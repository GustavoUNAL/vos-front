/** Marca VOS AI — fuente única para UI y meta. */
export const BRAND_NAME =
  (import.meta.env.VITE_BRAND_NAME as string | undefined)?.trim() || 'VOS AI'

export const BRAND_TAGLINE =
  (import.meta.env.VITE_BRAND_TAGLINE as string | undefined)?.trim() ||
  'Sistema operativo inteligente para tu negocio.'

export const BRAND_LOGIN_TITLE = `Iniciar sesión · ${BRAND_NAME}`
