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
  deleteProduct,
  fetchInventoryOptions,
  fetchProduct,
  fetchProductCategories,
  fetchProductHistory,
  fetchProductSalesStats,
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
import { ProductRecipePopup } from './ProductRecipePopup'
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
  type ProductTypeSlug,
} from '../productTypes'
import { formatCOP as formatCOPMoney, parseMoney } from '../lib/money'
import { computeRecipeUnitCostCOP } from '../lib/recipeUnitCost'
import {
  marginPercentOnPrice,
  profitFromPriceAndCost,
  unitCostToNumber,
} from '../lib/productEconomics'

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

type CostMode = 'manual' | 'recipe'

type Draft = {
  name: string
  sku: string
  price: string
  unitCost: string
  costMode: CostMode
  categoryId: string
  type: string
  description: string
  size: string
  saleUnit: string
  imageUrl: string
  active: boolean
  traceModifiedLocal: string
}

function emptyDraft(categories: CategoryRef[]): Draft {
  const first = categories[0]
  return {
    name: '',
    sku: '',
    price: '',
    unitCost: '',
    costMode: 'manual',
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

function productTableMargin(p: ProductRow): string {
  const price =
    typeof p.price === 'number'
      ? p.price
      : parseFloat(String(p.price).replace(',', '.'))
  const cost = unitCostToNumber(p.unitCost ?? p.cost ?? null)
  const m = marginPercentOnPrice(
    Number.isFinite(price) ? price : NaN,
    cost,
  )
  if (m == null) return '—'
  return `${m}%`
}

function productTableCost(p: ProductRow): string {
  const cost = unitCostToNumber(p.unitCost ?? p.cost ?? null)
  if (cost == null || cost <= 0) return '—'
  return formatCOPMoney(cost)
}

function productTableProfit(p: ProductRow): string {
  const price = priceToNumber(p.price)
  const cost = unitCostToNumber(p.unitCost ?? p.cost ?? null)
  const profit = profitFromPriceAndCost(price, cost)
  if (profit == null) return '—'
  return formatCOPMoney(profit)
}

function productTableUpdatedParts(
  iso: string | null | undefined,
): { date: string; time: string } | null {
  if (!iso?.trim()) return null
  const d = new Date(iso.trim())
  if (Number.isNaN(d.getTime())) return null
  return {
    date: new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(d),
    time: new Intl.DateTimeFormat('es-CO', { timeStyle: 'short' }).format(d),
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

function formatUnitsSold(units: number): string {
  if (units <= 0) return '0'
  return units % 1 === 0 ? units.toFixed(0) : units.toFixed(1)
}

function sortProductsBySales(
  rows: ProductRow[],
  unitsSoldByProductId: Map<string, number>,
): ProductRow[] {
  return [...rows].sort((a, b) => {
    const soldA = unitsSoldByProductId.get(a.id) ?? 0
    const soldB = unitsSoldByProductId.get(b.id) ?? 0
    if (soldB !== soldA) return soldB - soldA
    return a.name.localeCompare(b.name, 'es')
  })
}

function partitionGridBySales(
  rows: ProductRow[],
  unitsSoldByProductId: Map<string, number>,
): { topSellers: ProductRow[]; rest: ProductRow[] } {
  const sorted = sortProductsBySales(rows, unitsSoldByProductId)
  const topSellers: ProductRow[] = []
  const rest: ProductRow[] = []
  for (const row of sorted) {
    if ((unitsSoldByProductId.get(row.id) ?? 0) > 0) topSellers.push(row)
    else rest.push(row)
  }
  return { topSellers, rest }
}

function resolveDraftType(d: Draft, categories: CategoryRef[]): ProductTypeSlug {
  const normalized = normalizeProductType(d.type)
  if (isProductTypeSlug(normalized)) return normalized
  const cat = categories.find((c) => c.id === d.categoryId)
  if (cat) return inferProductTypeFromCategory(cat)
  return PRODUCT_TYPE_SLUGS[0]
}

/** Costo en borrador: vacío si es 0 o no declarado (no prellenar con cero). */
function draftUnitCostFromProduct(p: ProductRow): string {
  const n = unitCostToNumber(p.unitCost ?? p.cost ?? null)
  if (n == null || n <= 0) return ''
  return String(Math.round(n))
}

function resolveUnitCostForSave(
  draft: Draft,
  detailRecipe: unknown,
  inventoryOptions: InventoryOption[],
  selectedProductDetail: ProductRow | null,
): number | undefined {
  if (draft.unitCost.trim()) {
    const fromInput = Math.round(parseMoney(draft.unitCost))
    if (fromInput > 0) return fromInput
  }
  if (draft.costMode === 'recipe') {
    const fromRecipe = computeRecipeUnitCostCOP(
      parseProductRecipeFull(detailRecipe),
      inventoryOptions,
    )
    if (fromRecipe != null && fromRecipe > 0) return fromRecipe
  }
  const stored = unitCostToNumber(
    selectedProductDetail?.unitCost ?? selectedProductDetail?.cost ?? null,
  )
  if (stored != null && stored > 0) return Math.round(stored)
  return undefined
}

function draftHasZeroOrMissingCost(
  draft: Draft,
  detailRecipe: unknown,
  inventoryOptions: InventoryOption[],
  selectedProductDetail: ProductRow | null,
): boolean {
  const resolved = resolveUnitCostForSave(
    draft,
    detailRecipe,
    inventoryOptions,
    selectedProductDetail,
  )
  return resolved == null || resolved <= 0
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
    sku: p.sku?.trim() ?? '',
    price: String(priceToNumber(p.price)),
    unitCost: draftUnitCostFromProduct(p),
    costMode: p.costSource === 'RECIPE' ? 'recipe' : 'manual',
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

function validateProductDraft(
  d: Draft,
  categories: CategoryRef[],
  creating: boolean,
): string | null {
  if (!d.name.trim()) return 'El nombre es obligatorio.'
  if (creating) {
    const skuTrim = d.sku.trim()
    if (skuTrim && !/^\d{4}$/.test(skuTrim)) {
      return 'El código debe ser exactamente 4 dígitos (ej. 1001).'
    }
  }
  const price = parseFloat(d.price.replace(',', '.'))
  if (!Number.isFinite(price) || price < 0) return 'Precio inválido.'
  if (d.costMode === 'manual' && d.unitCost.trim()) {
    const u = parseMoney(d.unitCost)
    if (!Number.isFinite(u) || u < 0) return 'Costo unitario inválido.'
  }
  if (!d.categoryId) return 'Elige una categoría.'
  const typeResolved = resolveDraftType(d, categories)
  if (!isProductTypeSlug(typeResolved)) {
    return `El tipo debe ser uno de: ${PRODUCT_TYPE_SLUGS.join(', ')} (p. ej. bar, comida, combos).`
  }
  return null
}

function draftEconomics(
  d: Draft,
  effectiveUnitCost: number | null,
): {
  profit: number | null
  marginPct: number | null
} {
  const price = parseMoney(d.price)
  return {
    profit: profitFromPriceAndCost(price, effectiveUnitCost),
    marginPct: marginPercentOnPrice(price, effectiveUnitCost),
  }
}

function ProductGridCard({
  product: p,
  rank,
  unitsSold,
  categoryName,
  meta,
  selected,
  onPrefetch,
  onSelect,
}: {
  product: ProductRow
  rank: number
  unitsSold: number
  categoryName: string | undefined
  meta: string | null
  selected: boolean
  onPrefetch: () => void
  onSelect: () => void
}) {
  return (
    <li>
      <button
        type="button"
        className={
          selected
            ? 'product-card product-card--catalog active'
            : 'product-card product-card--catalog'
        }
        onMouseEnter={onPrefetch}
        onFocus={onPrefetch}
        onClick={onSelect}
      >
        <div className="product-card-body">
          <div className="products-catalog-grid__stats">
            <span
              className={`products-catalog-grid__rank${rank <= 3 && unitsSold > 0 ? ` products-catalog-grid__rank--${rank}` : ''}`}
              title={`Puesto #${rank} en ventas`}
            >
              #{rank}
            </span>
            <div className="products-catalog-grid__qty" aria-label={`${formatUnitsSold(unitsSold)} vendidos`}>
              <strong className="products-catalog-grid__qty-value mono">
                {formatUnitsSold(unitsSold)}
              </strong>
              <span className="products-catalog-grid__qty-label">vendidos</span>
            </div>
          </div>
          <div className="products-catalog-grid__head">
            <span className="product-card-name">{p.name}</span>
          </div>
          <div className="products-catalog-grid__price-row">
            <span className="products-catalog-grid__price mono">{formatCOP(p.price)}</span>
            {p.sku?.trim() ? (
              <span className="products-catalog-grid__sku mono muted">{p.sku.trim()}</span>
            ) : null}
          </div>
          {categoryName || meta ? (
            <p className="products-catalog-grid__meta muted small">
              {[categoryName, meta].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </div>
      </button>
    </li>
  )
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
  >('active')
  const [filterType, setFilterType] = useState('')
  const [sortBy, setSortBy] = useState<ProductListSort>('name')
  const [catalogViewMode, setCatalogViewMode] = useState<'grid' | 'list'>('grid')
  const [salesStatsByProductId, setSalesStatsByProductId] = useState(
    () => new Map<string, { unitsSold: number; revenue: number }>(),
  )
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
  const [saveBannerVisible, setSaveBannerVisible] = useState(false)
  const [savePulse, setSavePulse] = useState(false)
  const [saveAnimKey, setSaveAnimKey] = useState(0)
  const saveBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savePulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [zeroCostWarning, setZeroCostWarning] = useState<'close' | 'save' | null>(
    null,
  )
  const [historyPopupOpen, setHistoryPopupOpen] = useState(false)
  const [recipePopupOpen, setRecipePopupOpen] = useState(false)
  const [inventoryOptions, setInventoryOptions] = useState<InventoryOption[]>([])

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

  const unitsSoldByProductId = useMemo(() => {
    const map = new Map<string, number>()
    for (const [productId, stat] of salesStatsByProductId) {
      map.set(productId, stat.unitsSold)
    }
    return map
  }, [salesStatsByProductId])

  const gridProducts = useMemo(() => {
    const activeOnly = allProducts.filter((p) => p.active)
    return sortProductsBySales(activeOnly, unitsSoldByProductId)
  }, [allProducts, unitsSoldByProductId])

  const gridSections = useMemo(
    () => partitionGridBySales(gridProducts, unitsSoldByProductId),
    [gridProducts, unitsSoldByProductId],
  )

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of categories) map.set(c.id, c.name)
    return map
  }, [categories])

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
    fetchProductSalesStats(baseUrl)
      .then((stats) => {
        if (cancelled) return
        const map = new Map<string, { unitsSold: number; revenue: number }>()
        for (const row of stats) {
          map.set(row.productId, {
            unitsSold: row.unitsSold,
            revenue: row.revenue,
          })
        }
        setSalesStatsByProductId(map)
      })
      .catch(() => {
        if (!cancelled) setSalesStatsByProductId(new Map())
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
    setSaveError(null)
    setSaveBannerVisible(false)
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
        const rd = rowToDraft(p, categories)
        setDraft(rd)
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
    if (savePulseTimerRef.current) {
      clearTimeout(savePulseTimerRef.current)
      savePulseTimerRef.current = null
    }
    setSavePulse(false)
    setSelectedId(null)
    setCreating(false)
    setDraft(null)
    setSelectedProductDetail(null)
    setDetailRecipe(null)
    setSaveError(null)
    setProductHistory(null)
    setHistoryError(null)
    setHistoryLoading(false)
    setSaveBannerVisible(false)
    setArchiveConfirmOpen(false)
    setZeroCostWarning(null)
    setHistoryPopupOpen(false)
    setRecipePopupOpen(false)
  }, [])

  const requestClosePanel = useCallback(() => {
    if (
      draft &&
      draftHasZeroOrMissingCost(
        draft,
        detailRecipe,
        inventoryOptions,
        selectedProductDetail,
      )
    ) {
      setZeroCostWarning('close')
      return
    }
    closePanel()
  }, [
    closePanel,
    detailRecipe,
    draft,
    inventoryOptions,
    selectedProductDetail,
  ])

  const navigateToRecipesIndex = useCallback(() => {
    closePanel()
    window.location.hash = '#/recipes'
  }, [closePanel])

  const showSavedBanner = useCallback(() => {
    setSaveAnimKey((k) => k + 1)
    setSaveBannerVisible(true)
    setSavePulse(true)
    if (saveBannerTimerRef.current) {
      clearTimeout(saveBannerTimerRef.current)
    }
    saveBannerTimerRef.current = window.setTimeout(() => {
      setSaveBannerVisible(false)
      saveBannerTimerRef.current = null
    }, 3400)
    if (savePulseTimerRef.current) {
      clearTimeout(savePulseTimerRef.current)
    }
    savePulseTimerRef.current = window.setTimeout(() => {
      setSavePulse(false)
      savePulseTimerRef.current = null
    }, 2400)
  }, [])

  const syncDraftAfterServerProduct = useCallback(
    (p: ProductRow) => {
      const next = rowToDraft(p, categories)
      setDraft(next)
      setSelectedProductDetail(p)
      setDetailRecipe('recipe' in p ? p.recipe : null)
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

  const save = useCallback(async (opts?: {
    afterSuccess?: () => void
    skipZeroCostCheck?: boolean
  }) => {
    if (!draft) return
    const validationError = validateProductDraft(draft, categories, creating)
    if (validationError) {
      setSaveError(validationError)
      return
    }
    if (
      !opts?.skipZeroCostCheck &&
      draftHasZeroOrMissingCost(
        draft,
        detailRecipe,
        inventoryOptions,
        selectedProductDetail,
      )
    ) {
      setZeroCostWarning('save')
      return
    }
    const price = Math.round(parseMoney(draft.price))
    const typeTrim = resolveDraftType(draft, categories)
    const costSource = draft.costMode === 'recipe' ? 'RECIPE' : 'MANUAL'
    const unitCostForApi = resolveUnitCostForSave(
      draft,
      detailRecipe,
      inventoryOptions,
      selectedProductDetail,
    )
    const skuForApi = draft.sku.trim() || null
    const costPayload =
      unitCostForApi !== undefined ? { unitCost: unitCostForApi } : {}
    setSaving(true)
    setSaveError(null)
    try {
      let savedRow: ProductRow | null = null
      if (creating) {
        savedRow = await createProduct(baseUrl, {
          name: draft.name.trim(),
          sku: skuForApi,
          price,
          categoryId: draft.categoryId,
          type: typeTrim,
          description: draft.description.trim() || undefined,
          size: draft.size.trim() || undefined,
          saleUnit: draft.saleUnit.trim() || undefined,
          imageUrl: draft.imageUrl.trim() || undefined,
          active: draft.active,
          costSource,
          ...costPayload,
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
          costSource,
          ...costPayload,
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
        opts?.afterSuccess?.()
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
    detailRecipe,
    inventoryOptions,
    refreshCatalogSummary,
    selectedId,
    selectedProductDetail,
    showSavedBanner,
    syncDraftAfterServerProduct,
  ])

  const confirmZeroCostWarning = useCallback(() => {
    const mode = zeroCostWarning
    setZeroCostWarning(null)
    if (mode === 'close') closePanel()
    else if (mode === 'save') void save({ skipZeroCostCheck: true })
  }, [closePanel, save, zeroCostWarning])

  const cancelZeroCostWarning = useCallback(() => {
    setZeroCostWarning(null)
  }, [])

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

  const recipeUnitCostLive = useMemo(() => {
    if (draft?.costMode !== 'recipe') return null
    return computeRecipeUnitCostCOP(
      parseProductRecipeFull(detailRecipe),
      inventoryOptions,
    )
  }, [detailRecipe, draft?.costMode, inventoryOptions])

  const effectiveUnitCost = useMemo((): number | null => {
    if (!draft) return null
    if (draft.unitCost.trim()) {
      const fromInput = unitCostToNumber(draft.unitCost)
      if (fromInput != null && fromInput > 0) return fromInput
    }
    if (draft.costMode === 'recipe') return recipeUnitCostLive
    return null
  }, [draft, recipeUnitCostLive])

  useEffect(() => {
    if (!panelOpen || SALES_FLOOR_ONLY) return
    let cancelled = false
    fetchInventoryOptions(baseUrl)
      .then((rows) => {
        if (!cancelled) setInventoryOptions(rows)
      })
      .catch(() => {
        if (!cancelled) setInventoryOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [baseUrl, panelOpen])

  const handleSave = useCallback(() => {
    if (!draft || saving || categories.length === 0) return
    void save()
  }, [categories.length, draft, save, saving])

  useEffect(() => {
    if (!panelOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (historyPopupOpen) {
          setHistoryPopupOpen(false)
          return
        }
        if (recipePopupOpen) {
          setRecipePopupOpen(false)
          return
        }
        if (archiveConfirmOpen) {
          setArchiveConfirmOpen(false)
          return
        }
        if (zeroCostWarning) {
          setZeroCostWarning(null)
          return
        }
        requestClosePanel()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [
    archiveConfirmOpen,
    historyPopupOpen,
    panelOpen,
    recipePopupOpen,
    requestClosePanel,
    zeroCostWarning,
  ])

  function renderProductFieldRow(args: {
    fieldKey?: string
    label: string
    display?: ReactNode
    canLock?: boolean
    disabled?: boolean
    children: ReactNode
    inAdvancedPopup?: boolean
  }): ReactNode {
    const { label, children, inAdvancedPopup } = args
    return (
      <div
        className={`product-editor-field-row product-editor-field-row--unlocked${inAdvancedPopup ? ' product-editor-field-row--advanced' : ''}`}
      >
        <div className="product-editor-field-row__main">
          <span className="product-editor-field-row__label">{label}</span>
          <div className="product-editor-field-row__input">{children}</div>
        </div>
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
              <div className="vos-toolbar__actions mobile-list-toolbar__actions">
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

        <div className="products-page-head">
          <div className="products-page-intro">
            <p className="products-dashboard-lead muted">
              Productos a la venta para carta y tickets.
              {catalogViewMode === 'grid' ? (
                <>
                  {' '}
                  Ordenados por unidades vendidas; la cantidad aparece en cada tarjeta.
                </>
              ) : null}
            </p>
          </div>
          <div className="products-toolbar-actions products-toolbar-actions--top">
            <div
              className="view-toggle module-view-toggle"
              role="tablist"
              aria-label="Vista de productos"
            >
              <button
                type="button"
                role="tab"
                aria-selected={catalogViewMode === 'grid'}
                className={catalogViewMode === 'grid' ? 'active' : ''}
                onClick={() => setCatalogViewMode('grid')}
              >
                Cuadrícula
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={catalogViewMode === 'list'}
                className={catalogViewMode === 'list' ? 'active' : ''}
                onClick={() => setCatalogViewMode('list')}
              >
                Lista
              </button>
            </div>
          </div>
        </div>

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

        {catalogViewMode === 'grid' ? (
          <div className="products-catalog-grid-wrap">
            {gridSections.topSellers.length > 0 ? (
              <section className="products-catalog-grid-section" aria-label="Más vendidos">
                <h2 className="products-catalog-grid-section__title">Más vendidos</h2>
                <ul className="product-cards products-catalog-grid">
                  {gridSections.topSellers.map((p, index) => (
                    <ProductGridCard
                      key={p.id}
                      product={p}
                      rank={index + 1}
                      unitsSold={unitsSoldByProductId.get(p.id) ?? 0}
                      categoryName={categoryNameById.get(p.categoryId)}
                      meta={productListMeta(p)}
                      selected={selectedId === p.id}
                      onPrefetch={() => prefetchProductDetail(p.id)}
                      onSelect={() => void openEdit(p.id)}
                    />
                  ))}
                </ul>
              </section>
            ) : null}
            {gridSections.rest.length > 0 ? (
              <section
                className="products-catalog-grid-section"
                aria-label={
                  gridSections.topSellers.length > 0
                    ? 'Resto del catálogo'
                    : 'Productos a la venta en cuadrícula'
                }
              >
                {gridSections.topSellers.length > 0 ? (
                  <h2 className="products-catalog-grid-section__title">Resto del catálogo</h2>
                ) : null}
                <ul className="product-cards products-catalog-grid">
                  {gridSections.rest.map((p, index) => (
                    <ProductGridCard
                      key={p.id}
                      product={p}
                      rank={gridSections.topSellers.length + index + 1}
                      unitsSold={unitsSoldByProductId.get(p.id) ?? 0}
                      categoryName={categoryNameById.get(p.categoryId)}
                      meta={productListMeta(p)}
                      selected={selectedId === p.id}
                      onPrefetch={() => prefetchProductDetail(p.id)}
                      onSelect={() => void openEdit(p.id)}
                    />
                  ))}
                </ul>
              </section>
            ) : null}
            {gridProducts.length === 0 && !loading ? (
              <p className="muted">No hay productos activos que coincidan con los filtros.</p>
            ) : null}
          </div>
        ) : (
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
                        <th className="products-table-col products-table-col--code">
                          Código
                        </th>
                        <th className="products-table-col products-table-col--name">
                          Producto
                        </th>
                        <th className="products-table-col products-table-col--price num">
                          Precio
                        </th>
                        <th className="products-table-col products-table-col--cost num products-catalog-col--desktop">
                          Costo
                        </th>
                        <th className="products-table-col products-table-col--profit num products-catalog-col--desktop">
                          Utilidad
                        </th>
                        <th className="products-table-col products-table-col--margin num products-catalog-col--desktop">
                          Margen
                        </th>
                        <th className="products-table-col products-table-col--updated products-catalog-col--desktop">
                          Actualizado
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
                          <td className="mono muted products-table-cell products-table-cell--code">
                            {p.sku?.trim() || '—'}
                          </td>
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
                              {p.description?.trim() ? (
                                <span className="products-table-link__meta muted small products-catalog-desc">
                                  {p.description.trim()}
                                </span>
                              ) : meta ? (
                                <span className="products-table-link__meta muted small">
                                  {meta}
                                </span>
                              ) : null}
                            </button>
                          </td>
                          <td className="num mono products-table-cell products-table-cell--price">
                            {formatCOP(p.price)}
                          </td>
                          <td className="num mono muted products-table-cell products-table-cell--cost products-catalog-col--desktop">
                            {productTableCost(p)}
                          </td>
                          <td className="num mono products-table-cell products-table-cell--profit products-catalog-col--desktop">
                            {productTableProfit(p)}
                          </td>
                          <td className="num mono products-table-cell products-table-cell--margin products-catalog-col--desktop">
                            {productTableMargin(p)}
                          </td>
                          <td className="products-table-cell products-table-cell--updated products-catalog-col--desktop">
                            {(() => {
                              const updated = productTableUpdatedParts(p.updatedAt)
                              if (!updated) {
                                return <span className="muted">—</span>
                              }
                              return (
                                <span
                                  className="products-table-updated"
                                  title={formatSystemDateTime(p.updatedAt)}
                                >
                                  <span className="products-table-updated__date">
                                    {updated.date}
                                  </span>
                                  <span className="products-table-updated__time muted small">
                                    {updated.time}
                                  </span>
                                </span>
                              )
                            })()}
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
        )}

        {!loading && allProducts.length === 0 && !listError && (
          <p className="empty-hint">No hay productos. Crea uno o ajusta la búsqueda.</p>
        )}
      </div>

      {panelOpen && draft && (
        <div
          className="modal-backdrop modal-backdrop--product-editor modal-backdrop--config"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return
            if (archiveConfirmOpen) {
              cancelArchive()
              return
            }
            if (zeroCostWarning) {
              cancelZeroCostWarning()
              return
            }
            requestClosePanel()
          }}
        >
          <section
            className="modal modal--config modal--config-full modal--product-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-editor-title"
          >
            <header className="modal-head modal-head--config modal-head--product-editor">
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
                  onClick={requestClosePanel}
                  aria-label="Cerrar editor"
                >
                  <span aria-hidden>×</span>
                </button>
              </div>
            </header>

            <div className="modal-body modal-body--config modal-body--product-editor">
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
                <div
                  className={`product-editor-cost-mode${savePulse ? ' product-editor-cost-mode--saved' : ''}`}
                >
                  <div className="product-editor-cost-mode__head">
                    <span className="product-editor-field-row__label">
                      Costo unitario (COP)
                    </span>
                    {!SALES_FLOOR_ONLY && !creating ? (
                      <div
                        className="product-editor-cost-mode__switch"
                        role="group"
                        aria-label="Origen del costo"
                      >
                        <button
                          type="button"
                          className={`product-editor-cost-mode__option${draft.costMode === 'manual' ? ' product-editor-cost-mode__option--active' : ''}`}
                          disabled={saving}
                          onClick={() =>
                            setDraft((d) => {
                              if (!d) return d
                              if (d.unitCost.trim()) return { ...d, costMode: 'manual' }
                              const suggested =
                                recipeUnitCostLive ??
                                unitCostToNumber(
                                  selectedProductDetail?.unitCost ??
                                    selectedProductDetail?.cost ??
                                    null,
                                )
                              return {
                                ...d,
                                costMode: 'manual',
                                unitCost:
                                  suggested != null && suggested > 0
                                    ? String(Math.round(suggested))
                                    : d.unitCost,
                              }
                            })
                          }
                        >
                          Manual
                        </button>
                        <button
                          type="button"
                          className={`product-editor-cost-mode__option${draft.costMode === 'recipe' ? ' product-editor-cost-mode__option--active' : ''}`}
                          disabled={saving}
                          onClick={() =>
                            setDraft((d) => {
                              if (!d) return d
                              const next = { ...d, costMode: 'recipe' as const }
                              if (
                                !d.unitCost.trim() &&
                                recipeUnitCostLive != null &&
                                recipeUnitCostLive > 0
                              ) {
                                next.unitCost = String(Math.round(recipeUnitCostLive))
                              }
                              return next
                            })
                          }
                        >
                          Desde receta
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {draft.costMode === 'recipe' &&
                  !SALES_FLOOR_ONLY &&
                  recipeUnitCostLive != null ? (
                    <p className="muted small product-editor-cost-mode__recipe-hint">
                      Sugerido desde receta:{' '}
                      <strong className="mono">
                        {formatCOPMoney(recipeUnitCostLive)}
                      </strong>
                      . Podés ajustarlo abajo.
                    </p>
                  ) : null}
                  <input
                    className="input-cell mono product-editor-cost-mode__input"
                    inputMode="decimal"
                    placeholder="Sin costo cargado"
                    value={draft.unitCost}
                    disabled={saving}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        unitCost: e.target.value,
                        costMode: 'manual',
                      })
                    }
                  />
                  <p className="muted small product-editor-field-hint">
                    {draft.costMode === 'recipe'
                      ? 'Modo receta: al guardar se usa el valor de la receta si existe; el campo queda como referencia editable.'
                      : 'Valor fijo en cartilla. Dejalo vacío si aún no tenés costo.'}
                  </p>
                </div>
                {(() => {
                  const econ = draftEconomics(draft, effectiveUnitCost)
                  return (
                    <div
                      className="product-editor-economics muted small"
                      aria-live="polite"
                    >
                      <dl className="product-editor-economics__grid">
                        <dt>Utilidad unitaria</dt>
                        <dd
                          className={`mono${econ.profit !== null && econ.profit < 0 ? ' product-editor-profit--neg' : ''}`}
                        >
                          {econ.profit != null ? formatCOPMoney(econ.profit) : '—'}
                        </dd>
                        <dt>Margen sobre precio</dt>
                        <dd className="mono">
                          {econ.marginPct != null ? `${econ.marginPct}%` : '—'}
                        </dd>
                      </dl>
                    </div>
                  )
                })()}
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

              <details className="product-editor-advanced-panel catalog-category-block" open>
                <summary className="catalog-category-block__summary product-editor-advanced-panel__summary">
                  <span className="catalog-category-block__summary-main">
                    <span className="catalog-category-block__chevron" aria-hidden />
                    <span>
                      <span className="product-editor-advanced-panel__title">
                        Configuración avanzada
                      </span>
                      <span className="muted small product-editor-advanced-panel__preview">
                        {productSaleDefaultsSummary(draft)}
                      </span>
                    </span>
                  </span>
                </summary>
                <div className="catalog-category-block__body product-editor-advanced-panel__body">
                  <p className="muted small product-editor-advanced-panel__intro">
                    Unidad y tamaño al vender, descripción extendida, imagen y
                    auditoría. Los cambios se aplican al guardar el producto.
                  </p>
                  <div className="product-advanced-fields">
                    <div className="product-advanced-fields__grid">
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
                            canLock: false,
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
                            canLock: false,
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

                      <section className="product-editor-subsection product-editor-subsection--advanced-text">
                        <header className="product-editor-subsection__head">
                          <h4 className="product-editor-subsection__title">
                            Texto e imagen
                          </h4>
                        </header>
                        <div className="product-editor-subsection__body">
                          {renderProductFieldRow({
                            fieldKey: 'description',
                            label: 'Descripción',
                            inAdvancedPopup: true,
                            canLock: false,
                            disabled: saving,
                            display: (
                              <span className="product-editor-field-value-text product-editor-field-value-text--multiline">
                                {draft.description.trim() || '—'}
                              </span>
                            ),
                            children: (
                              <textarea
                                className="input-cell product-editor-description-input product-editor-description-input--advanced"
                                rows={5}
                                value={draft.description}
                                onChange={(e) =>
                                  setDraft({ ...draft, description: e.target.value })
                                }
                                placeholder="Texto comercial para la carta…"
                              />
                            ),
                          })}
                          {renderProductFieldRow({
                            fieldKey: 'type',
                            label: 'Tipo (API)',
                            inAdvancedPopup: true,
                            canLock: false,
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
                            fieldKey: 'imageUrl',
                            label: 'URL de imagen',
                            inAdvancedPopup: true,
                            canLock: false,
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
                          {draft.imageUrl.trim() ? (
                            <div className="product-advanced-image-preview">
                              <img
                                src={draft.imageUrl.trim()}
                                alt=""
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            </div>
                          ) : null}
                        </div>
                      </section>

                      {!creating && selectedProductDetail ? (
                        <section className="product-editor-subsection product-advanced-fields__span-full">
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
                                {formatSystemDateTime(selectedProductDetail.updatedAt)}
                              </p>
                            </div>
                            {renderProductFieldRow({
                              fieldKey: 'trace',
                              label: 'Marca de revisión',
                              inAdvancedPopup: true,
                              canLock: false,
                              disabled: saving,
                              display: (
                                <span className="product-editor-field-value-text">
                                  {draft.traceModifiedLocal
                                    ? (() => {
                                        const dt = new Date(draft.traceModifiedLocal)
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
                                        row.id === selectedId ? (p as ProductRow) : row,
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
                </div>
              </details>

              {!SALES_FLOOR_ONLY && creating ? (
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
                  {!SALES_FLOOR_ONLY && !creating && selectedId ? (
                    <button
                      type="button"
                      className="product-editor-link-card product-editor-link-card--recipe"
                      onClick={() => setRecipePopupOpen(true)}
                    >
                      <span className="product-editor-link-card__copy">
                        <span className="product-editor-link-card__title">
                          Receta
                        </span>
                        <span className="product-editor-link-card__preview muted small">
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
                                .join(' · ') || 'Con contenido'
                            : 'Sin insumos · tocar para definir'}
                        </span>
                      </span>
                      <span className="product-editor-link-card__chevron" aria-hidden />
                    </button>
                  ) : null}
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
                  aria-label="Eliminar producto"
                >
                  <button
                    type="button"
                    className="product-editor-btn product-editor-btn--danger product-editor-btn--archive-full"
                    onClick={requestArchive}
                    disabled={saving || archiveConfirmOpen || zeroCostWarning != null}
                  >
                    Eliminar producto
                  </button>
                </div>
              ) : null}
            </div>

            <footer
              className="product-editor-footer modal-footer--config"
              role="toolbar"
              aria-label="Guardar producto"
            >
              <div className="product-editor-footer__actions">
                <button
                  type="button"
                  className={`product-editor-btn product-editor-btn--primary${savePulse ? ' product-editor-btn--saved' : ''}`}
                  disabled={saving || categories.length === 0}
                  onClick={handleSave}
                >
                  {saving
                    ? 'Guardando…'
                    : savePulse
                      ? '✓ Guardado'
                      : creating
                        ? 'Crear producto'
                        : 'Guardar cambios'}
                </button>
              </div>
            </footer>

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
                    ¿Eliminar este producto?
                  </h3>
                  <p
                    id="product-archive-confirm-desc"
                    className="product-editor-confirm__desc"
                  >
                    <strong>{draft.name?.trim() || 'Sin nombre'}</strong> se
                    borrará de forma permanente. Las ventas antiguas conservan el
                    nombre en el detalle, pero el producto ya no estará en la carta.
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
                      {saving ? 'Eliminando…' : 'Sí, eliminar'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {zeroCostWarning ? (
              <div
                className="product-editor-confirm-layer"
                role="presentation"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) cancelZeroCostWarning()
                }}
              >
                <div
                  className="product-editor-confirm product-editor-confirm--warning"
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby="product-zero-cost-title"
                  aria-describedby="product-zero-cost-desc"
                >
                  <h3
                    id="product-zero-cost-title"
                    className="product-editor-confirm__title"
                  >
                    {zeroCostWarning === 'close'
                      ? '¿Cerrar sin costo unitario?'
                      : '¿Guardar con costo en cero?'}
                  </h3>
                  <p
                    id="product-zero-cost-desc"
                    className="product-editor-confirm__desc"
                  >
                    <strong>{draft.name?.trim() || 'Sin nombre'}</strong> no
                    tiene costo unitario definido. Sin costo no podés calcular
                    márgenes ni utilidades reales.
                    {draft.costMode === 'recipe'
                      ? ' Revisá la receta o ingresá un costo manual.'
                      : ' Ingresá un costo manual o configurá la receta.'}
                  </p>
                  <div className="product-editor-confirm__actions">
                    <button
                      type="button"
                      className="product-editor-btn product-editor-btn--secondary"
                      disabled={saving}
                      onClick={cancelZeroCostWarning}
                    >
                      Volver y corregir
                    </button>
                    <button
                      type="button"
                      className="product-editor-btn product-editor-btn--warning"
                      disabled={saving}
                      onClick={() => void confirmZeroCostWarning()}
                    >
                      {zeroCostWarning === 'close'
                        ? 'Cerrar igual'
                        : saving
                          ? 'Guardando…'
                          : 'Guardar igual'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>


          {historyPopupOpen && !creating && selectedId ? (
            <div
              className="modal-backdrop modal-backdrop--product-submodal modal-backdrop--config"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setHistoryPopupOpen(false)
              }}
            >
              <section
                className="modal modal--config modal--config-xl modal--product-submodal modal--product-history-popup"
                role="dialog"
                aria-modal="true"
                aria-labelledby="product-history-popup-title"
              >
                <header className="modal-head modal-head--config modal-head--product-submodal modal-head--product-submodal--history">
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
                <div className="modal-body modal-body--config modal-body--product-submodal modal-body--product-submodal--history">
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
                  className="product-editor-footer modal-footer--config product-submodal-footer"
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

          {recipePopupOpen && !creating && selectedId && draft ? (
            <ProductRecipePopup
              baseUrl={baseUrl}
              productId={selectedId}
              productName={draft.name}
              initialRecipe={detailRecipe}
              onClose={() => setRecipePopupOpen(false)}
              onRecipeUpdated={setDetailRecipe}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}
