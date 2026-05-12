import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createSale,
  fetchProducts,
  fetchSale,
  fetchSales,
  formatPurchaseLotDate,
  patchSale,
  replaceSaleLines,
  type ProductRow,
  saleListRowLineCount,
  saleRowTotalNumeric,
  type SaleDetail,
  type SaleLineDetail,
  type SaleListRow,
} from '../api'
import { useMatchMedia } from '../hooks/useMatchMedia'
import {
  MobileAwareFilterBar,
  MOBILE_FILTER_BREAKPOINT,
} from './MobileAwareFilterBar'
import { FloatingGearFab, FloatingGearFabDockAdd } from './FloatingGearFab'
import { SectionSummaryDeck } from './SectionSummaryDeck'
import { type SectionSummaryItem } from './SectionSummaryBar'

const LIMIT = 15
const SALE_SOURCES = ['MANUAL', 'CART', 'AI'] as const

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

function newLineKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function num(v: string | number): number {
  const n = parseFloat(String(v).replace(',', '.'))
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

function formatSaleDateLong(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(d)
}

function formatSaleDateList(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: iso, time: '' }
  return {
    date: new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(d),
    time: new Intl.DateTimeFormat('es-CO', { timeStyle: 'short' }).format(d),
  }
}

function timeOnlyFromSaleDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('es-CO', { timeStyle: 'short' }).format(d)
}

/** Fecha de columna: `saleDateOnly` (sin desfase TZ) + hora desde `saleDate`. */
function saleListRowDateParts(row: SaleListRow): { date: string; time: string } {
  if (row.saleDateOnly?.trim()) {
    return {
      date: formatPurchaseLotDate(row.saleDateOnly, 'medium'),
      time: timeOnlyFromSaleDate(row.saleDate),
    }
  }
  return formatSaleDateList(row.saleDate)
}

function truncateText(s: string | null | undefined, max: number): string {
  const t = (s ?? '').trim()
  if (!t) return '—'
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function shortSaleId(id: string): string {
  if (id.length <= 10) return id
  return `${id.slice(0, 8)}…`
}

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type LineDraft = {
  key: string
  /** Id de línea en el servidor (para costo/margen de solo lectura). */
  lineId?: string
  productId: string
  productName: string
  quantity: string
  unitPrice: string
}

function linesFromDetail(lines: SaleLineDetail[]): LineDraft[] {
  return lines.map((l) => ({
    key: newLineKey(),
    lineId: l.id,
    productId: l.productId ?? '',
    productName: l.productName,
    quantity: String(l.quantity),
    unitPrice: String(l.unitPrice ?? l.unit_price ?? ''),
  }))
}

function emptyLine(): LineDraft {
  return {
    key: newLineKey(),
    productId: '',
    productName: '',
    quantity: '1',
    unitPrice: '0',
  }
}

type HeaderDraft = {
  saleDateLocal: string
  paymentMethod: string
  mesa: string
  notes: string
  source: string
}

function headerFromSale(s: SaleDetail): HeaderDraft {
  return {
    saleDateLocal: toDatetimeLocalValue(s.saleDate),
    paymentMethod: s.paymentMethod ?? '',
    mesa: s.mesa ?? '',
    notes: s.notes ?? '',
    source: s.source,
  }
}

export function SalesManager({ baseUrl }: { baseUrl: string }) {
  const isMobileFilters = useMatchMedia(MOBILE_FILTER_BREAKPOINT)
  const salesSearchInputRef = useRef<HTMLInputElement>(null)
  const [list, setList] = useState<SaleListRow[]>([])
  const [meta, setMeta] = useState<{
    page: number
    limit: number
    total: number
    hasNextPage: boolean
  } | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [detail, setDetail] = useState<SaleDetail | null>(null)
  const [header, setHeader] = useState<HeaderDraft | null>(null)
  const [lineRows, setLineRows] = useState<LineDraft[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [saveHeaderError, setSaveHeaderError] = useState<string | null>(null)
  const [saveLinesError, setSaveLinesError] = useState<string | null>(null)
  const [savingHeader, setSavingHeader] = useState(false)
  const [savingLines, setSavingLines] = useState(false)

  const [productSearch, setProductSearch] = useState('')
  const [productHits, setProductHits] = useState<ProductRow[]>([])

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search), 320)
    return () => window.clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [searchDebounced, filterSource, filterDateFrom, filterDateTo])

  const salesListQuery = useMemo(
    () => ({
      search: searchDebounced.trim() || undefined,
      source: filterSource || undefined,
      dateFrom: filterDateFrom || undefined,
      dateTo: filterDateTo || undefined,
    }),
    [searchDebounced, filterSource, filterDateFrom, filterDateTo],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setListError(null)
    fetchSales(baseUrl, { page, limit: LIMIT, ...salesListQuery })
      .then((res) => {
        if (!cancelled) {
          setList(res.data)
          setMeta(res.meta)
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setListError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [baseUrl, page, salesListQuery])

  useEffect(() => {
    if (!selectedId && !creating) return
    let cancelled = false
    const t = window.setTimeout(() => {
      fetchProducts(baseUrl, {
        page: 1,
        limit: 80,
        search: productSearch,
      })
        .then((r) => {
          if (!cancelled) setProductHits(r.data)
        })
        .catch(() => {
          if (!cancelled) setProductHits([])
        })
    }, 280)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [baseUrl, selectedId, creating, productSearch])

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true)
      setDetailError(null)
      setSaveHeaderError(null)
      setSaveLinesError(null)
      try {
        const s = await fetchSale(baseUrl, id)
        setDetail(s)
        setHeader(headerFromSale(s))
        setLineRows(linesFromDetail(s.lines ?? []))
      } catch (e) {
        setDetailError((e as Error).message)
        setDetail(null)
        setHeader(null)
        setLineRows([])
      } finally {
        setDetailLoading(false)
      }
    },
    [baseUrl],
  )

  const openSale = useCallback(
    (id: string) => {
      setCreating(false)
      setSelectedId(id)
      setProductSearch('')
      void loadDetail(id)
    },
    [loadDetail],
  )

  const openCreate = useCallback(() => {
    setCreating(true)
    setSelectedId(null)
    setDetail(null)
    setDetailError(null)
    setSaveHeaderError(null)
    setSaveLinesError(null)
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
    setHeader({
      saleDateLocal: local,
      paymentMethod: '',
      mesa: '',
      notes: '',
      source: 'MANUAL',
    })
    setLineRows([emptyLine()])
    setProductSearch('')
  }, [])

  const closePanel = useCallback(() => {
    setSelectedId(null)
    setCreating(false)
    setDetail(null)
    setHeader(null)
    setLineRows([])
    setDetailError(null)
    setSaveHeaderError(null)
    setSaveLinesError(null)
  }, [])

  const saveNewSale = useCallback(async () => {
    if (!header) return
    const d = new Date(header.saleDateLocal)
    if (Number.isNaN(d.getTime())) {
      setSaveLinesError('Fecha u hora inválida.')
      return
    }
    const payloadLines = []
    for (const r of lineRows) {
      if (!r.productName.trim()) {
        setSaveLinesError('Cada línea necesita nombre de producto.')
        return
      }
      const q = num(r.quantity)
      const p = num(r.unitPrice)
      if (!Number.isFinite(q) || q <= 0) {
        setSaveLinesError('Cantidades inválidas.')
        return
      }
      if (!Number.isFinite(p) || p < 0) {
        setSaveLinesError('Precios inválidos.')
        return
      }
      payloadLines.push({
        productId: r.productId.trim() || undefined,
        productName: r.productName.trim(),
        quantity: q,
        unitPrice: p,
      })
    }
    if (!payloadLines.length) {
      setSaveLinesError('Añade al menos una línea.')
      return
    }

    setSavingLines(true)
    setSaveLinesError(null)
    try {
      const created = await createSale(baseUrl, {
        saleDate: d.toISOString(),
        paymentMethod: header.paymentMethod.trim() || undefined,
        source: header.source,
        mesa: header.mesa.trim() || undefined,
        notes: header.notes.trim() || undefined,
        lines: payloadLines,
      })
      setPage(1)
      const res = await fetchSales(baseUrl, {
        page: 1,
        limit: LIMIT,
        ...salesListQuery,
      })
      setList(res.data)
      setMeta(res.meta)
      openSale(created.id)
    } catch (e) {
      setSaveLinesError((e as Error).message)
    } finally {
      setSavingLines(false)
    }
  }, [baseUrl, header, lineRows, openSale, salesListQuery])

  const saveHeader = useCallback(async () => {
    if (!selectedId || !header) return
    const d = new Date(header.saleDateLocal)
    if (Number.isNaN(d.getTime())) {
      setSaveHeaderError('Fecha u hora inválida.')
      return
    }
    setSavingHeader(true)
    setSaveHeaderError(null)
    try {
      const updated = await patchSale(baseUrl, selectedId, {
        saleDate: d.toISOString(),
        paymentMethod: header.paymentMethod.trim() || undefined,
        source: header.source,
        mesa: header.mesa.trim() || undefined,
        notes: header.notes.trim() || undefined,
      })
      setDetail(updated)
      setHeader(headerFromSale(updated))
      const res = await fetchSales(baseUrl, {
        page,
        limit: LIMIT,
        ...salesListQuery,
      })
      setList(res.data)
      setMeta(res.meta)
    } catch (e) {
      setSaveHeaderError((e as Error).message)
    } finally {
      setSavingHeader(false)
    }
  }, [baseUrl, header, page, salesListQuery, selectedId])

  const saveLines = useCallback(async () => {
    if (!selectedId) return
    const payloadLines = []
    for (const r of lineRows) {
      if (!r.productName.trim()) {
        setSaveLinesError('Cada línea necesita nombre de producto.')
        return
      }
      const q = num(r.quantity)
      const p = num(r.unitPrice)
      if (!Number.isFinite(q) || q <= 0) {
        setSaveLinesError('Cantidades inválidas.')
        return
      }
      if (!Number.isFinite(p) || p < 0) {
        setSaveLinesError('Precios inválidos.')
        return
      }
      payloadLines.push({
        productId: r.productId.trim() || undefined,
        productName: r.productName.trim(),
        quantity: q,
        unitPrice: p,
      })
    }
    if (!payloadLines.length) {
      setSaveLinesError('Debe haber al menos una línea.')
      return
    }

    setSavingLines(true)
    setSaveLinesError(null)
    try {
      const updated = await replaceSaleLines(baseUrl, selectedId, payloadLines)
      setDetail(updated)
      setHeader(headerFromSale(updated))
      setLineRows(linesFromDetail(updated.lines ?? []))
      const res = await fetchSales(baseUrl, {
        page,
        limit: LIMIT,
        ...salesListQuery,
      })
      setList(res.data)
      setMeta(res.meta)
    } catch (e) {
      setSaveLinesError((e as Error).message)
    } finally {
      setSavingLines(false)
    }
  }, [baseUrl, lineRows, page, salesListQuery, selectedId])

  const updateLine = useCallback(
    (key: string, patch: Partial<LineDraft>) => {
      setLineRows((rows) =>
        rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
      )
    },
    [],
  )

  const addLine = useCallback(() => {
    setLineRows((rows) => [...rows, emptyLine()])
  }, [])

  const removeLine = useCallback((key: string) => {
    setLineRows((rows) => rows.filter((r) => r.key !== key))
  }, [])

  const panelOpen = creating || selectedId !== null
  const linesSubtotal = lineRows.reduce((s, r) => {
    const q = num(r.quantity)
    const p = num(r.unitPrice)
    if (!Number.isFinite(q) || !Number.isFinite(p)) return s
    return s + q * p
  }, 0)

  const salesSummaryItems = useMemo((): SectionSummaryItem[] => {
    let pageTotal = 0
    let lineRowsCount = 0
    for (const row of list) {
      const t = saleRowTotalNumeric(row)
      if (t != null) pageTotal += t
      lineRowsCount += saleListRowLineCount(row)
    }
    const items: SectionSummaryItem[] = []
    if (meta != null) {
      items.push({
        label: 'Ventas',
        value: meta.total,
        title: 'Total de registros',
      })
    }
    items.push(
      {
        label: 'En página',
        value: list.length,
        title: 'Filas en esta página',
      },
      {
        label: 'Total pág.',
        value: formatCOP(pageTotal),
        title: 'Suma de totales de ventas en esta página',
      },
      {
        label: 'Líneas pág.',
        value: lineRowsCount,
        title: 'Suma de líneas de ticket en esta página',
      },
    )
    return items
  }, [list, meta])
  const totalPages =
    meta && meta.limit > 0 ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1
  const pageDots = paginationDots(page, totalPages)

  const salesFiltersActive = useMemo(
    () =>
      search.trim() !== '' ||
      filterSource !== '' ||
      filterDateFrom !== '' ||
      filterDateTo !== '',
    [search, filterSource, filterDateFrom, filterDateTo],
  )

  return (
    <div className="products-layout">
      <div className="products-list-pane page-pane--floating-gear-dock">
        <div className="page-intro page-intro--tight">
          <h2 className="page-title">Ventas</h2>
          <p className="muted page-subtitle">
            Tickets y totales por página; filtrá por fecha, origen o texto. Cinco tipos
            de producto en menú alineados con recetas y catálogo.
          </p>
        </div>

        <MobileAwareFilterBar
          hasActiveFilters={salesFiltersActive}
          composeMobileToolbar={
            isMobileFilters
              ? ({ filterToggle }) => (
                  <FloatingGearFab
                    navAriaLabel="Ventas"
                    menuToggleTitleClosed="Configuración del listado"
                    menuToggleTitleOpen="Cerrar menú"
                    ariaLabelMenuClosed="Abrir menú: buscar, filtros y nueva venta"
                    ariaLabelMenuOpen="Cerrar menú de ventas"
                    filterToggle={filterToggle}
                  >
                    <FloatingGearFabDockAdd
                      title="Nueva venta"
                      ariaLabel="Nueva venta"
                      onClick={openCreate}
                    />
                    <SectionSummaryDeck
                      section="sales"
                      items={salesSummaryItems}
                      loading={loading}
                      suspendDetailWhileLoading
                    />
                  </FloatingGearFab>
                )
              : undefined
          }
        >
        <div className="inventory-filter-bar app-toolbar-zone">
          <div className="inventory-filter-bar__controls" role="search">
            <label className="inventory-filter">
              <span className="inventory-filter__label">Buscar</span>
              <input
                ref={salesSearchInputRef}
                className="inventory-filter__input"
                type="search"
                placeholder="Producto, mesa, pago, notas…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar ventas"
              />
            </label>
            <label className="inventory-filter">
              <span className="inventory-filter__label">Origen</span>
              <select
                className="inventory-filter__input"
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
              >
                <option value="">Todos</option>
                {SALE_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="inventory-filter">
              <span className="inventory-filter__label">Desde</span>
              <input
                className="inventory-filter__input"
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
              />
            </label>
            <label className="inventory-filter">
              <span className="inventory-filter__label">Hasta</span>
              <input
                className="inventory-filter__input"
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
              />
            </label>
          </div>
          <div className="inventory-filter-bar__actions">
            <button
              type="button"
              className="btn-secondary btn-compact"
              onClick={() => {
                setSearch('')
                setFilterSource('')
                setFilterDateFrom('')
                setFilterDateTo('')
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
              Nueva venta
            </button>
          </div>
        </div>
        </MobileAwareFilterBar>

        {!isMobileFilters && (
          <FloatingGearFab
            navAriaLabel="Ventas"
            menuToggleTitleClosed="Configuración del listado"
            menuToggleTitleOpen="Cerrar menú"
            ariaLabelMenuClosed="Abrir menú: buscar y ver resumen"
            ariaLabelMenuOpen="Cerrar menú de ventas"
            filterToggle={
              <button
                type="button"
                className="btn-catalog-dock-tool btn-catalog-dock-tool--search"
                onClick={() => salesSearchInputRef.current?.focus()}
                aria-label="Buscar ventas"
                title="Buscar ventas"
              >
                <span className="icon-mobile-search" aria-hidden />
              </button>
            }
          >
            <FloatingGearFabDockAdd
              title="Nueva venta"
              ariaLabel="Nueva venta"
              onClick={openCreate}
            />
            <SectionSummaryDeck
              section="sales"
              items={salesSummaryItems}
              loading={loading}
              suspendDetailWhileLoading
            />
          </FloatingGearFab>
        )}

        {listError && (
          <p className="error" role="alert">
            {listError}
          </p>
        )}
        {loading && <p className="muted">Cargando ventas…</p>}

        {!loading && list.length > 0 && (
          <div className="data-table-wrap data-table-elevated">
            <table className="data-table data-table-striped">
              <thead>
                <tr>
                  <th>Ref.</th>
                  <th>Fecha de venta</th>
                  <th>Persona</th>
                  <th className="num">Total</th>
                  <th className="num">Líneas</th>
                  <th>Origen</th>
                  <th>Pago</th>
                  <th>Mesa</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr
                    key={row.id}
                    className={selectedId === row.id ? 'row-active' : ''}
                  >
                    <td className="mono muted" title={row.id}>
                      {shortSaleId(row.id)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="table-link sale-list-datetime"
                        onClick={() => openSale(row.id)}
                      >
                        {(() => {
                          const { date, time } = saleListRowDateParts(row)
                          return (
                            <>
                              <span className="sale-list-date">{date}</span>
                              {time && (
                                <span className="sale-list-time muted">
                                  {time}
                                </span>
                              )}
                            </>
                          )
                        })()}
                      </button>
                    </td>
                    <td className="muted sale-person-cell" title={row.displayPerson ?? undefined}>
                      {row.displayPerson?.trim() || '—'}
                    </td>
                    <td className="num mono">
                      {formatCOP(saleRowTotalNumeric(row) ?? Number.NaN)}
                    </td>
                    <td className="num">{saleListRowLineCount(row)}</td>
                    <td>
                      <span className="pill">{row.source}</span>
                    </td>
                    <td className="muted">{row.paymentMethod ?? '—'}</td>
                    <td className="muted">{row.mesa ?? '—'}</td>
                    <td
                      className="muted sale-notes-cell"
                      title={(row.notes ?? '').trim() || undefined}
                    >
                      {truncateText(row.notes, 42)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.total > 0 && (
          <div className="pagination-bar">
            <span className="muted">
              {meta.total} venta{meta.total !== 1 ? 's' : ''}
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
          <p className="empty-hint">No hay ventas en esta página.</p>
        )}
      </div>

      {panelOpen && header && (
        <aside className="editor-panel sales-editor-panel" aria-label="Editor de venta">
          <div className="editor-panel-head">
            <h2>{creating ? 'Nueva venta' : 'Editar venta'}</h2>
            <button
              type="button"
              className="btn-ghost icon-close"
              onClick={closePanel}
              aria-label="Cerrar"
            />
          </div>

          <div className="editor-panel-body">
            {detailLoading && (
              <p className="muted">Cargando detalle…</p>
            )}
            {detailError && (
              <p className="error" role="alert">
                {detailError}
              </p>
            )}

            {(!detailLoading || creating) && header && (
              <>
                {!creating && detail && (
                  <div
                    className="panel-lot-meta sale-detail-readonly"
                    aria-label="Resumen de la venta"
                  >
                    <div className="sale-detail-readonly-grid">
                      <div>
                        <strong>ID</strong>
                        <div className="mono wrap-break">{detail.id}</div>
                      </div>
                      <div>
                        <strong>Fecha de venta</strong>
                        <div>
                          {detail.saleDateOnly?.trim() && (
                            <div>
                              {formatPurchaseLotDate(detail.saleDateOnly, 'long')}
                            </div>
                          )}
                          <div
                            className={
                              detail.saleDateOnly?.trim() ? 'muted small' : ''
                            }
                          >
                            {formatSaleDateLong(detail.saleDate)}
                          </div>
                        </div>
                      </div>
                      <div>
                        <strong>Persona</strong>
                        <div>{detail.displayPerson?.trim() || '—'}</div>
                      </div>
                      {(detail.recordedByName?.trim() ||
                        detail.recordedByUserId?.trim()) && (
                        <div>
                          <strong>Registró</strong>
                          <div>
                            {detail.recordedByName?.trim() || '—'}
                            {detail.recordedByUserId?.trim() && (
                              <span className="mono muted">
                                {' '}
                                · {detail.recordedByUserId}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      <div>
                        <strong>Total</strong>
                        <div className="mono">
                          {formatCOP(saleRowTotalNumeric(detail) ?? Number.NaN)}
                        </div>
                      </div>
                      <div>
                        <strong>Origen</strong>
                        <div>
                          <span className="pill">{detail.source}</span>
                        </div>
                      </div>
                      <div>
                        <strong>Medio de pago</strong>
                        <div>{detail.paymentMethod?.trim() || '—'}</div>
                      </div>
                      <div>
                        <strong>Mesa / ref.</strong>
                        <div>{detail.mesa?.trim() || '—'}</div>
                      </div>
                      <div className="sale-detail-span">
                        <strong>Notas</strong>
                        <div className="wrap-break">
                          {detail.notes?.trim() || '—'}
                        </div>
                      </div>
                      <div>
                        <strong>Líneas</strong>
                        <div>{(detail.lines ?? []).length}</div>
                      </div>
                      {detail.userId?.trim() &&
                        !detail.recordedByUserId?.trim() && (
                          <div>
                            <strong>Usuario (id)</strong>
                            <div className="mono wrap-break">{detail.userId}</div>
                          </div>
                        )}
                      {detail.createdAt && (
                        <div>
                          <strong>Creada (sistema)</strong>
                          <div>{formatSaleDateLong(detail.createdAt)}</div>
                        </div>
                      )}
                      {detail.updatedAt &&
                        detail.updatedAt !== detail.createdAt && (
                          <div>
                            <strong>Última actualización</strong>
                            <div>{formatSaleDateLong(detail.updatedAt)}</div>
                          </div>
                        )}
                    </div>
                  </div>
                )}

                <div className="sales-header-block">
                  <h3 className="sales-edit-section-title">Editar cabecera</h3>
                  <label className="field">
                    <span>Fecha y hora</span>
                    <input
                      type="datetime-local"
                      value={header.saleDateLocal}
                      onChange={(e) =>
                        setHeader({ ...header, saleDateLocal: e.target.value })
                      }
                    />
                  </label>
                  <div className="field-row-2">
                    <label className="field">
                      <span>Origen</span>
                      <select
                        value={header.source}
                        onChange={(e) =>
                          setHeader({ ...header, source: e.target.value })
                        }
                      >
                        {SALE_SOURCES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Medio de pago</span>
                      <input
                        value={header.paymentMethod}
                        onChange={(e) =>
                          setHeader({
                            ...header,
                            paymentMethod: e.target.value,
                          })
                        }
                        placeholder="Efectivo, Nequi…"
                      />
                    </label>
                  </div>
                  <label className="field">
                    <span>Mesa / referencia</span>
                    <input
                      value={header.mesa}
                      onChange={(e) =>
                        setHeader({ ...header, mesa: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Notas</span>
                    <textarea
                      rows={2}
                      value={header.notes}
                      onChange={(e) =>
                        setHeader({ ...header, notes: e.target.value })
                      }
                    />
                  </label>

                  {!creating && selectedId && (
                    <>
                      {saveHeaderError && (
                        <p className="error" role="alert">
                          {saveHeaderError}
                        </p>
                      )}
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={savingHeader}
                        onClick={() => void saveHeader()}
                      >
                        {savingHeader ? 'Guardando…' : 'Guardar cabecera'}
                      </button>
                    </>
                  )}
                </div>

                <div className="sales-lines-block">
                  <div className="sales-lines-head">
                    <h3>Líneas</h3>
                    <p className="muted small">
                      Subtotal editado:{' '}
                      <strong className="mono">{formatCOP(linesSubtotal)}</strong>
                      {!creating && detail && (
                        <>
                          {' '}
                          · Total registrado:{' '}
                          <strong className="mono">
                            {formatCOP(saleRowTotalNumeric(detail) ?? Number.NaN)}
                          </strong>
                        </>
                      )}
                    </p>
                  </div>

                  <label className="field">
                    <span>Buscar producto para enlazar</span>
                    <input
                      type="search"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Nombre del catálogo…"
                    />
                  </label>

                  <div className="recipe-table-wrap sales-lines-table-wrap">
                    <table className="recipe-table sales-lines-table">
                      <thead>
                        <tr>
                          <th>Enlazar</th>
                          <th>Producto (texto en ticket)</th>
                          <th className="col-qty">Cant.</th>
                          <th className="col-cost">P. unit.</th>
                          <th className="col-cost">Subt.</th>
                          <th className="col-cost">Total línea</th>
                          <th className="col-cost">Costo u.</th>
                          <th className="col-cost">Margen</th>
                          <th className="col-actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {lineRows.map((r) => {
                          const q = num(r.quantity)
                          const p = num(r.unitPrice)
                          const sub =
                            Number.isFinite(q) && Number.isFinite(p)
                              ? formatCOP(q * p)
                              : '—'
                          const lineDetail =
                            !creating && r.lineId && detail
                              ? (detail.lines ?? []).find(
                                  (x) => x.id === r.lineId,
                                )
                              : undefined
                          const costCell =
                            lineDetail?.costAtSale != null &&
                            lineDetail.costAtSale !== ''
                              ? formatCOP(lineDetail.costAtSale)
                              : '—'
                          const profitCell =
                            lineDetail?.profit != null && lineDetail.profit !== ''
                              ? formatCOP(lineDetail.profit)
                              : '—'
                          const lineTotalApi =
                            lineDetail?.lineTotal != null &&
                            lineDetail.lineTotal !== ''
                              ? formatCOP(lineDetail.lineTotal)
                              : lineDetail?.lineTotalCOP != null &&
                                  String(lineDetail.lineTotalCOP).trim() !== ''
                                ? formatCOP(lineDetail.lineTotalCOP)
                                : '—'
                          return (
                            <tr key={r.key}>
                              <td>
                                <select
                                  className="recipe-select"
                                  value={r.productId}
                                  onChange={(e) => {
                                    const id = e.target.value
                                    const hit = productHits.find(
                                      (x) => x.id === id,
                                    )
                                    updateLine(r.key, {
                                      productId: id,
                                      productName: hit?.name ?? r.productName,
                                    })
                                  }}
                                >
                                  <option value="">— Elegir —</option>
                                  {productHits.map((prod) => (
                                    <option key={prod.id} value={prod.id}>
                                      {prod.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  className="input-cell"
                                  value={r.productName}
                                  onChange={(e) =>
                                    updateLine(r.key, {
                                      productName: e.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td className="col-qty">
                                <input
                                  className="input-cell"
                                  inputMode="decimal"
                                  value={r.quantity}
                                  onChange={(e) =>
                                    updateLine(r.key, {
                                      quantity: e.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td className="col-cost">
                                <input
                                  className="input-cell"
                                  inputMode="decimal"
                                  value={r.unitPrice}
                                  onChange={(e) =>
                                    updateLine(r.key, {
                                      unitPrice: e.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td className="col-cost mono">{sub}</td>
                              <td className="col-cost mono muted">{lineTotalApi}</td>
                              <td className="col-cost mono muted">{costCell}</td>
                              <td className="col-cost mono muted">{profitCell}</td>
                              <td className="col-actions">
                                <button
                                  type="button"
                                  className="btn-icon-remove"
                                  onClick={() => removeLine(r.key)}
                                  disabled={lineRows.length <= 1}
                                >
                                  Quitar
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="recipe-editor-footer">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={addLine}
                    >
                      + Línea
                    </button>
                    {creating ? (
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={savingLines}
                        onClick={() => void saveNewSale()}
                      >
                        {savingLines ? 'Creando…' : 'Crear venta'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={savingLines || !selectedId}
                        onClick={() => void saveLines()}
                      >
                        {savingLines
                          ? 'Guardando líneas…'
                          : 'Guardar líneas y total'}
                      </button>
                    )}
                  </div>

                  {saveLinesError && (
                    <p className="error" role="alert">
                      {saveLinesError}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </aside>
      )}
    </div>
  )
}
