import { useCallback, useEffect, useState } from 'react'
import {
  fetchPlatformShopOrders,
  type PlatformShopOrder,
} from '../../api'
import { readApiCache, writeApiCache } from '../../lib/apiCache'
import {
  SHOP_ORDERS_CACHE_KEY,
  SHOP_ORDERS_CACHE_TTL_MS,
} from '../constants'
import { dispatchShopOrderEvent } from '../services/posLocalEvents'
import { shopWsClient } from '../services/shopWebSocket'

const ACTIVE_STATUSES = new Set(['PENDING', 'PREPARING', 'DELIVERED'])

function isActiveOrder(order: PlatformShopOrder): boolean {
  return ACTIVE_STATUSES.has(order.status)
}

function normalizeShopOrder(raw: Record<string, unknown>): PlatformShopOrder | null {
  if (typeof raw.id !== 'string' || typeof raw.orderCode !== 'string') return null
  return raw as unknown as PlatformShopOrder
}

function mergeShopOrder(
  list: PlatformShopOrder[],
  order: PlatformShopOrder,
): PlatformShopOrder[] {
  const without = list.filter((row) => row.id !== order.id)
  if (!isActiveOrder(order)) return without
  return [order, ...without].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
}

export function useShopOrdersFeed(baseUrl: string) {
  const [orders, setOrders] = useState<PlatformShopOrder[]>(() => {
    return readApiCache<PlatformShopOrder[]>(SHOP_ORDERS_CACHE_KEY)?.data ?? []
  })
  const [loading, setLoading] = useState(() => !readApiCache(SHOP_ORDERS_CACHE_KEY))
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ code: string; message: string } | null>(
    null,
  )

  const persist = useCallback((next: PlatformShopOrder[]) => {
    const active = next.filter(isActiveOrder)
    setOrders(active)
    writeApiCache(SHOP_ORDERS_CACHE_KEY, active, SHOP_ORDERS_CACHE_TTL_MS)
    return active
  }, [])

  const refresh = useCallback(async (force = false) => {
    const cached = !force ? readApiCache<PlatformShopOrder[]>(SHOP_ORDERS_CACHE_KEY) : null
    if (cached) {
      persist(cached.data.filter(isActiveOrder))
      setLoading(false)
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)
    try {
      const rows = await fetchPlatformShopOrders(baseUrl)
      persist(rows.filter(isActiveOrder))
    } catch (e) {
      if (!cached) {
        setOrders([])
        setError(e instanceof Error ? e.message : 'Error cargando pedidos')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [baseUrl, persist])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    shopWsClient.reset()
    shopWsClient.connect(baseUrl)
    const unsub = shopWsClient.subscribe((ev) => {
      if (ev.type === 'shop-order.created' || ev.type === 'shop-order.updated') {
        dispatchShopOrderEvent(ev)
      }
    })
    return () => {
      unsub()
      shopWsClient.dispose()
    }
  }, [baseUrl])

  useEffect(() => {
    const onShopOrder = (event: Event) => {
      const ev = (event as CustomEvent).detail as {
        type: 'shop-order.created' | 'shop-order.updated'
        order: Record<string, unknown>
      }
      const order = normalizeShopOrder(ev.order)
      if (!order) return
      setOrders((prev) => {
        const next = mergeShopOrder(prev, order)
        writeApiCache(SHOP_ORDERS_CACHE_KEY, next, SHOP_ORDERS_CACHE_TTL_MS)
        return next
      })
      if (ev.type === 'shop-order.created' && isActiveOrder(order)) {
        setToast({
          code: order.orderCode,
          message: `Nuevo pedido web · ${order.orderCode}`,
        })
      }
    }
    window.addEventListener('pos:shop-order', onShopOrder)
    return () => window.removeEventListener('pos:shop-order', onShopOrder)
  }, [persist])

  return {
    orders,
    pendingCount: orders.filter((o) => o.status === 'PENDING').length,
    activeCount: orders.length,
    loading,
    refreshing,
    error,
    toast,
    dismissToast: () => setToast(null),
    refresh,
  }
}
