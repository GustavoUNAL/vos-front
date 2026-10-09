import { PLATFORM_MODE, SALES_FLOOR_ONLY } from '../appScope'
import type { AuthUser } from '../api'
import type { NavGroupId } from '../navTypes'
import { canAccessView, canViewFinance, canViewProjects, canViewTasks, hasBookingModule, isBookingLedCompany } from './permissions'

export type DesktopNavLink = {
  view: string
  label: string
}

export type DesktopNavGroup = {
  id: NavGroupId
  label: string
  items: DesktopNavLink[]
}

export function buildDesktopNavGroups(options: {
  user?: AuthUser | null
  canViewFinance?: boolean
  canViewTasks?: boolean
}): DesktopNavGroup[] {
  if (SALES_FLOOR_ONLY) {
    return [
      {
        id: 'catalog',
        label: 'Productos',
        items: [{ view: 'products', label: 'Productos a la venta' }],
      },
      {
        id: 'sales',
        label: 'Ventas',
        items: [{ view: 'sales', label: 'Ventas' }],
      },
    ]
  }

  if (PLATFORM_MODE) {
    const user = options.user ?? null
    if (isBookingLedCompany(user)) {
      const groups: DesktopNavGroup[] = [
        {
          id: 'booking',
          label: 'Agenda',
          items: [
            { view: 'booking', label: 'Agenda' },
            { view: 'customers', label: 'Clientes' },
            { view: 'services', label: 'Servicios' },
            { view: 'settings', label: 'Enlace público' },
          ],
        },
        {
          id: 'sales',
          label: 'Cierre',
          items: [{ view: 'cash-close', label: 'Cierre del día' }],
        },
      ]
      if (options.canViewFinance ?? canViewFinance(user)) {
        groups.push({
          id: 'finance',
          label: 'Finanzas',
          items: [{ view: 'analytics', label: 'Análisis financiero' }],
        })
      }
      return groups
        .map((g) => ({
          ...g,
          items: g.items.filter((item) => canAccessView(user, item.view)),
        }))
        .filter((g) => g.items.length > 0)
    }
    const groups: DesktopNavGroup[] = [
      {
        id: 'catalog',
        label: 'Productos',
        items: [{ view: 'products', label: 'Catálogo' }],
      },
      {
        id: 'stock',
        label: 'Inventario',
        items: [
          { view: 'inventory', label: 'Stock' },
          { view: 'recipes', label: 'Recetas' },
        ],
      },
      {
        id: 'sales',
        label: 'Ventas',
        items: [
          { view: 'sales', label: 'Ventas' },
          { view: 'pos', label: 'Punto de venta · Mesas' },
          { view: 'shop', label: 'Tienda en línea' },
          { view: 'cash-close', label: 'Cierre del día' },
        ],
      },
      {
        id: 'purchases',
        label: 'Compras',
        items: [{ view: 'purchases', label: 'Compras' }],
      },
      {
        id: 'staff',
        label: 'Personal',
        items: [{ view: 'staff', label: 'Turnos y nómina' }],
      },
    ]
    if (options.canViewTasks ?? canViewTasks(user)) {
      groups.push({
        id: 'tasks',
        label: 'Tareas',
        items: [{ view: 'tasks', label: 'Calendario' }],
      })
    }
    if (canViewProjects(user)) {
      groups.push({
        id: 'projects',
        label: 'Proyectos',
        items: [{ view: 'projects', label: 'Historial de proyectos' }],
      })
    }
    if (hasBookingModule(user) || canAccessView(user, 'booking')) {
      groups.push({
        id: 'booking',
        label: 'Agenda de citas',
        items: [
          { view: 'booking', label: 'Agenda' },
          { view: 'appointments', label: 'Citas' },
          { view: 'customers', label: 'Clientes' },
          { view: 'services', label: 'Servicios' },
          { view: 'professionals', label: 'Profesionales' },
          { view: 'hours', label: 'Disponibilidad' },
          { view: 'settings', label: 'Enlace público' },
        ],
      })
    }
    if (options.canViewFinance ?? canViewFinance(user)) {
      groups.push({
        id: 'finance',
        label: 'Finanzas',
        items: [{ view: 'analytics', label: 'Análisis financiero' }],
      })
    }
    if (!user) return groups
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((item) => canAccessView(user, item.view)),
      }))
      .filter((g) => g.items.length > 0)
  }

  return [
    {
      id: 'catalog',
      label: 'Productos',
      items: [{ view: 'products', label: 'Productos a la venta' }],
    },
    {
      id: 'stock',
      label: 'Inventario',
      items: [
        { view: 'inventory', label: 'Productos' },
        { view: 'purchases', label: 'Compras' },
      ],
    },
    {
      id: 'sales',
      label: 'Ventas',
      items: [
        { view: 'sales', label: 'Ventas' },
        { view: 'pos', label: 'Punto de venta · Mesas' },
        { view: 'cash-close', label: 'Cierre del día' },
      ],
    },
    {
      id: 'finance',
      label: 'Finanzas',
      items: [
        { view: 'costs', label: 'Costos' },
        { view: 'gastos', label: 'Gastos' },
      ],
    },
    {
      id: 'data',
      label: 'Datos',
      items: [{ view: 'explorer', label: 'Base de datos' }],
    },
  ]
}
