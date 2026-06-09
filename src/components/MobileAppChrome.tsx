import { Home, Menu, Moon, Sun, User, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AuthUser } from '../api'
import { PLATFORM_MODE, SALES_FLOOR_ONLY } from '../appScope'
import { BRAND_NAME } from '../lib/brand'
import { displayCompanyName } from '../lib/displayLabels'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { UserProfileCard } from './UserProfileCard'

export type MobileChromeView =
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

const SCREEN_TITLE: Record<MobileChromeView, string> = {
  home: 'Inicio',
  menu: 'Inicio',
  products: 'Productos a la venta',
  recipes: 'Recetas',
  inventory: 'Inventario',
  sales: 'Ventas',
  pos: 'POS',
  shop: 'Tienda',
  purchases: 'Compras',
  staff: 'Personal',
  analytics: 'Finanzas',
  costs: 'Costos',
  gastos: 'Gastos',
  explorer: 'Datos',
}

type SheetLink = {
  view: MobileChromeView
  label: string
}

const PLATFORM_SHEET_LINKS: SheetLink[] = [
  { view: 'home', label: 'Inicio' },
  { view: 'products', label: 'Productos a la venta' },
  { view: 'pos', label: 'POS · Mesas' },
  { view: 'sales', label: 'Ventas' },
  { view: 'purchases', label: 'Compras' },
  { view: 'inventory', label: 'Inventario' },
  { view: 'shop', label: 'Tienda en línea' },
  { view: 'staff', label: 'Personal' },
  { view: 'analytics', label: 'Análisis financiero' },
]

const FULL_SHEET_LINKS: SheetLink[] = [
  { view: 'menu', label: 'Inicio' },
  { view: 'products', label: 'Productos a la venta' },
  { view: 'pos', label: 'POS · Mesas' },
  { view: 'sales', label: 'Ventas' },
  { view: 'purchases', label: 'Compras' },
  { view: 'recipes', label: 'Recetas' },
  { view: 'inventory', label: 'Inventario' },
  { view: 'staff', label: 'Personal' },
  { view: 'analytics', label: 'Análisis financiero' },
  { view: 'costs', label: 'Costos' },
  { view: 'gastos', label: 'Gastos' },
  { view: 'explorer', label: 'Explorador de datos' },
]

type DockTabId = MobileChromeView

type DockTab = {
  id: DockTabId
  label: string
  view: MobileChromeView
}

const DOCK_TABS_PLATFORM: DockTab[] = [
  { id: 'home', label: 'Inicio', view: 'home' },
  { id: 'products', label: 'Productos', view: 'products' },
  { id: 'pos', label: 'POS', view: 'pos' },
  { id: 'sales', label: 'Ventas', view: 'sales' },
  { id: 'purchases', label: 'Compras', view: 'purchases' },
]

const DOCK_TABS_SALES: DockTab[] = [
  { id: 'products', label: 'Productos', view: 'products' },
  { id: 'sales', label: 'Ventas', view: 'sales' },
]

const DOCK_TABS_FULL: DockTab[] = [
  { id: 'products', label: 'Productos', view: 'products' },
  { id: 'sales', label: 'Ventas', view: 'sales' },
  { id: 'inventory', label: 'Stock', view: 'inventory' },
]

function MobileDockIcon({ id }: { id: DockTabId }) {
  const c = 'h-[1.15rem] w-[1.15rem]'
  switch (id) {
    case 'home':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'products':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Zm9 0a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V5ZM4 14a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5Zm9 0a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'sales':
    case 'shop':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M6 9h15l-1.5 9h-12L6 9Zm0 0L5 3H2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="20" r="1.5" fill="currentColor" />
          <circle cx="18" cy="20" r="1.5" fill="currentColor" />
        </svg>
      )
    case 'pos':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect
            x="3"
            y="4"
            width="18"
            height="14"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M7 9h4M7 12h10M7 15h6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'inventory':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M21 16.5V8.2a1.9 1.9 0 0 0-.9-1.6l-7-4.1a1.9 1.9 0 0 0-2 0l-7 4.1A1.9 1.9 0 0 0 3 8.2v8.3a1.9 1.9 0 0 0 1 1.6l7 4.1a1.9 1.9 0 0 0 2 0l7-4.1a1.9 1.9 0 0 0 1-1.6Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="m3.3 7.7 8.7 5 8.7-5M12 22V12.7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'purchases':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 7h16M4 7l1.5 12h13L20 7M9 11v5M15 11v5M10 7V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    default:
      return null
  }
}

export function MobileAppChrome({
  view,
  onNavigate,
  onHome,
  theme,
  onToggleTheme,
  user,
  onLogout,
  sheetOpen,
  onSheetOpenChange,
}: {
  view: MobileChromeView
  onNavigate: (v: MobileChromeView) => void
  onHome?: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  user: AuthUser | null
  onLogout: () => void
  sheetOpen: boolean
  onSheetOpenChange: (open: boolean) => void
}) {
  const [profileOpen, setProfileOpen] = useState(false)
  const compactChrome = PLATFORM_MODE || SALES_FLOOR_ONLY
  const dockTabs = PLATFORM_MODE
    ? DOCK_TABS_PLATFORM
    : SALES_FLOOR_ONLY
      ? DOCK_TABS_SALES
      : DOCK_TABS_FULL
  const showDock = dockTabs.length > 0

  const sheetLinks: SheetLink[] = PLATFORM_MODE
    ? PLATFORM_SHEET_LINKS
    : SALES_FLOOR_ONLY
      ? [
          { view: 'products', label: 'Productos a la venta' },
          { view: 'sales', label: 'Ventas' },
        ]
      : FULL_SHEET_LINKS

  const companyLabel = displayCompanyName(user?.companyName)
  const showMenuButton = sheetLinks.length > 0 || Boolean(user)
  const homeView: MobileChromeView = PLATFORM_MODE ? 'home' : 'menu'
  const isHomeScreen = view === homeView
  const brandLine = companyLabel
    ? `${BRAND_NAME} · ${companyLabel}`
    : BRAND_NAME
  const headerTitle = isHomeScreen ? brandLine : SCREEN_TITLE[view]

  useEffect(() => {
    if (!sheetOpen) setProfileOpen(false)
  }, [sheetOpen])

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

  const pickView = (v: MobileChromeView) => {
    onSheetOpenChange(false)
    onNavigate(v)
  }

  const themeLabel = theme === 'light' ? 'Oscuro' : 'Claro'
  const ThemeIcon = theme === 'light' ? Moon : Sun

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
            {showDock ? (
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
                <Home className="h-[1.1rem] w-[1.1rem]" strokeWidth={2} aria-hidden />
              </Button>
            )}
          </div>

          <div className="vos-mobile-header__center">
            <h1
              className={cn(
                'vos-mobile-header__title',
                isHomeScreen && 'vos-mobile-header__title--brand',
              )}
            >
              {headerTitle}
            </h1>
          </div>

          <div className="vos-mobile-header__trailing">
            {!showDock ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="vos-mobile-header__theme"
                  aria-label={`Cambiar a tema ${themeLabel.toLowerCase()}`}
                  onClick={onToggleTheme}
                >
                  <ThemeIcon className="h-[1.1rem] w-[1.1rem]" strokeWidth={2} aria-hidden />
                </Button>
                {user ? (
                  <Button
                    type="button"
                    variant={profileOpen ? 'accent' : 'ghost'}
                    size="icon-sm"
                    className="vos-mobile-header__profile"
                    aria-expanded={sheetOpen && profileOpen}
                    aria-label="Mi perfil"
                    onClick={() => {
                      setProfileOpen(true)
                      onSheetOpenChange(true)
                    }}
                  >
                    <User className="h-[1.1rem] w-[1.1rem]" strokeWidth={2} aria-hidden />
                  </Button>
                ) : null}
              </>
            ) : null}
            {showMenuButton ? (
              <Button
                type="button"
                variant={sheetOpen && !profileOpen ? 'accent' : 'ghost'}
                size="icon"
                className="vos-mobile-header__menu"
                aria-expanded={sheetOpen && !profileOpen}
                aria-haspopup="dialog"
                aria-label="Menú de módulos"
                onClick={() => {
                  setProfileOpen(false)
                  onSheetOpenChange(!sheetOpen || profileOpen)
                }}
              >
                <Menu className="h-[1.25rem] w-[1.25rem]" strokeWidth={2.25} aria-hidden />
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
              const active = view === tab.view
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={cn(
                    'app-mobile-dock__tab',
                    active && 'app-mobile-dock__tab--active',
                  )}
                  aria-current={active ? 'page' : undefined}
                  aria-label={tab.label}
                  onClick={() => onNavigate(tab.view)}
                >
                  <span className="app-mobile-dock__icon-wrap">
                    <MobileDockIcon id={tab.id} />
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
                {profileOpen ? 'Mi perfil' : companyLabel || 'Menú'}
              </h2>
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                onClick={() => onSheetOpenChange(false)}
                aria-label="Cerrar"
              >
                <X className="h-[1.1rem] w-[1.1rem]" strokeWidth={2} aria-hidden />
              </Button>
            </header>
            <div className="vos-sheet__body">
              {profileOpen && user ? (
                <div className="flex flex-col gap-3">
                  <UserProfileCard user={user} />
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    block
                    onClick={() => {
                      onSheetOpenChange(false)
                      onLogout()
                    }}
                  >
                    Salir
                  </Button>
                </div>
              ) : null}
              {!profileOpen && sheetLinks.length > 0 ? (
                <ul className="vos-sheet__nav-grid m-0 list-none p-0">
                  {sheetLinks.map((link) => (
                    <li key={link.view}>
                      <button
                        type="button"
                        className={cn(
                          'vos-sheet__nav-tile',
                          view === link.view && 'vos-sheet__nav-tile--active',
                        )}
                        onClick={() => pickView(link.view)}
                      >
                        <span className="vos-sheet__nav-tile-label">{link.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {!profileOpen && user ? (
                <div className="flex flex-col gap-2 border-t border-[color-mix(in_srgb,var(--border)_72%,transparent)] pt-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    block
                    className="justify-start"
                    onClick={() => setProfileOpen(true)}
                  >
                    <User className="h-4 w-4" strokeWidth={2} aria-hidden />
                    Mi perfil · {companyLabel || user.name}
                  </Button>
                  {showDock || !compactChrome ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      block
                      onClick={onToggleTheme}
                    >
                      <ThemeIcon className="h-4 w-4" strokeWidth={2} aria-hidden />
                      Tema {themeLabel.toLowerCase()}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    block
                    onClick={() => {
                      onSheetOpenChange(false)
                      onLogout()
                    }}
                  >
                    Salir
                  </Button>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
