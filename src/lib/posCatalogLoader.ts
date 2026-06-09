import {
  fetchProductCategories,
  fetchProducts,
  type CategoryRef,
  type ProductRow,
} from '../api'
import { readApiCache, writeApiCache } from './apiCache'

export const POS_ACTIVE_CATALOG_CACHE_KEY = 'pos:active-catalog'
export const POS_ACTIVE_CATALOG_TTL_MS = 12 * 60 * 1000

export type PosActiveCatalog = {
  categories: CategoryRef[]
  products: ProductRow[]
  source: 'api' | 'demo'
}

export async function fetchPosActiveCatalog(
  baseUrl: string,
): Promise<PosActiveCatalog> {
  const cats = await fetchProductCategories(baseUrl)
  const products: ProductRow[] = []
  let page = 1
  while (page <= 50) {
    const res = await fetchProducts(baseUrl, {
      page,
      limit: 100,
      active: true,
    })
    products.push(...res.data)
    if (!res.meta.hasNextPage) break
    page++
  }
  return { categories: cats, products, source: 'api' }
}

export function peekPosActiveCatalog(): PosActiveCatalog | null {
  return readApiCache<PosActiveCatalog>(POS_ACTIVE_CATALOG_CACHE_KEY)?.data ?? null
}

/** Carga en segundo plano; útil al entrar a Mesas para que el pedido abra al instante. */
export function prefetchPosActiveCatalog(baseUrl: string): void {
  const cached = readApiCache<PosActiveCatalog>(POS_ACTIVE_CATALOG_CACHE_KEY)
  if (cached && !cached.stale) return
  void fetchPosActiveCatalog(baseUrl)
    .then((data) => {
      writeApiCache(POS_ACTIVE_CATALOG_CACHE_KEY, data, POS_ACTIVE_CATALOG_TTL_MS)
    })
    .catch(() => {
      /* silencioso: el hook del pedido reintenta */
    })
}
