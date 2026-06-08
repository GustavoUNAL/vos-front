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

export type ShopOrder = {
  id: string
  orderCode: string
  status: string
  paymentMethod: 'NEQUI' | 'BREB'
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
  createdAt: string
  paidAt: string | null
  expiresAt: string | null
}

const DEFAULT_SLUG =
  (import.meta.env.VITE_SHOP_SLUG as string | undefined)?.trim() || 'arandano'

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

export function getShopSlugFromHash(): string {
  const raw = (window.location.hash ?? '').replace(/^#/, '')
  const parts = raw.split('/').filter(Boolean)
  if (parts[0] !== 'tienda') return DEFAULT_SLUG
  if (parts[1] && parts[1] !== 'pago') return parts[1]
  return DEFAULT_SLUG
}

export function isPublicShopRoute(): boolean {
  return (window.location.hash ?? '').startsWith('#/tienda')
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
    paymentMethod: 'NEQUI' | 'BREB'
  },
): Promise<ShopOrder> {
  return publicJson(`/public/shop/${encodeURIComponent(slug)}/checkout`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchShopOrder(orderId: string): Promise<ShopOrder> {
  return publicJson(`/public/shop/orders/${encodeURIComponent(orderId)}`)
}

export function fetchShopOrderByCode(
  slug: string,
  orderCode: string,
): Promise<ShopOrder> {
  return publicJson(
    `/public/shop/${encodeURIComponent(slug)}/orders/${encodeURIComponent(orderCode)}`,
  )
}

export function confirmShopPayment(orderId: string): Promise<ShopOrder> {
  return publicJson(`/public/shop/orders/${encodeURIComponent(orderId)}/confirm`, {
    method: 'POST',
  })
}
