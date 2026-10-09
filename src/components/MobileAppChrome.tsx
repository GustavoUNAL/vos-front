import { Home, Menu, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import type { AuthUser } from '../api'
import { PLATFORM_MODE, SALES_FLOOR_ONLY } from '../appScope'
import { canAccessView, isBookingLedCompany } from '../lib/permissions'
import { BRAND_NAME } from '../lib/brand'
import { displayCompanyName } from '../lib/displayLabels'
import { greetUser, namedCopy } from '../lib/userIdentity'
import { navigateToSelectCompany } from '../lib/authRoutes'
import { userNeedsCompanyPicker } from '../lib/companySelect'
import { cn } from '../lib/utils'
import {
  MobileModuleIcon,
  type MobileModuleIconId,
} from './mobile/mobileModuleIcons'
import { HeaderSystray } from './HeaderSystray'
import { Button } from './ui/button'
import { PlatformAdminBar } from './PlatformAdminBar'

export type MobileChromeView =
  | 'home'
  | 'menu'
  | 'products'
  | 'recipes'
  | 'inventory'
  | 'sales'
  | 'cash-close'
  | 'pos'
  | 'shop'
  | 'purchases'
  | 'staff'
  | 'analytics'
  | 'tasks'
  | 'projects'
  | 'costs'
  | 'gastos'
  | 'explorer'
  | 'booking'
  | 'appointments'
  | 'customers'
  | 'services'
  | 'professionals'
  | 'hours'
  | 'settings'

const SCREEN_TITLE: Record<MobileChromeView, string> = {
  home: 'Inicio',
  menu: 'Inicio',
  products: 'Productos a la venta',
  recipes: 'Recetas',
  inventory: 'Inventario',
  sales: 'Ventas',
  'cash-close': 'Cierre del día',
  pos: 'Punto de venta',
  shop: 'Tienda',
  purchases: 'Compras',
  staff: 'Personal',
  analytics: 'Finanzas',
  tasks: 'Tareas',
  projects: 'Proyectos',
  costs: 'Costos',
  gastos: 'Gastos',
  explorer: 'Datos',
  booking: 'Agenda de citas',
  appointments: 'Citas',
  customers: 'Clientes',
  services: 'Servicios',
  professionals: 'Profesionales',
  hours: 'Disponibilidad',
  settings: 'Enlace público',
}

export function isMobileChromeView(view: string): view is MobileChromeView {
  return Object.prototype.hasOwnProperty.call(SCREEN_TITLE, view)
}

type SheetLink = {
  view: MobileChromeView | 'assistant'
  label: string
  icon: MobileModuleIconId
}

const PLATFORM_SHEET_LINKS: SheetLink[] = [
  { view: 'home', label: 'Inicio', icon: 'home' },
  { view: 'products', label: 'Productos a la venta', icon: 'products' },
  { view: 'recipes', label: 'Recetas', icon: 'recipes' },
  { view: 'pos', label: 'Punto de venta · Mesas', icon: 'pos' },
  { view: 'sales', label: 'Ventas', icon: 'sales' },
  { view: 'cash-close', label: 'Cierre del día', icon: 'cash-close' },
  { view: 'purchases', label: 'Compras', icon: 'purchases' },
  { view: 'tasks', label: 'Tareas', icon: 'tasks' },
  { view: 'projects', label: 'Proyectos', icon: 'projects' },
  { view: 'inventory', label: 'Inventario', icon: 'inventory' },
  { view: 'shop', label: 'Tienda en línea', icon: 'shop' },
  { view: 'staff', label: 'Personal', icon: 'staff' },
  { view: 'booking', label: 'Agenda de citas', icon: 'booking' },
  { view: 'customers', label: 'Clientes', icon: 'booking' },
  { view: 'services', label: 'Servicios', icon: 'booking' },
  { view: 'settings', label: 'Enlace público', icon: 'booking' },
  { view: 'analytics', label: 'Análisis financiero', icon: 'analytics' },
  { view: 'assistant', label: 'VOS IA', icon: 'assistant' },
]

const FULL_SHEET_LINKS: SheetLink[] = [
  { view: 'menu', label: 'Inicio', icon: 'menu' },
  { view: 'products', label: 'Productos a la venta', icon: 'products' },
  { view: 'pos', label: 'Punto de venta · Mesas', icon: 'pos' },
  { view: 'sales', label: 'Ventas', icon: 'sales' },
  { view: 'cash-close', label: 'Cierre del día', icon: 'cash-close' },
  { view: 'purchases', label: 'Compras', icon: 'purchases' },
  { view: 'recipes', label: 'Recetas', icon: 'recipes' },
  { view: 'inventory', label: 'Inventario', icon: 'inventory' },
  { view: 'staff', label: 'Personal', icon: 'staff' },
  { view: 'analytics', label: 'Análisis financiero', icon: 'analytics' },
  { view: 'costs', label: 'Costos', icon: 'costs' },
  { view: 'gastos', label: 'Gastos', icon: 'gastos' },
  { view: 'explorer', label: 'Explorador de datos', icon: 'explorer' },
]

type DockTabId = MobileChromeView | 'assistant'

type DockTab = {
  id: DockTabId
  label: string
  view?: MobileChromeView
  action?: 'assistant'
  icon: MobileModuleIconId
}

const DOCK_TABS_PLATFORM: DockTab[] = [
  { id: 'home', label: 'Inicio', view: 'home', icon: 'home' },
  { id: 'tasks', label: 'Tareas', view: 'tasks', icon: 'tasks' },
  { id: 'pos', label: 'Punto de venta', view: 'pos', icon: 'pos' },
  { id: 'sales', label: 'Ventas', view: 'sales', icon: 'sales' },
  { id: 'purchases', label: 'Compras', view: 'purchases', icon: 'purchases' },
]

const DOCK_TABS_SALES: DockTab[] = [
  { id: 'products', label: 'Productos', view: 'products', icon: 'products' },
  { id: 'sales', label: 'Ventas', view: 'sales', icon: 'sales' },
]

const DOCK_TABS_FULL: DockTab[] = [
  { id: 'products', label: 'Productos', view: 'products', icon: 'products' },
  { id: 'sales', label: 'Ventas', view: 'sales', icon: 'sales' },
  { id: 'inventory', label: 'Stock', view: 'inventory', icon: 'inventory' },
]

export function MobileAppChrome({
  view,
  onNavigate,
  onHome,
  theme,
  onToggleTheme,
  user,
  onLogout,
  onSwitchCompany,
  sheetOpen,
  onSheetOpenChange,
  assistantOpen = false,
  onAssistantOpenChange,
  backendDown = false,
  onRetryApi,
  baseUrl,
  onReturnToPlatform,
}: {
  view: MobileChromeView
  onNavigate: (v: MobileChromeView) => void
  onHome?: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  user: AuthUser | null
  onLogout: () => void
  onSwitchCompany?: (user: AuthUser) => void
  sheetOpen: boolean
  onSheetOpenChange: (open: boolean) => void
  assistantOpen?: boolean
  onAssistantOpenChange?: (open: boolean) => void
  backendDown?: boolean
  onRetryApi?: () => void
  baseUrl?: string
  onReturnToPlatform?: () => void
}) {
  const dockTabs = useMemo(() => {
    const bookingDock: DockTab[] = [
      { id: 'home', label: 'Inicio', view: 'home', icon: 'home' },
      { id: 'booking', label: 'Agenda', view: 'booking', icon: 'booking' },
      { id: 'cash-close', label: 'Cierre', view: 'cash-close', icon: 'cash-close' },
      { id: 'analytics', label: 'Finanzas', view: 'analytics', icon: 'analytics' },
    ]
    const base = PLATFORM_MODE
      ? isBookingLedCompany(user)
        ? bookingDock
        : DOCK_TABS_PLATFORM
      : SALES_FLOOR_ONLY
        ? DOCK_TABS_SALES
        : DOCK_TABS_FULL
    let tabs = base.filter((tab) => {
      if (!tab.view) return false
      if (tab.view === 'home' || tab.view === 'menu') return true
      if (!user) return false
      return canAccessView(user, tab.view)
    })
    // Clientes con pocos módulos: dock con Inventario + Finanzas.
    if (PLATFORM_MODE && user && tabs.length <= 1 && !isBookingLedCompany(user)) {
      const extras: DockTab[] = []
      if (canAccessView(user, 'inventory')) {
        extras.push({
          id: 'inventory',
          label: 'Inventario',
          view: 'inventory',
          icon: 'inventory',
        })
      }
      if (canAccessView(user, 'analytics')) {
        extras.push({
          id: 'analytics',
          label: 'Finanzas',
          view: 'analytics',
          icon: 'analytics',
        })
      }
      tabs = [...tabs, ...extras]
    }
    return tabs
  }, [user])
  const showDock = dockTabs.length > 0

  const sheetLinks: SheetLink[] = useMemo(() => {
    const base = PLATFORM_MODE
      ? PLATFORM_SHEET_LINKS
      : SALES_FLOOR_ONLY
        ? [
            { view: 'products' as const, label: 'Productos a la venta', icon: 'products' as const },
            { view: 'sales' as const, label: 'Ventas', icon: 'sales' as const },
          ]
        : FULL_SHEET_LINKS
    return base.filter((link) => {
      if (link.view === 'assistant' || link.view === 'home' || link.view === 'menu') {
        return true
      }
      if (!user) return false
      return canAccessView(user, link.view)
    })
  }, [user])

  const companyLabel = displayCompanyName(user?.companyName)
  const showMenuButton = sheetLinks.length > 0
  const homeView: MobileChromeView = PLATFORM_MODE ? 'home' : 'menu'
  const isHomeScreen = view === homeView
  const brandLine = companyLabel
    ? `${BRAND_NAME} · ${companyLabel}`
    : BRAND_NAME
  const homeTitle = user?.name ? greetUser(user.name) : brandLine
  const headerTitle = isHomeScreen ? homeTitle : SCREEN_TITLE[view]

  useEffect(() => {
    if (!sheetOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSheetOpenChange(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen, onSheetOpenChange])

  useEffect(() => {
    const root = document.documentElement
    if (!sheetOpen) {
      root.classList.remove('app--mobile-sheet-open')
      return
    }
    root.classList.add('app--mobile-sheet-open')
    return () => root.classList.remove('app--mobile-sheet-open')
  }, [sheetOpen])

  const pickSheetLink = (link: SheetLink) => {
    onSheetOpenChange(false)
    if (link.view === 'assistant') {
      onAssistantOpenChange?.(true)
      return
    }
    onNavigate(link.view)
  }

  return (
    <>
      <header
        className={cn(
          'vos-mobile-header',
          showDock && 'vos-mobile-header--dock',
          isHomeScreen && 'vos-mobile-header--home-brand',
        )}
      >
        <div className="vos-mobile-header__bar vos-mobile-header__bar--actions">
          <div className="vos-mobile-header__leading">
            {onReturnToPlatform ? (
              <PlatformAdminBar compact onReturn={onReturnToPlatform} />
            ) : showDock ? (
              <span className="vos-mobile-header__spacer" aria-hidden />
            ) : (
              <Button
                type="button"
                variant={view === homeView ? 'accent' : 'ghost'}
                size="icon-sm"
                className="vos-mobile-header__home"
                aria-label="Inicio"
                aria-current={view === homeView ? 'page' : undefined}
                onClick={() => {
                  if (onHome) onHome()
                  else onNavigate(homeView)
                }}
              >
                <Home className="h-[1.35rem] w-[1.35rem]" strokeWidth={2} aria-hidden />
              </Button>
            )}
          </div>

          <div className="vos-mobile-header__center">
            {user && userNeedsCompanyPicker(user) && isHomeScreen ? (
              <button
                type="button"
                className="vos-mobile-header__company-switch"
                onClick={() => navigateToSelectCompany(false)}
              >
                <h1 className="vos-mobile-header__title vos-mobile-header__title--brand">
                  {brandLine}
                </h1>
                <span className="vos-mobile-header__company-switch-hint">Cambiar empresa</span>
              </button>
            ) : (
              <h1
                className={cn(
                  'vos-mobile-header__title',
                  isHomeScreen && 'vos-mobile-header__title--brand',
                )}
              >
                {headerTitle}
              </h1>
            )}
          </div>

          <div className="vos-mobile-header__trailing">
            {user ? (
              <HeaderSystray
                user={user}
                theme={theme}
                onToggleTheme={onToggleTheme}
                onLogout={onLogout}
                onSwitchCompany={onSwitchCompany}
                baseUrl={baseUrl}
                onOpenAssistant={
                  PLATFORM_MODE && !showDock
                    ? () => onAssistantOpenChange?.(!assistantOpen)
                    : undefined
                }
                assistantOpen={assistantOpen}
                backendDown={backendDown}
                onRetryApi={onRetryApi}
                variant="mobile"
              />
            ) : null}
            {showMenuButton ? (
              <Button
                type="button"
                variant={sheetOpen ? 'accent' : 'ghost'}
                size="icon"
                className="vos-mobile-header__menu"
                aria-expanded={sheetOpen}
                aria-haspopup="dialog"
                aria-label="Menú de módulos"
                onClick={() => onSheetOpenChange(!sheetOpen)}
              >
                <Menu className="h-[1.35rem] w-[1.35rem]" strokeWidth={2.25} aria-hidden />
              </Button>
            ) : (
              <span className="vos-mobile-header__spacer" aria-hidden />
            )}
          </div>
        </div>
      </header>

      {showDock ? (
        <nav className="app-mobile-dock" aria-label="Módulos principales">
          <div className="app-mobile-dock__fade" aria-hidden />
          <div className="app-mobile-dock__inner">
            {dockTabs.map((tab) => {
              const active =
                tab.action === 'assistant'
                  ? assistantOpen
                  : tab.view != null && view === tab.view
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={cn(
                    'app-mobile-dock__tab',
                    active && 'app-mobile-dock__tab--active',
                    tab.action === 'assistant' && 'app-mobile-dock__tab--assistant',
                  )}
                  aria-current={active ? 'page' : undefined}
                  aria-expanded={tab.action === 'assistant' ? assistantOpen : undefined}
                  aria-label={tab.label}
                  onClick={() => {
                    if (tab.action === 'assistant') {
                      onAssistantOpenChange?.(!assistantOpen)
                      return
                    }
                    if (tab.view) {
                      onAssistantOpenChange?.(false)
                      onNavigate(tab.view)
                    }
                  }}
                >
                  <span
                    className={cn(
                      'app-mobile-dock__icon-wrap',
                      tab.action === 'assistant' && 'app-mobile-dock__icon-wrap--assistant',
                    )}
                  >
                    <MobileModuleIcon
                      id={tab.icon}
                      className={
                        tab.action === 'assistant'
                          ? 'app-mobile-dock__assistant-icon'
                          : undefined
                      }
                    />
                  </span>
                  <span className="app-mobile-dock__label">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      ) : null}

      {sheetOpen ? (
        <div
          className="app-mobile-sheet-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onSheetOpenChange(false)
          }}
        >
          <section
            className="vos-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-sheet-title"
          >
            <header className="vos-sheet__head">
              <h2 id="mobile-sheet-title" className="vos-sheet__title">
            {namedCopy(user?.name, 'Hola, {name}', companyLabel || 'Menú')}
              </h2>
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                onClick={() => onSheetOpenChange(false)}
                aria-label="Cerrar"
              >
                <X className="h-[1.35rem] w-[1.35rem]" strokeWidth={2} aria-hidden />
              </Button>
            </header>
            <div className="vos-sheet__body">
              {onReturnToPlatform ? (
                <button
                  type="button"
                  className="vos-sheet__company-switch"
                  onClick={() => {
                    onSheetOpenChange(false)
                    onReturnToPlatform()
                  }}
                >
                  Volver al menú plataforma
                  <span className="muted small">Salir de {companyLabel || 'esta empresa'}</span>
                </button>
              ) : null}
              {user && userNeedsCompanyPicker(user) ? (
                <button
                  type="button"
                  className="vos-sheet__company-switch"
                  onClick={() => {
                    onSheetOpenChange(false)
                    navigateToSelectCompany(false)
                  }}
                >
                  Cambiar de empresa
                  <span className="muted small">{companyLabel}</span>
                </button>
              ) : null}
              {sheetLinks.length > 0 ? (
                <ul className="vos-sheet__nav-grid m-0 list-none p-0">
                  {sheetLinks.map((link) => (
                    <li key={link.view}>
                      <button
                        type="button"
                        className={cn(
                          'vos-sheet__nav-tile',
                          link.view === 'assistant'
                            ? assistantOpen && 'vos-sheet__nav-tile--active'
                            : view === link.view && 'vos-sheet__nav-tile--active',
                        )}
                        onClick={() => pickSheetLink(link)}
                      >
                        <span className="vos-sheet__nav-tile-icon" aria-hidden>
                          <MobileModuleIcon id={link.icon} className="h-[1.35rem] w-[1.35rem]" />
                        </span>
                        <span className="vos-sheet__nav-tile-label">{link.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
