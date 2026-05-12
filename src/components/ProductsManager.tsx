import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  createProduct,
  datetimeLocalValueToIsoUtcOrNull,
  deleteProduct,
  fetchInventoryOptions,
  fetchProduct,
  fetchProductCategories,
  fetchProductHistory,
  fetchProducts,
  fetchProductsCatalogSummary,
  formatSystemDateTime,
  isoInstantToDatetimeLocalValue,
  parseProductRecipeFull,
  updateProduct,
  type CategoryRef,
  type InventoryOption,
  type ProductHistoryResponse,
  type ProductListSort,
  type ProductRow,
} from '../api'
import { useMatchMedia } from '../hooks/useMatchMedia'
import {
  MobileAwareFilterBar,
  MOBILE_FILTER_BREAKPOINT,
} from './MobileAwareFilterBar'
import {
  FloatingGearFab,
  FloatingGearFabDockAdd,
} from './FloatingGearFab'
import { ProductSummaryCard } from './ProductSummaryCard'
import { RecipeEditor } from './RecipeEditor'
import {
  inferProductTypeFromCategory,
  isProductTypeSlug,
  normalizeProductType,
  PRODUCT_TYPE_LABELS,
  PRODUCT_TYPE_SLUGS,
  productTypeLabel,
} from '../productTypes'

const FETCH_PAGE_SIZE = 40
const MAX_PRODUCT_PAGES = 25

function priceToNumber(p: string | number): number {
  if (typeof p === 'number') return p
  const n = parseFloat(String(p).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function formatCOP(value: string | number): string {
  const n = priceToNumber(value)
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n)
}

type Draft = {
  name: string
  price: string
  categoryId: string
  type: string
  description: string
  size: string
  imageUrl: string
  active: boolean
  traceModifiedLocal: string
}

function emptyDraft(categories: CategoryRef[]): Draft {
  const first = categories[0]
  return {
    name: '',
    price: '',
    categoryId: first?.id ?? '',
    type: first ? inferProductTypeFromCategory(first) : PRODUCT_TYPE_SLUGS[0],
    description: '',
    size: '',
    imageUrl: '',
    active: true,
    traceModifiedLocal: '',
  }
}

function openPurchaseLotInApp(lotId: string): void {
  window.location.hash = `#/purchases/${encodeURIComponent(lotId)}`
}

function sortProductRows(rows: ProductRow[], sort: ProductListSort): ProductRow[] {
  const copy = [...rows]
  if (sort === 'name') {
    copy.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  } else if (sort === 'price_asc') {
    copy.sort((a, b) => priceToNumber(a.price) - priceToNumber(b.price))
  } else {
    copy.sort((a, b) => priceToNumber(b.price) - priceToNumber(a.price))
  }
  return copy
}

function rowToDraft(p: ProductRow, categories: CategoryRef[]): Draft {
  const cat = categories.find((c) => c.id === p.categoryId)
  const normalized = normalizeProductType(p.type)
  const type =
    isProductTypeSlug(normalized)
      ? normalized
      : cat
        ? inferProductTypeFromCategory(cat)
        : PRODUCT_TYPE_SLUGS[0]
  return {
    name: p.name,
    price: String(priceToNumber(p.price)),
    categoryId: p.categoryId,
    type,
    description: p.description ?? '',
    size: p.size ?? '',
    imageUrl: p.imageUrl ?? '',
    active: p.active,
    traceModifiedLocal: isoInstantToDatetimeLocalValue(p.traceModifiedAt),
  }
}

export function ProductsManager({ baseUrl }: { baseUrl: string }) {
  const isMobile = useMatchMedia(MOBILE_FILTER_BREAKPOINT)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [categories, setCategories] = useState<CategoryRef[]>([])
  const [catError, setCatError] = useState<string | null>(null)

  const [allProducts, setAllProducts] = useState<ProductRow[]>([])
  const [catalogTruncated, setCatalogTruncated] = useState(false)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [filterActive, setFilterActive] = useState<
    'all' | 'active' | 'inactive'
  >('all')
  const [filterType, setFilterType] = useState('')
  const [sortBy, setSortBy] = useState<ProductListSort>('name')
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [catalogSummary, setCatalogSummary] = useState<Awaited<
    ReturnType<typeof fetchProductsCatalogSummary>
  > | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  /** Fila de producto cargada (para `updatedAt` en solo lectura). */
  const [selectedProductDetail, setSelectedProductDetail] =
    useState<ProductRow | null>(null)
  const [detailRecipe, setDetailRecipe] = useState<unknown>(null)
  const [inventoryOptions, setInventoryOptions] = useState<InventoryOption[]>(
    [],
  )
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const prefetchedProductIds = useRef<Set<string>>(new Set())
  const [productHistory, setProductHistory] =
    useState<ProductHistoryResponse | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const openRecipePage = useCallback((productId: string) => {
    window.location.hash = `#/recipes/${productId}`
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search), 320)
    return () => window.clearTimeout(t)
  }, [search])

  const productListQuery = useMemo(
    () => ({
      search: searchDebounced,
      active:
        filterActive === 'all'
          ? undefined
          : filterActive === 'active'
            ? true
            : false,
      type: filterType || undefined,
      sort: sortBy,
    }),
    [searchDebounced, filterActive, filterType, sortBy],
  )

  const filtersBarActive = useMemo(
    () =>
      search.trim() !== '' ||
      filterActive !== 'all' ||
      filterType !== '' ||
      sortBy !== 'name',
    [search, filterActive, filterType, sortBy],
  )

  const loadAllProducts = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setListError(null)
    setCatalogTruncated(false)
    try {
      const acc: ProductRow[] = []
      let p = 1
      let truncated = false
      while (p <= MAX_PRODUCT_PAGES) {
        const res = await fetchProducts(baseUrl, {
          page: p,
          limit: FETCH_PAGE_SIZE,
          signal,
          ...productListQuery,
        })
        acc.push(...res.data)
        if (!res.meta.hasNextPage) break
        if (p === MAX_PRODUCT_PAGES) {
          truncated = true
          break
        }
        p++
      }
      if (!signal?.aborted) {
        setAllProducts(acc)
        setCatalogTruncated(truncated)
      }
    } catch (e) {
      if (signal?.aborted) return
      setListError((e as Error).message)
      setAllProducts([])
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [baseUrl, productListQuery])

  const productSections = useMemo(() => {
    const buckets = new Map<string, ProductRow[]>()
    for (const c of categories) buckets.set(c.id, [])
    const orphans: ProductRow[] = []
    const known = new Set(categories.map((c) => c.id))
    for (const row of allProducts) {
      if (known.has(row.categoryId)) {
        buckets.get(row.categoryId)!.push(row)
      } else {
        orphans.push(row)
      }
    }
    const sections = categories.map((c) => ({
      id: c.id,
      name: c.name,
      products: sortProductRows(buckets.get(c.id) ?? [], sortBy),
    }))
    if (orphans.length > 0) {
      sections.push({
        id: '_other',
        name: 'Otras categorías',
        products: sortProductRows(orphans, sortBy),
      })
    }
    return sections
  }, [allProducts, categories, sortBy])

  const catalogLayoutKey = useMemo(
    () =>
      productSections
        .filter((s) => s.products.length > 0)
        .map((s) => s.id)
        .join('|'),
    [productSections],
  )

  const [openCategoryIds, setOpenCategoryIds] = useState(() => new Set<string>())

  useLayoutEffect(() => {
    const first = productSections.find((s) => s.products.length > 0)?.id
    if (!first) {
      setOpenCategoryIds(new Set())
      return
    }
    setOpenCategoryIds(new Set([first]))
  }, [catalogLayoutKey])

  useEffect(() => {
    let cancelled = false
    fetchProductCategories(baseUrl)
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
    let cancelled = false
    // Cargar insumos solo cuando se abre edición de un producto con receta.
    if (!selectedId) {
      setInventoryOptions([])
      return () => {
        cancelled = true
      }
    }
    fetchInventoryOptions(baseUrl)
      .then((inv) => {
        if (!cancelled) setInventoryOptions(inv)
      })
      .catch(() => {
        if (!cancelled) setInventoryOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [baseUrl, selectedId])

  const refreshCatalogSummary = useCallback(() => {
    setSummaryLoading(true)
    fetchProductsCatalogSummary(baseUrl)
      .then((s) => {
        setCatalogSummary(s)
      })
      .catch(() => {
        setCatalogSummary(null)
      })
      .finally(() => {
        setSummaryLoading(false)
      })
  }, [baseUrl])

  useEffect(() => {
    refreshCatalogSummary()
  }, [refreshCatalogSummary])

  useEffect(() => {
    const controller = new AbortController()
    void loadAllProducts(controller.signal)
    return () => controller.abort()
  }, [loadAllProducts])

  const prefetchProductDetail = useCallback(
    (id: string) => {
      if (prefetchedProductIds.current.has(id)) return
      prefetchedProductIds.current.add(id)
      fetchProduct(baseUrl, id).catch(() => {
        prefetchedProductIds.current.delete(id)
      })
    },
    [baseUrl],
  )

  const openCreate = useCallback(() => {
    setCreating(true)
    setSelectedId(null)
    setSelectedProductDetail(null)
    setDetailRecipe(null)
    setDraft(emptyDraft(categories))
    setSaveError(null)
  }, [categories])

  const openEdit = useCallback(
    async (id: string) => {
      setCreating(false)
      setSelectedId(id)
      setSaveError(null)
      setDetailRecipe(null)
      setProductHistory(null)
      setHistoryError(null)
      setHistoryLoading(true)
      try {
        const p = await fetchProduct(baseUrl, id)
        setDraft(rowToDraft(p, categories))
        setSelectedProductDetail(p as ProductRow)
        setDetailRecipe('recipe' in p ? p.recipe : null)
        try {
          const h = await fetchProductHistory(baseUrl, id)
          setProductHistory(h)
        } catch (he) {
          setHistoryError((he as Error).message)
          setProductHistory(null)
        }
      } catch (e) {
        setSaveError((e as Error).message)
        setDraft(null)
        setSelectedProductDetail(null)
        setProductHistory(null)
      } finally {
        setHistoryLoading(false)
      }
    },
    [baseUrl, categories],
  )

  const closePanel = useCallback(() => {
    setSelectedId(null)
    setCreating(false)
    setDraft(null)
    setSelectedProductDetail(null)
    setDetailRecipe(null)
    setSaveError(null)
    setProductHistory(null)
    setHistoryError(null)
    setHistoryLoading(false)
  }, [])

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

  const save = useCallback(async () => {
    if (!draft) return
    const price = parseFloat(draft.price.replace(',', '.'))
    if (!draft.name.trim()) {
      setSaveError('El nombre es obligatorio.')
      return
    }
    if (!Number.isFinite(price) || price < 0) {
      setSaveError('Precio inválido.')
      return
    }
    if (!draft.categoryId) {
      setSaveError('Elige una categoría.')
      return
    }
    const typeTrim = draft.type.trim()
    if (!typeTrim) {
      setSaveError('Elige el tipo de producto.')
      return
    }
    if (!isProductTypeSlug(typeTrim)) {
      setSaveError(
        `El tipo debe ser uno de: ${PRODUCT_TYPE_SLUGS.join(', ')} (p. ej. bar, comida, combos).`,
      )
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      let savedRow: ProductRow | null = null
      if (creating) {
        savedRow = await createProduct(baseUrl, {
          name: draft.name.trim(),
          price,
          categoryId: draft.categoryId,
          type: typeTrim,
          description: draft.description.trim() || undefined,
          size: draft.size.trim() || undefined,
          imageUrl: draft.imageUrl.trim() || undefined,
          active: draft.active,
        })
      } else if (selectedId) {
        savedRow = await updateProduct(baseUrl, selectedId, {
          name: draft.name.trim(),
          price,
          categoryId: draft.categoryId,
          type: typeTrim,
          description: draft.description,
          size: draft.size.trim() || undefined,
          imageUrl: draft.imageUrl.trim() || undefined,
          active: draft.active,
          traceModifiedAt: datetimeLocalValueToIsoUtcOrNull(
            draft.traceModifiedLocal,
          ),
        })
      }
      if (savedRow) {
        setAllProducts((prev) => {
          if (creating) return [savedRow!, ...prev]
          return prev.map((p) => (p.id === savedRow!.id ? savedRow! : p))
        })
      }
      closePanel()
      refreshCatalogSummary()
    } catch (e) {
      setSaveError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }, [
    baseUrl,
    creating,
    closePanel,
    draft,
    refreshCatalogSummary,
    selectedId,
  ])

  const remove = useCallback(async () => {
    if (!selectedId) return
    if (!window.confirm('¿Archivar este producto? Dejará de mostrarse en listados.'))
      return
    setSaving(true)
    setSaveError(null)
    try {
      await deleteProduct(baseUrl, selectedId)
      setAllProducts((prev) => prev.filter((p) => p.id !== selectedId))
      closePanel()
      refreshCatalogSummary()
    } catch (e) {
      setSaveError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }, [baseUrl, closePanel, refreshCatalogSummary, selectedId])

  const parsedRecipe = useMemo(
    () => parseProductRecipeFull(detailRecipe),
    [detailRecipe],
  )

  return (
    <div className="products-layout">
      <div className="products-list-pane page-pane--floating-gear-dock">
        <h2 className="sr-only">Productos a la venta</h2>

        <MobileAwareFilterBar
          hasActiveFilters={filtersBarActive}
          composeMobileToolbar={
            isMobile
              ? ({ filterToggle }) => (
                  <FloatingGearFab
                    navAriaLabel="Productos a la venta"
                    menuToggleTitleClosed="Configuración del listado"
                    menuToggleTitleOpen="Cerrar menú"
                    ariaLabelMenuClosed="Abrir menú (buscar, nuevo producto, resumen)"
                    ariaLabelMenuOpen="Cerrar menú"
                    filterToggle={filterToggle}
                  >
                    <FloatingGearFabDockAdd
                      title="Nuevo producto"
                      ariaLabel="Nuevo producto"
                      onClick={openCreate}
                    />
                    <ProductSummaryCard
                      summary={catalogSummary}
                      categories={categories}
                      loading={summaryLoading}
                    />
                  </FloatingGearFab>
                )
              : undefined
          }
        >
          <>
            <div className="products-catalog-filters-wrap">
              <div className="inventory-filter-bar">
              <div className="inventory-filter-bar__controls" role="search">
                <label className="inventory-filter">
                  <span className="inventory-filter__label">Buscar</span>
                  <input
                    ref={searchInputRef}
                    className="inventory-filter__input"
                    type="search"
                    placeholder="Nombre…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Buscar productos"
                  />
                </label>
                <label className="inventory-filter">
                  <span className="inventory-filter__label">Estado</span>
                  <select
                    className="inventory-filter__input"
                    value={filterActive}
                    onChange={(e) =>
                      setFilterActive(
                        e.target.value as 'all' | 'active' | 'inactive',
                      )
                    }
                  >
                    <option value="all">Todos</option>
                    <option value="active">Activos</option>
                    <option value="inactive">Inactivos</option>
                  </select>
                </label>
                <label className="inventory-filter">
                  <span className="inventory-filter__label">Tipo</span>
                  <select
                    className="inventory-filter__input"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                  >
                    <option value="">Todos</option>
                    {PRODUCT_TYPE_SLUGS.map((t) => (
                      <option key={t} value={t}>
                        {PRODUCT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inventory-filter">
                  <span className="inventory-filter__label">Orden</span>
                  <select
                    className="inventory-filter__input"
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(e.target.value as ProductListSort)
                    }
                  >
                    <option value="name">Nombre (A-Z)</option>
                    <option value="price_asc">Precio ↑</option>
                    <option value="price_desc">Precio ↓</option>
                  </select>
                </label>
              </div>
              <div className="inventory-filter-bar__actions">
                <button
                  type="button"
                  className="btn-secondary btn-compact"
                  onClick={() => {
                    setSearch('')
                    setFilterActive('all')
                    setFilterType('')
                    setSortBy('name')
                  }}
                >
                  Limpiar
                </button>
              </div>
              </div>
            </div>
          </>
          </MobileAwareFilterBar>

        {!isMobile && (
          <FloatingGearFab
            navAriaLabel="Productos a la venta"
            menuToggleTitleClosed="Configuración del listado"
            menuToggleTitleOpen="Cerrar menú"
            ariaLabelMenuClosed="Abrir menú (buscar, nuevo producto, resumen)"
            ariaLabelMenuOpen="Cerrar menú"
            filterToggle={
              <button
                type="button"
                className="btn-catalog-dock-tool btn-catalog-dock-tool--search"
                onClick={() => searchInputRef.current?.focus()}
                aria-label="Buscar productos"
                title="Buscar productos"
              >
                <span className="icon-mobile-search" aria-hidden />
              </button>
            }
          >
            <FloatingGearFabDockAdd
              title="Nuevo producto"
              ariaLabel="Nuevo producto"
              onClick={openCreate}
            />
            <ProductSummaryCard
              summary={catalogSummary}
              categories={categories}
              loading={summaryLoading}
            />
          </FloatingGearFab>
        )}

        <p className="products-dashboard-lead muted">
          Productos a la venta para carta y tickets.
        </p>

        {catError && (
          <p className="banner-warn" role="status">
            No se pudieron cargar categorías: {catError}
          </p>
        )}
        {listError && (
          <p className="error" role="alert">
            {listError}
          </p>
        )}
        {loading && <p className="muted">Cargando productos…</p>}

        {catalogTruncated && !listError && (
          <p className="banner-warn" role="status">
            Se alcanzó el límite de carga ({MAX_PRODUCT_PAGES * FETCH_PAGE_SIZE} ítems). Afina
            búsqueda o filtros para ver el resto.
          </p>
        )}

        <div className="catalog-by-category" aria-label="Productos a la venta por categoría">
          {productSections.map((section) =>
            section.products.length === 0 ? null : (
              <details
                key={section.id}
                className="catalog-category-block"
                open={openCategoryIds.has(section.id)}
                onToggle={(e) => {
                  const nextOpen = e.currentTarget.open
                  setOpenCategoryIds((prev) => {
                    const next = new Set(prev)
                    if (nextOpen) next.add(section.id)
                    else next.delete(section.id)
                    return next
                  })
                }}
              >
                <summary className="catalog-category-block__summary">
                  <span className="catalog-category-block__summary-main">
                    <span className="catalog-category-block__chevron" aria-hidden />
                    <h3 className="catalog-category-block__title">{section.name}</h3>
                  </span>
                  <span className="muted small">
                    {section.products.length} producto
                    {section.products.length !== 1 ? 's' : ''}
                  </span>
                </summary>
                <div className="catalog-category-block__body">
                  <div className="data-table-wrap data-table-elevated">
                  <table className="data-table data-table-striped">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th className="num">Precio</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.products.map((p) => (
                        <tr
                          key={p.id}
                          className={selectedId === p.id ? 'row-active' : ''}
                        >
                          <td>
                            <button
                              type="button"
                              className="table-link"
                              onMouseEnter={() => prefetchProductDetail(p.id)}
                              onFocus={() => prefetchProductDetail(p.id)}
                              onClick={() => void openEdit(p.id)}
                            >
                              {p.name}
                            </button>
                          </td>
                          <td className="num mono">{formatCOP(p.price)}</td>
                          <td>
                            {p.active ? (
                              <span className="badge badge-ok">Activo</span>
                            ) : (
                              <span className="badge badge-muted">Inactivo</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </details>
            ),
          )}
        </div>

        {!loading && allProducts.length === 0 && !listError && (
          <p className="empty-hint">No hay productos. Crea uno o ajusta la búsqueda.</p>
        )}
      </div>

      {panelOpen && draft && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closePanel()
          }}
        >
          <section
            className="modal modal--fullscreen"
            role="dialog"
            aria-modal="true"
            aria-label="Editor de producto"
          >
            <header className="modal-head">
              <div className="modal-head-title">
                <h2>{creating ? 'Nuevo producto' : 'Editar producto'}</h2>
                {!creating && (
                  <p className="muted small modal-subtitle">
                    {draft.name?.trim() ? draft.name.trim() : '—'}
                  </p>
                )}
              </div>
              <div className="modal-head-actions">
                <button
                  type="button"
                  className="btn-primary btn-compact products-catalog-save-head"
                  disabled={saving || categories.length === 0}
                  onClick={() => void save()}
                >
                  {saving ? 'Guardando…' : creating ? 'Crear' : 'Guardar'}
                </button>
                <button
                  type="button"
                  className="btn-ghost icon-close"
                  onClick={closePanel}
                  aria-label="Cerrar"
                />
              </div>
            </header>

            <div className="modal-body">
            {draft.imageUrl ? (
              <div className="editor-preview-img">
                <img src={draft.imageUrl} alt="Vista previa" />
              </div>
            ) : null}

            <label className="field">
              <span>Nombre</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>

            <label className="field">
              <span>Precio (COP)</span>
              <input
                inputMode="decimal"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              />
            </label>

            <label className="field">
              <span>Categoría</span>
              <select
                value={draft.categoryId}
                onChange={(e) => {
                  const categoryId = e.target.value
                  const cat = categories.find((c) => c.id === categoryId)
                  setDraft({
                    ...draft,
                    categoryId,
                    type: cat ? inferProductTypeFromCategory(cat) : draft.type,
                  })
                }}
              >
                {categories.length === 0 && <option value="">— Sin categorías —</option>}
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Tipo</span>
              <select
                value={
                  isProductTypeSlug(draft.type) ? draft.type : PRODUCT_TYPE_SLUGS[0]
                }
                onChange={(e) => setDraft({ ...draft, type: e.target.value })}
              >
                {PRODUCT_TYPE_SLUGS.map((t) => (
                  <option key={t} value={t}>
                    {PRODUCT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              <span className="muted small">
                Slug enviado al API (alinear con la categoría: {productTypeLabel(draft.type)}).
              </span>
            </label>

            <label className="field">
              <span>Descripción</span>
              <textarea
                rows={3}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>

            <label className="field">
              <span>Tamaño / presentación</span>
              <input
                value={draft.size}
                onChange={(e) => setDraft({ ...draft, size: e.target.value })}
                placeholder="Opcional"
              />
            </label>

            <label className="field">
              <span>URL de imagen</span>
              <input
                type="url"
                value={draft.imageUrl}
                onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
                placeholder="https://…"
              />
            </label>

            {!creating && selectedProductDetail ? (
              <>
                <div className="field">
                  <span>Último cambio en sistema (solo lectura)</span>
                  <p className="mono muted small">
                    {formatSystemDateTime(selectedProductDetail.updatedAt)}
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
                          await updateProduct(baseUrl, selectedId, {
                            traceModifiedAt: null,
                          })
                          const p = await fetchProduct(baseUrl, selectedId)
                          setDraft(rowToDraft(p, categories))
                          setSelectedProductDetail(p as ProductRow)
                          setDetailRecipe('recipe' in p ? p.recipe : null)
                          setAllProducts((prev) =>
                            prev.map((row) =>
                              row.id === selectedId ? (p as ProductRow) : row,
                            ),
                          )
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

            {!creating && selectedId ? (
              <div className="product-trace-history field">
                <h3 className="product-trace-history__title">
                  Historial, lotes y precios
                </h3>
                {historyLoading ? (
                  <p className="muted small">Cargando historial…</p>
                ) : historyError ? (
                  <p className="error" role="alert">
                    {historyError}
                  </p>
                ) : productHistory === null ? (
                  <p className="muted small">
                    Este servidor aún no expone{' '}
                    <span className="mono">GET /products/:id/history</span>. Pedí al
                    equipo de API implementar el contrato en{' '}
                    <span className="mono">backend/README.md</span> (apartado historial
                    de producto).
                  </p>
                ) : (
                  <>
                    {productHistory.summary ? (
                      <p className="muted small">{productHistory.summary}</p>
                    ) : null}
                    <p className="small">
                      <strong>{productHistory.lotsCount ?? productHistory.lots.length}</strong>{' '}
                      lote
                      {(productHistory.lotsCount ?? productHistory.lots.length) !== 1
                        ? 's'
                        : ''}{' '}
                      relacionado
                      {(productHistory.lotsCount ?? productHistory.lots.length) !== 1
                        ? 's'
                        : ''}{' '}
                      (compras vía receta / inventario).
                    </p>
                    {productHistory.lots.length === 0 ? (
                      <p className="muted small">
                        No hay lotes enlazados: receta vacía, insumos sin compra, o datos
                        aún no cargados en el servidor.
                      </p>
                    ) : (
                      <div className="data-table-wrap data-table-elevated product-history-lots-table">
                        <table className="data-table data-table-striped">
                          <thead>
                            <tr>
                              <th>Lote</th>
                              <th>Fecha compra</th>
                              <th>Proveedor</th>
                              <th className="num">Valor línea</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {productHistory.lots.map((lot) => (
                              <tr key={`${lot.code}-${lot.id ?? ''}`}>
                                <td className="mono">{lot.code}</td>
                                <td>
                                  {lot.purchaseDate
                                    ? formatSystemDateTime(lot.purchaseDate)
                                    : '—'}
                                </td>
                                <td>{lot.supplier?.trim() || '—'}</td>
                                <td className="num mono">
                                  {lot.lineTotalCOP !== undefined &&
                                  lot.lineTotalCOP !== null &&
                                  String(lot.lineTotalCOP).trim() !== ''
                                    ? formatCOP(lot.lineTotalCOP)
                                    : '—'}
                                </td>
                                <td>
                                  {lot.id ? (
                                    <button
                                      type="button"
                                      className="btn-secondary btn-compact"
                                      onClick={() => openPurchaseLotInApp(lot.id!)}
                                    >
                                      Ver compra
                                    </button>
                                  ) : null}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {productHistory.salePriceHistory &&
                    productHistory.salePriceHistory.length > 0 ? (
                      <div className="product-history-prices">
                        <h4 className="muted small product-history-prices__title">
                          Precio de venta (historial)
                        </h4>
                        <ul className="product-history-prices__list">
                          {productHistory.salePriceHistory.map((pt, i) => (
                            <li key={`${pt.effectiveAt}-${i}`}>
                              <span className="mono muted small">
                                {formatSystemDateTime(pt.effectiveAt)}
                              </span>{' '}
                              <strong className="mono">{formatCOP(pt.price)}</strong>
                              {pt.kind ? (
                                <span className="muted small"> ({pt.kind})</span>
                              ) : null}
                              {pt.note ? (
                                <span className="muted small"> — {pt.note}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {productHistory.events && productHistory.events.length > 0 ? (
                      <div className="product-history-events">
                        <h4 className="muted small">Eventos</h4>
                        <ul className="product-history-events__list">
                          {productHistory.events.map((ev, i) => (
                            <li key={`${ev.at}-${i}`}>
                              <span className="mono muted small">
                                {formatSystemDateTime(ev.at)}
                              </span>{' '}
                              {ev.label}
                              {ev.detail ? (
                                <span className="muted small"> — {ev.detail}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            <label className="field checkbox-field">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
              />
              <span>Producto activo (visible en ventas)</span>
            </label>

            {!creating && selectedId && (
              <div className="recipe-embed">
                <div className="recipe-embed-tools">
                  <button
                    type="button"
                    className="btn-secondary btn-compact recipe-embed-open-recipe"
                    onClick={() => openRecipePage(selectedId)}
                    title="Abrir la receta en una ruta dedicada"
                  >
                    <span>Abrir receta</span>
                    <span className="table-link-icon-external" aria-hidden />
                  </button>
                </div>
                <RecipeEditor
                  baseUrl={baseUrl}
                  productId={selectedId}
                  recipe={parsedRecipe}
                  inventory={inventoryOptions}
                  onRecipeUpdated={(r) => setDetailRecipe(r)}
                />
              </div>
            )}

            {saveError && (
              <p className="error" role="alert">
                {saveError}
              </p>
            )}

            <div className="editor-actions">
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
          </section>
        </div>
      )}
    </div>
  )
}
