import { Menu, Moon, Sun, X } from 'lucide-react'
import { useEffect } from 'react'
import type { AuthUser } from '../api'
import { PLATFORM_MODE, SALES_FLOOR_ONLY } from '../appScope'
import { cn } from '../lib/utils'
import { Button } from './ui/button'

export type MobileChromeView =
  | 'menu'
  | 'products'
  | 'recipes'
  | 'inventory'
  | 'sales'
  | 'pos'
  | 'purchases'
  | 'costs'
  | 'gastos'
  | 'explorer'

const SCREEN_TITLE: Record<MobileChromeView, string> = {
  menu: 'Inicio',
  products: 'Productos a la venta',
  recipes: 'Recetas',
  inventory: 'Inventario',
  sales: 'Ventas',
  pos: 'POS · Mesas',
  purchases: 'Compras',
  costs: 'Costos',
  gastos: 'Gastos',
  explorer: 'Datos',
}

type DockTabId = MobileChromeView

type DockTab = {
  id: DockTabId
  label: string
  view: MobileChromeView
}

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
    default:
      return null
  }
}

type SheetLink = {
  view: MobileChromeView
  label: string
}

export function MobileAppChrome({
  view,
  onNavigate,
  theme,
  onToggleTheme,
  user,
  onLogout,
  sheetOpen,
  onSheetOpenChange,
}: {
  view: MobileChromeView
  onNavigate: (v: MobileChromeView) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  user: AuthUser | null
  onLogout: () => void
  sheetOpen: boolean
  onSheetOpenChange: (open: boolean) => void
}) {
  const compactChrome = PLATFORM_MODE || SALES_FLOOR_ONLY
  const dockTabs = PLATFORM_MODE
    ? []
    : SALES_FLOOR_ONLY
      ? DOCK_TABS_SALES
      : DOCK_TABS_FULL
  const showDock = dockTabs.length > 0

  const sheetLinks: SheetLink[] = compactChrome
    ? []
    : [
        { view: 'menu', label: 'Inicio' },
        { view: 'recipes', label: 'Recetas' },
        { view: 'purchases', label: 'Compras' },
        { view: 'pos', label: 'POS · Mesas' },
        { view: 'costs', label: 'Costos' },
        { view: 'gastos', label: 'Gastos' },
        { view: 'explorer', label: 'Explorador DB' },
      ]

  const userInitial = user?.name?.trim().charAt(0).toUpperCase() ?? ''
  const showMenuButton = sheetLinks.length > 0 || Boolean(user)
  const showAvatarButton = !compactChrome && showMenuButton && Boolean(userInitial)
  const headerTitle = PLATFORM_MODE
    ? 'Productos a la venta'
    : SCREEN_TITLE[view]

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
      <header className="vos-mobile-header">
        <div
          className={cn(
            'vos-mobile-header__bar',
            !compactChrome && showAvatarButton && 'vos-mobile-header__bar--with-trailing',
          )}
        >
          {showMenuButton ? (
            <Button
              type="button"
              variant={sheetOpen ? 'accent' : 'ghost'}
              size="icon-sm"
              aria-expanded={sheetOpen}
              aria-haspopup="dialog"
              aria-label="Menú y cuenta"
              onClick={() => onSheetOpenChange(!sheetOpen)}
            >
              <Menu className="h-[1.1rem] w-[1.1rem]" strokeWidth={2} aria-hidden />
            </Button>
          ) : (
            <span className="w-10" aria-hidden />
          )}

          <h1 className="vos-mobile-header__title">{headerTitle}</h1>

          {!compactChrome ? (
            showAvatarButton ? (
              <Button
                type="button"
                variant={sheetOpen ? 'accent' : 'secondary'}
                size="icon-sm"
                aria-label={`Cuenta: ${user?.name}`}
                onClick={() => onSheetOpenChange(!sheetOpen)}
              >
                {userInitial}
              </Button>
            ) : (
              <span className="w-10" aria-hidden />
            )
          ) : null}
        </div>
      </header>

      {showDock ? (
        <nav className="app-mobile-dock" aria-label="Módulos principales">
          <div className="app-mobile-dock__fade" aria-hidden />
          <div className="app-mobile-dock__inner">
            {dockTabs.map((tab) => {
              const active = view === tab.view
              return (
                <Button
                  key={tab.id}
                  type="button"
                  variant={active ? 'accent' : 'ghost'}
                  size="icon"
                  className={cn(
                    'app-mobile-dock__tab',
                    active && 'app-mobile-dock__tab--active',
                  )}
                  aria-current={active ? 'page' : undefined}
                  aria-label={tab.label}
                  onClick={() => onNavigate(tab.view)}
                >
                  <MobileDockIcon id={tab.id} />
                </Button>
              )
            })}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="app-mobile-dock__tab app-mobile-dock__tab--theme"
              aria-label={`Cambiar a tema ${themeLabel.toLowerCase()}`}
              onClick={onToggleTheme}
            >
              <ThemeIcon className="h-[1.15rem] w-[1.15rem]" strokeWidth={2} aria-hidden />
            </Button>
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
                Menú
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
              {sheetLinks.length > 0 ? (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {sheetLinks.map((link) => (
                    <li key={link.view}>
                      <Button
                        type="button"
                        variant={view === link.view ? 'accent' : 'secondary'}
                        size="md"
                        block
                        className="justify-start"
                        onClick={() => pickView(link.view)}
                      >
                        {link.label}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {user ? (
                <div className="flex flex-col gap-2 border-t border-[color-mix(in_srgb,var(--border)_72%,transparent)] pt-3">
                  {user.companyName ? (
                    <p className="vos-sheet__company">{user.companyName}</p>
                  ) : null}
                  <p className="vos-sheet__user">
                    {user.name}
                    <span className="text-[color-mix(in_srgb,var(--muted)_80%,transparent)]">
                      {' '}
                      · {user.role}
                    </span>
                  </p>
                  {compactChrome ? (
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
