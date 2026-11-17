/** Sin valores de respaldo. En producción quedan vacíos aunque exista la variable. */
const emailFromEnv = (import.meta.env.VITE_PRESET_LOGIN_EMAIL as string | undefined)?.trim() || ''
const passwordFromEnv =
  (import.meta.env.VITE_PRESET_LOGIN_PASSWORD as string | undefined)?.trim() || ''

export const PRESET_LOGIN_EMAIL = import.meta.env.PROD ? '' : emailFromEnv
export const PRESET_LOGIN_PASSWORD = import.meta.env.PROD ? '' : passwordFromEnv
