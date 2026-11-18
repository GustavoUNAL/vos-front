import type { AuthUser } from '../api'

export function hasPermission(
  user: AuthUser | null | undefined,
  slug: string,
): boolean {
  if (!user) return false
  if (user.isPlatformAdmin && user.platformView) return true
  return user.permissions?.includes(slug) ?? false
}

/** Módulos habilitados de la empresa activa. */
export function getCompanyModules(user: AuthUser | null | undefined): string[] {
  if (!user?.companyId) return []
  const company = user.companies?.find((c) => c.id === user.companyId)
  return company?.modules ?? []
}

export function hasCompanyModule(
  user: AuthUser | null | undefined,
  moduleSlug: string,
): boolean {
  if (!user) return false
  if (user.isPlatformAdmin && !user.platformView) {
    // Platform admin dentro de una empresa: respeta módulos de esa empresa.
    return getCompanyModules(user).includes(moduleSlug)
  }
  if (user.isPlatformAdmin && user.platformView) return true
  return getCompanyModules(user).includes(moduleSlug)
}

/** Vista de app → módulo de plataforma requerido (si aplica). */
export const VIEW_MODULE: Record<string, string | null> = {
  home: null,
  menu: null,
  products: 'products',
  recipes: 'products',
  inventory: 'inventory',
  sales: 'sales',
  pos: 'sales',
  shop: 'sales',
  'cash-close': 'sales',
  purchases: 'purchases',
  staff: 'staff',
  analytics: 'finance',
  tasks: 'tasks',
  projects: 'projects',
  costs: null,
  gastos: null,
  explorer: null,
  patients: 'dental',
  agenda: 'dental',
  ingresos: 'dental',
  financiamiento: 'dental',
  reportes: 'dental',
  'bio-temp': 'dental',
  'bio-sterilization': 'dental',
  'bio-waste': 'dental',
  'dental-config': 'dental',
  appointments: 'booking',
  customers: 'booking',
  services: 'booking',
  professionals: 'booking',
  hours: 'booking',
  settings: 'booking',
  booking: 'booking',
}

export function canAccessView(
  user: AuthUser | null | undefined,
  view: string,
): boolean {
  if (!user) return false
  if (isBookingLedCompany(user) && BOOKING_LED_HIDDEN_VIEWS.has(view)) {
    return false
  }
  if (
    (view === 'recipes' || view === 'pos' || view === 'shop') &&
    !showsHospitalityTools(user)
  ) {
    return false
  }
  if (hasCompanyModule(user, 'booking')) {
    if (
      view === 'home' ||
      view === 'booking' ||
      view === 'agenda' ||
      view === 'appointments' ||
      view === 'customers' ||
      view === 'services' ||
      view === 'professionals' ||
      view === 'hours' ||
      view === 'settings'
    ) {
      return hasPermission(user, 'booking.view') || user.role === 'owner' || user.role === 'manager' || user.role === 'admin'
    }
  }
  if (view === 'analytics') {
    return hasCompanyModule(user, 'finance') && hasPermission(user, 'finance.view')
  }
  if (view === 'tasks') {
    return canViewTasks(user)
  }
  if (view === 'projects') {
    return canViewProjects(user)
  }
  if (view === 'gastos' && hasCompanyModule(user, 'dental')) {
    return hasCompanyModule(user, 'dental')
  }
  if (view === 'inventory' && hasCompanyModule(user, 'dental')) {
    return hasCompanyModule(user, 'inventory')
  }
  const mod = VIEW_MODULE[view]
  if (mod == null) return true
  if (!hasCompanyModule(user, mod)) return false
  if (
    user.role === 'owner' ||
    user.role === 'manager' ||
    user.role === 'admin' ||
    user.isPlatformAdmin
  ) {
    return true
  }
  const perm = VIEW_PERMISSION[view]
  if (!perm) return true
  return hasPermission(user, perm)
}

/** Permiso .view exigido a roles que no son owner/manager. */
export const VIEW_PERMISSION: Record<string, string> = {
  products: 'products.view',
  recipes: 'products.view',
  inventory: 'inventory.view',
  sales: 'sales.view',
  pos: 'sales.view',
  shop: 'sales.view',
  'cash-close': 'sales.view',
  purchases: 'purchases.view',
  staff: 'staff.view',
}

export function canManageAllStaff(user: AuthUser | null | undefined): boolean {
  if (!user) return false
  if (hasPermission(user, 'staff.manage')) return true
  return user.role === 'owner' || user.role === 'manager' || user.role === 'admin'
}

export function hasBookingModule(user: AuthUser | null | undefined): boolean {
  return hasCompanyModule(user, 'booking')
}

/**
 * Empresa que opera solo por agenda (barbería): reservas, atención y cierre.
 * Si además tiene obras, materiales, tareas o personal, la agenda convive con esos módulos.
 */
const BOOKING_LED_BLOCKERS = [
  'products',
  'inventory',
  'purchases',
  'tasks',
  'projects',
  'staff',
  'dental',
] as const

export function isBookingLedCompany(user: AuthUser | null | undefined): boolean {
  if (!hasBookingModule(user)) return false
  const mods = getCompanyModules(user)
  return !mods.some((slug) =>
    (BOOKING_LED_BLOCKERS as readonly string[]).includes(slug),
  )
}

/** Recetas, mesas y tienda web son del mostrador. No aplican a vida personal ni a obras. */
export function activeBusinessType(user: AuthUser | null | undefined): string | null {
  if (!user?.companyId) return null
  return user.companies?.find((company) => company.id === user.companyId)?.businessType ?? null
}

export function showsHospitalityTools(user: AuthUser | null | undefined): boolean {
  const type = activeBusinessType(user)
  return type !== 'personal' && type !== 'energy' && type !== 'services'
}

/** Empresa cuyo único módulo habilitado es la agenda (p. ej. Ricky). */
export function isBookingOnlyCompany(user: AuthUser | null | undefined): boolean {
  const mods = getCompanyModules(user)
  return mods.includes('booking') && mods.every((m) => m === 'booking')
}

const BOOKING_LED_HIDDEN_VIEWS = new Set([
  'products',
  'recipes',
  'pos',
  'shop',
  'staff',
  'inventory',
  'purchases',
  'sales',
  'tasks',
  'projects',
])

export function hasDentalModule(user: AuthUser | null | undefined): boolean {
  return hasCompanyModule(user, 'dental')
}

/** Clínica Health: dental sin operación general (ventas). El resto usa VOS IA. */
export function isHealthClinicCompany(user: AuthUser | null | undefined): boolean {
  return hasDentalModule(user) && !hasCompanyModule(user, 'sales')
}

export function canViewFinance(user: AuthUser | null | undefined): boolean {
  return (
    hasCompanyModule(user, 'finance') && hasPermission(user, 'finance.view')
  )
}

export function canViewInventory(user: AuthUser | null | undefined): boolean {
  return (
    hasCompanyModule(user, 'inventory') &&
    (hasPermission(user, 'inventory.view') ||
      user?.role === 'owner' ||
      user?.role === 'manager')
  )
}

export function canDeleteSales(user: AuthUser | null | undefined): boolean {
  return hasPermission(user, 'sales.delete')
}

function companyHasTasksModule(user: AuthUser | null | undefined): boolean {
  return hasCompanyModule(user, 'tasks')
}

export function canViewProjects(user: AuthUser | null | undefined): boolean {
  if (!user) return false
  if (!hasCompanyModule(user, 'projects')) return false
  if (hasPermission(user, 'projects.view')) return true
  if (user.role === 'owner' || user.role === 'manager') return true
  return false
}

const PERSONAL_LABELS: Record<string, string> = {
  tasks: 'Pendientes',
  projects: 'Proyectos',
  booking: 'Agenda',
  customers: 'Personas',
  analytics: 'Dinero',
}

const ENERGY_LABELS: Record<string, string> = {
  products: 'Servicios y materiales',
  inventory: 'Materiales',
  purchases: 'Compras de obra',
  sales: 'Cobros',
  staff: 'Cuadrilla',
  projects: 'Obras y remodelaciones',
  tasks: 'Seguimiento',
  booking: 'Visitas',
  customers: 'Clientes',
  services: 'Servicios',
  analytics: 'Finanzas',
}

export function companyToolLabel(
  user: AuthUser | null | undefined,
  view: string,
  fallback: string,
): string {
  const type = activeBusinessType(user)
  const table =
    type === 'personal' ? PERSONAL_LABELS : type === 'energy' ? ENERGY_LABELS : null
  return table?.[view] ?? fallback
}

export function canViewTasks(user: AuthUser | null | undefined): boolean {
  if (!user) return false
  if (!companyHasTasksModule(user)) return false
  if (hasPermission(user, 'tasks.view')) return true
  if (user.role === 'owner' || user.role === 'manager') return true
  return false
}

export function canManageTasks(
  user: AuthUser | null | undefined,
  action: 'create' | 'update' | 'delete',
): boolean {
  if (!companyHasTasksModule(user)) return false
  if (hasPermission(user, `tasks.${action}`)) return true
  if (user?.role === 'owner' || user?.role === 'manager') return true
  return false
}
