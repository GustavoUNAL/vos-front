import type { AuthUser } from '../api'

export type AppView =
  | 'home'
  | 'menu'
  | 'products'
  | 'recipes'
  | 'inventory'
  | 'sales'
  | 'pos'
  | 'shop'
  | 'purchases'
  | 'staff'
  | 'analytics'
  | 'costs'
  | 'gastos'
  | 'explorer'

const VIEW_KEYS = new Set<string>([
  'home',
  'menu',
  'products',
  'recipes',
  'inventory',
  'sales',
  'pos',
  'shop',
  'purchases',
  'staff',
  'analytics',
  'costs',
  'gastos',
  'explorer',
])

export function slugifyLabel(raw: string): string {
  return (raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'empresa'
}

export function getCompanySlugFromUser(user: AuthUser): string {
  if (user.companySlug?.trim()) return user.companySlug.trim()
  const current = user.companies.find((c) => c.id === user.companyId)
  if (current?.slug) return current.slug
  return slugifyLabel(user.companyName)
}

export function hashParts(): string[] {
  const raw = (window.location.hash ?? '').replace(/^#/, '')
  const pathOnly = raw.split('?')[0] ?? ''
  return pathOnly.split('/').filter(Boolean)
}

export function parseCompanyAppHash(): {
  companySlug: string | null
  view: AppView | null
} {
  const parts = hashParts()
  if (parts[0] === 'e' && parts[1]) {
    const viewKey = parts[2] ?? 'home'
    return {
      companySlug: parts[1],
      view: VIEW_KEYS.has(viewKey) ? (viewKey as AppView) : 'home',
    }
  }
  const first = parts[0] ?? ''
  if (VIEW_KEYS.has(first)) {
    return { companySlug: null, view: first as AppView }
  }
  return { companySlug: null, view: null }
}

export function buildCompanyViewHash(
  companySlug: string,
  view: AppView,
  query?: string,
): string {
  const base = `#/e/${encodeURIComponent(companySlug)}/${view}`
  return query ? `${base}?${query}` : base
}

export function shopUrlForCompany(slug: string): string {
  const base =
    (import.meta.env.VITE_APP_URL as string | undefined)?.trim() ||
    `${window.location.origin}${window.location.pathname}`
  return `${base.replace(/\/$/, '')}#/tienda/${encodeURIComponent(slug)}`
}
