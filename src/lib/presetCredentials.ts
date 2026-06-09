/** Credenciales predefinidas (mismo valor en .env.local y .env.dev al desplegar). */
export const PRESET_LOGIN_EMAIL =
  (import.meta.env.VITE_PRESET_LOGIN_EMAIL as string | undefined)?.trim() ||
  'admin@vos.ai'

export const PRESET_LOGIN_PASSWORD =
  (import.meta.env.VITE_PRESET_LOGIN_PASSWORD as string | undefined)?.trim() ||
  'VosAi2026!'
