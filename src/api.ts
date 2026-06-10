import { isBackendDown } from './backendHealth'
import { unitCostToNumber } from './lib/productEconomics'
import { getWhatsAppUrl } from './lib/siteContact'

const STORAGE_KEY = 'vos_api_base'
const TOKEN_KEY = 'vos_access_token'
const COMPANY_KEY = 'vos_company_id'

export function getCompanyId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const id = window.localStorage.getItem(COMPANY_KEY)
    return id?.trim() ? id.trim() : null
  } catch {
    return null
  }
}

export function setCompanyId(companyId: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (!companyId?.trim()) {
      window.localStorage.removeItem(COMPANY_KEY)
    } else {
      window.localStorage.setItem(COMPANY_KEY, companyId.trim())
    }
  } catch {
    /* ignore */
  }
}

export class ApiUnreachableError extends Error {
  constructor() {
    super(
      'No se pudo conectar con el API. Levantá vos-api en el puerto 3000 (npm run start:dev).',
    )
    this.name = 'ApiUnreachableError'
  }
}

export function getApiBase(): string {
  const trim = (s: string) => s.replace(/\/$/, '')
  /** Evita `.../api` + `/purchase-lots` cuando la ruta real del Nest no lleva prefijo `/api`. */
  const normalize = (raw: string) => {
    let u = trim(raw.trim())
    if (u.endsWith('/api')) u = trim(u.slice(0, -4))
    return u
  }
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined
  if (fromEnv?.trim()) {
    return normalize(fromEnv)
  }
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored?.trim()) {
      return normalize(stored)
    }
  }
  /**
   * En desarrollo sin VITE_API_URL: peticiones vía proxy de Vite (`/dev-api` → API en :3000).
   * Así funciona al abrir el front por IP de red (p. ej. 192.168.40.10:5173) sin CORS.
   * Si necesitás URL directa al Nest, definí VITE_API_URL y en el API CORS_ORIGIN con ese origen.
   */
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return `${window.location.origin}/dev-api`
  }
  return 'http://localhost:3000'
}

export function setApiBase(url: string): void {
  const trim = (s: string) => s.replace(/\/$/, '')
  let u = trim(url)
  if (u.endsWith('/api')) u = trim(u.slice(0, -4))
  window.localStorage.setItem(STORAGE_KEY, u)
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
      setCompanyId(null)
    } else {
      window.localStorage.setItem(TOKEN_KEY, token.trim())
      const fromJwt = companyIdFromAccessToken(token.trim())
      if (fromJwt) setCompanyId(fromJwt)
      else if (!decodeJwtPayload(token.trim())?.isPlatformAdmin) setCompanyId(null)
    }
  } catch {
    /* ignore */
  }
}

type JwtCompanyPayload = {
  companyId?: string
  isPlatformAdmin?: boolean
  platformView?: boolean
}

function decodeJwtPayload(token: string): JwtCompanyPayload | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json) as JwtCompanyPayload
  } catch {
    return null
  }
}

/** Empresa activa del JWT (fuente de verdad; evita X-Company-Id obsoleto en localStorage). */
export function companyIdFromAccessToken(token: string | null): string | null {
  if (!token?.trim()) return null
  const payload = decodeJwtPayload(token.trim())
  const id = payload?.companyId?.trim()
  return id || null
}

function resolveAuthCompanyId(token: string | null): string | null {
  return companyIdFromAccessToken(token) ?? getCompanyId()
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
    throw new Error(await parseJsonError(res))
  }
  return res.json() as Promise<TableInfo[]>
}

/** La API documenta `limit` máx. 100; valores mayores suelen responder 400. */
const EXPLORER_MAX_LIMIT = 100

export async function fetchTableRows(
  base: string,
  slug: string,
  limit: number,
  offset: number,
): Promise<TableRowsResponse> {
  const capped = Math.min(Math.max(1, limit), EXPLORER_MAX_LIMIT)
  const q = new URLSearchParams({
    limit: String(capped),
    offset: String(Math.max(0, offset)),
  })
  const res = await apiFetch(
    `${base}/explorer/tables/${encodeURIComponent(slug)}?${q}`,
  )
  if (!res.ok) {
    throw new Error(await parseJsonError(res))
  }
  return res.json() as Promise<TableRowsResponse>
}

/** Recorre filas del explorador respetando el tope de página del backend. */
async function fetchAllExplorerTableRows(
  base: string,
  slug: string,
  opts?: { maxRows?: number },
): Promise<Record<string, unknown>[]> {
  const maxRows = opts?.maxRows ?? 20_000
  const acc: Record<string, unknown>[] = []
  let offset = 0
  while (acc.length < maxRows) {
    const batch = await fetchTableRows(base, slug, EXPLORER_MAX_LIMIT, offset)
    acc.push(...batch.rows)
    if (batch.rows.length === 0) break
    if (batch.rows.length < EXPLORER_MAX_LIMIT) break
    offset += batch.rows.length
    if (typeof batch.total === 'number' && offset >= batch.total) break
  }
  return acc
}

function explorerRowToCategoryRef(r: Record<string, unknown>): CategoryRef {
  const slugRaw = r.slug ?? r.code ?? r.key
  const slugStr =
    slugRaw != null && String(slugRaw).trim() !== ''
      ? String(slugRaw).trim()
      : undefined
  return {
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    type: String(r.type ?? ''),
    slug: slugStr,
    parentId:
      r.parentId != null
        ? String(r.parentId)
        : r.parent_id != null
          ? String(r.parent_id)
          : null,
  }
}

/** Respuesta GET /categories (array, { data }, { items }, paginado). */
function categoriesRestPayloadToRows(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body as Record<string, unknown>[]
  if (body && typeof body === 'object') {
    const o = body as {
      data?: unknown
      items?: unknown
    }
    if (Array.isArray(o.data)) return o.data as Record<string, unknown>[]
    if (Array.isArray(o.items)) return o.items as Record<string, unknown>[]
  }
  return []
}

function categoriesRestHasNextPage(body: unknown): boolean | undefined {
  if (!body || typeof body !== 'object') return undefined
  const m = (body as { meta?: { hasNextPage?: boolean } }).meta
  if (m && typeof m.hasNextPage === 'boolean') return m.hasNextPage
  return undefined
}

/**
 * Intenta GET /categories?page=&limit= (convención Nest). Devuelve null si la ruta no existe (404/405).
 */
async function tryFetchCategoriesRest(
  base: string,
  typeFilter: 'PRODUCT' | 'INVENTORY',
): Promise<CategoryRef[] | null> {
  const out: CategoryRef[] = []
  for (let page = 1; page <= 500; page++) {
    /** Sin `type` en query: algunos backends Nest rejectean valores no listados y devuelven 400. */
    const q = new URLSearchParams({
      page: String(page),
      limit: String(EXPLORER_MAX_LIMIT),
    })
    const res = await apiFetch(`${base}/categories?${q}`)
    if (res.status === 404 || res.status === 405) return null
    if (!res.ok) throw new Error(await parseJsonError(res))
    const body = await res.json()
    const chunk = categoriesRestPayloadToRows(body)
    if (chunk.length === 0) break
    for (const r of chunk) {
      const ref = explorerRowToCategoryRef(r)
      if (ref.type === typeFilter) out.push(ref)
    }
    if (chunk.length < EXPLORER_MAX_LIMIT) break
    const hasNext = categoriesRestHasNextPage(body)
    if (hasNext === false) break
  }
  return out
}

async function fetchCategoriesViaExplorer(
  base: string,
  typeFilter: 'PRODUCT' | 'INVENTORY',
): Promise<CategoryRef[]> {
  /**
   * Slug del explorador debe coincidir con lo que registra vos-api (p. ej. `categories`).
   * No usar `category` en singular: suele responder "Unknown table: category".
   */
  const rows = await fetchAllExplorerTableRows(base, 'categories')
  return rows
    .filter((r) => String(r.type) === typeFilter)
    .map(explorerRowToCategoryRef)
}

// ——— Products API ———

export type CategoryRef = {
  id: string
  name: string
  type: string
  /** Slug canónico si el API lo envía (p. ej. alinear con `product.type`). */
  slug?: string
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
  /** Unidad por defecto al vender (und, porción, etc.). */
  saleUnit?: string | null
  active: boolean
  sku?: string | null
  /** Costo declarado (API v2: `cost`). */
  cost?: string | number | null
  unitCost?: string | number | null
  /** Origen del costo unitario: manual o calculado desde receta. */
  costSource?: 'MANUAL' | 'RECIPE' | null
  /** % utilidad declarada sobre precio (cartilla). */
  marginPercent?: string | number | null
  createdAt?: string
  updatedAt?: string
  /** Revisión / trazabilidad (manual). Distinto de `updatedAt`. */
  traceModifiedAt?: string | null
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
  saleUnit?: string
  imageUrl?: string
  sku?: string | null
  unitCost?: number | null
  costSource?: 'MANUAL' | 'RECIPE'
  marginPercent?: number | null
  active?: boolean
}

export type UpdateProductPayload = Partial<CreateProductPayload> & {
  traceModifiedAt?: string | null
}

/** Normaliza fila del API v2 (`cost` → `unitCost` para el front). */
export function normalizeProductRow<T extends ProductRow>(row: T): T {
  const rawCost = row.cost ?? row.unitCost
  const parsed =
    rawCost != null && `${rawCost}`.trim() !== ''
      ? unitCostToNumber(rawCost as string | number)
      : null
  const hasCost = parsed != null && parsed > 0
  return {
    ...row,
    unitCost: hasCost ? rawCost : null,
    cost: hasCost ? rawCost : null,
    costSource:
      row.costSource === 'RECIPE' || row.costSource === 'MANUAL'
        ? row.costSource
        : 'MANUAL',
  }
}

/** Campos permitidos por el API v2 de productos (evita rechazos por whitelist). */
function productWriteBody(
  payload: CreateProductPayload | UpdateProductPayload,
): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (payload.name !== undefined) body.name = payload.name
  if (payload.price !== undefined) body.price = payload.price
  if (payload.categoryId !== undefined) body.categoryId = payload.categoryId
  if (payload.type !== undefined) body.type = payload.type
  if (payload.description !== undefined) body.description = payload.description
  if (payload.sku !== undefined) body.sku = payload.sku
  if (payload.imageUrl !== undefined) body.imageUrl = payload.imageUrl
  if (payload.active !== undefined) body.active = payload.active
  const unitCost = payload.unitCost
  if (typeof unitCost === 'number' && Number.isFinite(unitCost)) {
    body.cost = unitCost
  } else if (unitCost === 0) {
    body.cost = 0
  }
  if (payload.costSource === 'MANUAL' || payload.costSource === 'RECIPE') {
    body.costSource = payload.costSource
  }
  return body
}

/** Cuerpo típico de error Nest / vos-api (`message`, `hint`, `path`, `statusCode`). */
export type ApiErrorBody = {
  statusCode?: number
  message?: string | string[]
  hint?: string
  path?: string
}

/**
 * Texto legible para mostrar al usuario (incluye `hint` cuando el backend lo envía).
 * Ver README del API: errores JSON con pasos concretos en `hint`.
 */
export function formatApiErrorFromBody(
  body: unknown,
  fallback: string,
): string {
  if (!body || typeof body !== 'object') return fallback
  const b = body as ApiErrorBody
  let msg = ''
  if (Array.isArray(b.message)) msg = b.message.join(', ')
  else if (typeof b.message === 'string') msg = b.message.trim()
  if (typeof b.hint === 'string' && b.hint.trim()) {
    msg = msg ? `${msg}\n\n${b.hint.trim()}` : b.hint.trim()
  }
  if (!msg) return fallback
  return msg
}

async function parseJsonError(res: Response): Promise<string> {
  const fallback = `${res.status} ${res.statusText}`
  try {
    const body = await res.json().catch(() => ({}))
    return formatApiErrorFromBody(body, fallback)
  } catch {
    return fallback
  }
}

async function apiFetch(
  url: string,
  init?: RequestInit & { auth?: boolean },
): Promise<Response> {
  if (isBackendDown()) {
    return new Response(
      JSON.stringify({
        message: 'API no disponible',
        hint: 'Iniciá el backend: cd vos.ai-api && npm run start:dev',
      }),
      { status: 503, statusText: 'Service Unavailable' },
    )
  }
  const auth = init?.auth !== false
  const token = auth ? getAccessToken() : null
  const companyId = auth ? resolveAuthCompanyId(token) : null
  const headers = new Headers(init?.headers ?? undefined)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (companyId) headers.set('X-Company-Id', companyId)
  const res = await fetch(url, { ...init, headers })
  /** Token rechazado por el API → limpiar sesión y avisar a la app para volver al login. */
  if (auth && token && res.status === 401) {
    setAccessToken(null)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:logout'))
    }
  }
  if (auth && token && res.status === 403 && companyId) {
    const msg = await res
      .clone()
      .json()
      .then((body) => formatApiErrorFromBody(body, ''))
      .catch(() => '')
    if (
      /Seleccioná una empresa|Sin acceso a esta empresa|Contexto de empresa|X-Company-Id/i.test(
        msg,
      ) &&
      typeof window !== 'undefined'
    ) {
      const jwtCompany = companyIdFromAccessToken(token)
      if (!jwtCompany || jwtCompany !== companyId) {
        setCompanyId(jwtCompany)
      }
      window.dispatchEvent(
        new CustomEvent('auth:tenant-denied', { detail: { message: msg } }),
      )
    }
  }
  return res
}

export type LoginPayload = { email: string; password: string }
export type CompanySummary = {
  id: string
  name: string
  slug: string
  role: string
  modules: string[]
}

export type SystemSettings = {
  inaugurationDate: string | null
}

export type AuthUser = {
  sub: string
  email: string
  name: string
  role: string
  companyId: string
  companyName: string
  companySlug: string
  isPlatformAdmin?: boolean
  platformView?: boolean
  permissions?: string[]
  companies: CompanySummary[]
  systemSettings?: SystemSettings
}

export type LoginResponse = { accessToken: string; user: AuthUser }

function syncCompanyFromUser(user: AuthUser): void {
  if (user.isPlatformAdmin && user.platformView) {
    setCompanyId(null)
    return
  }
  const id = user.companyId?.trim()
  if (id) setCompanyId(id)
  else setCompanyId(null)
}

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
  syncCompanyFromUser(out.user)
  return out
}

export type RegisterPayload = {
  name: string
  email: string
  password: string
  companyName: string
}

export async function submitAccessRequest(
  base: string,
  payload: {
    companyName: string
    contactName: string
    email: string
    phone?: string
    message?: string
  },
): Promise<{ ok: boolean; message: string }> {
  const res = await apiFetch(`${base}/access-requests`, {
    method: 'POST',
    auth: false,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return (await res.json()) as { ok: boolean; message: string }
}

export async function register(
  base: string,
  payload: RegisterPayload,
): Promise<LoginResponse> {
  const res = await apiFetch(`${base}/auth/register`, {
    method: 'POST',
    auth: false,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  const out = (await res.json()) as LoginResponse
  setAccessToken(out.accessToken)
  syncCompanyFromUser(out.user)
  return out
}

export async function loginWithGoogle(
  base: string,
  idToken: string,
  companyName?: string,
): Promise<LoginResponse> {
  const res = await apiFetch(`${base}/auth/google`, {
    method: 'POST',
    auth: false,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, companyName }),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  const out = (await res.json()) as LoginResponse
  setAccessToken(out.accessToken)
  syncCompanyFromUser(out.user)
  return out
}

export async function fetchMe(base: string): Promise<AuthUser> {
  const res = await apiFetch(`${base}/auth/me`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  const user = (await res.json()) as AuthUser
  syncCompanyFromUser(user)
  return user
}

export async function switchCompany(
  base: string,
  companyId: string,
): Promise<LoginResponse> {
  const res = await apiFetch(`${base}/auth/switch-company`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId }),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  const out = (await res.json()) as LoginResponse
  setAccessToken(out.accessToken)
  syncCompanyFromUser(out.user)
  return out
}

export async function enterPlatformCompany(
  base: string,
  companyId: string,
): Promise<LoginResponse> {
  const res = await apiFetch(`${base}/auth/platform/enter-company`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId }),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  const out = (await res.json()) as LoginResponse
  setAccessToken(out.accessToken)
  syncCompanyFromUser(out.user)
  return out
}

export async function exitToPlatformAdmin(base: string): Promise<LoginResponse> {
  const res = await apiFetch(`${base}/auth/platform/home`, { method: 'POST' })
  if (!res.ok) throw new Error(await parseJsonError(res))
  const out = (await res.json()) as LoginResponse
  setAccessToken(out.accessToken)
  if (out.user.companyId) setCompanyId(out.user.companyId)
  return out
}

export type PlatformOverview = {
  companiesCount: number
  activeCompanies: number
  usersCount: number
  pendingRequests: number
  recentRequests: Array<{
    id: string
    companyName: string
    contactName: string
    email: string
    phone: string | null
    message: string | null
    status: string
    createdAt: string
  }>
}

export type PlatformCompanyRow = {
  id: string
  name: string
  slug: string
  shopSlug: string | null
  status: string
  email: string | null
  phone: string | null
  membersCount: number
  productsCount: number
  salesCount: number
  shopOrdersCount: number
  modules: Array<{ slug: string; name: string }>
}

export type PlatformCompanyDetail = PlatformCompanyRow & {
  address: string | null
  counts: {
    members: number
    products: number
    sales: number
    inventoryItems: number
    purchaseLots: number
    staffMembers: number
    shopOrders: number
  }
  members: Array<{
    id: string
    email: string
    name: string
    active: boolean
    status: string
    roles: string[]
  }>
}

export type PlatformUserRow = {
  id: string
  email: string
  name: string
  active: boolean
  isPlatformAdmin: boolean
  createdAt: string
  companies: Array<{
    id: string
    name: string
    slug: string
    role: string
    status: string
  }>
}

export type AccessRequestRow = {
  id: string
  companyName: string
  contactName: string
  email: string
  phone: string | null
  message: string | null
  status: string
  createdAt: string
}

export async function fetchPlatformOverview(base: string): Promise<PlatformOverview> {
  const res = await apiFetch(`${base}/platform/overview`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return (await res.json()) as PlatformOverview
}

export async function fetchPlatformCompanies(base: string): Promise<PlatformCompanyRow[]> {
  const res = await apiFetch(`${base}/platform/companies`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return (await res.json()) as PlatformCompanyRow[]
}

export async function fetchPlatformCompanyDetail(
  base: string,
  companyId: string,
): Promise<PlatformCompanyDetail> {
  const res = await apiFetch(`${base}/platform/companies/${encodeURIComponent(companyId)}`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return (await res.json()) as PlatformCompanyDetail
}

export async function fetchPlatformUsers(base: string): Promise<PlatformUserRow[]> {
  const res = await apiFetch(`${base}/platform/users`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return (await res.json()) as PlatformUserRow[]
}

export async function fetchPlatformAccessRequests(
  base: string,
  status?: string,
): Promise<AccessRequestRow[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : ''
  const res = await apiFetch(`${base}/platform/access-requests${q}`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return (await res.json()) as AccessRequestRow[]
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
  const out = (await res.json()) as ProductsListResponse
  return {
    ...out,
    data: out.data.map((row) => normalizeProductRow(row)),
  }
}

export type ProductSalesStat = {
  productId: string
  unitsSold: number
  revenue: number
}

export async function fetchProductSalesStats(
  base: string,
  signal?: AbortSignal,
): Promise<ProductSalesStat[]> {
  const res = await apiFetch(`${base}/products/sales-stats`, { signal })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return (await res.json()) as ProductSalesStat[]
}

export async function fetchProduct(
  base: string,
  id: string,
): Promise<ProductRow & { recipe?: unknown }> {
  const res = await apiFetch(`${base}/products/${id}`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return normalizeProductRow(
    (await res.json()) as ProductRow & { recipe?: unknown },
  )
}

/** Lote de compra asociado al producto (p. ej. vía receta → inventario → compra). */
export type ProductHistoryLotLine = {
  /** Id del lote (`purchase_lots.id`) para enlazar a `#/purchases/:id`. */
  id?: string
  /** Código único del lote (`purchase_lots.code`). */
  code: string
  purchaseDate?: string | null
  supplier?: string | null
  lineTotalCOP?: string | number | null
  notes?: string | null
}

export type ProductHistoryPricePoint = {
  effectiveAt: string
  price: string | number
  kind?: string
  note?: string | null
}

export type ProductHistoryEvent = {
  at: string
  label: string
  detail?: string | null
}

/** Respuesta esperada de GET /products/:id/history */
export type ProductHistoryResponse = {
  productId: string
  productName?: string
  lots: ProductHistoryLotLine[]
  lotsCount?: number
  salePriceHistory?: ProductHistoryPricePoint[]
  events?: ProductHistoryEvent[]
  summary?: string | null
}

/**
 * Historial del producto: lotes de compra vinculados, precios, etc.
 * Devuelve `null` si el servidor responde 404 (endpoint aún no implementado).
 */
export async function fetchProductHistory(
  base: string,
  productId: string,
  opts?: { signal?: AbortSignal },
): Promise<ProductHistoryResponse | null> {
  const res = await apiFetch(
    `${base}/products/${encodeURIComponent(productId)}/history`,
    { signal: opts?.signal },
  )
  if (res.status === 404) return null
  if (!res.ok) throw new Error(await parseJsonError(res))
  const raw = (await res.json()) as unknown
  if (!raw || typeof raw !== 'object') {
    throw new Error('Historial de producto: respuesta inválida')
  }
  const o = raw as Record<string, unknown>
  const lotsRaw = o.lots
  const lots = Array.isArray(lotsRaw)
    ? (lotsRaw as ProductHistoryLotLine[]).filter(
        (row) => row && typeof row === 'object' && typeof row.code === 'string',
      )
    : []
  const lotsCount =
    typeof o.lotsCount === 'number' && Number.isFinite(o.lotsCount)
      ? o.lotsCount
      : lots.length
  const salePriceHistory = Array.isArray(o.salePriceHistory)
    ? (o.salePriceHistory as ProductHistoryPricePoint[])
    : undefined
  const events = Array.isArray(o.events)
    ? (o.events as ProductHistoryEvent[])
    : undefined
  const productIdOut =
    typeof o.productId === 'string' ? o.productId : productId
  const productName =
    typeof o.productName === 'string' ? o.productName : undefined
  const summary =
    typeof o.summary === 'string' && o.summary.trim() ? o.summary : null
  return {
    productId: productIdOut,
    ...(productName !== undefined ? { productName } : {}),
    lots,
    lotsCount,
    ...(salePriceHistory?.length ? { salePriceHistory } : {}),
    ...(events?.length ? { events } : {}),
    ...(summary ? { summary } : {}),
  }
}

export async function createProduct(
  base: string,
  payload: CreateProductPayload,
): Promise<ProductRow> {
  const res = await apiFetch(`${base}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productWriteBody(payload)),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return normalizeProductRow((await res.json()) as ProductRow)
}

export async function updateProduct(
  base: string,
  id: string,
  payload: UpdateProductPayload,
): Promise<ProductRow> {
  const res = await apiFetch(`${base}/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productWriteBody(payload)),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return normalizeProductRow((await res.json()) as ProductRow)
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
  /**
   * Etiqueta corta resuelta por el backend para listas/cabeceras: prioriza `name`,
   * cae al `code` legible. Para pantallas de edición seguí usando `name` directo.
   */
  displayName?: string | null
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
    /** Id de `purchase_lot_lines` (requerido para PATCH cantidad comprada). */
    id?: string
    inventoryItemId?: string | null
    quantityPurchased?: string | number | null
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
    /**
     * Id de línea de compra (`purchase_lot_lines`) si el API lo expone
     * (alternativa a cruzar solo por `purchaseLines[].inventoryItemId`).
     */
    purchaseLineId?: string | null
    /** Histórico del comprobante; si es null, no hay línea de compra enlazada. */
    purchase?: {
      linePurchaseTotalCOP?: string | number | null
      purchaseUnitCostCOP?: string | number | null
    } | null
  }> | null
  totalValue?: string | number | null
  createdAt?: string
  updatedAt?: string
  /** Revisión / trazabilidad (manual). Distinto de `updatedAt`. */
  traceModifiedAt?: string | null
}

export type PurchaseLotsListMeta = {
  page: number
  limit: number
  total: number
  hasNextPage: boolean
  /** Si true, el servidor indica que falta migración DB de líneas de comprobante. */
  purchaseLotLinesMigrationPending?: boolean
  purchaseLotLinesMigrationHint?: string | null
}

export type PurchaseLotsListResponse = {
  data: PurchaseLotRow[]
  meta: PurchaseLotsListMeta
}

export type PatchPurchaseLotPayload = {
  /** Título legible del lote (opcional; vacío → `null` en el API). */
  name?: string | null
  purchaseDate?: string
  supplier?: string
  notes?: string
  /** Mismo efecto que notas en el backend; si se envían ambos, suele predominar `comment`. */
  comment?: string
  totalValue?: number
  /** Si el backend lo expone en PATCH: lote agotado vs aún con saldo. */
  isDepleted?: boolean
  consumptionStatus?: 'EMPTY' | 'FRESH' | 'PARTIAL' | 'DEPLETED'
  /** ISO UTC; usar `null` explícito para borrar la marca (no omitir el campo). */
  traceModifiedAt?: string | null
}

export type PurchaseCalendarDay = {
  date: string
  count: number
  totalCOP: string
}

export type PurchaseCalendarResponse = {
  year: number
  month: number
  days: PurchaseCalendarDay[]
  totals: { count: number; totalCOP: string }
}

export type CreatePurchaseLotLinePayload = {
  lineName: string
  quantityPurchased: number
  unit: string
  purchaseUnitCostCOP: number
  lineTotalCOP?: number
  categoryId?: string | null
  lineComment?: string | null
}

export type CreatePurchaseLotPayload = {
  purchaseDate: string
  supplier?: string
  notes?: string
  lines?: CreatePurchaseLotLinePayload[]
  totalValue?: number
}

export async function fetchPurchaseLotsCalendar(
  base: string,
  year: number,
  month: number,
): Promise<PurchaseCalendarResponse> {
  const q = new URLSearchParams({ year: String(year), month: String(month) })
  const res = await apiFetch(`${base}/purchase-lots/calendar?${q}`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<PurchaseCalendarResponse>
}

export async function createPurchaseLot(
  base: string,
  payload: CreatePurchaseLotPayload,
): Promise<PurchaseLotRow> {
  const res = await apiFetch(`${base}/purchase-lots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<PurchaseLotRow>
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
  createdAt?: string | null
  updatedAt?: string | null
  /** Revisión / trazabilidad (manual). Distinto de `updatedAt`. */
  traceModifiedAt?: string | null
  /**
   * Marca manual: cuándo se consideró consumido/agotado el ítem (ISO 8601).
   */
  consumedAt?: string | null
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

export type UpdateInventoryPayload = Partial<CreateInventoryPayload> & {
  /** ISO UTC; `null` explícito borra la marca en PATCH. */
  traceModifiedAt?: string | null
  /** ISO UTC; `null` explícito borra la marca de consumo en PATCH. */
  consumedAt?: string | null
}

export type PatchPurchaseLotPurchaseLinePayload = {
  /** Nueva cantidad declarada en comprobante (unidades de la línea). */
  quantityPurchased: number
}

/** Línea del body `PUT /purchase-lots/:id/purchase-lines` (reemplazo del comprobante). */
export type PutPurchaseLotLineItem = {
  inventoryItemId: string | null
  lineName: string
  categoryId: string | null
  quantityPurchased: number
  unit: string
  purchaseUnitCostCOP: number
  lineTotalCOP?: number
  sortOrder: number
  lineComment?: string | null
}

export type PutPurchaseLotLinesPayload = {
  lines: PutPurchaseLotLineItem[]
  expectedTotalValueCOP?: number
}

/**
 * Reemplaza todas las líneas de comprobante del lote (`PUT`, no `PATCH` sobre la colección).
 * Después conviene `GET /purchase-lots/:id`: con `inventoryItemId`, el servidor puede
 * recalcular `quantityPurchased`.
 */
export async function putPurchaseLotLines(
  base: string,
  purchaseLotId: string,
  payload: PutPurchaseLotLinesPayload,
): Promise<void> {
  const res = await apiFetch(
    `${base}/purchase-lots/${encodeURIComponent(purchaseLotId)}/purchase-lines`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  if (!res.ok) throw new Error(await parseJsonError(res))
}

/**
 * Ajusta una línea vía sub-recurso `PATCH .../purchase-lines/:lineId` (si el backend lo expone).
 * Si solo existe reemplazo completo, usá {@link putPurchaseLotLines}.
 */
export async function patchPurchaseLotPurchaseLine(
  base: string,
  purchaseLotId: string,
  purchaseLineId: string,
  payload: PatchPurchaseLotPurchaseLinePayload,
): Promise<void> {
  const res = await apiFetch(
    `${base}/purchase-lots/${encodeURIComponent(purchaseLotId)}/purchase-lines/${encodeURIComponent(purchaseLineId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
  if (!res.ok) throw new Error(await parseJsonError(res))
}

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
  /** Código legible de la venta (ej. comprobante POS). */
  code?: string | null
  /** Cliente vinculado en CRM, si aplica. */
  clientName?: string | null
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
  customerPhone?: string | null
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
  lineUnit?: string | null
  lineSize?: string | null
  lineTotal?: string | number | null
  lineTotalCOP?: string | null
  costAtSale?: string | number | null
  profit?: string | number | null
  product?: {
    id: string
    name: string
    size?: string | null
    saleUnit?: string | null
  } | null
}

export type SaleDetail = {
  id: string
  code?: string | null
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
  customerPhone?: string | null
  notes?: string | null
  userId?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  cart?: { user?: SaleCartUserRef | null } | null
  lines?: SaleLineDetail[]
  whatsappSent?: boolean
  whatsappConfigured?: boolean
  internalNotified?: boolean
}

export type SaleLineInputPayload = {
  productId?: string
  productName: string
  quantity: number
  unitPrice: number
  lineUnit?: string
  lineSize?: string
  costAtSale?: number
  profit?: number
}

export type CreateSalePayload = {
  saleDate: string
  paymentMethod?: string
  source?: string
  mesa?: string
  customerPhone?: string
  notes?: string
  userId?: string
  receiptImageDataUrl?: string
  lines: SaleLineInputPayload[]
}

export type AssistantHistoryItem = {
  role: 'user' | 'assistant'
  content: string
}

export async function askBusinessAssistant(
  base: string,
  question: string,
  history?: AssistantHistoryItem[],
): Promise<{ answer: string }> {
  const res = await apiFetch(`${base}/assistant/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, history }),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<{ answer: string }>
}

export async function askLandingAssistant(
  base: string,
  question: string,
  history?: AssistantHistoryItem[],
): Promise<{ answer: string; advisorSuggested?: boolean }> {
  const res = await apiFetch(`${base}/public/landing/ask`, {
    method: 'POST',
    auth: false,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, history }),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<{ answer: string; advisorSuggested?: boolean }>
}

/** URL de WhatsApp para asesoría (env o contacto por defecto del sitio). */
export function getLandingAdvisorUrl(prefill?: string): string {
  return getWhatsAppUrl(prefill)
}

export type PatchSalePayload = {
  saleDate?: string
  paymentMethod?: string
  source?: string
  mesa?: string
  customerPhone?: string
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

export async function deleteSale(
  base: string,
  id: string,
): Promise<{ ok: boolean; id: string; code?: string | null }> {
  const res = await apiFetch(`${base}/sales/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<{ ok: boolean; id: string; code?: string | null }>
}

// ——— Tasks API ———

export type CompanyTask = {
  id: string
  taskDate: string
  title: string
  description?: string | null
  completed: boolean
  completedAt?: string | null
  sortOrder: number
  createdById?: string | null
  assignedToId?: string | null
  createdByName?: string | null
  assignedToName?: string | null
  createdAt: string
  updatedAt: string
}

export type TasksDayResponse = {
  taskDate: string
  tasks: CompanyTask[]
  summary: { total: number; completed: number; pending: number }
}

export type TasksCalendarDay = {
  date: string
  count: number
  completedCount: number
  pendingCount: number
}

export type TasksCalendarResponse = {
  year: number
  month: number
  days: TasksCalendarDay[]
}

export async function fetchTasksCalendar(
  base: string,
  year: number,
  month: number,
): Promise<TasksCalendarResponse> {
  const q = new URLSearchParams({
    year: String(year),
    month: String(month),
  })
  const res = await apiFetch(`${base}/tasks/calendar?${q}`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<TasksCalendarResponse>
}

export async function fetchTasksByDate(
  base: string,
  date: string,
): Promise<TasksDayResponse> {
  const q = new URLSearchParams({ date })
  const res = await apiFetch(`${base}/tasks?${q}`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<TasksDayResponse>
}

export async function createTask(
  base: string,
  body: { taskDate: string; title: string; description?: string },
): Promise<CompanyTask> {
  const res = await apiFetch(`${base}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<CompanyTask>
}

export async function updateTask(
  base: string,
  id: string,
  body: Partial<{
    title: string
    description: string | null
    completed: boolean
    assignedToId: string | null
  }>,
): Promise<CompanyTask> {
  const res = await apiFetch(`${base}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<CompanyTask>
}

export async function deleteTask(
  base: string,
  id: string,
): Promise<{ ok: boolean }> {
  const res = await apiFetch(`${base}/tasks/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<{ ok: boolean }>
}

async function downloadSaleInvoicePdfCopy(
  base: string,
  saleId: string,
  code?: string | null,
): Promise<void> {
  const res = await apiFetch(`${base}/sales/${saleId}/invoice.pdf`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `comprobante-${code ?? saleId.slice(0, 8)}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadSaleReceiptTxt(
  base: string,
  saleId: string,
  code?: string | null,
): Promise<void> {
  const res = await apiFetch(`${base}/sales/${saleId}/receipt.txt`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `comprobante-${code ?? saleId.slice(0, 8)}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadSaleInvoicePdf(
  base: string,
  saleId: string,
  code?: string | null,
): Promise<void> {
  return downloadSaleInvoicePdfCopy(base, saleId, code)
}

/** @deprecated Usar downloadSaleInvoicePdf */
export async function downloadSaleInvoiceClientPdf(
  base: string,
  saleId: string,
  code?: string | null,
): Promise<void> {
  return downloadSaleInvoicePdf(base, saleId, code)
}

/** @deprecated Usar downloadSaleInvoicePdf */
export async function downloadSaleInvoiceBusinessPdf(
  base: string,
  saleId: string,
  code?: string | null,
): Promise<void> {
  return downloadSaleInvoicePdf(base, saleId, code)
}

export type PlatformShopOrder = {
  id: string
  orderCode: string
  status: string
  paymentMethod: 'NEQUI' | 'BREB' | 'CASH'
  paymentMethodLabel: string
  customerName: string | null
  customerPhone: string
  items: {
    productId: string
    productName: string
    quantity: number
    unitPrice: number
  }[]
  total: number
  totalCOP: string
  saleId: string | null
  saleCode?: string | null
  createdAt: string
  preparingAt: string | null
  deliveredAt: string | null
  paidAt: string | null
  whatsappSent?: boolean
  internalNotified?: boolean
}

export async function fetchPlatformShopOrders(
  base: string,
  status?: string,
): Promise<PlatformShopOrder[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : ''
  const res = await apiFetch(`${base}/shop-orders${q}`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<PlatformShopOrder[]>
}

export async function updatePlatformShopOrderStatus(
  base: string,
  id: string,
  status: 'PREPARING' | 'DELIVERED',
): Promise<PlatformShopOrder> {
  const res = await apiFetch(`${base}/shop-orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<PlatformShopOrder>
}

export async function collectPlatformShopOrderPayment(
  base: string,
  id: string,
  paymentMethod: 'NEQUI' | 'BREB' | 'CASH',
): Promise<PlatformShopOrder> {
  const res = await apiFetch(`${base}/shop-orders/${id}/collect-payment`, {
    method: 'POST',
    body: JSON.stringify({ paymentMethod }),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<PlatformShopOrder>
}

export type ShopSettings = {
  companyId: string
  companyName: string
  shopSlug: string | null
  enabled: boolean
  activeProducts: number
  pendingOrders: number
  frontBase: string
  catalogUrlHash: string | null
  catalogUrlPath: string | null
  embedIframeHtml: string | null
  apiCatalogPath: string | null
}

export async function fetchShopSettings(base: string): Promise<ShopSettings> {
  const res = await apiFetch(`${base}/shop-settings`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<ShopSettings>
}

export async function updateShopSettings(
  base: string,
  payload: { shopSlug?: string | null },
): Promise<Partial<ShopSettings>> {
  const res = await apiFetch(`${base}/shop-settings`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<Partial<ShopSettings>>
}

export type DailyCashClose = {
  date: string
  companyName: string
  summary: {
    saleCount: number
    salesTotalCOP: number
    purchaseCount: number
    purchasesTotalCOP: number
    netCOP: number
    laborTotalCOP: number
    shiftCount: number
  }
  paymentsByMethod: { method: string; totalCOP: number }[]
  sales: {
    id: string
    code: string | null
    customer: string
    customerPhone?: string | null
    mesa?: string | null
    notes?: string | null
    source?: string
    saleDate: string
    total: number
    paymentMethod: string
    lineCount: number
    lines: {
      id: string
      productName: string
      quantity: number
      unitPrice: number
      lineTotal: number
      lineUnit?: string | null
    }[]
  }[]
  purchases: {
    id: string
    code: string
    name: string
    purchaseDate: string
    total: number
    lineCount: number
  }[]
  shifts: {
    id: string
    staffName: string
    startAt: string
    endAt: string | null
    hoursWorked: number | null
    totalPayCOP: number | null
    notes: string | null
  }[]
}

export async function fetchDailyCashClose(
  base: string,
  date: string,
): Promise<DailyCashClose> {
  const q = new URLSearchParams({ date })
  const res = await apiFetch(`${base}/cash-close/daily?${q}`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<DailyCashClose>
}

export type SalesCalendarDay = {
  date: string
  count: number
  totalCOP: string
}

export type SalesCalendarResponse = {
  year: number
  month: number
  days: SalesCalendarDay[]
  totals: { count: number; totalCOP: string }
}

export async function fetchSalesCalendar(
  base: string,
  year: number,
  month: number,
): Promise<SalesCalendarResponse> {
  const q = new URLSearchParams({ year: String(year), month: String(month) })
  const res = await apiFetch(`${base}/sales/calendar?${q}`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<SalesCalendarResponse>
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

export async function sendSaleReceiptWhatsApp(
  base: string,
  id: string,
  customerPhone?: string,
): Promise<{
  whatsappSent: boolean
  whatsappConfigured: boolean
  internalNotified?: boolean
}> {
  const res = await apiFetch(`${base}/sales/${id}/send-receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      customerPhone?.trim() ? { customerPhone: customerPhone.trim() } : {},
    ),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<{
    whatsappSent: boolean
    whatsappConfigured: boolean
    internalNotified?: boolean
  }>
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

/**
 * ISO 8601 (UTC u offset) → valor para `<input type="datetime-local">` en hora local del navegador.
 */
export function isoInstantToDatetimeLocalValue(
  iso: string | null | undefined,
): string {
  if (!iso?.trim()) return ''
  const d = new Date(iso.trim())
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Valor actual para `<input type="datetime-local">` (hora local del navegador). */
export function nowDatetimeLocalValue(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Valor de `<input type="datetime-local">` (interpretado como hora local) → ISO UTC (`…Z`) para JSON PATCH.
 * Cadena vacía → `null` (limpiar marca de revisión).
 */
export function datetimeLocalValueToIsoUtcOrNull(local: string): string | null {
  const v = local.trim()
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

/** `updatedAt` u otras marcas de sistema: solo lectura en UI. */
export function formatSystemDateTime(
  iso: string | null | undefined,
): string {
  if (!iso?.trim()) return '—'
  const d = new Date(iso.trim())
  if (Number.isNaN(d.getTime())) return String(iso).trim()
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d)
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

/**
 * Etiqueta de lote para filas de inventario (movimientos/recetas): prioriza el
 * objeto anidado `purchaseLot` del API (su `displayName` o `name` ya viene corto)
 * y cae a `row.lot` si el inventario no resolvió el lote.
 */
export function inventoryLotDisplayLabel(row: InventoryRow): string | null {
  const pl = row.purchaseLot
  if (pl) {
    const d = pl.displayName?.trim()
    if (d) return d
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
  const trimmed = id.trim()
  if (!trimmed) throw new Error('Falta el identificador del lote.')

  const directUrl = `${base}/purchase-lots/${encodeURIComponent(trimmed)}`
  const res = await apiFetch(directUrl)
  if (res.ok) return res.json() as Promise<PurchaseLotRow>

  const errMsg = await parseJsonError(res)

  /**
   * Algunos despliegues validan el segmento como UUID y devuelven 400 para ids tipo CUID.
   * Respaldo: buscar en el listado por id o código (mismo texto que en la URL).
   */
  if (res.status === 400 || res.status === 404) {
    try {
      const listRes = await fetchPurchaseLots(base, {
        search: trimmed,
        limit: 100,
      })
      const hit =
        listRes.data.find((r) => r.id === trimmed) ??
        listRes.data.find((r) => (r.code ?? '').trim() === trimmed)
      if (hit) return hit
    } catch {
      /* usar errMsg */
    }
  }

  throw new Error(errMsg)
}

export async function patchPurchaseLot(
  base: string,
  id: string,
  payload: PatchPurchaseLotPayload,
): Promise<PurchaseLotRow> {
  const res = await apiFetch(`${base}/purchase-lots/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<PurchaseLotRow>
}

/** Categorías para productos (`type === PRODUCT`): explorador paginado (limit≤100); respaldo GET /categories. */
async function fetchProductCategoriesTenant(
  base: string,
): Promise<CategoryRef[] | null> {
  for (const path of ['/product-categories', '/categories']) {
    const res = await apiFetch(`${base}${path}`)
    if (res.status === 404 || res.status === 405) continue
    if (!res.ok) throw new Error(await parseJsonError(res))
    const body = await res.json()
    if (Array.isArray(body)) {
      return body.map((c: Record<string, unknown>) => ({
        id: String(c.id),
        name: String(c.name),
        type: String(c.type ?? 'PRODUCT'),
        slug: typeof c.slug === 'string' ? c.slug : undefined,
        parentId:
          c.parentId === null || c.parentId === undefined
            ? null
            : String(c.parentId),
      }))
    }
  }
  return null
}

export async function fetchProductCategories(
  base: string,
): Promise<CategoryRef[]> {
  const tenant = await fetchProductCategoriesTenant(base)
  if (tenant !== null) return tenant
  try {
    return await fetchCategoriesViaExplorer(base, 'PRODUCT')
  } catch (first) {
    const viaRest = await tryFetchCategoriesRest(base, 'PRODUCT')
    if (viaRest !== null) return viaRest
    throw first instanceof Error ? first : new Error(String(first))
  }
}

/** Categorías de inventario (`type === INVENTORY`). */
export async function fetchInventoryCategories(
  base: string,
): Promise<CategoryRef[]> {
  try {
    const res = await apiFetch(`${base}/inventory/categories`)
    if (res.ok) {
      const rows = (await res.json()) as CategoryRef[]
      if (Array.isArray(rows)) return rows
    }
  } catch {
    /* fallback al explorador legacy */
  }
  try {
    return await fetchCategoriesViaExplorer(base, 'INVENTORY')
  } catch (first) {
    const viaRest = await tryFetchCategoriesRest(base, 'INVENTORY')
    if (viaRest !== null) return viaRest
    throw first instanceof Error ? first : new Error(String(first))
  }
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

// ——— Personal (turnos) ———

export type StaffMemberRow = {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  idNumber?: string | null
  defaultHourlyRate: string
  active: boolean
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export type StaffShiftRow = {
  id: string
  staffMemberId: string
  staffMemberName: string
  shiftDate: string
  startAt: string
  endAt: string | null
  hourlyRateCOP: string
  hoursWorked: string | null
  totalPayCOP: string | null
  status: 'OPEN' | 'CLOSED' | 'PAID'
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export type StaffSummary = {
  shiftCount: number
  openShifts: number
  totalHours: number
  totalPayCOP: number
}

type Paginated<T> = {
  data: T[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
  }
}

export async function fetchStaffMembers(
  base: string,
  opts?: { page?: number; limit?: number; search?: string; active?: boolean },
): Promise<Paginated<StaffMemberRow>> {
  const q = new URLSearchParams()
  q.set('page', String(opts?.page ?? 1))
  q.set('limit', String(opts?.limit ?? 100))
  if (opts?.search?.trim()) q.set('search', opts.search.trim())
  if (opts?.active === true) q.set('active', 'true')
  if (opts?.active === false) q.set('active', 'false')
  const res = await apiFetch(`${base}/staff?${q}`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<Paginated<StaffMemberRow>>
}

export async function createStaffMember(
  base: string,
  payload: {
    name: string
    phone?: string
    email?: string
    idNumber?: string
    defaultHourlyRate: number
    active?: boolean
    notes?: string
  },
): Promise<StaffMemberRow> {
  const res = await apiFetch(`${base}/staff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<StaffMemberRow>
}

export async function updateStaffMember(
  base: string,
  id: string,
  payload: Partial<{
    name: string
    phone: string
    email: string
    idNumber: string
    defaultHourlyRate: number
    active: boolean
    notes: string
  }>,
): Promise<StaffMemberRow> {
  const res = await apiFetch(`${base}/staff/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<StaffMemberRow>
}

export async function deleteStaffMember(
  base: string,
  id: string,
): Promise<void> {
  const res = await apiFetch(`${base}/staff/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseJsonError(res))
}

export async function fetchStaffShifts(
  base: string,
  opts?: {
    page?: number
    limit?: number
    staffMemberId?: string
    status?: StaffShiftRow['status']
    dateFrom?: string
    dateTo?: string
  },
): Promise<Paginated<StaffShiftRow>> {
  const q = new URLSearchParams()
  q.set('page', String(opts?.page ?? 1))
  q.set('limit', String(opts?.limit ?? 100))
  if (opts?.staffMemberId) q.set('staffMemberId', opts.staffMemberId)
  if (opts?.status) q.set('status', opts.status)
  if (opts?.dateFrom) q.set('dateFrom', opts.dateFrom)
  if (opts?.dateTo) q.set('dateTo', opts.dateTo)
  const res = await apiFetch(`${base}/staff-shifts?${q}`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<Paginated<StaffShiftRow>>
}

export async function createStaffShift(
  base: string,
  payload: {
    staffMemberId: string
    startAt: string
    endAt?: string
    hourlyRateCOP: number
    hoursWorked?: number
    status?: StaffShiftRow['status']
    notes?: string
  },
): Promise<StaffShiftRow> {
  const res = await apiFetch(`${base}/staff-shifts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<StaffShiftRow>
}

export async function updateStaffShift(
  base: string,
  id: string,
  payload: Partial<{
    startAt: string
    endAt: string | null
    hourlyRateCOP: number
    hoursWorked: number | null
    status: StaffShiftRow['status']
    notes: string
  }>,
): Promise<StaffShiftRow> {
  const res = await apiFetch(`${base}/staff-shifts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<StaffShiftRow>
}

export async function deleteStaffShift(base: string, id: string): Promise<void> {
  const res = await apiFetch(`${base}/staff-shifts/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseJsonError(res))
}

export async function fetchStaffSummary(
  base: string,
  opts?: { dateFrom?: string; dateTo?: string },
): Promise<StaffSummary> {
  const q = new URLSearchParams()
  if (opts?.dateFrom) q.set('dateFrom', opts.dateFrom)
  if (opts?.dateTo) q.set('dateTo', opts.dateTo)
  const qs = q.toString()
  const res = await apiFetch(`${base}/staff/summary${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<StaffSummary>
}

export type AnalyticsGranularity = 'day' | 'week' | 'month'

export type FinancialAnalyticsSeriesPoint = {
  period: string
  label: string
  count: number
  totalCOP: number
  profitCOP?: number
  hours?: number
}

export type FinancialAnalyticsCombinedRow = {
  period: string
  label: string
  salesCount: number
  salesCOP: number
  salesProfitCOP: number
  grossProfitCOP: number
  purchasesCount: number
  purchasesCOP: number
  staffShifts: number
  staffHours: number
  staffPayCOP: number
  netCOP: number
}

export type FinancialAnalyticsOverview = {
  granularity: AnalyticsGranularity
  dateFrom: string
  dateTo: string
  sales: {
    series: FinancialAnalyticsSeriesPoint[]
    totals: { count: number; totalCOP: number; profitCOP: number }
  }
  purchases: {
    series: FinancialAnalyticsSeriesPoint[]
    totals: { count: number; totalCOP: number }
  }
  staff: {
    series: FinancialAnalyticsSeriesPoint[]
    totals: { shiftCount: number; hours: number; totalPayCOP: number }
  }
  combined: FinancialAnalyticsCombinedRow[]
  summary: {
    salesCOP: number
    salesProfitCOP: number
    grossProfitCOP: number
    purchasesCOP: number
    staffPayCOP: number
    netCOP: number
  }
}

export async function fetchFinancialAnalytics(
  base: string,
  opts?: {
    dateFrom?: string
    dateTo?: string
    granularity?: AnalyticsGranularity
  },
): Promise<FinancialAnalyticsOverview> {
  const q = new URLSearchParams()
  if (opts?.dateFrom) q.set('dateFrom', opts.dateFrom)
  if (opts?.dateTo) q.set('dateTo', opts.dateTo)
  if (opts?.granularity) q.set('granularity', opts.granularity)
  const qs = q.toString()
  const res = await apiFetch(`${base}/analytics/financial${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error(await parseJsonError(res))
  return res.json() as Promise<FinancialAnalyticsOverview>
}
