/** Contacto público del sitio (footer / redes). El asesor comercial sigue siendo vía bot en el chat. */
export const SITE_WHATSAPP_E164 = '573207909835'
export const SITE_WHATSAPP_DISPLAY = '3207909835'
export const SITE_EMAIL = 'arteagaestacio@gmail.com'
export const SITE_LINKEDIN = 'https://www.linkedin.com/in/gustavo-arteaga/'

export function getWhatsAppUrl(prefill?: string): string {
  const env = (import.meta.env.VITE_LANDING_WHATSAPP_URL as string | undefined)?.trim()
  const base = env || `https://wa.me/${SITE_WHATSAPP_E164}`
  if (!prefill?.trim()) return base
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}text=${encodeURIComponent(prefill)}`
}
