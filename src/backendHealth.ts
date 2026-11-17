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

/** Fuerza un nuevo probe (p. ej. tras levantar vos-api). */
export function resetBackendProbe(): void {
  status = 'unknown'
  probePromise = null
}

/**
 * Comprobación GET /navigation con timeout corto.
 * Si el primer intento falló (p. ej. API aún arrancando), permite re-probar.
 */
export async function ensureBackendProbe(base: string): Promise<boolean> {
  if (status === 'up') return true
  if (!probePromise) {
    probePromise = runProbe(base).then((ok) => {
      status = ok ? 'up' : 'down'
      if (!ok) enablePosLocalFallback()
      // Liberar el promise para que un retry posterior pueda volver a probar.
      if (!ok) probePromise = null
      return ok
    })
  }
  return probePromise
}

async function runProbe(base: string): Promise<boolean> {
  const url = `${base.replace(/\/$/, '')}/health`
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
