const STORAGE_KEY = 'arandano_api_base'
const TOKEN_KEY = 'arandano_access_token'

export function getApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined
  if (fromEnv?.trim()) {
    return fromEnv.replace(/\/$/, '')
  }
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored?.trim()) {
      return stored.replace(/\/$/, '')
    }
  }
  return 'http://localhost:3000'
}

export function setApiBase(url: string): void {
  window.localStorage.setItem(STORAGE_KEY, url.replace(/\/$/, ''))
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const t = window.localStorage.getItem(TOKEN_KEY)
    return t?.trim() ? t.trim() : null
  } catch {
    return null
  }
}

export function setAccessToken(token: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (!token?.trim()) {
      window.localStorage.removeItem(TOKEN_KEY)
    } else {
      window.localStorage.setItem(TOKEN_KEY, token.trim())
    }
  } catch {
    /* ignore */
  }
}

export type TableInfo = {
  slug: string
  sqlName: string
  /** Presente en tablas con metadatos (p. ej. inventory, sales). */
  title?: string
  description?: string
}

/** Definición de columna alineada con Prisma (inventory, sales, etc.). */
export type ExplorerColumnDef = {
  key: string
  label: string
  description: string
}

export type TableRowsResponse = {
  total: number
  /** Orden de celdas: mismo orden que columnDefs cuando aplica; si no, claves como antes. */
  columns: string[]
  rows: Record<string, unknown>[]
  /** Si viene, usar label/description en cabeceras; orden igual que columns. */
  columnDefs?: ExplorerColumnDef[]
}

export async function fetchTables(base: string): Promise<TableInfo[]> {
  const res = await apiFetch(`${base}/explorer/tables`)
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<TableInfo[]>
}

export async function fetchTableRows(
  base: string,
  slug: string,
  limit: number,
  offset: number,
): Promise<TableRowsResponse> {
  const q = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  })
  const res = await apiFetch(`${base}/explorer/tables/${slug}?${q}`)
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<TableRowsResponse>
}

// ——— Products API ———

export type CategoryRef = {
  id: string
  name: string
  type: string
  parentId?: string | null
}

export type ProductRow = {
  id: string
  name: string
  description: string
  price: string | number
  categoryId: string
  type: string
  imageUrl?: string | null
  size?: string | null
  active: boolean
  createdAt?: string
  updatedAt?: string
  category: CategoryRef
}

export type ProductsListResponse = {
  data: ProductRow[]
  meta: { page: number; limit: number; total: number; hasNextPage: boolean }
}

export type CreateProductPayload = {
  name: string
  price: number
  categoryId: string
  type: string
  description?: string
  size?: string
  imageUrl?: string
  active?: boolean
}

export type UpdateProductPayload = Partial<CreateProductPayload>

async function parseJsonError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] }
    if (Array.isArray(body.message)) return body.message.join(', ')
    if (typeof body.message === 'string') return body.message
  } catch {
    /* ignore */
  }
  return `${res.status} ${res.statusText}`
}

async function apiFetch(
  url: string,
  init?: RequestInit & { auth?: boolean },
): Promise<Response> {
  const auth = init?.auth !== false
  const token = auth ? getAccessToken() : null
  const headers = new Headers(init?.headers ?? undefined)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(url, { ...init, headers })
}

export type LoginPayload = { email: string; password: string }
export type AuthUser = { sub: string; email: string; name: string; role: string }
export type LoginResponse = { accessToken: string; user: AuthUser }

export async function login(
  base: string,
  payload: LoginPayload,
): Promise<LoginResponse> {
  const res = await apiFetch(`${base}/auth/login`, {
    method: 'POST',
    auth: false,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  const out = (await res.json()) as LoginResponse
  setAccessToken(out.accessToken)
  return out
}

export async function fetchMe(base: string): Promise<AuthUser> {
  const res = await apiFetch(`${base}/auth/me`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<AuthUser>
}

export type ProductListSort = 'name' | 'price_asc' | 'price_desc'

export async function fetchProducts(
  base: string,
  opts: {
    page?: number
    limit?: number
    search?: string
    categoryId?: string
    active?: boolean
    type?: string
    sort?: ProductListSort
    signal?: AbortSignal
  },
): Promise<ProductsListResponse> {
  const q = new URLSearchParams()
  q.set('page', String(opts.page ?? 1))
  q.set('limit', String(Math.min(opts.limit ?? 24, 100)))
  if (opts.search?.trim()) q.set('search', opts.search.trim())
  if (opts.categoryId?.trim()) q.set('categoryId', opts.categoryId.trim())
  if (opts.active === true) q.set('active', 'true')
  if (opts.active === false) q.set('active', 'false')
  if (opts.type?.trim()) q.set('type', opts.type.trim())
  if (opts.sort && opts.sort !== 'name') q.set('sort', opts.sort)
  const res = await apiFetch(`${base}/products?${q}`, { signal: opts.signal })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<ProductsListResponse>
}

export async function fetchProduct(
  base: string,
  id: string,
): Promise<ProductRow & { recipe?: unknown }> {
  const res = await apiFetch(`${base}/products/${id}`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<ProductRow & { recipe?: unknown }>
}

export async function createProduct(
  base: string,
  payload: CreateProductPayload,
): Promise<ProductRow> {
  const res = await apiFetch(`${base}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<ProductRow>
}

export async function updateProduct(
  base: string,
  id: string,
  payload: UpdateProductPayload,
): Promise<ProductRow> {
  const res = await apiFetch(`${base}/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<ProductRow>
}

export async function deleteProduct(base: string, id: string): Promise<void> {
  const res = await apiFetch(`${base}/products/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseJsonError(res))
}

// ——— Recipes ———

export type RecipeCatalogEntry = {
  productId: string
  productName: string
  productType: string
  categoryId?: string
  categoryName: string | null
  recipeYield: string
  ingredientCount: number
}

export async function fetchRecipeCatalog(
  base: string,
  categoryId?: string,
  signal?: AbortSignal,
): Promise<RecipeCatalogEntry[]> {
  const q = new URLSearchParams()
  if (categoryId?.trim()) q.set('categoryId', categoryId.trim())
  const qs = q.toString()
  const res = await apiFetch(`${base}/recipes${qs ? `?${qs}` : ''}`, { signal })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<RecipeCatalogEntry[]>
}

export type RecipeCostKind = 'FIJO' | 'VARIABLE'

export type RecipeCostLineRow = {
  id: string
  recipeId: string
  productId: string
  productName?: string
  productType?: string
  productActive?: boolean
  categoryId?: string
  categoryName: string | null
  kind: RecipeCostKind
  name: string
  quantity: string | null
  unit: string
  lineTotalCOP: string
  sheetUnitCost: string | null
  sortOrder: number
}

export type RecipeCostsProductGroup = {
  productId: string
  productName: string
  productType?: string
  productActive: boolean
  categoryId?: string
  categoryName: string | null
  recipeId: string
  fixed: RecipeCostLineRow[]
  variable: RecipeCostLineRow[]
  /** Flat (fixed + variable) ordenado para UI. */
  rows?: RecipeCostLineRow[]
  totals: { fixedCOP: string; variableCOP: string; totalCOP: string }
}

export type RecipeCostsResponse = {
  products: RecipeCostsProductGroup[]
  /** Flat global (una fila por costo) para UI. */
  rows?: RecipeCostLineRow[]
  totals: { fixedCOP: string; variableCOP: string; totalCOP: string }
}

export async function fetchRecipeCosts(
  base: string,
): Promise<RecipeCostsResponse> {
  const res = await apiFetch(`${base}/recipes/costs`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<RecipeCostsResponse>
}

export type GastosByTypeGroup = {
  type: string
  items: Array<{
    id: string
    type: string
    name: string
    kind: RecipeCostKind
    unit: string
    lineTotalCOP: string
  }>
  totalCOP: string
}

export type GastosResponse = {
  fixed: Array<{
    id: string
    type: string
    name: string
    unit: string
    lineTotalCOP: string
  }>
  variable: Array<{
    id: string
    type: string
    name: string
    unit: string
    lineTotalCOP: string
  }>
  /** Flat con todos los gastos (ideal para tablas). */
  items?: Array<{
    id: string
    type: string
    name: string
    kind: RecipeCostKind
    unit: string
    lineTotalCOP: string
  }>
  fixedByType?: GastosByTypeGroup[]
  variableByType?: GastosByTypeGroup[]
  totals: { fixedCOP: string; variableCOP: string; totalCOP: string }
}

export async function fetchGastos(base: string): Promise<GastosResponse> {
  const res = await apiFetch(`${base}/gastos`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<GastosResponse>
}

export type ProductRecipeIngredientLine = {
  id?: string
  inventoryItemId: string
  quantity: string
  unit: string
  sortOrder?: number
  /** Categoría del insumo (p. ej. activos); sin prefijo INVENTORY:: */
  categoryName?: string | null
  inventoryBehavior?: 'CONSUMABLE' | 'CAPITAL_ASSET'
  /** Puede ser AVAILABLE aunque quantity sea 0 en categorías activo. */
  stockStatus?: string | null
}

export type ProductRecipeDetail = {
  recipeYield: string
  ingredients: ProductRecipeIngredientLine[]
}

export function parseProductRecipe(
  recipe: unknown,
): ProductRecipeDetail | null {
  if (!recipe || typeof recipe !== 'object') return null
  const r = recipe as {
    recipeYield?: string
    ingredients?: unknown[]
    lines?: unknown[]
  }
  if (typeof r.recipeYield !== 'string') return null
  const ingredientsRaw = Array.isArray(r.ingredients)
    ? r.ingredients
    : Array.isArray(r.lines)
      ? r.lines
      : null
  if (!ingredientsRaw) return null
  return {
    recipeYield: r.recipeYield,
    ingredients: ingredientsRaw as ProductRecipeIngredientLine[],
  }
}

export type UpsertRecipePayload = {
  recipeYield: number
  ingredients?: {
    inventoryItemId: string
    quantity: number
    unit: string
    sortOrder?: number
  }[]
  costs?: {
    kind: 'FIJO' | 'VARIABLE'
    name: string
    quantity?: number
    unit: string
    lineTotalCOP: number
    sheetUnitCost?: number
    sortOrder?: number
  }[]
}

export async function upsertProductRecipe(
  base: string,
  productId: string,
  payload: UpsertRecipePayload,
): Promise<ProductRow & { recipe?: ProductRecipeDetail }> {
  const res = await apiFetch(`${base}/products/${productId}/recipe`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<ProductRow & { recipe?: ProductRecipeDetail }>
}

export type ProductRecipeCostLine = {
  id?: string
  kind: 'FIJO' | 'VARIABLE'
  name: string
  quantity?: string | null
  unit: string
  lineTotalCOP: string
  sheetUnitCost?: string | null
  sortOrder?: number
}

export type ProductRecipeFull = {
  recipeYield: string
  ingredients: ProductRecipeIngredientLine[]
  costs: ProductRecipeCostLine[]
  /** Tasa de administración (p. ej. 0.30). */
  adminRate?: number
}

export function parseProductRecipeFull(recipe: unknown): ProductRecipeFull | null {
  if (!recipe || typeof recipe !== 'object') return null
  const r = recipe as {
    recipeYield?: string
    ingredients?: unknown[]
    lines?: unknown[]
    costs?: unknown[]
    adminRate?: number
  }
  const base = parseProductRecipe(recipe)
  if (!base) return null
  const costsRaw = Array.isArray(r.costs) ? (r.costs as ProductRecipeCostLine[]) : []
  const adminRate =
    typeof r.adminRate === 'number' && Number.isFinite(r.adminRate)
      ? r.adminRate
      : undefined
  return { ...base, costs: costsRaw, ...(adminRate !== undefined ? { adminRate } : {}) }
}

/** Totales base y tasa de administración (GET /products/:id/recipe/cost-controls). */
export type RecipeCostControlsResponse = {
  adminRate: number
  materialsCOP: number
  servicesCOP: number
  baseCOP: number
}

export async function fetchRecipeCostControls(
  base: string,
  productId: string,
): Promise<RecipeCostControlsResponse> {
  const res = await apiFetch(`${base}/products/${productId}/recipe/cost-controls`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<RecipeCostControlsResponse>
}

export async function updateRecipeAdminRate(
  base: string,
  productId: string,
  payload: { adminRate: number },
): Promise<void> {
  const res = await apiFetch(`${base}/products/${productId}/recipe/admin`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
}

// ——— Compras: tipos base (anidados en inventario y usados más abajo en el API) ———

export type PurchaseLotRow = {
  id: string
  code: string
  /** Nombre legible del lote (si el API lo envía); si no, usar `code` en UI. */
  name?: string | null
  purchaseDate: string
  supplier?: string | null
  /**
   * Proveedor del lote (`purchase_lots.supplier`) o, si vacío, el primer
   * proveedor no nulo de inventario con el mismo código de lote (GET list/detail).
   */
  supplierResolved?: string | null
  notes?: string | null
  itemCount: number
  /** Conteo heredado para compatibilidad (ítems activos enlazados). */
  linkedActiveItemCount?: number
  /**
   * Métricas de consumo del lote (si el backend las expone en list/detail).
   * `remainingValue` representa valor remanente del lote, no el valor histórico total.
   */
  inventoryMetrics?: {
    productsCount?: number | string
    availableItemsCount?: number | string
    consumedItemsCount?: number | string
    /** Backend puede enviar Decimal/numeric como string. */
    remainingUnits?: number | string
    remainingValue?: string | number | null
    /** Total histórico de compra del lote (alternativa a purchaseTotals cuando hay comprobante). */
    purchasedValueCOP?: string | number | null
    consumptionStatus?: 'EMPTY' | 'FRESH' | 'PARTIAL' | 'DEPLETED'
    isDepleted?: boolean
    lotAgeDays?: number
  } | null
  /** Totales del comprobante / pie de factura (GET detalle). */
  purchaseTotals?: {
    /** Total líneas de compra en COP (string numérico sin formato). */
    linesPurchaseTotalCOP?: string | number | null
  } | null
  /** Líneas de compra enlazadas a ítems de inventario (alternativa a items[].purchase). */
  purchaseLines?: Array<{
    inventoryItemId?: string | null
    linePurchaseTotalCOP?: string | number | null
    purchaseUnitCostCOP?: string | number | null
    inventoryBehavior?: 'CONSUMABLE' | 'CAPITAL_ASSET'
  }> | null
  /**
   * Ítems de inventario del lote sin línea de comprobante (p. ej. añadidos después).
   */
  inventoryWithoutPurchaseLine?: Array<{
    id?: string
    name?: string | null
    inventoryBehavior?: 'CONSUMABLE' | 'CAPITAL_ASSET'
  }> | null
  /** Detalle compacto de productos del lote (GET /purchase-lots/:id). */
  items?: Array<{
    /** Id del ítem de inventario en backend (para cruzar con purchaseLines / inventario). */
    id?: string
    name: string
    category?: string | null
    /** Nombre de categoría sin prefijo INVENTORY:: (cuando el API lo envía). */
    categoryName?: string | null
    quantity: string | number
    unit: string
    /** Costo unitario contable en inventario (no es el histórico del comprobante). */
    unitCost: string | number
    available?: string | number | boolean | null
    /** CONSUMABLE = insumo agotable; CAPITAL_ASSET = bien de uso (no flujo consumido/agotado). */
    inventoryBehavior?: 'CONSUMABLE' | 'CAPITAL_ASSET'
    /** Cantidad consumida del total comprado (p. ej. 0 en líneas de activo). */
    quantityConsumed?: string | number | null
    /** Histórico del comprobante; si es null, no hay línea de compra enlazada. */
    purchase?: {
      linePurchaseTotalCOP?: string | number | null
      purchaseUnitCostCOP?: string | number | null
    } | null
  }> | null
  totalValue?: string | number | null
  createdAt?: string
  updatedAt?: string
}

export type PurchaseLotsListResponse = {
  data: PurchaseLotRow[]
  meta: { page: number; limit: number; total: number; hasNextPage: boolean }
}

export type PatchPurchaseLotPayload = {
  purchaseDate?: string
  supplier?: string
  notes?: string
  totalValue?: number
  /** Si el backend lo expone en PATCH: lote agotado vs aún con saldo. */
  isDepleted?: boolean
  consumptionStatus?: 'EMPTY' | 'FRESH' | 'PARTIAL' | 'DEPLETED'
}

export type InventoryOption = {
  id: string
  name: string
  unit: string
  unitCostCOP: string
  quantity: string
  /** Nombre/código de lote para UI (desde `purchaseLot` o `lot`). */
  lotLabel?: string | null
  categoryName?: string | null
  inventoryBehavior?: 'CONSUMABLE' | 'CAPITAL_ASSET'
}

// ——— Inventory API ———

/** Agregados de movimientos (tipos IN, SALE, OUT, WASTE, ADJUSTMENT) cuando `includeStats=true`. */
export type InventoryMovementStats = {
  received?: number
  consumedViaSales?: number
  consumedViaOut?: number
  consumedTotal?: number
  waste?: number
  adjustment?: number
}

/** Estadísticas físicas por ítem (GET /inventory?includeStats=true). */
export type InventoryItemStats = {
  onHand?: number
  minStock?: number | null
  belowMinimum?: boolean
  movements?: InventoryMovementStats
}

export type InventoryRow = {
  id: string
  name: string
  categoryId: string
  quantity: string | number
  unit: string
  unitCost: string | number
  supplier?: string | null
  lot?: string | null
  minStock?: string | number | null
  category: { id: string; name: string; type: string }
  /**
   * Lote de compra enlazado por FK (`inventory.lot` → `purchase_lots.code`).
   * Listado y detalle; `null` si `lot` es null.
   */
  purchaseLot?: PurchaseLotRow | null
  /** Presente cuando la petición lleva `includeStats=true`. */
  stats?: InventoryItemStats
}

export type InventoryListResponse = {
  data: InventoryRow[]
  meta: { page: number; limit: number; total: number; hasNextPage: boolean }
}

export type CreateInventoryPayload = {
  name: string
  categoryId: string
  quantity: number
  unit: string
  unitCost: number
  supplier?: string
  lot?: string
  minStock?: number
}

export type UpdateInventoryPayload = Partial<CreateInventoryPayload>

export async function fetchInventoryItems(
  base: string,
  opts: {
    page?: number
    limit?: number
    search?: string
    categoryId?: string
    /** Incluye agregados de movimientos y flags de mínimo (contrato API). */
    includeStats?: boolean
    /** Disponible (cantidad mayor que 0) vs consumido (0). Omitir = todos. */
    availability?: 'available' | 'depleted'
    /** Solo ítems bajo stock mínimo (API debe soportar el query). */
    belowMinimum?: boolean
    /** Filtro por código de lote (coincidencia según backend). */
    lot?: string
    signal?: AbortSignal
  },
): Promise<InventoryListResponse> {
  const q = new URLSearchParams()
  q.set('page', String(opts.page ?? 1))
  q.set('limit', String(Math.min(opts.limit ?? 24, 100)))
  if (opts.search?.trim()) q.set('search', opts.search.trim())
  if (opts.categoryId?.trim()) q.set('categoryId', opts.categoryId.trim())
  if (opts.includeStats) q.set('includeStats', 'true')
  if (opts.availability === 'available' || opts.availability === 'depleted') {
    q.set('availability', opts.availability)
  }
  if (opts.belowMinimum === true) q.set('belowMinimum', 'true')
  if (opts.lot?.trim()) q.set('lot', opts.lot.trim())
  const res = await apiFetch(`${base}/inventory?${q}`, { signal: opts.signal })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<InventoryListResponse>
}

export async function fetchInventoryItem(
  base: string,
  id: string,
  opts?: { includeStats?: boolean },
): Promise<InventoryRow> {
  const q = new URLSearchParams()
  if (opts?.includeStats) q.set('includeStats', 'true')
  const qs = q.toString()
  const res = await apiFetch(`${base}/inventory/${id}${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<InventoryRow>
}

export async function createInventoryItem(
  base: string,
  payload: CreateInventoryPayload,
): Promise<InventoryRow> {
  const res = await apiFetch(`${base}/inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<InventoryRow>
}

export async function updateInventoryItem(
  base: string,
  id: string,
  payload: UpdateInventoryPayload,
): Promise<InventoryRow> {
  const res = await apiFetch(`${base}/inventory/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<InventoryRow>
}

export async function deleteInventoryItem(base: string, id: string): Promise<void> {
  const res = await apiFetch(`${base}/inventory/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseJsonError(res))
}

// ——— Navigation (contrato front / API) ———

/** Sección en GET /navigation (domainModel v2 o raíz). */
export type NavigationSectionContract = {
  id?: string
  key?: string
  title?: string
  subtitle?: string
  domain?: string
  domainModel?: {
    version?: number
    purchases?: {
      mapsTo?: Record<string, string>
      note?: string
    }
    inventory?: {
      listWithStats?: string
      stock_movements?: string
      note?: string
    }
  }
}

export type NavigationPayload = {
  version?: number
  sections?: NavigationSectionContract[]
  domainModel?: {
    version?: number
    sections?: NavigationSectionContract[]
  }
}

/** Normaliza respuesta: a veces `sections` viene bajo `domainModel`. */
export function normalizeNavigationPayload(raw: unknown): NavigationPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as NavigationPayload & Record<string, unknown>
  const dm = o.domainModel
  if (dm && typeof dm === 'object' && Array.isArray(dm.sections)) {
    return {
      version: dm.version ?? o.version,
      sections: dm.sections,
      domainModel: dm,
    }
  }
  if (Array.isArray(o.sections)) return o
  return null
}

export async function fetchNavigation(base: string): Promise<NavigationPayload | null> {
  const res = await apiFetch(`${base}/navigation`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  const raw = await res.json()
  return normalizeNavigationPayload(raw)
}

/** Subtítulo de sección por `id` o por `domain` (p. ej. financial_entry vs stock físico). */
export function navigationSubtitleFor(
  nav: NavigationPayload | null,
  match: 'purchases' | 'inventory',
): string | undefined {
  const sections = nav?.sections ?? nav?.domainModel?.sections
  if (!sections?.length) return undefined
  if (match === 'purchases') {
    const hit =
      sections.find((s) => s.id === 'purchases' || s.key === 'purchases') ??
      sections.find((s) => s.domain === 'financial_entry')
    return hit?.subtitle
  }
  const hit =
    sections.find((s) => s.id === 'inventory' || s.key === 'inventory') ??
    sections.find(
      (s) =>
        s.domain &&
        /physical|inventory|stock|resource/i.test(String(s.domain)),
    )
  return hit?.subtitle
}

/** Insumos activos para recetas (pagina GET /inventory). */
export async function fetchInventoryOptions(
  base: string,
  maxRows = 2000,
): Promise<InventoryOption[]> {
  const out: InventoryOption[] = []
  let page = 1
  while (out.length < maxRows) {
    const res = await fetchInventoryItems(base, { page, limit: 100 })
    for (const row of res.data) {
      out.push({
        id: row.id,
        name: row.name,
        unit: row.unit,
        unitCostCOP: String(row.unitCost),
        quantity: String(row.quantity),
        lotLabel: inventoryLotDisplayLabel(row),
      })
      if (out.length >= maxRows) break
    }
    if (!res.meta.hasNextPage) break
    page++
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return out
}

// ——— Sales API ———

export type SaleCartUserRef = {
  id?: string
  name?: string | null
  email?: string | null
}

export type SaleListRow = {
  id: string
  saleDate: string
  /** `YYYY-MM-DD` (día civil); preferido para columna “solo fecha”. */
  saleDateOnly?: string | null
  /** Total COP numérico (recomendado para formato moneda). */
  total?: string | number | null
  /** Mismo total como string (p. ej. 2 decimales). */
  totalCOP?: string | null
  totalAmount?: string | number | null
  grandTotal?: string | number | null
  amount?: string | number | null
  total_amount?: string | number | null
  grand_total?: string | number | null
  /** Quién figura en la venta (empleado o usuario del carrito). */
  displayPerson?: string | null
  recordedByName?: string | null
  recordedByUserId?: string | null
  paymentMethod?: string | null
  source: string
  mesa?: string | null
  notes?: string | null
  userId?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  cart?: { user?: SaleCartUserRef | null } | null
  /** Prisma / listados anteriores */
  _count?: { lines?: number }
  /** Cantidad de líneas (API). */
  lineCount?: number
  linesCount?: number
}

export type SalesListResponse = {
  data: SaleListRow[]
  meta: { page: number; limit: number; total: number; hasNextPage: boolean }
}

export function saleListRowLineCount(row: SaleListRow): number {
  if (typeof row.lineCount === 'number' && Number.isFinite(row.lineCount)) {
    return row.lineCount
  }
  const a = row._count?.lines
  if (typeof a === 'number' && Number.isFinite(a)) return a
  const b = row.linesCount
  if (typeof b === 'number' && Number.isFinite(b)) return b
  return 0
}

function parseMoneyish(v: unknown): number {
  if (v == null || v === '') return NaN
  if (typeof v === 'bigint') {
    const n = Number(v)
    return Number.isFinite(n) ? n : NaN
  }
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN
  if (typeof v === 'object' && v !== null && 'toString' in v) {
    const n = parseMoneyish((v as { toString(): string }).toString())
    if (Number.isFinite(n)) return n
  }
  let s = String(v).trim()
  if (!s) return NaN
  // Decimal con coma, sin separador de miles: "1234,56"
  if (/^\d+,\d{1,6}$/.test(s) && !s.includes('.')) {
    s = s.replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    // Miles con punto y decimal con coma: "1.234.567,89"
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    s = s.replace(/,/g, '')
  }
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : NaN
}

const SALE_TOTAL_SCALAR_KEYS = [
  'total',
  'totalCOP',
  'total_cop',
  'totalAmount',
  'grandTotal',
  'amount',
  'total_amount',
  'grand_total',
  'totalValue',
  'total_value',
  'valorTotal',
  'valor_total',
  'saleTotal',
  'sale_total',
  'priceTotal',
  'price_total',
  'sumTotal',
  'sum_total',
  'monto',
  'montoTotal',
  'monto_total',
  'valor',
  'valorVenta',
  'valor_venta',
] as const

const SALE_LINE_ARRAY_KEYS = [
  'lines',
  'saleLines',
  'sale_lines',
  'items',
  'lineItems',
  'line_items',
  'detalle',
  'saleLineItems',
] as const

function lineMonetaryContribution(line: Record<string, unknown>): number {
  const explicit = [
    'lineTotal',
    'line_total',
    'subtotal',
    'subTotal',
    'sub_total',
    'importe',
    'importeLinea',
    'importe_linea',
    'total',
    'totalLine',
    'total_line',
    'valorLinea',
    'valor_linea',
    'extendedPrice',
    'extended_price',
    'grossAmount',
    'gross_amount',
    'lineTotalCOP',
    'line_total_cop',
  ] as const
  for (const k of explicit) {
    if (k in line) {
      const n = parseMoneyish(line[k])
      if (Number.isFinite(n)) return n
    }
  }
  const qtyKeys = ['quantity', 'qty', 'count', 'cantidad', 'amount'] as const
  const priceKeys = [
    'unitPrice',
    'unit_price',
    'price',
    'precio',
    'valorUnitario',
    'valor_unitario',
    'unitario',
  ] as const
  let q = NaN
  let p = NaN
  for (const k of qtyKeys) {
    if (k in line) {
      q = parseMoneyish(line[k])
      if (Number.isFinite(q)) break
    }
  }
  for (const k of priceKeys) {
    if (k in line) {
      p = parseMoneyish(line[k])
      if (Number.isFinite(p)) break
    }
  }
  if (Number.isFinite(q) && Number.isFinite(p)) return q * p
  return NaN
}

function sumFromLineArrays(row: Record<string, unknown>): number | undefined {
  for (const key of SALE_LINE_ARRAY_KEYS) {
    const raw = row[key]
    if (!Array.isArray(raw) || raw.length === 0) continue
    let sum = 0
    let used = 0
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const n = lineMonetaryContribution(item as Record<string, unknown>)
      if (Number.isFinite(n)) {
        sum += n
        used++
      }
    }
    if (used > 0) return sum
  }
  return undefined
}

/**
 * Total en COP: escanea claves habituales del API y suma líneas / subtotales por ítem.
 */
export function resolveSaleTotal(
  row: SaleListRow | SaleDetail | Record<string, unknown>,
): number | undefined {
  const r = row as Record<string, unknown>

  for (const k of SALE_TOTAL_SCALAR_KEYS) {
    if (!(k in r)) continue
    const v = r[k]
    if (v == null || v === '') continue
    const n = parseMoneyish(v)
    if (Number.isFinite(n)) return n
  }

  for (const ck of ['totalInCents', 'total_in_cents', 'amountCents', 'amount_cents'] as const) {
    if (!(ck in r)) continue
    const n = parseMoneyish(r[ck])
    if (Number.isFinite(n)) return n / 100
  }

  const nestedKeys = ['totals', 'summary', 'aggregate', '_sum'] as const
  for (const nk of nestedKeys) {
    const sub = r[nk]
    if (sub && typeof sub === 'object' && !Array.isArray(sub)) {
      for (const k of SALE_TOTAL_SCALAR_KEYS) {
        if (!(k in sub)) continue
        const n = parseMoneyish((sub as Record<string, unknown>)[k])
        if (Number.isFinite(n)) return n
      }
    }
  }

  const fromLines = sumFromLineArrays(r)
  if (fromLines !== undefined) return fromLines

  return undefined
}

/**
 * Total en COP para mostrar: prioriza `total` numérico y `totalCOP` del API;
 * si faltan, usa `resolveSaleTotal`.
 */
export function saleRowTotalNumeric(
  row: SaleListRow | SaleDetail | Record<string, unknown>,
): number | undefined {
  const o = row as SaleListRow & SaleDetail
  if (typeof o.total === 'number' && Number.isFinite(o.total)) return o.total
  if (o.total != null && o.total !== '') {
    const n = parseMoneyish(o.total)
    if (Number.isFinite(n)) return n
  }
  if (o.totalCOP != null && String(o.totalCOP).trim() !== '') {
    const n = parseMoneyish(o.totalCOP)
    if (Number.isFinite(n)) return n
  }
  return resolveSaleTotal(row)
}

export type SaleLineDetail = {
  id: string
  saleId: string
  productId: string | null
  productName: string
  quantity: string | number
  unitPrice?: string | number | null
  unit_price?: string | number | null
  unitPriceCOP?: string | null
  lineTotal?: string | number | null
  lineTotalCOP?: string | null
  costAtSale?: string | number | null
  profit?: string | number | null
  product?: { id: string; name: string } | null
}

export type SaleDetail = {
  id: string
  saleDate: string
  saleDateOnly?: string | null
  total?: string | number | null
  totalCOP?: string | null
  totalAmount?: string | number | null
  grandTotal?: string | number | null
  amount?: string | number | null
  total_amount?: string | number | null
  grand_total?: string | number | null
  displayPerson?: string | null
  recordedByName?: string | null
  recordedByUserId?: string | null
  paymentMethod?: string | null
  source: string
  mesa?: string | null
  notes?: string | null
  userId?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  cart?: { user?: SaleCartUserRef | null } | null
  lines?: SaleLineDetail[]
}

export type SaleLineInputPayload = {
  productId?: string
  productName: string
  quantity: number
  unitPrice: number
  costAtSale?: number
  profit?: number
}

export type CreateSalePayload = {
  saleDate: string
  paymentMethod?: string
  source?: string
  mesa?: string
  notes?: string
  userId?: string
  lines: SaleLineInputPayload[]
}

export type PatchSalePayload = {
  saleDate?: string
  paymentMethod?: string
  source?: string
  mesa?: string
  notes?: string
  userId?: string
}

export async function fetchSales(
  base: string,
  opts: {
    page?: number
    limit?: number
    search?: string
    source?: string
    dateFrom?: string
    dateTo?: string
  },
): Promise<SalesListResponse> {
  const q = new URLSearchParams()
  q.set('page', String(opts.page ?? 1))
  q.set('limit', String(Math.min(opts.limit ?? 20, 100)))
  if (opts.search?.trim()) q.set('search', opts.search.trim())
  if (opts.source?.trim()) q.set('source', opts.source.trim())
  if (opts.dateFrom?.trim()) q.set('dateFrom', opts.dateFrom.trim())
  if (opts.dateTo?.trim()) q.set('dateTo', opts.dateTo.trim())
  const res = await apiFetch(`${base}/sales?${q}`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<SalesListResponse>
}

export async function fetchSale(base: string, id: string): Promise<SaleDetail> {
  const res = await apiFetch(`${base}/sales/${id}`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<SaleDetail>
}

export async function createSale(
  base: string,
  payload: CreateSalePayload,
): Promise<SaleDetail> {
  const res = await apiFetch(`${base}/sales`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<SaleDetail>
}

export async function patchSale(
  base: string,
  id: string,
  payload: PatchSalePayload,
): Promise<SaleDetail> {
  const res = await apiFetch(`${base}/sales/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<SaleDetail>
}

export async function replaceSaleLines(
  base: string,
  id: string,
  lines: SaleLineInputPayload[],
): Promise<SaleDetail> {
  const res = await apiFetch(`${base}/sales/${id}/lines`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lines }),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<SaleDetail>
}

// ——— Compras (lotes de compra): fechas, fetch ———

/**
 * Día de compra del lote: el API suele mandar `YYYY-MM-DD` o ISO (`…T…Z`).
 * `new Date("YYYY-MM-DD")` se interpreta en UTC y en Colombia puede mostrarse un día antes;
 * aquí usamos siempre el día civil del prefijo `YYYY-MM-DD` cuando existe.
 */
export function parsePurchaseLotDate(value: string): Date | null {
  const s = value.trim()
  if (!s) return null
  const prefix = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/i.exec(s)
  if (prefix) {
    const y = Number(prefix[1])
    const mo = Number(prefix[2])
    const d = Number(prefix[3])
    const dt = new Date(y, mo - 1, d)
    return Number.isNaN(dt.getTime()) ? null : dt
  }
  const dt = new Date(s)
  return Number.isNaN(dt.getTime()) ? null : dt
}

export function formatPurchaseLotDate(
  value: string | null | undefined,
  dateStyle: 'short' | 'medium' | 'long' = 'medium',
): string {
  if (!value?.trim()) return '—'
  const d = parsePurchaseLotDate(value)
  if (!d) return value.trim()
  return new Intl.DateTimeFormat('es-CO', { dateStyle }).format(d)
}

/** Valor para `<input type="date">` a partir de `purchaseDate` del API. */
export function purchaseLotDateToInputValue(value: string): string {
  const d = parsePurchaseLotDate(value)
  if (!d) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Texto de proveedor para UI: resuelto (lote + fallback inventario) o `supplier` del lote. */
export function displayPurchaseLotSupplier(row: {
  supplier?: string | null
  supplierResolved?: string | null
}): string {
  const r = row.supplierResolved?.trim()
  if (r) return r
  return row.supplier?.trim() || ''
}

/** Etiqueta de lote para filas de inventario (prioriza `purchaseLot` del API). */
export function inventoryLotDisplayLabel(row: InventoryRow): string | null {
  const pl = row.purchaseLot
  if (pl) {
    const n = pl.name?.trim()
    if (n) return n
    const c = pl.code?.trim()
    return c || null
  }
  return row.lot?.trim() || null
}

/**
 * Metadatos del lote para una fila de inventario: objeto anidado `purchaseLot`
 * o, en su defecto, entrada del mapa por código (respaldo).
 */
export function inventoryResolvedPurchaseLot(
  row: InventoryRow,
  fallbackByCode?: Map<string, PurchaseLotRow> | null,
): PurchaseLotRow | undefined {
  if (row.purchaseLot) return row.purchaseLot
  const code = row.lot?.trim()
  if (code && fallbackByCode) return fallbackByCode.get(code)
  return undefined
}

export async function fetchPurchaseLots(
  base: string,
  opts: {
    page?: number
    limit?: number
    search?: string
    dateFrom?: string
    dateTo?: string
    signal?: AbortSignal
  },
): Promise<PurchaseLotsListResponse> {
  const q = new URLSearchParams()
  q.set('page', String(opts.page ?? 1))
  q.set('limit', String(Math.min(opts.limit ?? 20, 100)))
  if (opts.search?.trim()) q.set('search', opts.search.trim())
  if (opts.dateFrom?.trim()) q.set('dateFrom', opts.dateFrom.trim())
  if (opts.dateTo?.trim()) q.set('dateTo', opts.dateTo.trim())
  const res = await apiFetch(`${base}/purchase-lots?${q}`, { signal: opts.signal })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<PurchaseLotsListResponse>
}

/** Mapa `purchase_lots.code` → fila (para cruzar con `inventory.lot`). */
export async function fetchPurchaseLotsCodeIndex(
  base: string,
): Promise<Map<string, PurchaseLotRow>> {
  const m = new Map<string, PurchaseLotRow>()
  let page = 1
  while (true) {
    const res = await fetchPurchaseLots(base, { page, limit: 100 })
    for (const row of res.data) {
      const code = row.code?.trim()
      if (code) m.set(code, row)
    }
    if (!res.meta.hasNextPage) break
    page++
    if (page > 200) break
  }
  return m
}

export async function fetchPurchaseLot(
  base: string,
  id: string,
): Promise<PurchaseLotRow> {
  const res = await apiFetch(`${base}/purchase-lots/${id}`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<PurchaseLotRow>
}

export async function patchPurchaseLot(
  base: string,
  id: string,
  payload: PatchPurchaseLotPayload,
): Promise<PurchaseLotRow> {
  const res = await apiFetch(`${base}/purchase-lots/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<PurchaseLotRow>
}

/** Categorías aptas para productos (`type === PRODUCT`) vía explorador. */
export async function fetchProductCategories(
  base: string,
): Promise<CategoryRef[]> {
  const { rows } = await fetchTableRows(base, 'categories', 500, 0)
  return rows
    .filter((r) => String(r.type) === 'PRODUCT')
    .map((r) => ({
      id: String(r.id),
      name: String(r.name ?? ''),
      type: String(r.type ?? ''),
      parentId:
        r.parentId != null
          ? String(r.parentId)
          : r.parent_id != null
            ? String(r.parent_id)
            : null,
    }))
}

/** Categorías de inventario (`type === INVENTORY`). */
export async function fetchInventoryCategories(
  base: string,
): Promise<CategoryRef[]> {
  const { rows } = await fetchTableRows(base, 'categories', 500, 0)
  return rows
    .filter((r) => String(r.type) === 'INVENTORY')
    .map((r) => ({
      id: String(r.id),
      name: String(r.name ?? ''),
      type: String(r.type ?? ''),
      parentId:
        r.parentId != null
          ? String(r.parentId)
          : r.parent_id != null
            ? String(r.parent_id)
            : null,
    }))
}

export async function fetchActiveProductsCount(base: string): Promise<number> {
  const res = await fetchProducts(base, { page: 1, limit: 1, active: true })
  return res.meta.total
}

/** Totales globales del catálogo (sin filtros de búsqueda). */
export async function fetchProductsCatalogStats(base: string): Promise<{
  active: number
  inactive: number
  total: number
}> {
  const [activeRes, inactiveRes, allRes] = await Promise.all([
    fetchProducts(base, { page: 1, limit: 1, active: true }),
    fetchProducts(base, { page: 1, limit: 1, active: false }),
    fetchProducts(base, { page: 1, limit: 1 }),
  ])
  return {
    active: activeRes.meta.total,
    inactive: inactiveRes.meta.total,
    total: allRes.meta.total,
  }
}

function productRowPriceNum(p: ProductRow): number {
  if (typeof p.price === 'number') return p.price
  const n = parseFloat(String(p.price).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** Recorre todo el catálogo (sin filtros) para precio medio y conteos por categoría. */
export type ProductsCatalogSummary = {
  total: number
  averagePriceCOP: number
  perCategory: { categoryId: string; count: number }[]
}

export async function fetchProductsCatalogSummary(
  base: string,
): Promise<ProductsCatalogSummary> {
  const all: ProductRow[] = []
  let page = 1
  const limit = 100
  let reportedTotal = 0
  while (true) {
    const res = await fetchProducts(base, { page, limit, sort: 'name' })
    if (page === 1) reportedTotal = res.meta.total
    all.push(...res.data)
    if (!res.meta.hasNextPage) break
    page += 1
    if (page > 500) break
  }
  const byCat = new Map<string, number>()
  let sum = 0
  for (const p of all) {
    sum += productRowPriceNum(p)
    byCat.set(p.categoryId, (byCat.get(p.categoryId) ?? 0) + 1)
  }
  const n = all.length
  const perCategory = [...byCat.entries()]
    .map(([categoryId, count]) => ({ categoryId, count }))
    .sort((a, b) => b.count - a.count)
  return {
    total: reportedTotal || n,
    averagePriceCOP: n > 0 ? sum / n : 0,
    perCategory,
  }
}

function qtyToNumber(v: string | number): number {
  if (typeof v === 'number') return v
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export async function fetchInventoryInStockCount(base: string): Promise<number> {
  let page = 1
  let count = 0
  while (true) {
    const res = await fetchInventoryItems(base, { page, limit: 100 })
    for (const row of res.data) {
      if (qtyToNumber(row.quantity) > 0) count++
    }
    if (!res.meta.hasNextPage) break
    page++
    if (page > 100) break
  }
  return count
}
