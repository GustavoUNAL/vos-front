import { enablePosLocalFallback } from './pos/services/posApi'

export type BackendStatus = 'unknown' | 'up' | 'down'

let status: BackendStatus = 'unknown'
let probePromise: Promise<boolean> | null = null

export function getBackendStatus(): BackendStatus {
  return status
}

export function isBackendDown(): boolean {
  return status === 'down'
}

export function isBackendUp(): boolean {
  return status === 'up'
}

/** Fuerza un nuevo probe (p. ej. tras levantar arandano-api). */
export function resetBackendProbe(): void {
  status = 'unknown'
  probePromise = null
}

/**
 * Una sola comprobación por sesión: GET /navigation con timeout corto.
 * Si falla, el resto de apiFetch no hace red (evita 502 en consola).
 */
export async function ensureBackendProbe(base: string): Promise<boolean> {
  if (status === 'up') return true
  if (status === 'down') return false
  if (!probePromise) {
    probePromise = runProbe(base).then((ok) => {
      status = ok ? 'up' : 'down'
      if (!ok) enablePosLocalFallback()
      return ok
    })
  }
  return probePromise
}

async function runProbe(base: string): Promise<boolean> {
  const url = `${base.replace(/\/$/, '')}/navigation`
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 4000)
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    })
    return res.ok
  } catch {
    return false
  } finally {
    window.clearTimeout(timer)
  }
}
