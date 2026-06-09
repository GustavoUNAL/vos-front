import { useCallback, useEffect, useRef, useState } from 'react'
import { readApiCache, writeApiCache } from '../lib/apiCache'

type Options = {
  ttlMs?: number
  enabled?: boolean
}

export function useStaleCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: Options,
) {
  const ttlMs = options?.ttlMs ?? 5 * 60 * 1000
  const enabled = options?.enabled ?? true
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const [data, setData] = useState<T | null>(() => {
    if (!enabled) return null
    return readApiCache<T>(key)?.data ?? null
  })
  const [loading, setLoading] = useState(() => {
    if (!enabled) return false
    return readApiCache<T>(key) == null
  })
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (force = false) => {
      if (!enabled) return
      const cached = !force ? readApiCache<T>(key) : null
      if (cached) {
        setData(cached.data)
        setLoading(false)
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)
      try {
        const fresh = await fetcherRef.current()
        writeApiCache(key, fresh, ttlMs)
        setData(fresh)
      } catch (e) {
        if (!cached) {
          setData(null)
          setError(e instanceof Error ? e.message : 'Error al cargar datos')
        }
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [enabled, key, ttlMs],
  )

  useEffect(() => {
    void load()
  }, [load])

  return { data, loading, refreshing, error, reload: () => load(true) }
}
