import { useCallback, useMemo } from 'react'
import { fetchProductSalesStats } from '../../api'
import { useStaleCache } from '../../hooks/useStaleCache'

const CACHE_KEY = 'pos:sales-stats'
const TTL_MS = 30 * 60 * 1000
const TOP_COUNT = 10

export function usePosSalesRanking(baseUrl: string) {
  const fetcher = useCallback(
    () => fetchProductSalesStats(baseUrl),
    [baseUrl],
  )

  const { data, loading, refreshing } = useStaleCache(CACHE_KEY, fetcher, {
    ttlMs: TTL_MS,
  })

  const unitsSoldByProductId = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of data ?? []) {
      map.set(row.productId, row.unitsSold)
    }
    return map
  }, [data])

  const topProductIds = useMemo(() => {
    if (!data?.length) return [] as string[]
    return [...data]
      .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)
      .slice(0, TOP_COUNT)
      .map((row) => row.productId)
  }, [data])

  return {
    unitsSoldByProductId,
    topProductIds,
    loading,
    refreshing,
    hasRanking: topProductIds.length > 0,
  }
}
