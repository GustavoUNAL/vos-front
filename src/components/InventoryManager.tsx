import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createInventoryItem,
  deleteInventoryItem,
  fetchInventoryCategories,
  datetimeLocalValueToIsoUtcOrNull,
  fetchInventoryItem,
  fetchInventoryItems,
  displayPurchaseLotSupplier,
  fetchPurchaseLotsCodeIndex,
  formatPurchaseLotDate,
  formatSystemDateTime,
  inventoryLotDisplayLabel,
  inventoryResolvedPurchaseLot,
  isoInstantToDatetimeLocalValue,
  updateInventoryItem,
  type CategoryRef,
  type InventoryMovementStats,
  type InventoryRow,
  type PurchaseLotRow,
} from '../api'
import { useNavigation } from '../NavigationContext'
import { useMatchMedia } from '../hooks/useMatchMedia'
import { useEntityActionAnimation } from '../hooks/useEntityActionAnimation'
import {
  MobileAwareFilterBar,
  MOBILE_FILTER_BREAKPOINT,
} from './MobileAwareFilterBar'
import { ViewBootSplash } from './DataLoadingSplash'
import { FloatingGearFab, FloatingGearFabDockAdd } from './FloatingGearFab'
import { SectionSummaryDeck } from './SectionSummaryDeck'
import { type SectionSummaryItem } from './SectionSummaryBar'

const LIMIT = 18

function paginationDots(current: number, total: number): number[] {
  if (total <= 1) return []
  const out: number[] = []
  const start = Math.max(1, current - 2)
  const end = Math.min(total, current + 2)
  for (let p = start; p <= end; p++) out.push(p)
  if (!out.includes(1)) out.unshift(1)
  if (!out.includes(total)) out.push(total)
  return out
}

/** Prefijo técnico en nombres de categoría de inventario (no mostrar en UI). */
const INVENTORY_CATEGORY_NAME_PREFIX = 'INVENTORY::'

function inventoryCategoryLabel(name: string | null | undefined): string {
  if (name == null || name === '') return '—'
  if (name.startsWith(INVENTORY_CATEGORY_NAME_PREFIX)) {
    const rest = name.slice(INVENTORY_CATEGORY_NAME_PREFIX.length).trim()
    return rest !== '' ? rest : name
  }
  return name
}

type AvailabilityFilter = '' | 'available' | 'depleted'

function num(v: string | number | null | undefined): number {
  const n = parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

function formatCOP(value: string | number): string {
  const n = num(value)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n)
}

function isAvailable(qty: string | number | null | undefined): boolean {
  const q = num(qty)
  return Number.isFinite(q) && q > 0
}

function fmtStat(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}

/** Valor en celdas de movimiento: ausente → —; cero → 0; resto formateado. */
function fmtMovCell(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (n === 0) return '0'
  return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}

function MovementSummaryCell({ st }: { st?: InventoryMovementStats }) {
  if (!st) {
    return <span className="mov-summary mov-summary--na">—</span>
  }
  const items: {
    id: string
    lab: string
    tip: string
    v: number | undefined
  }[] = [
    { id: 'ent', lab: 'Ent', tip: 'Entradas (IN)', v: st.received },
    {
      id: 'sal',
      lab: 'Sal',
      tip: 'Salidas acumuladas (SALE + OUT)',
      v: st.consumedTotal,
    },
    { id: 'mer', lab: 'Mer', tip: 'Merma (WASTE)', v: st.waste },
    { id: 'aju', lab: 'Aju', tip: 'Ajuste (ADJUSTMENT)', v: st.adjustment },
  ]
  return (
    <div
      className="mov-summary"
      role="group"
      aria-label="Movimientos acumulados por tipo"
    >
      {items.map((x) => {
        const text = fmtMovCell(x.v)
        const emptyish = text === '—' || text === '0'
        return (
          <div
            key={x.id}
            className="mov-summary__item"
            title={`${x.tip}: ${text}`}
          >
            <span className="mov-summary__lab">{x.lab}</span>
            <span
              className={
                emptyish
                  ? 'mov-summary__val mov-summary__val--soft'
                  : 'mov-summary__val'
              }
            >
              {text}
            </span>
          </div>
        )
      })}
    </div>
  )
}

type Draft = {
  name: string
  categoryId: string
  quantity: string
  unit: string
  unitCost: string
  supplier: string
  lot: string
  minStock: string
  traceModifiedLocal: string
}

function emptyDraft(cats: CategoryRef[]): Draft {
  return {
    name: '',
    categoryId: cats[0]?.id ?? '',
    quantity: '0',
    unit: '',
    unitCost: '0',
    supplier: '',
    lot: '',
    minStock: '',
    traceModifiedLocal: '',
  }
}

function rowToDraft(r: InventoryRow): Draft {
  return {
    name: r.name,
    categoryId: r.categoryId,
    quantity: String(r.quantity),
    unit: r.unit,
    unitCost: String(r.unitCost),
    supplier: r.supplier ?? '',
    lot: r.lot ?? '',
    minStock: r.minStock != null ? String(r.minStock) : '',
    traceModifiedLocal: isoInstantToDatetimeLocalValue(r.traceModifiedAt),
  }
}

const INVENTORY_EDITOR_MOBILE_MQ = '(max-width: 959px)'

export function InventoryManager({ baseUrl }: { baseUrl: string }) {
  const { inventorySubtitle } = useNavigation()
  const isMobileFilters = useMatchMedia(MOBILE_FILTER_BREAKPOINT)
  const inventoryEditorMobile = useMatchMedia(INVENTORY_EDITOR_MOBILE_MQ)
  const { rowClass, panelClass, runPanelRemove, flashSaved } = useEntityActionAnimation()
  const [categories, setCategories] = useState<CategoryRef[]>([])
  const [catError, setCatError] = useState<string | null>(null)

  const [list, setList] = useState<InventoryRow[]>([])
  const [meta, setMeta] = useState<{
    page: number
    limit: number
    total: number
    hasNextPage: boolean
  } | null>(null)
  const [page, setPage] = useState(1)
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [filterAvailability, setFilterAvailability] =
    useState<AvailabilityFilter>('')
  const [showStats, setShowStats] = useState(false)
  const [lotFilter, setLotFilter] = useState('')
  const [lotFilterDebounced, setLotFilterDebounced] = useState('')
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  /** Fila con `includeStats` al editar (agregados de movimientos). */
  const [selectedRowFull, setSelectedRowFull] = useState<InventoryRow | null>(
    null,
  )

  const [lotByCode, setLotByCode] = useState<Map<string, PurchaseLotRow> | null>(
    null,
  )
  const [lotIndexError, setLotIndexError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // Diferir el mapa código->lote para priorizar el render inicial de inventario.
    const timer = window.setTimeout(() => {
      setLotIndexError(null)
      fetchPurchaseLotsCodeIndex(baseUrl)
        .then((m) => {
          if (!cancelled) {
            setLotByCode(m)
            setLotIndexError(null)
          }
        })
        .catch((e: Error) => {
          if (!cancelled) {
            setLotByCode(null)
            setLotIndexError(e.message)
          }
        })
    }, 1200)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [baseUrl])

  const refreshLotIndex = useCallback(() => {
    fetchPurchaseLotsCodeIndex(baseUrl)
      .then((m) => {
        setLotByCode(m)
        setLotIndexError(null)
      })
      .catch((e: Error) => {
        setLotIndexError(e.message)
      })
  }, [baseUrl])

  useEffect(() => {
    const t = window.setTimeout(() => setLotFilterDebounced(lotFilter), 320)
    return () => window.clearTimeout(t)
  }, [lotFilter])

  useEffect(() => {
    setPage(1)
  }, [filterCategoryId, filterAvailability, lotFilterDebounced])

  const inventoryListQuery = useMemo(
    () => ({
      categoryId: filterCategoryId || undefined,
      includeStats: showStats,
      availability:
        filterAvailability === 'available' || filterAvailability === 'depleted'
          ? filterAvailability
          : undefined,
      lot: lotFilterDebounced.trim() || undefined,
    }),
    [filterCategoryId, filterAvailability, lotFilterDebounced, showStats],
  )

  useEffect(() => {
    let cancelled = false
    fetchInventoryCategories(baseUrl)
      .then((c) => {
        if (!cancelled) {
          setCategories(c.sort((a, b) => a.name.localeCompare(b.name, 'es')))
          setCatError(null)
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setCatError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [baseUrl])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setListError(null)
    fetchInventoryItems(baseUrl, {
      page,
      limit: LIMIT,
      signal: controller.signal,
      ...inventoryListQuery,
    })
      .then((res) => {
        if (!controller.signal.aborted) {
          setList(res.data)
          setMeta(res.meta)
        }
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setListError(e.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => {
      controller.abort()
    }
  }, [baseUrl, page, inventoryListQuery])

  const openCreate = useCallback(() => {
    setCreating(true)
    setSelectedId(null)
    setSelectedRowFull(null)
    setDraft(emptyDraft(categories))
    setSaveError(null)
  }, [categories])

  const openEdit = useCallback(
    async (row: InventoryRow) => {
      setCreating(false)
      setSelectedId(row.id)
      setSaveError(null)
      setDraft(rowToDraft(row))
      setSelectedRowFull(null)
      try {
        const full = await fetchInventoryItem(baseUrl, row.id, {
          includeStats: true,
        })
        setDraft(rowToDraft(full))
        setSelectedRowFull(full)
      } catch {
        setSelectedRowFull(row)
      }
    },
    [baseUrl],
  )

  const closePanel = useCallback(() => {
    setSelectedId(null)
    setCreating(false)
    setDraft(null)
    setSelectedRowFull(null)
    setSaveError(null)
  }, [])

  const save = useCallback(async () => {
    if (!draft) return
    const quantity = parseFloat(draft.quantity.replace(',', '.'))
    const unitCost = parseFloat(draft.unitCost.replace(',', '.'))
    const minStockRaw = draft.minStock.trim()
    const minStock =
      minStockRaw === '' ? undefined : parseFloat(minStockRaw.replace(',', '.'))

    if (!draft.name.trim()) {
      setSaveError('El nombre es obligatorio.')
      return
    }
    if (!draft.categoryId) {
      setSaveError('Elige una categoría.')
      return
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      setSaveError('Cantidad inválida.')
      return
    }
    if (!draft.unit.trim()) {
      setSaveError('La unidad es obligatoria.')
      return
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      setSaveError('Costo unitario inválido.')
      return
    }
    if (
      minStockRaw !== '' &&
      (!Number.isFinite(minStock) || (minStock as number) < 0)
    ) {
      setSaveError('Stock mínimo inválido.')
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      if (creating) {
        await createInventoryItem(baseUrl, {
          name: draft.name.trim(),
          categoryId: draft.categoryId,
          quantity,
          unit: draft.unit.trim(),
          unitCost,
          supplier: draft.supplier.trim() || undefined,
          lot: draft.lot.trim() || undefined,
          minStock,
        })
      } else if (selectedId) {
        await updateInventoryItem(baseUrl, selectedId, {
          name: draft.name.trim(),
          categoryId: draft.categoryId,
          quantity,
          unit: draft.unit.trim(),
          unitCost,
          supplier: draft.supplier.trim() || undefined,
          lot: draft.lot.trim() || undefined,
          minStock,
          traceModifiedAt: datetimeLocalValueToIsoUtcOrNull(
            draft.traceModifiedLocal,
          ),
        })
      }
      closePanel()
      setPage(1)
      const res = await fetchInventoryItems(baseUrl, {
        page: 1,
        limit: LIMIT,
        ...inventoryListQuery,
      })
      setList(res.data)
      setMeta(res.meta)
      refreshLotIndex()
      if (selectedId) flashSaved(selectedId)
    } catch (e) {
      setSaveError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }, [
    baseUrl,
    closePanel,
    creating,
    draft,
    inventoryListQuery,
    refreshLotIndex,
    selectedId,
  ])

  const remove = useCallback(async () => {
    if (!selectedId) return
    if (
      !window.confirm(
        '¿Archivar este ítem de inventario? No podrá usarse en recetas nuevas.',
      )
    )
      return
    setSaving(true)
    setSaveError(null)
    try {
      await runPanelRemove(async () => {
        await deleteInventoryItem(baseUrl, selectedId)
      })
      closePanel()
      const res = await fetchInventoryItems(baseUrl, {
        page,
        limit: LIMIT,
        ...inventoryListQuery,
      })
      setList(res.data)
      setMeta(res.meta)
    } catch (e) {
      setSaveError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }, [baseUrl, closePanel, flashSaved, inventoryListQuery, page, runPanelRemove, selectedId])

  const panelOpen = creating || selectedId !== null

  useEffect(() => {
    if (!panelOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [closePanel, panelOpen])

  useEffect(() => {
    if (!panelOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [panelOpen])

  const totalPages =
    meta && meta.limit > 0 ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1
  const pageDots = paginationDots(page, totalPages)

  const draftMatchedLot = useMemo(() => {
    if (!draft) return undefined
    const code = draft.lot.trim()
    if (!code) return undefined
    if (
      !creating &&
      selectedRowFull?.purchaseLot &&
      selectedRowFull.purchaseLot.code?.trim() === code
    ) {
      return selectedRowFull.purchaseLot
    }
    if (lotByCode) return lotByCode.get(code)
    return undefined
  }, [creating, draft, lotByCode, selectedRowFull])

  const lowStockIds = useMemo(() => {
    const s = new Set<string>()
    for (const r of list) {
      if (r.stats?.belowMinimum === true) {
        s.add(r.id)
        continue
      }
      if (r.stats?.belowMinimum === false) continue
      const q = num(r.quantity)
      const m = num(r.minStock)
      if (Number.isFinite(q) && Number.isFinite(m) && q <= m) s.add(r.id)
    }
    return s
  }, [list])

  const inventorySummaryItems = useMemo((): SectionSummaryItem[] => {
    let available = 0
    let consumed = 0
    let low = 0
    for (const r of list) {
      if (isAvailable(r.quantity)) available++
      else consumed++
      if (lowStockIds.has(r.id)) low++
    }
    const items: SectionSummaryItem[] = []
    if (meta != null) {
      items.push({
        label: 'Coinciden',
        value: meta.total,
        title: 'Ítems que cumplen búsqueda y categoría',
      })
    }
    items.push(
      {
        label: 'Página',
        value: list.length,
        title: 'Filas en esta página',
      },
      {
        label: 'Disponible',
        value: available,
        title: 'Cantidad mayor que 0 en esta página',
      },
      {
        label: 'Consumido',
        value: consumed,
        title: 'Cantidad 0 en esta página',
      },
      {
        label: 'Bajo mín.',
        value: low,
        title: 'Alerta de stock mínimo en esta página',
      },
    )
    return items
  }, [list, lowStockIds, meta])

  const inventoryFiltersActive = useMemo(
    () =>
      filterCategoryId !== '' ||
      lotFilter.trim() !== '' ||
      filterAvailability !== '' ||
      showStats,
    [filterCategoryId, lotFilter, filterAvailability, showStats],
  )

  const lotFilterInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="products-layout">
      <div className="products-list-pane page-pane--floating-gear-dock">
        <div className="page-intro">
          <h2 className="page-title">Productos</h2>
          {inventorySubtitle ? (
            <p className="muted page-subtitle">{inventorySubtitle}</p>
          ) : null}
        </div>

        <MobileAwareFilterBar
          hasActiveFilters={inventoryFiltersActive}
          trailing={
            isMobileFilters ? (
              <div className="mobile-list-toolbar__actions">
                <SectionSummaryDeck
                  section="inventory"
                  items={inventorySummaryItems}
                  loading={loading}
                />
                <FloatingGearFabDockAdd
                  title="Nuevo ítem"
                  ariaLabel="Nuevo ítem"
                  onClick={openCreate}
                />
              </div>
            ) : undefined
          }
        >
        <div className="inventory-filter-bar">
          <div className="inventory-filter-bar__controls" role="search">
            <label className="inventory-filter">
              <span className="inventory-filter__label">Categoría</span>
              <select
                className="inventory-filter__input"
                value={filterCategoryId}
                onChange={(e) => setFilterCategoryId(e.target.value)}
                aria-label="Filtrar por categoría"
              >
                <option value="">Todas</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id} title={c.name}>
                    {inventoryCategoryLabel(c.name)}
                  </option>
                ))}
              </select>
            </label>
            <label className="inventory-filter">
              <span className="inventory-filter__label">Lote</span>
              <input
                ref={lotFilterInputRef}
                className="inventory-filter__input"
                type="search"
                placeholder="Código…"
                value={lotFilter}
                onChange={(e) => setLotFilter(e.target.value)}
                aria-label="Filtrar por código de lote"
              />
            </label>
            <label className="inventory-filter">
              <span className="inventory-filter__label">Estado</span>
              <select
                className="inventory-filter__input"
                value={filterAvailability}
                onChange={(e) =>
                  setFilterAvailability(e.target.value as AvailabilityFilter)
                }
                aria-label="Filtrar por estado de stock"
              >
                <option value="">Todos</option>
                <option value="available">Disponible</option>
                <option value="depleted">Consumido</option>
              </select>
            </label>
            <label className="inventory-filter">
              <span className="inventory-filter__label">Métricas</span>
              <select
                className="inventory-filter__input"
                value={showStats ? 'on' : 'off'}
                onChange={(e) => setShowStats(e.target.value === 'on')}
                aria-label="Cargar estadísticas de movimientos"
              >
                <option value="off">Ligero</option>
                <option value="on">Completo</option>
              </select>
            </label>
          </div>
          <div className="inventory-filter-bar__actions">
            <button
              type="button"
              className="btn-secondary btn-compact"
              onClick={() => {
                setFilterCategoryId('')
                setFilterAvailability('')
                setLotFilter('')
              }}
            >
              Limpiar
            </button>
            <button
              type="button"
              className="btn-primary"
              data-mobile-filter-primary="inside"
              onClick={openCreate}
            >
              Nuevo ítem
            </button>
          </div>
        </div>
        </MobileAwareFilterBar>

        {!isMobileFilters && (
          <FloatingGearFab
            navAriaLabel="Productos"
            menuToggleTitleClosed="Configuración del listado"
            menuToggleTitleOpen="Cerrar menú"
            ariaLabelMenuClosed="Abrir menú: buscar, filtros y nuevo ítem"
            ariaLabelMenuOpen="Cerrar menú de inventario"
            filterToggle={
              <button
                type="button"
                className="btn-catalog-dock-tool btn-catalog-dock-tool--search"
                onClick={() => lotFilterInputRef.current?.focus()}
                aria-label="Buscar por código de lote"
                title="Buscar por lote"
              >
                <span className="icon-mobile-search" aria-hidden />
              </button>
            }
          >
            <FloatingGearFabDockAdd
              title="Nuevo ítem"
              ariaLabel="Nuevo ítem"
              onClick={openCreate}
            />
            <SectionSummaryDeck
              section="inventory"
              items={inventorySummaryItems}
              loading={loading}
            />
          </FloatingGearFab>
        )}

        {catError && (
          <p className="banner-warn" role="status">
            Categorías: {catError}
          </p>
        )}
        {lotIndexError && (
          <p className="banner-warn" role="status">
            Respaldo de lotes (mapa código → compra): no se cargó ({lotIndexError}
            ). Si el API ya envía <code className="mono">purchaseLot</code> en
            cada ítem, la vista sigue funcionando; si no, recarga la página.
          </p>
        )}
        {listError && (
          <p className="error" role="alert">
            {listError}
          </p>
        )}
        {loading && <p className="muted">Cargando inventario…</p>}

        {!loading && list.length > 0 && (
          <div className="data-table-wrap data-table-elevated inventory-table-wrap">
            <table className="data-table data-table-striped">
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th>Categoría</th>
                  <th>Lote</th>
                  <th>Fecha compra</th>
                  <th>Compra en</th>
                  <th className="num">Cantidad</th>
                  <th>Unidad</th>
                  <th className="num">Costo u.</th>
                  <th className="num">Mín.</th>
                  <th className="inventory-th-mov">Movimientos</th>
                  <th>Estado</th>
                  <th aria-label="Alertas" />
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const low = lowStockIds.has(r.id)
                  const available = isAvailable(r.quantity)
                  const lotCode = r.lot?.trim() ?? ''
                  const pl = inventoryResolvedPurchaseLot(r, lotByCode)
                  const lotTitle = inventoryLotDisplayLabel(r)
                  const whereBought =
                    (pl ? displayPurchaseLotSupplier(pl) : '') ||
                    r.supplier?.trim() ||
                    ''
                  return (
                    <tr
                      key={r.id}
                      className={rowClass(
                        r.id,
                        selectedId === r.id
                          ? 'row-active'
                          : low
                            ? 'row-warn'
                            : '',
                      )}
                    >
                      <td>
                        <button
                          type="button"
                          className="table-link"
                          onClick={() => void openEdit(r)}
                        >
                          {r.name}
                        </button>
                      </td>
                      <td className="muted" title={r.category?.name}>
                        {inventoryCategoryLabel(r.category?.name)}
                      </td>
                      <td>
                        {lotCode ? (
                          <a
                            className="table-link inventory-table-lot-cell"
                            href="#/purchases"
                            title={`Abrir Compras (${lotCode})`}
                          >
                            <span className="inventory-table-lot-cell__name">
                              {lotTitle ?? lotCode}
                            </span>
                            {lotTitle && lotTitle !== lotCode ? (
                              <span className="inventory-table-lot-cell__code muted small mono">
                                {lotCode}
                              </span>
                            ) : null}
                          </a>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="muted">
                        {pl
                          ? formatPurchaseLotDate(pl.purchaseDate, 'short')
                          : '—'}
                      </td>
                      <td className="muted">
                        {whereBought || '—'}
                      </td>
                      <td className="num mono">{String(r.quantity)}</td>
                      <td>{r.unit}</td>
                      <td className="num mono">{formatCOP(r.unitCost)}</td>
                      <td className="num mono">
                        {r.minStock != null ? String(r.minStock) : '—'}
                      </td>
                      <td className="inventory-td-mov">
                        <MovementSummaryCell st={r.stats?.movements} />
                      </td>
                      <td>
                        {available ? (
                          <span className="badge badge-ok">Disponible</span>
                        ) : (
                          <span className="badge badge-muted">Consumido</span>
                        )}
                      </td>
                      <td>
                        {low && (
                          <span className="badge badge-warn">Bajo mín.</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.total > 0 && (
          <div className="pagination-bar">
            <span className="muted">
              {meta.total} ítem{meta.total !== 1 ? 's' : ''}
            </span>
            {pageDots.length > 1 && (
              <div className="pager-dots" aria-hidden>
                {pageDots.map((p) => (
                  <span
                    key={p}
                    className={`pager-dot${p === page ? ' is-active' : ''}`}
                  />
                ))}
              </div>
            )}
            <div className="pager">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={!meta.hasNextPage || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}

        {!loading && list.length === 0 && !listError && (
          <p className="empty-hint">No hay ítems. Crea uno o ajusta la búsqueda.</p>
        )}
      </div>

      {panelOpen && draft && (
        <>
          {inventoryEditorMobile && (
            <div
              className="editor-panel-backdrop"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closePanel()
              }}
            />
          )}
          <aside
            className={panelClass(
              inventoryEditorMobile
                ? 'editor-panel editor-panel--modal-mobile'
                : 'editor-panel',
            )}
            aria-label="Editor de inventario"
          >
          <div className="editor-panel-head">
            <h2>{creating ? 'Nuevo ítem' : 'Editar inventario'}</h2>
            <button
              type="button"
              className="btn-ghost icon-close"
              onClick={closePanel}
              aria-label="Cerrar"
            />
          </div>

          <div className="editor-panel-body">
            <label className="field">
              <span>Nombre</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>

            <label className="field">
              <span>Categoría</span>
              <select
                value={draft.categoryId}
                onChange={(e) =>
                  setDraft({ ...draft, categoryId: e.target.value })
                }
              >
                {categories.length === 0 && (
                  <option value="">— Sin categorías —</option>
                )}
                {categories.map((c) => (
                  <option key={c.id} value={c.id} title={c.name}>
                    {inventoryCategoryLabel(c.name)}
                  </option>
                ))}
              </select>
            </label>

            <div className="field-row-2">
              <label className="field">
                <span>Cantidad en stock</span>
                <input
                  inputMode="decimal"
                  value={draft.quantity}
                  onChange={(e) =>
                    setDraft({ ...draft, quantity: e.target.value })
                  }
                />
              </label>
              <label className="field">
                <span>Unidad</span>
                <input
                  value={draft.unit}
                  onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                  placeholder="kg, L, unidad…"
                />
              </label>
            </div>

            <label className="field">
              <span>Costo unitario (COP)</span>
              <input
                inputMode="decimal"
                value={draft.unitCost}
                onChange={(e) =>
                  setDraft({ ...draft, unitCost: e.target.value })
                }
              />
            </label>

            <label className="field">
              <span>Proveedor / notas</span>
              <input
                value={draft.supplier}
                onChange={(e) =>
                  setDraft({ ...draft, supplier: e.target.value })
                }
              />
            </label>

            <label className="field">
              <span>Lote (código)</span>
              <input
                value={draft.lot}
                onChange={(e) => setDraft({ ...draft, lot: e.target.value })}
              />
            </label>

            {!creating && draft.lot.trim() && draftMatchedLot && (
              <div className="panel-lot-meta muted">
                <div>
                  <strong>Fecha de compra (lote):</strong>{' '}
                  {formatPurchaseLotDate(draftMatchedLot.purchaseDate, 'short')}
                </div>
                <div>
                  <strong>Compra en (lote):</strong>{' '}
                  {displayPurchaseLotSupplier(draftMatchedLot) || '—'}
                </div>
              </div>
            )}
            {!creating &&
              draft.lot.trim() &&
              lotByCode &&
              !draftMatchedLot && (
                <p className="muted panel-lot-meta">
                  No hay compra con ese código en los datos cargados. Al guardar,
                  el backend puede crear un registro mínimo de lote si hace falta
                  para enlazar el inventario.
                </p>
              )}

            <label className="field">
              <span>Stock mínimo (alerta)</span>
              <input
                inputMode="decimal"
                value={draft.minStock}
                onChange={(e) =>
                  setDraft({ ...draft, minStock: e.target.value })
                }
                placeholder="Opcional"
              />
            </label>

            {!creating ? (
              <>
                <div className="field">
                  <span>Último cambio en sistema (solo lectura)</span>
                  <p className="mono muted small">
                    {formatSystemDateTime(selectedRowFull?.updatedAt)}
                  </p>
                </div>
                <label className="field">
                  <span>Revisión / trazabilidad</span>
                  <input
                    type="datetime-local"
                    value={draft.traceModifiedLocal}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        traceModifiedLocal: e.target.value,
                      })
                    }
                  />
                  <p className="muted small">
                    Se guarda al pulsar Guardar; vacío envía{' '}
                    <span className="mono">traceModifiedAt: null</span>.
                  </p>
                </label>
                <div className="field">
                  <button
                    type="button"
                    className="btn-secondary btn-compact"
                    disabled={saving}
                    onClick={() => {
                      void (async () => {
                        if (!selectedId) return
                        setSaving(true)
                        setSaveError(null)
                        try {
                          const updated = await updateInventoryItem(
                            baseUrl,
                            selectedId,
                            { traceModifiedAt: null },
                          )
                          setSelectedRowFull(updated)
                          setDraft((d) =>
                            d ? { ...d, traceModifiedLocal: '' } : d,
                          )
                          const res = await fetchInventoryItems(baseUrl, {
                            page,
                            limit: LIMIT,
                            ...inventoryListQuery,
                          })
                          setList(res.data)
                          setMeta(res.meta)
                          refreshLotIndex()
                        } catch (e) {
                          setSaveError((e as Error).message)
                        } finally {
                          setSaving(false)
                        }
                      })()
                    }}
                  >
                    Quitar marca de revisión
                  </button>
                </div>
              </>
            ) : null}

            {!creating && selectedRowFull?.stats?.movements && (
              <div className="panel-stats-block" aria-label="Resumen de movimientos">
                <p className="panel-stats-block__title">Movimientos (acumulado)</p>
                <dl className="panel-stats-dl">
                  <dt>Entradas (IN)</dt>
                  <dd className="mono">{fmtStat(selectedRowFull.stats.movements.received)}</dd>
                  <dt>Venta / receta (SALE)</dt>
                  <dd className="mono">
                    {fmtStat(selectedRowFull.stats.movements.consumedViaSales)}
                  </dd>
                  <dt>Otras salidas (OUT)</dt>
                  <dd className="mono">
                    {fmtStat(selectedRowFull.stats.movements.consumedViaOut)}
                  </dd>
                  <dt>Salidas (Σ)</dt>
                  <dd className="mono">
                    {fmtStat(selectedRowFull.stats.movements.consumedTotal)}
                  </dd>
                  <dt>Mermas (WASTE)</dt>
                  <dd className="mono">{fmtStat(selectedRowFull.stats.movements.waste)}</dd>
                  <dt>Ajustes (ADJUSTMENT)</dt>
                  <dd className="mono">
                    {fmtStat(selectedRowFull.stats.movements.adjustment)}
                  </dd>
                </dl>
                <p className="muted small panel-stats-foot">
                  Detalle de líneas: endpoint de movimientos según contrato del API.
                </p>
              </div>
            )}

            {saveError && (
              <p className="error" role="alert">
                {saveError}
              </p>
            )}

            <div className="editor-actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={saving}
                onClick={closePanel}
              >
                Cancelar
              </button>
              {!creating && (
                <button
                  type="button"
                  className="btn-danger"
                  disabled={saving}
                  onClick={() => void remove()}
                >
                  Archivar
                </button>
              )}
              <button
                type="button"
                className="btn-primary"
                disabled={saving || categories.length === 0}
                onClick={() => void save()}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </aside>
        </>
      )}

      <ViewBootSplash ready={!loading} label="Cargando inventario…" />
    </div>
  )
}
