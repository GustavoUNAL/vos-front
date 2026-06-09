import { companyIdFromAccessToken, getAccessToken, getCompanyId, getApiBase } from '../api'

const STORAGE_PREFIX = 'vos_cache:'
const memory = new Map<string, CacheEntry<unknown>>()

type CacheEntry<T> = {
  data: T
  savedAt: number
  ttlMs: number
}

function scopedKey(key: string): string {
  const token = getAccessToken()
  const companyId = companyIdFromAccessToken(token) ?? getCompanyId() ?? 'anon'
  return `${getApiBase()}|${companyId}|${key}`
}

function readStorage<T>(scoped: string): CacheEntry<T> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + scoped)
    if (!raw) return null
    return JSON.parse(raw) as CacheEntry<T>
  } catch {
    return null
  }
}

function writeStorage<T>(scoped: string, entry: CacheEntry<T>): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + scoped, JSON.stringify(entry))
  } catch {
    /* quota or private mode */
  }
}

export function readApiCache<T>(
  key: string,
): { data: T; stale: boolean; ageMs: number } | null {
  const scoped = scopedKey(key)
  let entry = memory.get(scoped) as CacheEntry<T> | undefined
  if (!entry) {
    const stored = readStorage<T>(scoped)
    if (stored) {
      entry = stored
      memory.set(scoped, entry)
    }
  }
  if (!entry) return null
  const ageMs = Date.now() - entry.savedAt
  return { data: entry.data, stale: ageMs > entry.ttlMs, ageMs }
}

export function writeApiCache<T>(key: string, data: T, ttlMs: number): void {
  const scoped = scopedKey(key)
  const entry: CacheEntry<T> = { data, savedAt: Date.now(), ttlMs }
  memory.set(scoped, entry)
  writeStorage(scoped, entry)
}

export function invalidateApiCache(key: string): void {
  const scoped = scopedKey(key)
  memory.delete(scoped)
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(STORAGE_PREFIX + scoped)
    } catch {
      /* ignore */
    }
  }
}

export function invalidateApiCachePrefix(keyPrefix: string): void {
  const needle = `|${keyPrefix}`
  for (const key of [...memory.keys()]) {
    if (key.includes(needle)) memory.delete(key)
  }
  if (typeof window === 'undefined') return
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i)
      if (k?.startsWith(STORAGE_PREFIX) && k.includes(needle)) {
        keysToRemove.push(k)
      }
    }
    for (const k of keysToRemove) window.sessionStorage.removeItem(k)
  } catch {
    /* ignore */
  }
}

export function clearApiCache(): void {
  memory.clear()
  if (typeof window === 'undefined') return
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i)
      if (k?.startsWith(STORAGE_PREFIX)) keysToRemove.push(k)
    }
    for (const k of keysToRemove) window.sessionStorage.removeItem(k)
  } catch {
    /* ignore */
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('auth:logout', () => clearApiCache())
}
