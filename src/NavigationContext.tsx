import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchNavigation,
  getApiBase,
  navigationSubtitleFor,
  type NavigationPayload,
} from './api'
import { ensureBackendProbe, isBackendDown, resetBackendProbe } from './backendHealth'
import { readApiCache, writeApiCache } from './lib/apiCache'

const NAVIGATION_CACHE_KEY = 'app:navigation'
const NAVIGATION_TTL_MS = 30 * 60 * 1000

type NavigationContextValue = {
  navigation: NavigationPayload | null
  loading: boolean
  error: string | null
  apiReady: boolean
  backendDown: boolean
  purchasesSubtitle: string | undefined
  inventorySubtitle: string | undefined
  retryApiProbe: () => void
}

const NavigationContext = createContext<NavigationContextValue | null>(null)

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [navigation, setNavigation] = useState<NavigationPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [apiReady, setApiReady] = useState(false)
  const [probeTick, setProbeTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    const base = getApiBase()

    async function load() {
      const cached = readApiCache<NavigationPayload | null>(NAVIGATION_CACHE_KEY)
      if (cached) {
        setNavigation(cached.data)
        setLoading(false)
        setApiReady(true)
      } else {
        setLoading(true)
        setApiReady(false)
      }
      setError(null)

      const up = await ensureBackendProbe(base)
      if (cancelled) return

      if (!up) {
        if (!cached) {
          setNavigation(null)
          setError(
            'API apagado o inaccesible. Levantá vos-api en http://localhost:3000 y recargá.',
          )
        }
        setLoading(false)
        setApiReady(true)
        return
      }

      try {
        const n = await fetchNavigation(base)
        if (!cancelled) {
          writeApiCache(NAVIGATION_CACHE_KEY, n, NAVIGATION_TTL_MS)
          setNavigation(n)
        }
      } catch (e) {
        if (!cancelled && !cached) {
          setNavigation(null)
          setError(e instanceof Error ? e.message : 'Error al cargar navegación')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setApiReady(true)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [probeTick])

  const value = useMemo((): NavigationContextValue => {
    return {
      navigation,
      loading,
      error,
      apiReady,
      backendDown: isBackendDown(),
      purchasesSubtitle: navigationSubtitleFor(navigation, 'purchases'),
      inventorySubtitle: navigationSubtitleFor(navigation, 'inventory'),
      retryApiProbe: () => {
        resetBackendProbe()
        setProbeTick((t) => t + 1)
      },
    }
  }, [navigation, loading, error, apiReady])

  if (!apiReady) {
    return (
      <div className="app-api-boot" role="status" aria-live="polite">
        <p>Conectando con el API…</p>
      </div>
    )
  }

  return (
    <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
  )
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext)
  if (!ctx) {
    throw new Error('useNavigation debe usarse dentro de NavigationProvider')
  }
  return ctx
}
