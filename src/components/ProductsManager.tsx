import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  createProduct,
  datetimeLocalValueToIsoUtcOrNull,
  deleteProduct,
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

function draftSnapshot(d: Draft): string {
  return JSON.stringify({
    name: d.name.trim(),
    price: d.price.trim(),
    categoryId: d.categoryId,
    type: d.type.trim(),
    description: d.description,
    size: d.size.trim(),
    imageUrl: d.imageUrl.trim(),
    active: d.active,
    trace: d.traceModifiedLocal,
  })
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

function validateProductDraft(d: Draft): string | null {
  if (!d.name.trim()) return 'El nombre es obligatorio.'
  const price = parseFloat(d.price.replace(',', '.'))
  if (!Number.isFinite(price) || price < 0) return 'Precio inválido.'
  if (!d.categoryId) return 'Elige una categoría.'
  const typeTrim = d.type.trim()
  if (!typeTrim) return 'Elige el tipo de producto.'
  if (!isProductTypeSlug(typeTrim)) {
    return `El tipo debe ser uno de: ${PRODUCT_TYPE_SLUGS.join(', ')} (p. ej. bar, comida, combos).`
  }
  return null
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
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const prefetchedProductIds = useRef<Set<string>>(new Set())
  const [productHistory, setProductHistory] =
    useState<ProductHistoryResponse | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [committedSnapshot, setCommittedSnapshot] = useState('')
  const [productUnlockedFields, setProductUnlockedFields] = useState(
    () => new Set<string>(),
  )
  const [saveBannerVisible, setSaveBannerVisible] = useState(false)
  const [saveAnimKey, setSaveAnimKey] = useState(0)
  const saveBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Edición: primer toque valida; el segundo envía al API. */
  const [saveConfirmPending, setSaveConfirmPending] = useState(false)

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
    const d = emptyDraft(categories)
    setDraft(d)
    setCommittedSnapshot(draftSnapshot(d))
    setProductUnlockedFields(new Set())
    setSaveConfirmPending(false)
    setSaveError(null)
    setSaveBannerVisible(false)
  }, [categories])

  const openEdit = useCallback(
    async (id: string) => {
      setCreating(false)
      setSelectedId(id)
      setSaveConfirmPending(false)
      setSaveError(null)
      setDetailRecipe(null)
      setProductHistory(null)
      setHistoryError(null)
      setHistoryLoading(true)
      try {
        const p = await fetchProduct(baseUrl, id)
        const rd = rowToDraft(p, categories)
        setDraft(rd)
        setCommittedSnapshot(draftSnapshot(rd))
        setProductUnlockedFields(new Set())
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
    if (saveBannerTimerRef.current) {
      clearTimeout(saveBannerTimerRef.current)
      saveBannerTimerRef.current = null
    }
    if (saveCloseTimerRef.current) {
      clearTimeout(saveCloseTimerRef.current)
      saveCloseTimerRef.current = null
    }
    setSelectedId(null)
    setCreating(false)
    setDraft(null)
    setSelectedProductDetail(null)
    setDetailRecipe(null)
    setSaveError(null)
    setProductHistory(null)
    setHistoryError(null)
    setHistoryLoading(false)
    setCommittedSnapshot('')
    setProductUnlockedFields(new Set())
    setSaveBannerVisible(false)
    setSaveConfirmPending(false)
  }, [])

  const navigateToProductRecipe = useCallback(
    (productId: string) => {
      closePanel()
      window.location.hash = `#/recipes/${productId}`
    },
    [closePanel],
  )

  const navigateToRecipesIndex = useCallback(() => {
    closePanel()
    window.location.hash = '#/recipes'
  }, [closePanel])

  const showSavedBanner = useCallback(() => {
    setSaveAnimKey((k) => k + 1)
    setSaveBannerVisible(true)
    if (saveBannerTimerRef.current) {
      clearTimeout(saveBannerTimerRef.current)
    }
    saveBannerTimerRef.current = window.setTimeout(() => {
      setSaveBannerVisible(false)
      saveBannerTimerRef.current = null
    }, 3400)
  }, [])

  const syncDraftAfterServerProduct = useCallback(
    (p: ProductRow) => {
      const next = rowToDraft(p, categories)
      setDraft(next)
      setSelectedProductDetail(p)
      setDetailRecipe('recipe' in p ? p.recipe : null)
      setCommittedSnapshot(draftSnapshot(next))
      setProductUnlockedFields(new Set())
      setSaveConfirmPending(false)
    },
    [categories],
  )

  const panelOpen = creating || selectedId !== null

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
    const validationError = validateProductDraft(draft)
    if (validationError) {
      setSaveError(validationError)
      return
    }
    const price = parseFloat(draft.price.replace(',', '.'))
    const typeTrim = draft.type.trim()
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
          return prev.map((pr) => (pr.id === savedRow!.id ? savedRow! : pr))
        })
        refreshCatalogSummary()
        if (creating) {
          showSavedBanner()
          if (saveCloseTimerRef.current) {
            clearTimeout(saveCloseTimerRef.current)
          }
          saveCloseTimerRef.current = window.setTimeout(() => {
            closePanel()
            saveCloseTimerRef.current = null
          }, 1500)
        } else {
          syncDraftAfterServerProduct(savedRow as ProductRow)
          showSavedBanner()
        }
      }
    } catch (e) {
      setSaveError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }, [
    baseUrl,
    categories,
    closePanel,
    creating,
    draft,
    refreshCatalogSummary,
    selectedId,
    showSavedBanner,
    syncDraftAfterServerProduct,
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

  const recipeCardMeta = useMemo(() => {
    const r = parseProductRecipeFull(detailRecipe)
    const nIng = r?.ingredients?.length ?? 0
    const nCost = r?.costs?.length ?? 0
    const hasViewableRecipe = nIng > 0 || nCost > 0
    return { nIng, nCost, hasViewableRecipe }
  }, [detailRecipe])

  const isDraftDirty = useMemo(() => {
    if (!draft) return false
    if (!committedSnapshot) return true
    return draftSnapshot(draft) !== committedSnapshot
  }, [draft, committedSnapshot])

  useEffect(() => {
    if (!panelOpen || creating) return
    if (!isDraftDirty && saveConfirmPending) {
      setSaveConfirmPending(false)
    }
  }, [panelOpen, creating, isDraftDirty, saveConfirmPending])

  useEffect(() => {
    if (!panelOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (saveConfirmPending) {
          setSaveConfirmPending(false)
          return
        }
        closePanel()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [closePanel, panelOpen, saveConfirmPending])

  const handleSaveOrConfirm = useCallback(() => {
    if (!draft || saving || categories.length === 0) return
    if (!creating && !isDraftDirty && !saveConfirmPending) return

    const validationError = validateProductDraft(draft)
    if (validationError) {
      setSaveError(validationError)
      return
    }
    setSaveError(null)

    if (creating) {
      void save()
      return
    }
    if (saveConfirmPending) {
      setSaveConfirmPending(false)
      void save()
      return
    }
    setSaveConfirmPending(true)
  }, [
    draft,
    saving,
    categories.length,
    creating,
    isDraftDirty,
    saveConfirmPending,
    save,
  ])

  function renderProductFieldRow(args: {
    fieldKey: string
    label: string
    display: ReactNode
    canLock: boolean
    disabled?: boolean
    children: ReactNode
  }): ReactNode {
    const { fieldKey, label, display, canLock, disabled, children } = args
    const locksOn = canLock
    const unlocked = !locksOn || productUnlockedFields.has(fieldKey)
    const toggle = () => {
      setProductUnlockedFields((prev) => {
        const next = new Set(prev)
        if (next.has(fieldKey)) next.delete(fieldKey)
        else next.add(fieldKey)
        return next
      })
    }
    return (
      <div
        className={`product-editor-field-row${unlocked ? ' product-editor-field-row--unlocked' : ''}`}
      >
        <div className="product-editor-field-row__main">
          <span className="product-editor-field-row__label">{label}</span>
          {unlocked ? (
            <div className="product-editor-field-row__input">{children}</div>
          ) : (
            <div className="product-editor-field-row__value">{display}</div>
          )}
        </div>
        {locksOn ? (
          <button
            type="button"
            className="btn-secondary btn-compact product-editor-field-row__edit"
            disabled={disabled}
            onClick={toggle}
          >
            {unlocked ? 'Listo' : 'Editar'}
          </button>
        ) : null}
      </div>
    )
  }

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
          className="modal-backdrop modal-backdrop--product-editor"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closePanel()
          }}
        >
          <section
            className="modal modal--product-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-editor-title"
          >
            <header className="modal-head modal-head--product-editor">
              <div className="modal-head-title">
                <h2 id="product-editor-title">
                  {creating ? 'Nuevo producto' : 'Producto'}
                </h2>
                <p className="muted small modal-subtitle">
                  {creating
                    ? 'Datos de carta y ticket. La receta se arma en su sección.'
                    : draft.name?.trim() || 'Sin nombre'}
                </p>
              </div>
              <div className="modal-head-actions">
                <button
                  type="button"
                  className="btn-ghost icon-close"
                  onClick={closePanel}
                  aria-label="Cerrar"
                />
              </div>
            </header>

            <div className="modal-body modal-body--product-editor">
            {saveBannerVisible ? (
              <div
                key={saveAnimKey}
                className="product-editor-save-ribbon"
                role="status"
                aria-live="polite"
              >
                <span className="product-editor-save-ribbon__check" aria-hidden />
                <span className="product-editor-save-ribbon__text">
                  {creating
                    ? 'Producto creado correctamente'
                    : 'Cambios guardados · verificado'}
                </span>
              </div>
            ) : null}
              {draft.imageUrl?.trim() ? (
                <div className="editor-preview-img product-editor-preview-thumb">
                  <img src={draft.imageUrl.trim()} alt="" />
                </div>
              ) : null}

              <div className="product-editor-fields">
                {renderProductFieldRow({
                  fieldKey: 'name',
                  label: 'Nombre',
                  canLock: !creating,
                  disabled: saving,
                  display: (
                    <span className="product-editor-field-value-text">
                      {draft.name.trim() || '—'}
                    </span>
                  ),
                  children: (
                    <input
                      className="input-cell"
                      value={draft.name}
                      onChange={(e) =>
                        setDraft({ ...draft, name: e.target.value })
                      }
                      autoComplete="off"
                    />
                  ),
                })}
                {renderProductFieldRow({
                  fieldKey: 'price',
                  label: 'Precio (COP)',
                  canLock: !creating,
                  disabled: saving,
                  display: (
                    <span className="mono product-editor-field-value-text">
                      {formatCOP(draft.price)}
                    </span>
                  ),
                  children: (
                    <input
                      className="input-cell mono"
                      inputMode="decimal"
                      value={draft.price}
                      onChange={(e) =>
                        setDraft({ ...draft, price: e.target.value })
                      }
                    />
                  ),
                })}
                {renderProductFieldRow({
                  fieldKey: 'category',
                  label: 'Categoría',
                  canLock: !creating,
                  disabled: saving,
                  display: (
                    <span className="product-editor-field-value-text">
                      {categories.find((c) => c.id === draft.categoryId)
                        ?.name ?? '—'}
                    </span>
                  ),
                  children: (
                    <select
                      className="inventory-filter__input"
                      value={draft.categoryId}
                      onChange={(e) => {
                        const categoryId = e.target.value
                        const cat = categories.find((c) => c.id === categoryId)
                        setDraft({
                          ...draft,
                          categoryId,
                          type: cat
                            ? inferProductTypeFromCategory(cat)
                            : draft.type,
                        })
                      }}
                    >
                      {categories.length === 0 && (
                        <option value="">— Sin categorías —</option>
                      )}
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ),
                })}
                {renderProductFieldRow({
                  fieldKey: 'active',
                  label: 'Estado en ventas',
                  canLock: !creating,
                  disabled: saving,
                  display: (
                    <span
                      className={
                        draft.active
                          ? 'badge badge-ok'
                          : 'badge badge-muted'
                      }
                    >
                      {draft.active ? 'Activo' : 'Inactivo'}
                    </span>
                  ),
                  children: (
                    <label className="product-editor-checkbox-inline">
                      <input
                        type="checkbox"
                        checked={draft.active}
                        onChange={(e) =>
                          setDraft({ ...draft, active: e.target.checked })
                        }
                      />
                      <span>Visible para ventas</span>
                    </label>
                  ),
                })}
              </div>

              {!creating && selectedId ? (
                <div
                  className="product-editor-recipe-card"
                  aria-label="Accesos a recetas"
                >
                  <div className="product-editor-recipe-card__head">
                    <h3 className="product-editor-recipe-card__title">
                      Receta
                    </h3>
                    {recipeCardMeta.hasViewableRecipe ? (
                      <span className="product-editor-recipe-card__badge product-editor-recipe-card__badge--ok">
                        Con contenido
                      </span>
                    ) : (
                      <span className="product-editor-recipe-card__badge product-editor-recipe-card__badge--muted">
                        Sin insumos ni costos
                      </span>
                    )}
                  </div>
                  <p className="muted small product-editor-recipe-card__lead">
                    {recipeCardMeta.hasViewableRecipe
                      ? [
                          recipeCardMeta.nIng > 0
                            ? `${recipeCardMeta.nIng} insumo${recipeCardMeta.nIng !== 1 ? 's' : ''}`
                            : null,
                          recipeCardMeta.nCost > 0
                            ? `${recipeCardMeta.nCost} línea${recipeCardMeta.nCost !== 1 ? 's' : ''} de costo`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : 'Agregá insumos o líneas de costo en la receta para poder verla aquí.'}
                  </p>
                  <div className="product-editor-recipe-card__actions product-editor-recipe-card__actions--primary-row">
                    <button
                      type="button"
                      className="product-editor-recipe-view-btn"
                      disabled={!recipeCardMeta.hasViewableRecipe}
                      title={
                        recipeCardMeta.hasViewableRecipe
                          ? 'Abrir la receta de este producto'
                          : 'Este producto aún no tiene insumos ni costos en la receta'
                      }
                      onClick={() => navigateToProductRecipe(selectedId)}
                    >
                      Ver receta
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-compact product-editor-recipe-card__btn-edit"
                      onClick={() => navigateToProductRecipe(selectedId)}
                    >
                      {recipeCardMeta.nIng > 0 || recipeCardMeta.nCost > 0
                        ? 'Editar receta'
                        : 'Definir receta'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-compact"
                      onClick={navigateToRecipesIndex}
                    >
                      Todas las recetas
                    </button>
                  </div>
                  <p className="muted small product-editor-recipe-card__foot">
                    {recipeCardMeta.hasViewableRecipe ? (
                      <>
                        <a
                          href={`#/recipes/${selectedId}`}
                          className="product-editor-hash-link"
                          onClick={(e) => {
                            e.preventDefault()
                            navigateToProductRecipe(selectedId)
                          }}
                        >
                          Abrir en pantalla completa
                        </a>
                        <span className="product-editor-hash-sep" aria-hidden>
                          ·
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="product-editor-recipe-card__foot-hint">
                          Vista de receta desactivada hasta que haya contenido.
                        </span>
                        <span className="product-editor-hash-sep" aria-hidden>
                          ·
                        </span>
                      </>
                    )}
                    <a
                      href="#/recipes"
                      className="product-editor-hash-link"
                      onClick={(e) => {
                        e.preventDefault()
                        navigateToRecipesIndex()
                      }}
                    >
                      Listado de recetas
                    </a>
                  </p>
                </div>
              ) : (
                <p className="muted small product-editor-recipe-hint">
                  Cuando guardes el producto, podrás{' '}
                  <a
                    href="#/recipes"
                    className="product-editor-hash-link"
                    onClick={(e) => {
                      e.preventDefault()
                      navigateToRecipesIndex()
                    }}
                  >
                    ir a Recetas
                  </a>{' '}
                  y definir insumos.
                </p>
              )}

              <details className="product-editor-details">
                <summary>Texto, presentación e imagen</summary>
                <div className="product-editor-details__body">
                  {renderProductFieldRow({
                    fieldKey: 'type',
                    label: 'Tipo (API)',
                    canLock: !creating,
                    disabled: saving,
                    display: (
                      <span className="product-editor-field-value-text">
                        {PRODUCT_TYPE_LABELS[
                          isProductTypeSlug(draft.type)
                            ? draft.type
                            : PRODUCT_TYPE_SLUGS[0]
                        ]}{' '}
                        <span className="mono muted small">({draft.type})</span>
                      </span>
                    ),
                    children: (
                      <>
                        <select
                          className="inventory-filter__input"
                          value={
                            isProductTypeSlug(draft.type)
                              ? draft.type
                              : PRODUCT_TYPE_SLUGS[0]
                          }
                          onChange={(e) =>
                            setDraft({ ...draft, type: e.target.value })
                          }
                        >
                          {PRODUCT_TYPE_SLUGS.map((t) => (
                            <option key={t} value={t}>
                              {PRODUCT_TYPE_LABELS[t]}
                            </option>
                          ))}
                        </select>
                        <p className="muted small product-editor-field-hint">
                          Suele alinearse con la categoría (
                          {productTypeLabel(draft.type)}).
                        </p>
                      </>
                    ),
                  })}
                  {renderProductFieldRow({
                    fieldKey: 'description',
                    label: 'Descripción',
                    canLock: !creating,
                    disabled: saving,
                    display: (
                      <span className="product-editor-field-value-text product-editor-field-value-text--multiline">
                        {draft.description.trim() || '—'}
                      </span>
                    ),
                    children: (
                      <textarea
                        className="input-cell"
                        rows={2}
                        value={draft.description}
                        onChange={(e) =>
                          setDraft({ ...draft, description: e.target.value })
                        }
                      />
                    ),
                  })}
                  {renderProductFieldRow({
                    fieldKey: 'size',
                    label: 'Tamaño / presentación',
                    canLock: !creating,
                    disabled: saving,
                    display: (
                      <span className="product-editor-field-value-text">
                        {draft.size.trim() || '—'}
                      </span>
                    ),
                    children: (
                      <input
                        className="input-cell"
                        value={draft.size}
                        onChange={(e) =>
                          setDraft({ ...draft, size: e.target.value })
                        }
                        placeholder="Opcional"
                      />
                    ),
                  })}
                  {renderProductFieldRow({
                    fieldKey: 'imageUrl',
                    label: 'URL de imagen',
                    canLock: !creating,
                    disabled: saving,
                    display: (
                      <span className="mono muted small product-editor-field-value-text product-editor-field-value-text--clip">
                        {draft.imageUrl.trim() || '—'}
                      </span>
                    ),
                    children: (
                      <input
                        className="input-cell"
                        type="url"
                        value={draft.imageUrl}
                        onChange={(e) =>
                          setDraft({ ...draft, imageUrl: e.target.value })
                        }
                        placeholder="https://…"
                      />
                    ),
                  })}
                </div>
              </details>

              {!creating && selectedProductDetail ? (
                <details className="product-editor-details">
                  <summary>Revisión y auditoría</summary>
                  <div className="product-editor-details__body">
                    <div className="product-editor-readonly-block">
                      <span className="product-editor-field-row__label">
                        Último cambio en sistema
                      </span>
                      <p className="mono muted small">
                        {formatSystemDateTime(
                          selectedProductDetail.updatedAt,
                        )}
                      </p>
                    </div>
                    {renderProductFieldRow({
                      fieldKey: 'trace',
                      label: 'Marca de revisión',
                      canLock: true,
                      disabled: saving,
                      display: (
                        <span className="product-editor-field-value-text">
                          {draft.traceModifiedLocal
                            ? (() => {
                                const dt = new Date(
                                  draft.traceModifiedLocal,
                                )
                                return Number.isFinite(dt.getTime())
                                  ? dt.toLocaleString('es-CO', {
                                      dateStyle: 'medium',
                                      timeStyle: 'short',
                                    })
                                  : draft.traceModifiedLocal
                              })()
                            : 'Sin marca'}
                        </span>
                      ),
                      children: (
                        <>
                          <input
                            className="input-cell"
                            type="datetime-local"
                            value={draft.traceModifiedLocal}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                traceModifiedLocal: e.target.value,
                              })
                            }
                          />
                          <p className="muted small product-editor-field-hint">
                            Vacío al guardar limpia la marca en el servidor.
                          </p>
                        </>
                      ),
                    })}
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
                            syncDraftAfterServerProduct(p as ProductRow)
                            setAllProducts((prev) =>
                              prev.map((row) =>
                                row.id === selectedId
                                  ? (p as ProductRow)
                                  : row,
                              ),
                            )
                            showSavedBanner()
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
                </details>
              ) : null}

              {!creating && selectedId ? (
                <details className="product-editor-details">
                  <summary>Historial, compras y precios</summary>
                  <div className="product-editor-details__body product-editor-history-body">
                    {historyLoading ? (
                      <p className="muted small">Cargando historial…</p>
                    ) : historyError ? (
                      <p className="error" role="alert">
                        {historyError}
                      </p>
                    ) : productHistory === null ? (
                      <p className="muted small">
                        Este servidor aún no expone{' '}
                        <span className="mono">GET /products/:id/history</span>.
                        Ver contrato en{' '}
                        <span className="mono">backend/README.md</span>.
                      </p>
                    ) : (
                      <>
                        {productHistory.summary ? (
                          <p className="muted small">
                            {productHistory.summary}
                          </p>
                        ) : null}
                        <p className="small">
                          <strong>
                            {productHistory.lotsCount ??
                              productHistory.lots.length}
                          </strong>{' '}
                          lote
                          {(productHistory.lotsCount ??
                            productHistory.lots.length) !== 1
                            ? 's'
                            : ''}{' '}
                          relacionado
                          {(productHistory.lotsCount ??
                            productHistory.lots.length) !== 1
                            ? 's'
                            : ''}
                          .
                        </p>
                        {productHistory.lots.length === 0 ? (
                          <p className="muted small">
                            Sin lotes enlazados (receta o compras).
                          </p>
                        ) : (
                          <div className="data-table-wrap data-table-elevated product-history-lots-table product-history-lots-table--compact">
                            <table className="data-table data-table-striped">
                              <thead>
                                <tr>
                                  <th>Lote</th>
                                  <th>Fecha</th>
                                  <th>Proveedor</th>
                                  <th className="num">Valor</th>
                                  <th />
                                </tr>
                              </thead>
                              <tbody>
                                {productHistory.lots.map((lot) => (
                                  <tr key={`${lot.code}-${lot.id ?? ''}`}>
                                    <td className="mono">{lot.code}</td>
                                    <td>
                                      {lot.purchaseDate
                                        ? formatSystemDateTime(
                                            lot.purchaseDate,
                                          )
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
                                          onClick={() =>
                                            openPurchaseLotInApp(lot.id!)
                                          }
                                        >
                                          Compra
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
                                  <strong className="mono">
                                    {formatCOP(pt.price)}
                                  </strong>
                                  {pt.kind ? (
                                    <span className="muted small">
                                      {' '}
                                      ({pt.kind})
                                    </span>
                                  ) : null}
                                  {pt.note ? (
                                    <span className="muted small">
                                      {' '}
                                      — {pt.note}
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {productHistory.events &&
                        productHistory.events.length > 0 ? (
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
                                    <span className="muted small">
                                      {' '}
                                      — {ev.detail}
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </details>
              ) : null}

              {saveError ? (
                <p className="error" role="alert">
                  {saveError}
                </p>
              ) : null}
            </div>

            <div
              className={`product-editor-save-popup${saveConfirmPending && !creating ? ' product-editor-save-popup--step2' : ''}`}
              role="toolbar"
              aria-label="Acciones de guardado"
            >
              {saveConfirmPending && !creating ? (
                <p
                  className="product-editor-save-popup__hint"
                  role="status"
                >
                  <span className="product-editor-save-popup__hint-badge" aria-hidden>
                    ②
                  </span>
                  Revisá los cambios. Un segundo toque en{' '}
                  <strong>Confirmar y guardar</strong> los envía al servidor.
                </p>
              ) : null}
              <div className="product-editor-save-popup__actions">
                <button
                  type="button"
                  className={`btn-primary product-editor-save-popup__primary${saveConfirmPending && !creating ? ' product-editor-save-popup__primary--confirm' : ''}`}
                  disabled={
                    saving ||
                    categories.length === 0 ||
                    (!creating && !isDraftDirty && !saveConfirmPending)
                  }
                  onClick={() => void handleSaveOrConfirm()}
                >
                  {saving
                    ? 'Guardando…'
                    : creating
                      ? 'Crear'
                      : saveConfirmPending
                        ? 'Confirmar y guardar'
                        : 'Guardar'}
                </button>
                {saveConfirmPending && !creating ? (
                  <button
                    type="button"
                    className="btn-ghost btn-compact product-editor-save-popup__cancel"
                    disabled={saving}
                    onClick={() => setSaveConfirmPending(false)}
                  >
                    Volver a editar
                  </button>
                ) : null}
                {!creating && !saveConfirmPending ? (
                  <button
                    type="button"
                    className="btn-danger btn-compact product-editor-save-popup__secondary"
                    disabled={saving}
                    onClick={() => void remove()}
                  >
                    Archivar
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
