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
import { SALES_FLOOR_ONLY } from '../appScope'
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
  saleUnit: string
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
    saleUnit: d.saleUnit.trim(),
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
    saleUnit: 'und',
    imageUrl: '',
    active: true,
    traceModifiedLocal: '',
  }
}

function productListMeta(p: ProductRow): string | null {
  const parts: string[] = []
  if (p.size?.trim()) parts.push(p.size.trim())
  const unit = p.saleUnit?.trim()
  if (unit && unit !== 'und') parts.push(unit)
  return parts.length > 0 ? parts.join(' · ') : null
}

/** Resumen de unidad/tamaño por defecto al vender este producto. */
function productSaleDefaultsSummary(d: Draft): string {
  const unit = d.saleUnit.trim() || 'und'
  const size = d.size.trim()
  if (!size) return `Unidad ${unit} · sin tamaño`
  return `Unidad ${unit} · tamaño ${size}`
}

function productHistorySummary(
  loading: boolean,
  error: string | null,
  history: ProductHistoryResponse | null,
): string {
  if (loading) return 'Cargando…'
  if (error) return 'No se pudo cargar'
  if (!history) return 'No disponible en este servidor'
  const lots = history.lotsCount ?? history.lots.length
  const prices = history.salePriceHistory?.length ?? 0
  const events = history.events?.length ?? 0
  const parts = [`${lots} lote${lots !== 1 ? 's' : ''}`]
  if (prices > 0) parts.push(`${prices} cambio${prices !== 1 ? 's' : ''} de precio`)
  if (events > 0) parts.push(`${events} evento${events !== 1 ? 's' : ''}`)
  return parts.join(' · ')
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
    saleUnit: p.saleUnit ?? 'und',
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
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [advancedPopupOpen, setAdvancedPopupOpen] = useState(false)
  const [historyPopupOpen, setHistoryPopupOpen] = useState(false)

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
    setArchiveConfirmOpen(false)
    setAdvancedPopupOpen(false)
    setHistoryPopupOpen(false)
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
          saleUnit: draft.saleUnit.trim() || undefined,
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
          saleUnit: draft.saleUnit.trim() || undefined,
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

  const requestArchive = useCallback(() => {
    if (!selectedId || saving) return
    setArchiveConfirmOpen(true)
  }, [selectedId, saving])

  const cancelArchive = useCallback(() => {
    setArchiveConfirmOpen(false)
  }, [])

  const confirmArchive = useCallback(async () => {
    if (!selectedId) return
    setSaving(true)
    setSaveError(null)
    try {
      await deleteProduct(baseUrl, selectedId)
      setAllProducts((prev) => prev.filter((p) => p.id !== selectedId))
      setArchiveConfirmOpen(false)
      closePanel()
      refreshCatalogSummary()
    } catch (e) {
      setSaveError((e as Error).message)
      setArchiveConfirmOpen(false)
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
        if (historyPopupOpen) {
          setHistoryPopupOpen(false)
          return
        }
        if (advancedPopupOpen) {
          setAdvancedPopupOpen(false)
          return
        }
        if (archiveConfirmOpen) {
          setArchiveConfirmOpen(false)
          return
        }
        if (saveConfirmPending) {
          setSaveConfirmPending(false)
          return
        }
        closePanel()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [
    advancedPopupOpen,
    archiveConfirmOpen,
    closePanel,
    historyPopupOpen,
    panelOpen,
    saveConfirmPending,
  ])

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
    /** Estilo compacto dentro del popup de edición avanzada */
    inAdvancedPopup?: boolean
  }): ReactNode {
    const {
      fieldKey,
      label,
      display,
      canLock,
      disabled,
      children,
      inAdvancedPopup,
    } = args
    const locksOn = canLock
    const unlocked = !locksOn || productUnlockedFields.has(fieldKey)
    const toggle = () => {
      if (disabled) return
      setProductUnlockedFields((prev) => {
        const next = new Set(prev)
        if (next.has(fieldKey)) next.delete(fieldKey)
        else next.add(fieldKey)
        return next
      })
    }
    return (
      <div
        className={`product-editor-field-row${unlocked ? ' product-editor-field-row--unlocked' : ''}${inAdvancedPopup ? ' product-editor-field-row--advanced' : ''}`}
      >
        <div className="product-editor-field-row__main">
          <span className="product-editor-field-row__label">{label}</span>
          {unlocked ? (
            <div className="product-editor-field-row__input">{children}</div>
          ) : locksOn ? (
            <button
              type="button"
              className="product-editor-field-row__value-btn"
              disabled={disabled}
              onClick={toggle}
              aria-label={`Editar ${label}`}
            >
              {display}
            </button>
          ) : (
            <div className="product-editor-field-row__value">{display}</div>
          )}
        </div>
        {locksOn ? (
          <button
            type="button"
            className={`product-editor-field-edit${unlocked ? ' product-editor-field-edit--active' : ''}`}
            disabled={disabled}
            onClick={toggle}
            aria-pressed={unlocked}
            aria-label={unlocked ? `Listo: ${label}` : `Editar ${label}`}
            title={unlocked ? 'Listo' : 'Editar'}
          >
            {unlocked ? (
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            )}
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
          trailing={
            isMobile ? (
              <div className="mobile-list-toolbar__actions">
                <ProductSummaryCard
                  summary={catalogSummary}
                  categories={categories}
                  loading={summaryLoading}
                />
                <FloatingGearFabDockAdd
                  title="Nuevo producto"
                  ariaLabel="Nuevo producto"
                  onClick={openCreate}
                />
              </div>
            ) : undefined
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
                  <div className="data-table-wrap data-table-elevated products-catalog-table-wrap">
                  <table className="data-table data-table-striped data-table--products-catalog">
                    <thead>
                      <tr>
                        <th className="products-table-col products-table-col--name">
                          Producto
                        </th>
                        <th className="products-table-col products-table-col--price num">
                          Precio
                        </th>
                        <th className="products-table-col products-table-col--status">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.products.map((p) => {
                        const meta = productListMeta(p)
                        return (
                        <tr
                          key={p.id}
                          className={
                            selectedId === p.id
                              ? 'row-active products-table-row--active'
                              : ''
                          }
                        >
                          <td className="products-table-cell products-table-cell--name">
                            <button
                              type="button"
                              className="table-link products-table-link"
                              onMouseEnter={() => prefetchProductDetail(p.id)}
                              onFocus={() => prefetchProductDetail(p.id)}
                              onClick={() => void openEdit(p.id)}
                            >
                              <span className="products-table-link__name">
                                {p.name}
                              </span>
                              {meta ? (
                                <span className="products-table-link__meta muted small">
                                  {meta}
                                </span>
                              ) : null}
                            </button>
                          </td>
                          <td className="num mono products-table-cell products-table-cell--price">
                            {formatCOP(p.price)}
                          </td>
                          <td className="products-table-cell products-table-cell--status">
                            {p.active ? (
                              <span className="badge badge-ok">Activo</span>
                            ) : (
                              <span className="badge badge-muted">Inactivo</span>
                            )}
                          </td>
                        </tr>
                        )
                      })}
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
            if (e.target !== e.currentTarget) return
            if (archiveConfirmOpen) {
              cancelArchive()
              return
            }
            closePanel()
          }}
        >
          <section
            className="modal modal--product-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-editor-title"
          >
            <header className="modal-head modal-head--product-editor">
              <div className="modal-head-title product-editor-head__title">
                {creating ? (
                  <>
                    <h2 id="product-editor-title">Nuevo producto</h2>
                    <p className="modal-subtitle product-editor-head__subtitle">
                      Precio, categoría y visibilidad en ventas
                    </p>
                  </>
                ) : (
                  <>
                    <p className="product-editor-head__eyebrow">Editar producto</p>
                    <h2 id="product-editor-title">
                      {draft.name?.trim() || 'Sin nombre'}
                    </h2>
                    <p className="modal-subtitle product-editor-head__subtitle">
                      {categories.find((c) => c.id === draft.categoryId)?.name ??
                        'Sin categoría'}
                      {draft.active ? (
                        <span className="product-editor-head__status"> · Activo</span>
                      ) : (
                        <span className="product-editor-head__status product-editor-head__status--off">
                          {' '}
                          · Inactivo
                        </span>
                      )}
                    </p>
                  </>
                )}
              </div>
              <div className="modal-head-actions product-editor-head__actions">
                <button
                  type="button"
                  className="product-editor-close"
                  onClick={closePanel}
                  aria-label="Cerrar editor"
                >
                  <span aria-hidden>×</span>
                </button>
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

              {!SALES_FLOOR_ONLY && !creating && selectedId ? (
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
              ) : !SALES_FLOOR_ONLY ? (
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
              ) : null}

              <div className="product-editor-extra-links" role="group" aria-label="Más opciones">
                <p className="product-editor-extra-links__label">Más opciones</p>
                <div className="product-editor-extra-links__grid">
                  <button
                    type="button"
                    className="product-editor-link-card product-editor-link-card--advanced"
                    onClick={() => setAdvancedPopupOpen(true)}
                  >
                    <span className="product-editor-link-card__copy">
                      <span className="product-editor-link-card__title">
                        Edición avanzada
                      </span>
                      <span className="product-editor-link-card__preview muted small">
                        {productSaleDefaultsSummary(draft)}
                      </span>
                    </span>
                    <span className="product-editor-link-card__chevron" aria-hidden />
                  </button>
                  {!creating && selectedId ? (
                    <button
                      type="button"
                      className="product-editor-link-card product-editor-link-card--history"
                      onClick={() => setHistoryPopupOpen(true)}
                    >
                      <span className="product-editor-link-card__copy">
                        <span className="product-editor-link-card__title">
                          Historial
                        </span>
                        <span className="product-editor-link-card__preview muted small">
                          {productHistorySummary(
                            historyLoading,
                            historyError,
                            productHistory,
                          )}
                        </span>
                      </span>
                      <span className="product-editor-link-card__chevron" aria-hidden />
                    </button>
                  ) : null}
                </div>
              </div>

              {saveError ? (
                <p className="error" role="alert">
                  {saveError}
                </p>
              ) : null}

              {!creating && selectedId ? (
                <div
                  className="product-editor-archive-bar"
                  role="group"
                  aria-label="Archivar producto"
                >
                  <button
                    type="button"
                    className="product-editor-btn product-editor-btn--danger product-editor-btn--archive-full"
                    onClick={requestArchive}
                    disabled={saving || archiveConfirmOpen}
                  >
                    Archivar producto
                  </button>
                </div>
              ) : null}
            </div>

            {(creating || isDraftDirty || saveConfirmPending) ? (
              <footer
                className={`product-editor-footer${saveConfirmPending && !creating ? ' product-editor-footer--confirm' : ''}`}
                role="toolbar"
                aria-label="Guardar producto"
              >
                {saveConfirmPending && !creating ? (
                  <p className="product-editor-footer__hint" role="status">
                    <span className="product-editor-footer__hint-step" aria-hidden>
                      2
                    </span>
                    Revisá los cambios. Tocá otra vez{' '}
                    <strong>Confirmar y guardar</strong> para aplicarlos.
                  </p>
                ) : null}
                <div className="product-editor-footer__actions">
                  <button
                    type="button"
                    className={`product-editor-btn product-editor-btn--primary${saveConfirmPending && !creating ? ' product-editor-btn--confirm' : ''}`}
                    disabled={saving || categories.length === 0}
                    onClick={() => void handleSaveOrConfirm()}
                  >
                    {saving
                      ? 'Guardando…'
                      : creating
                        ? 'Crear producto'
                        : saveConfirmPending
                          ? 'Confirmar y guardar'
                          : 'Guardar cambios'}
                  </button>
                  {saveConfirmPending && !creating ? (
                    <button
                      type="button"
                      className="product-editor-btn product-editor-btn--secondary"
                      disabled={saving}
                      onClick={() => setSaveConfirmPending(false)}
                    >
                      Seguir editando
                    </button>
                  ) : null}
                </div>
              </footer>
            ) : null}

            {archiveConfirmOpen && !creating ? (
              <div
                className="product-editor-confirm-layer"
                role="presentation"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) cancelArchive()
                }}
              >
                <div
                  className="product-editor-confirm"
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby="product-archive-confirm-title"
                  aria-describedby="product-archive-confirm-desc"
                >
                  <h3
                    id="product-archive-confirm-title"
                    className="product-editor-confirm__title"
                  >
                    ¿Archivar este producto?
                  </h3>
                  <p
                    id="product-archive-confirm-desc"
                    className="product-editor-confirm__desc"
                  >
                    <strong>{draft.name?.trim() || 'Sin nombre'}</strong> dejará
                    de mostrarse en la carta y en ventas. Podés cancelar si no
                    estás seguro.
                  </p>
                  <div className="product-editor-confirm__actions">
                    <button
                      type="button"
                      className="product-editor-btn product-editor-btn--secondary"
                      disabled={saving}
                      onClick={cancelArchive}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="product-editor-btn product-editor-btn--danger"
                      disabled={saving}
                      onClick={() => void confirmArchive()}
                    >
                      {saving ? 'Archivando…' : 'Sí, archivar'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          {advancedPopupOpen && draft ? (
            <div
              className="modal-backdrop modal-backdrop--product-submodal"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setAdvancedPopupOpen(false)
              }}
            >
              <section
                className="modal modal--product-submodal modal--product-advanced-popup"
                role="dialog"
                aria-modal="true"
                aria-labelledby="product-advanced-popup-title"
              >
                <header className="modal-head modal-head--product-submodal modal-head--product-submodal--advanced">
                  <div className="modal-head-title product-submodal-head__copy">
                    <h2 id="product-advanced-popup-title">Edición avanzada</h2>
                    <p className="product-submodal-head__product">
                      {draft.name?.trim() || 'Sin nombre'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="product-editor-close"
                    onClick={() => setAdvancedPopupOpen(false)}
                    aria-label="Cerrar edición avanzada"
                  >
                    <span aria-hidden>×</span>
                  </button>
                </header>
                <div className="modal-body modal-body--product-submodal">
                  <div className="product-submodal-callout" role="note">
                    <p className="product-submodal-callout__text muted small">
                      Unidad, tamaño, texto e imagen del catálogo. Se usan al
                      enlazar el producto en una venta. Los cambios se guardan con
                      el botón principal del producto.
                    </p>
                  </div>
                  <div className="product-editor-panel-scroll product-editor-panel-scroll--popup product-advanced-fields">
                  <section className="product-editor-subsection product-editor-subsection--advanced-sale">
                    <header className="product-editor-subsection__head">
                      <h4 className="product-editor-subsection__title">
                        Venta: unidad y tamaño
                      </h4>
                    </header>
                    <div className="product-editor-subsection__body">
                      <p className="product-editor-sale-defaults-preview muted small">
                        <strong>Por defecto en ventas:</strong>{' '}
                        {productSaleDefaultsSummary(draft)}
                      </p>
                      {renderProductFieldRow({
                        fieldKey: 'saleUnit',
                        label: 'Unidad de venta',
                        inAdvancedPopup: true,
                        canLock: !creating,
                        disabled: saving,
                        display: (
                          <span className="product-editor-field-value-text">
                            {draft.saleUnit.trim() || '—'}
                          </span>
                        ),
                        children: (
                          <input
                            className="input-cell"
                            value={draft.saleUnit}
                            onChange={(e) =>
                              setDraft({ ...draft, saleUnit: e.target.value })
                            }
                            placeholder="und, porción, oz…"
                            list="product-sale-unit-suggestions"
                          />
                        ),
                      })}
                      {renderProductFieldRow({
                        fieldKey: 'size',
                        label: 'Tamaño / presentación',
                        inAdvancedPopup: true,
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
                            placeholder="6 oz, 330 ml…"
                          />
                        ),
                      })}
                    </div>
                  </section>

                  <datalist id="product-sale-unit-suggestions">
                    <option value="und" />
                    <option value="porción" />
                    <option value="oz" />
                    <option value="ml" />
                    <option value="litro" />
                  </datalist>

                  <section className="product-editor-subsection">
                    <header className="product-editor-subsection__head">
                      <h4 className="product-editor-subsection__title">
                        Texto e imagen
                      </h4>
                    </header>
                    <div className="product-editor-subsection__body">
                  {renderProductFieldRow({
                    fieldKey: 'type',
                    label: 'Tipo (API)',
                    inAdvancedPopup: true,
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
                    inAdvancedPopup: true,
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
                    fieldKey: 'imageUrl',
                    label: 'URL de imagen',
                    inAdvancedPopup: true,
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
                  </section>

                  {!creating && selectedProductDetail ? (
                    <section className="product-editor-subsection">
                      <header className="product-editor-subsection__head">
                        <h4 className="product-editor-subsection__title">
                          Revisión y auditoría
                        </h4>
                      </header>
                      <div className="product-editor-subsection__body">
                    <div className="product-editor-readonly-block product-editor-readonly-block--audit">
                      <span className="product-editor-field-row__label">
                        Último cambio en sistema
                      </span>
                      <p className="product-editor-readonly-block__value mono">
                        {formatSystemDateTime(
                          selectedProductDetail.updatedAt,
                        )}
                      </p>
                    </div>
                    {renderProductFieldRow({
                      fieldKey: 'trace',
                      label: 'Marca de revisión',
                      inAdvancedPopup: true,
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
                    </section>
                  ) : null}
                  </div>
                </div>
                <footer
                  className="product-editor-footer product-submodal-footer"
                  role="toolbar"
                >
                  <button
                    type="button"
                    className="product-editor-btn product-editor-btn--primary"
                    onClick={() => setAdvancedPopupOpen(false)}
                  >
                    Listo
                  </button>
                </footer>
              </section>
            </div>
          ) : null}

          {historyPopupOpen && !creating && selectedId ? (
            <div
              className="modal-backdrop modal-backdrop--product-submodal"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setHistoryPopupOpen(false)
              }}
            >
              <section
                className="modal modal--product-submodal modal--product-history-popup"
                role="dialog"
                aria-modal="true"
                aria-labelledby="product-history-popup-title"
              >
                <header className="modal-head modal-head--product-submodal modal-head--product-submodal--history">
                  <div className="modal-head-title product-submodal-head__copy">
                    <h2 id="product-history-popup-title">Historial</h2>
                    <p className="product-submodal-head__product">
                      {draft.name?.trim() || 'Sin nombre'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="product-editor-close"
                    onClick={() => setHistoryPopupOpen(false)}
                    aria-label="Cerrar historial"
                  >
                    <span aria-hidden>×</span>
                  </button>
                </header>
                <div className="modal-body modal-body--product-submodal modal-body--product-submodal--history">
                  <div className="product-editor-panel-scroll product-editor-panel-scroll--popup product-editor-panel-scroll--history">
                    {historyLoading ? (
                      <p className="product-editor-panel-empty muted small">
                        Cargando historial…
                      </p>
                    ) : historyError ? (
                      <p className="error product-editor-panel-empty" role="alert">
                        {historyError}
                      </p>
                    ) : productHistory === null ? (
                      <div className="product-editor-panel-empty product-history-unavailable">
                        <p className="product-history-unavailable__title">
                          Historial no disponible
                        </p>
                        <p className="muted small">
                          El servidor no respondió al historial del producto.
                          Reiniciá la API o actualizá el backend.
                        </p>
                      </div>
                    ) : (
                      <>
                        {productHistory.summary ? (
                          <p className="product-history-intro muted small">
                            {productHistory.summary}
                          </p>
                        ) : null}

                        <section className="product-editor-subsection product-editor-subsection--history">
                          <header className="product-editor-subsection__head">
                            <h4 className="product-editor-subsection__title">
                              Lotes de compra
                            </h4>
                            <span className="product-editor-subsection__badge">
                              {productHistory.lotsCount ??
                                productHistory.lots.length}
                            </span>
                          </header>
                          <div className="product-editor-subsection__body">
                        {productHistory.lots.length === 0 ? (
                          <p className="muted small product-editor-panel-empty">
                            Sin lotes enlazados (receta o compras).
                          </p>
                        ) : (
                          <div className="product-history-table-wrap">
                            <table className="product-history-table">
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
                                      {lot.id && !SALES_FLOOR_ONLY ? (
                                        <button
                                          type="button"
                                          className="btn-secondary btn-compact"
                                          onClick={() =>
                                            openPurchaseLotInApp(lot.id!)
                                          }
                                        >
                                          Compra
                                        </button>
                                      ) : (
                                        '—'
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                          </div>
                        </section>

                        {productHistory.salePriceHistory &&
                        productHistory.salePriceHistory.length > 0 ? (
                          <section className="product-editor-subsection product-editor-subsection--history">
                            <header className="product-editor-subsection__head">
                              <h4 className="product-editor-subsection__title">
                                Precios de venta
                              </h4>
                              <span className="product-editor-subsection__badge">
                                {productHistory.salePriceHistory.length}
                              </span>
                            </header>
                            <ul className="product-history-timeline">
                              {productHistory.salePriceHistory.map((pt, i) => (
                                <li
                                  key={`${pt.effectiveAt}-${i}`}
                                  className="product-history-timeline__item"
                                >
                                  <time className="product-history-timeline__when mono muted small">
                                    {formatSystemDateTime(pt.effectiveAt)}
                                  </time>
                                  <span className="product-history-timeline__price mono">
                                    {formatCOP(pt.price)}
                                  </span>
                                  {(pt.kind || pt.note) && (
                                    <span className="product-history-timeline__meta muted small">
                                      {[pt.kind, pt.note].filter(Boolean).join(' · ')}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </section>
                        ) : null}

                        {productHistory.events &&
                        productHistory.events.length > 0 ? (
                          <section className="product-editor-subsection product-editor-subsection--history">
                            <header className="product-editor-subsection__head">
                              <h4 className="product-editor-subsection__title">
                                Eventos
                              </h4>
                              <span className="product-editor-subsection__badge">
                                {productHistory.events.length}
                              </span>
                            </header>
                            <ul className="product-history-timeline product-history-timeline--events">
                              {productHistory.events.map((ev, i) => (
                                <li
                                  key={`${ev.at}-${i}`}
                                  className="product-history-timeline__item"
                                >
                                  <time className="product-history-timeline__when mono muted small">
                                    {formatSystemDateTime(ev.at)}
                                  </time>
                                  <span className="product-history-timeline__label">
                                    {ev.label}
                                  </span>
                                  {ev.detail ? (
                                    <span className="product-history-timeline__meta muted small">
                                      {ev.detail}
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </section>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
                <footer
                  className="product-editor-footer product-submodal-footer"
                  role="toolbar"
                >
                  <button
                    type="button"
                    className="product-editor-btn product-editor-btn--primary"
                    onClick={() => setHistoryPopupOpen(false)}
                  >
                    Cerrar
                  </button>
                </footer>
              </section>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
