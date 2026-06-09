import { useCallback, useMemo } from 'react'
import type { CategoryRef, ProductRow } from '../../api'
import { isBackendDown } from '../../backendHealth'
import { useStaleCache } from '../../hooks/useStaleCache'
import {
  fetchPosActiveCatalog,
  POS_ACTIVE_CATALOG_CACHE_KEY,
  POS_ACTIVE_CATALOG_TTL_MS,
  type PosActiveCatalog,
} from '../../lib/posCatalogLoader'
import { getDemoCatalog } from '../services/demoCatalog'

function isApiUnreachableError(e: unknown): boolean {
  if (e instanceof TypeError) return true
  if (e instanceof Error) {
    return /failed to fetch|502|503|504|bad gateway/i.test(e.message)
  }
  return false
}

function demoCatalogPayload(): PosActiveCatalog {
  const demo = getDemoCatalog()
  return {
    categories: demo.categories,
    products: demo.products,
    source: 'demo',
  }
}

export function usePosCatalog(baseUrl: string) {
  const fetcher = useCallback(async (): Promise<PosActiveCatalog> => {
    if (isBackendDown()) return demoCatalogPayload()
    try {
      return await fetchPosActiveCatalog(baseUrl)
    } catch (e) {
      if (isApiUnreachableError(e) || isBackendDown()) return demoCatalogPayload()
      throw e
    }
  }, [baseUrl])

  const { data, loading, refreshing, error, reload } = useStaleCache(
    POS_ACTIVE_CATALOG_CACHE_KEY,
    fetcher,
    { ttlMs: POS_ACTIVE_CATALOG_TTL_MS },
  )

  const products = data?.products ?? []
  const categories = data?.categories ?? []
  const usingDemoCatalog = data?.source === 'demo'

  const catalogError = useMemo(() => {
    if (error) return error
    if (!loading && !refreshing && products.length === 0 && !usingDemoCatalog) {
      return 'No hay productos activos en la carta. Activá productos en «Productos a la venta».'
    }
    return null
  }, [error, loading, refreshing, products.length, usingDemoCatalog])

  return {
    products: products as ProductRow[],
    categories: categories as CategoryRef[],
    loading,
    refreshing,
    error: catalogError,
    usingDemoCatalog,
    reload,
  }
}
