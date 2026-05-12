import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchRecipeCosts, type RecipeCostLineRow } from '../api'
import { useMatchMedia } from '../hooks/useMatchMedia'
import {
  MobileAwareFilterBar,
  MOBILE_FILTER_BREAKPOINT,
} from './MobileAwareFilterBar'
import {
  FloatingGearFab,
  FloatingGearFabDockRefresh,
} from './FloatingGearFab'
import { SectionSummaryDeck } from './SectionSummaryDeck'

function num(v: string | number | null | undefined): number {
  const n = parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

function formatCOP(value: string | number | null | undefined): string {
  const n = num(value)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n)
}

function sortByProductAndOrder(a: RecipeCostLineRow, b: RecipeCostLineRow): number {
  const pa = (a.productName ?? '').localeCompare(b.productName ?? '', 'es')
  if (pa !== 0) return pa
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
}

function rowsTotalCOP(rows: RecipeCostLineRow[]): number {
  let sum = 0
  for (const r of rows) {
    const v = num(r.lineTotalCOP)
    if (Number.isFinite(v)) sum += v
  }
  return sum
}

function CostTable({
  rows,
  emptyLabel,
}: {
  rows: RecipeCostLineRow[]
  emptyLabel: string
}) {
  if (rows.length === 0) {
    return <p className="muted">{emptyLabel}</p>
  }
  return (
    <div className="data-table-wrap data-table-elevated costs-table-block">
      <table className="data-table data-table-striped">
        <thead>
          <tr>
            <th>Concepto</th>
            <th className="num">Cant.</th>
            <th>Unidad</th>
            <th className="num">Total (COP)</th>
            <th>Ref. hoja</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td className="num mono">{r.quantity ?? '—'}</td>
              <td className="muted">{r.unit}</td>
              <td className="num mono">{formatCOP(r.lineTotalCOP)}</td>
              <td className="muted small">{r.sheetUnitCost ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const UNCATEGORIZED_LABEL = 'Sin categoría'

export function CostsView({ baseUrl }: { baseUrl: string }) {
  const isMobileFilters = useMatchMedia(MOBILE_FILTER_BREAKPOINT)
  const costsSearchInputRef = useRef<HTMLInputElement>(null)
  const [data, setData] = useState<Awaited<
    ReturnType<typeof fetchRecipeCosts>
  > | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [filterKind, setFilterKind] = useState<'all' | 'FIJO' | 'VARIABLE'>(
    'all',
  )
  const [filterCategory, setFilterCategory] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchRecipeCosts(baseUrl)
      setData(res)
    } catch (e) {
      setData(null)
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [baseUrl])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search), 320)
    return () => window.clearTimeout(t)
  }, [search])

  const products = useMemo(() => data?.products ?? [], [data])

  const categories = useMemo(() => {
    const s = new Set<string>()
    for (const p of products) {
      const name = (p.categoryName ?? '').trim()
      if (name) s.add(name)
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'es'))
  }, [products])

  const filteredProducts = useMemo(() => {
    const q = searchDebounced.trim().toLowerCase()
    return products
      .map((p) => {
        if (filterCategory && (p.categoryName ?? '') !== filterCategory) return null

        const baseRows = (p.rows ?? [...(p.fixed ?? []), ...(p.variable ?? [])]).map(
          (r) => ({ ...r, productName: p.productName, categoryName: p.categoryName }),
        )

        const rowsFiltered = baseRows.filter((r) => {
          if (filterKind !== 'all' && r.kind !== filterKind) return false
          if (!q) return true
          const hay = `${p.productName} ${p.categoryName ?? ''} ${r.name}`.toLowerCase()
          return hay.includes(q)
        })

        const visibleLineCount = rowsFiltered.length
        if (q && visibleLineCount === 0) return null
        return {
          ...p,
          rows: [...rowsFiltered].sort(sortByProductAndOrder),
        }
      })
      .filter(Boolean) as Array<
      (typeof products)[number] & {
        rows: RecipeCostLineRow[]
      }
    >
  }, [products, searchDebounced, filterCategory, filterKind])

  type CostProductRow = (typeof filteredProducts)[number]

  const costSections = useMemo(() => {
    const buckets = new Map<string, CostProductRow[]>()
    for (const p of filteredProducts) {
      const raw = (p.categoryName ?? '').trim()
      const key = raw || UNCATEGORIZED_LABEL
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key)!.push(p)
    }
    const names = Array.from(buckets.keys()).sort((a, b) => {
      if (a === UNCATEGORIZED_LABEL) return 1
      if (b === UNCATEGORIZED_LABEL) return -1
      return a.localeCompare(b, 'es')
    })
    return names.map((name) => ({
      id: name === UNCATEGORIZED_LABEL ? '_uncategorized' : name,
      name,
      products: [...(buckets.get(name) ?? [])].sort((a, b) =>
        (a.productName ?? '').localeCompare(b.productName ?? '', 'es'),
      ),
    }))
  }, [filteredProducts])

  const totals = useMemo(() => {
    let fixed = 0
    let variable = 0
    let fixedLines = 0
    let variableLines = 0
    for (const p of filteredProducts) {
      for (const r of p.rows) {
        if (r.kind === 'FIJO') {
          fixed += num(r.lineTotalCOP)
          fixedLines++
        } else {
          variable += num(r.lineTotalCOP)
          variableLines++
        }
      }
    }
    return {
      all: fixed + variable,
      fixedLines,
      variableLines,
      linesAll: fixedLines + variableLines,
    }
  }, [filteredProducts])

  const costsSummaryItems = useMemo(
    () => [
      {
        label: 'Productos',
        value: products.length,
        title: 'Productos con costos (según API)',
      },
      {
        label: 'Visibles',
        value: filteredProducts.length,
        title: 'Productos que cumplen filtros',
      },
      {
        label: 'Líneas',
        value: totals.linesAll,
        title: 'Total líneas visibles (FIJO + VARIABLE)',
      },
      {
        label: 'FIJO',
        value: totals.fixedLines,
      },
      {
        label: 'VARIABLE',
        value: totals.variableLines,
      },
      {
        label: 'Total visible',
        value: formatCOP(totals.all),
        title: 'Suma de líneas visibles',
      },
      ...(data
        ? [
            {
              label: 'Total global',
              value: formatCOP(data.totals.totalCOP),
              title: 'Totales globales devueltos por la API',
            },
          ]
        : []),
    ],
    [
      data,
      filteredProducts.length,
      products.length,
      totals.all,
      totals.fixedLines,
      totals.linesAll,
      totals.variableLines,
    ],
  )

  const costsFiltersActive = useMemo(
    () =>
      search.trim() !== '' ||
      filterKind !== 'all' ||
      filterCategory !== '',
    [search, filterKind, filterCategory],
  )

  return (
    <div className="products-layout">
      <div className="products-list-pane page-pane--floating-gear-dock">
        <div className="page-intro page-intro--tight">
          <h2 className="page-title">Costos por producto</h2>
          <p className="muted page-subtitle">
            Costos FIJO y VARIABLE por receta. Categorías de menú alineadas con Bar,
            Cafetería, Cócteles, Comida y Shots.
          </p>
        </div>

        <MobileAwareFilterBar
          hasActiveFilters={costsFiltersActive}
          composeMobileToolbar={
            isMobileFilters
              ? ({ filterToggle }) => (
                  <FloatingGearFab
                    navAriaLabel="Costos por producto"
                    menuToggleTitleClosed="Configuración del listado"
                    menuToggleTitleOpen="Cerrar menú"
                    ariaLabelMenuClosed="Abrir menú: buscar, filtros y actualizar costos"
                    ariaLabelMenuOpen="Cerrar menú de costos"
                    filterToggle={filterToggle}
                  >
                    <FloatingGearFabDockRefresh
                      title="Actualizar"
                      ariaLabel="Actualizar costos"
                      onClick={load}
                      disabled={loading}
                    />
                    <SectionSummaryDeck
                      section="costs"
                      items={costsSummaryItems}
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
                ref={costsSearchInputRef}
                className="inventory-filter__input"
                type="search"
                placeholder="Producto, categoría o concepto…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar costos"
              />
            </label>
            <label className="inventory-filter">
              <span className="inventory-filter__label">Tipo</span>
              <select
                className="inventory-filter__input"
                value={filterKind}
                onChange={(e) =>
                  setFilterKind(e.target.value as 'all' | 'FIJO' | 'VARIABLE')
                }
              >
                <option value="all">Todos</option>
                <option value="FIJO">FIJO</option>
                <option value="VARIABLE">VARIABLE</option>
              </select>
            </label>
            <label className="inventory-filter">
              <span className="inventory-filter__label">Categoría</span>
              <select
                className="inventory-filter__input"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="">Todas</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="inventory-filter-bar__actions">
            <button
              type="button"
              className="btn-secondary btn-compact"
              onClick={() => {
                setSearch('')
                setFilterKind('all')
                setFilterCategory('')
              }}
            >
              Limpiar
            </button>
            <button
              type="button"
              className="btn-secondary btn-compact"
              onClick={() => void load()}
              disabled={loading}
            >
              Actualizar
            </button>
          </div>
        </div>
        </MobileAwareFilterBar>

        {!isMobileFilters && (
          <FloatingGearFab
            navAriaLabel="Costos por producto"
            menuToggleTitleClosed="Configuración del listado"
            menuToggleTitleOpen="Cerrar menú"
            ariaLabelMenuClosed="Abrir menú: buscar y ver resumen"
            ariaLabelMenuOpen="Cerrar menú de costos"
            filterToggle={
              <button
                type="button"
                className="btn-catalog-dock-tool btn-catalog-dock-tool--search"
                onClick={() => costsSearchInputRef.current?.focus()}
                aria-label="Buscar costos"
                title="Buscar costos"
              >
                <span className="icon-mobile-search" aria-hidden />
              </button>
            }
          >
            <FloatingGearFabDockRefresh
              title="Actualizar"
              ariaLabel="Actualizar costos"
              onClick={() => void load()}
              disabled={loading}
            />
            <SectionSummaryDeck
              section="costs"
              items={costsSummaryItems}
              loading={loading}
              suspendDetailWhileLoading
            />
          </FloatingGearFab>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {loading && <p className="muted">Cargando costos…</p>}

        {!loading && data && (
          <>
            <section className="cost-section" aria-label="Costos por producto">
              <div className="cost-section-head">
                <h3 className="cost-section-title">Productos por categoría</h3>
                <span className="muted small">
                  {filteredProducts.length} producto
                  {filteredProducts.length !== 1 ? 's' : ''} · {costSections.length} categoría
                  {costSections.length !== 1 ? 's' : ''}
                </span>
              </div>

              {filteredProducts.length === 0 ? (
                <p className="empty-hint">No hay productos que coincidan con los filtros.</p>
              ) : (
                <div className="catalog-by-category" aria-label="Costos agrupados por categoría">
                  {costSections.map((section) =>
                    section.products.length === 0 ? null : (
                      <details key={section.id} className="catalog-category-block">
                        <summary className="catalog-category-block__summary">
                          <span className="catalog-category-block__summary-main">
                            <span
                              className="catalog-category-block__chevron"
                              aria-hidden
                            />
                            <h3 className="catalog-category-block__title">
                              {section.name}
                            </h3>
                          </span>
                          <span className="muted small">
                            {section.products.length} producto
                            {section.products.length !== 1 ? 's' : ''}
                          </span>
                        </summary>
                        <div className="catalog-category-block__body">
                          <div className="cost-by-category-stack">
                            {section.products.map((p) => (
                              <details
                                key={p.productId}
                                className="cost-product-details"
                                aria-label={`Costos: ${p.productName}`}
                              >
                                <summary className="cost-product-summary">
                                  <span className="cost-product-summary-title">
                                    {p.productName}{' '}
                                    {!p.productActive && (
                                      <span className="badge badge-muted">Inactivo</span>
                                    )}
                                  </span>
                                  <span className="cost-product-meta">
                                    {`${p.rows.length} línea(s)`}
                                  </span>
                                  <span className="mono">
                                    {formatCOP(rowsTotalCOP(p.rows))}
                                  </span>
                                </summary>

                                <CostTable
                                  rows={p.rows}
                                  emptyLabel="Sin líneas visibles para este producto."
                                />
                              </details>
                            ))}
                          </div>
                        </div>
                      </details>
                    ),
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
