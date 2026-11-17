import { PLATFORM_MODE, SALES_FLOOR_ONLY } from '../appScope'
import type { AuthUser } from '../api'
import type { LauncherIconView } from '../components/AppLauncherIcon'
import type { NavGroupId } from '../navTypes'
import { canAccessView, canViewFinance, canViewProjects, canViewTasks, hasBookingModule, isBookingLedCompany } from './permissions'

export type LauncherApp = {
  view: LauncherIconView
  label: string
  group: NavGroupId
}

export function buildLauncherApps(options?: {
  user?: AuthUser | null
  canViewTasks?: boolean
  canViewFinance?: boolean
}): LauncherApp[] {
  if (SALES_FLOOR_ONLY) {
    return [
      { view: 'products', label: 'Productos', group: 'catalog' },
      { view: 'sales', label: 'Ventas', group: 'sales' },
    ]
  }

  if (PLATFORM_MODE) {
    const user = options?.user ?? null
    if (isBookingLedCompany(user)) {
      const apps: LauncherApp[] = [
        { view: 'booking', label: 'Agenda', group: 'booking' },
        { view: 'settings', label: 'Enlace público', group: 'booking' },
        { view: 'customers', label: 'Clientes', group: 'booking' },
        { view: 'services', label: 'Servicios', group: 'booking' },
        { view: 'cash-close', label: 'Cierre del día', group: 'sales' },
      ]
      if (options?.canViewFinance ?? canViewFinance(user)) {
        apps.push({ view: 'analytics', label: 'Finanzas', group: 'finance' })
      }
      return apps.filter((app) => canAccessView(user, app.view))
    }
    const apps: LauncherApp[] = [
      { view: 'products', label: 'Catálogo', group: 'catalog' },
      { view: 'recipes', label: 'Recetas', group: 'stock' },
      { view: 'inventory', label: 'Stock', group: 'stock' },
      { view: 'sales', label: 'Ventas', group: 'sales' },
      { view: 'pos', label: 'Punto de venta', group: 'sales' },
      { view: 'shop', label: 'Tienda', group: 'sales' },
      { view: 'cash-close', label: 'Cierre del día', group: 'sales' },
      { view: 'purchases', label: 'Compras', group: 'purchases' },
      { view: 'staff', label: 'Personal', group: 'staff' },
    ]
    if (options?.canViewTasks ?? canViewTasks(user)) {
      apps.push({ view: 'tasks', label: 'Tareas', group: 'tasks' })
    }
    if (canViewProjects(user)) {
      apps.push({ view: 'projects', label: 'Proyectos', group: 'projects' })
    }
    if (hasBookingModule(user)) {
      apps.push({ view: 'booking', label: 'Agenda de citas', group: 'booking' })
    }
    if (options?.canViewFinance ?? canViewFinance(user)) {
      apps.push({ view: 'analytics', label: 'Finanzas', group: 'finance' })
    }
    if (user) {
      return apps.filter((app) => canAccessView(user, app.view))
    }
    return apps
  }

  return [
    { view: 'products', label: 'Productos', group: 'catalog' },
    { view: 'recipes', label: 'Recetas', group: 'stock' },
    { view: 'inventory', label: 'Inventario', group: 'stock' },
    { view: 'purchases', label: 'Compras', group: 'stock' },
    { view: 'sales', label: 'Ventas', group: 'sales' },
    { view: 'pos', label: 'Punto de venta', group: 'sales' },
    { view: 'costs', label: 'Costos', group: 'finance' },
    { view: 'gastos', label: 'Gastos', group: 'finance' },
    { view: 'explorer', label: 'Base de datos', group: 'data' },
  ]
}
