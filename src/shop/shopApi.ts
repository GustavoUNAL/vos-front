import { getApiBase } from '../api'

export type ShopProduct = {
  id: string
  name: string
  description: string
  price: number
  imageUrl: string | null
  categoryId: string
  category: { id: string; name: string; slug: string }
}

export type ShopCatalog = {
  company: {
    id: string
    name: string
    slug: string | null
    phone: string | null
    address: string | null
  }
  categories: { id: string; name: string; slug: string; sortOrder: number }[]
  products: ShopProduct[]
}

export type ShopCartLine = {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
}

export type ShopOrderStatus =
  | 'PENDING'
  | 'PREPARING'
  | 'DELIVERED'
  | 'PAID'
  | 'CANCELLED'
  | 'EXPIRED'

export type ShopOrder = {
  id: string
  orderCode: string
  status: ShopOrderStatus
  paymentMethod: 'NEQUI' | 'BREB' | 'CASH'
  paymentMethodLabel?: string
  customerName: string | null
  customerPhone: string
  items: ShopCartLine[]
  total: number
  totalCOP: string
  paymentRef: string | null
  paymentLink: string | null
  paymentInstructions: string | null
  saleId: string | null
  saleCode: string | null
  companyName: string
  whatsappSent?: boolean
  accessToken?: string
  createdAt: string
  paidAt: string | null
  preparingAt: string | null
  deliveredAt: string | null
  expiresAt: string | null
}

const DEFAULT_SLUG =
  (import.meta.env.VITE_SHOP_SLUG as string | undefined)?.trim() || 'arandano'

const ROUTE_RESERVED = new Set(['pago', 'pedido', 'exito'])

export type ShopRoute =
  | { screen: 'catalog' }
  | { screen: 'pedido'; orderCode: string; accessToken: string }
  | { screen: 'payment'; orderCode: string; accessToken: string }
  | { screen: 'success'; orderCode: string; accessToken: string }

function shopRouteParts(): string[] {
  const path = window.location.pathname.replace(/^\/+/, '')
  if (path.startsWith('tienda')) {
    return path.split('/').filter(Boolean)
  }
  const raw = (window.location.hash ?? '').replace(/^#/, '')
  const pathOnly = raw.split('?')[0] ?? ''
  return pathOnly.split('/').filter(Boolean)
}

export function isShopEmbedMode(): boolean {
  const params = new URLSearchParams(window.location.search)
  if (params.get('embed') === '1') return true
  const hashQuery = (window.location.hash ?? '').split('?')[1]
  if (hashQuery && new URLSearchParams(hashQuery).get('embed') === '1') return true
  return false
}

function shopLookupToken(): string {
  if (typeof window === 'undefined') return ''
  const hash = window.location.hash ?? ''
  const query = hash.includes('?')
    ? hash.slice(hash.indexOf('?') + 1)
    : window.location.search.slice(1)
  return new URLSearchParams(query).get('k') ?? ''
}

export function parseShopRoute(): ShopRoute {
  const parts = shopRouteParts()
  if (parts[0] !== 'tienda') return { screen: 'catalog' }
  const accessToken = shopLookupToken()
  if ((parts[1] === 'pedido' || parts[1] === 'pago') && parts[2]?.startsWith('SHOP-') && accessToken) {
    return { screen: 'pedido', orderCode: parts[2], accessToken }
  }
  if (parts[1] === 'exito' && parts[2]?.startsWith('SHOP-') && accessToken) {
    return { screen: 'success', orderCode: parts[2], accessToken }
  }
  return { screen: 'catalog' }
}

export function getShopSlugFromHash(): string {
  const parts = shopRouteParts()
  if (parts[0] !== 'tienda') return DEFAULT_SLUG
  if (parts[1] && !ROUTE_RESERVED.has(parts[1])) return parts[1]
  return DEFAULT_SLUG
}

export function isPublicShopRoute(): boolean {
  const hash = window.location.hash ?? ''
  if (hash.startsWith('#/tienda')) return true
  const path = window.location.pathname.replace(/\/$/, '')
  return path === '/tienda' || path.startsWith('/tienda/')
}

export function shopCartStorageKey(slug: string): string {
  return `vos_shop_cart_${slug.trim().toLowerCase() || DEFAULT_SLUG}`
}

/** Navega dentro de la tienda (hash o path según la URL actual). */
export function navigateShop(pathAfterTienda: string): void {
  const suffix = pathAfterTienda.replace(/^\/+/, '')
  const usePath = window.location.pathname.startsWith('/tienda')
  if (usePath) {
    window.history.pushState({}, '', `/tienda/${suffix}`)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    return
  }
  window.location.hash = `#/tienda/${suffix}`
}

/** Abre la tienda pública con carrito (misma pestaña). */
export function openPublicShop(slug?: string): void {
  const s = slug?.trim() || DEFAULT_SLUG
  window.location.hash = `#/tienda/${s}`
}

export const SHOP_STATUS_LABEL: Record<ShopOrderStatus, string> = {
  PENDING: 'Recibido en cocina',
  PREPARING: 'En preparación',
  DELIVERED: 'Listo / entregado',
  PAID: 'Pagado',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Expirado',
}

async function publicJson<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBase()
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    let msg = res.statusText
    try {
      const body = (await res.json()) as { message?: string | string[] }
      if (Array.isArray(body.message)) msg = body.message.join(', ')
      else if (body.message) msg = body.message
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export function fetchShopCatalog(slug = DEFAULT_SLUG): Promise<ShopCatalog> {
  return publicJson(`/public/shop/${encodeURIComponent(slug)}/catalog`)
}

export function checkoutShop(
  slug: string,
  payload: {
    items: ShopCartLine[]
    customerPhone: string
    customerName?: string
    customerNotes?: string
    paymentMethod?: 'NEQUI' | 'BREB' | 'CASH'
  },
): Promise<ShopOrder> {
  return publicJson(`/public/shop/${encodeURIComponent(slug)}/checkout`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchShopOrderByCode(
  slug: string,
  orderCode: string,
  token: string,
): Promise<ShopOrder> {
  const q = new URLSearchParams({ token })
  return publicJson(
    `/public/shop/${encodeURIComponent(slug)}/orders/${encodeURIComponent(orderCode)}?${q}`,
  )
}
