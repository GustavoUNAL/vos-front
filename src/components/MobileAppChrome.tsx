import { useEffect } from 'react'
import type { AuthUser } from '../api'
import { SALES_FLOOR_ONLY } from '../appScope'

export const APP_BRAND_TITLE = 'Arándano Café Bar APP'

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
  products: 'Productos',
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
  const c = 'app-mobile-dock__svg'
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

function ThemeDockIcon({ theme }: { theme: 'dark' | 'light' }) {
  const c = 'app-mobile-dock__svg'
  if (theme === 'light') {
    return (
      <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3a1 1 0 0 1 1 1v1.2a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Zm0 14.8a5.2 5.2 0 1 0 0-10.4 5.2 5.2 0 0 0 0 10.4ZM4.6 5.4a1 1 0 0 1 1.4 0l.85.85a1 1 0 0 1-1.4 1.42l-.86-.86a1 1 0 0 1 0-1.41Zm12.5 12.5a1 1 0 0 1 1.4 0l.85.85a1 1 0 1 1-1.4 1.42l-.86-.86a1 1 0 0 1 0-1.41ZM3 12a1 1 0 0 1 1-1h1.2a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm15.8 0a1 1 0 0 1 1-1H20a1 1 0 1 1 0 2h-1.2a1 1 0 0 1-1-1ZM6.45 17.55a1 1 0 0 1 1.41 0l.86.86a1 1 0 0 1-1.41 1.41l-.86-.86a1 1 0 0 1 0-1.41Zm10.24-10.24a1 1 0 0 1 1.41 0l.86.86a1 1 0 0 1-1.41 1.41l-.86-.86a1 1 0 0 1 0-1.41Z"
          fill="currentColor"
        />
      </svg>
    )
  }
  return (
    <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14.2 3.8a7.2 7.2 0 1 0 2.4 13.9 5.8 5.8 0 1 1-2.4-13.9Z"
        fill="currentColor"
      />
    </svg>
  )
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
  const dockTabs = SALES_FLOOR_ONLY ? DOCK_TABS_SALES : DOCK_TABS_FULL

  const sheetLinks: SheetLink[] = SALES_FLOOR_ONLY
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

  const showMenuButton = sheetLinks.length > 0 || Boolean(user)

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

  const userInitial = user?.name?.trim().charAt(0).toUpperCase() ?? ''

  return (
    <>
      <header className="app-mobile-header">
        <div className="app-mobile-header__bar">
          {showMenuButton ? (
            <button
              type="button"
              className={`app-mobile-header__menu${sheetOpen ? ' app-mobile-header__menu--open' : ''}`}
              aria-expanded={sheetOpen}
              aria-haspopup="dialog"
              aria-label="Menú y cuenta"
              onClick={() => onSheetOpenChange(!sheetOpen)}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M5 7h14M5 12h14M5 17h10"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ) : (
            <span className="app-mobile-header__slot" aria-hidden />
          )}

          <div className="app-mobile-header__center">
            <h1 className="app-mobile-header__title">{SCREEN_TITLE[view]}</h1>
          </div>

          {showMenuButton && userInitial ? (
            <button
              type="button"
              className={`app-mobile-header__avatar${sheetOpen ? ' app-mobile-header__avatar--open' : ''}`}
              aria-label={`Cuenta: ${user?.name}`}
              onClick={() => onSheetOpenChange(!sheetOpen)}
            >
              {userInitial}
            </button>
          ) : (
            <span className="app-mobile-header__slot" aria-hidden />
          )}
        </div>
      </header>

      <nav className="app-mobile-dock" aria-label="Módulos principales">
        <div className="app-mobile-dock__fade" aria-hidden />
        <div className="app-mobile-dock__inner">
          {dockTabs.map((tab) => {
            const active = view === tab.view
            return (
              <button
                key={tab.id}
                type="button"
                className={`app-mobile-dock__tab${active ? ' app-mobile-dock__tab--active' : ''}`}
                aria-current={active ? 'page' : undefined}
                aria-label={tab.label}
                onClick={() => onNavigate(tab.view)}
              >
                <span className="app-mobile-dock__icon-wrap">
                  <MobileDockIcon id={tab.id} />
                </span>
              </button>
            )
          })}
          <button
            type="button"
            className="app-mobile-dock__tab app-mobile-dock__tab--theme"
            aria-label={`Cambiar a tema ${themeLabel.toLowerCase()}`}
            onClick={onToggleTheme}
          >
            <span className="app-mobile-dock__icon-wrap">
              <ThemeDockIcon theme={theme} />
            </span>
          </button>
        </div>
      </nav>

      {sheetOpen ? (
        <div
          className="app-mobile-sheet-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onSheetOpenChange(false)
          }}
        >
          <section
            className="app-mobile-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-sheet-title"
          >
            <header className="app-mobile-sheet__head">
              <h2 id="mobile-sheet-title" className="app-mobile-sheet__title">
                Menú
              </h2>
              <button
                type="button"
                className="app-mobile-sheet__close"
                onClick={() => onSheetOpenChange(false)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </header>
            <div className="app-mobile-sheet__body">
              {sheetLinks.length > 0 ? (
                <ul className="app-mobile-sheet__nav">
                  {sheetLinks.map((link) => (
                    <li key={link.view}>
                      <button
                        type="button"
                        className={view === link.view ? 'active' : ''}
                        onClick={() => pickView(link.view)}
                      >
                        {link.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {user ? (
                <div className="app-mobile-sheet__user">
                  <p className="app-mobile-sheet__user-name">
                    {user.name}
                    <span className="muted small"> · {user.role}</span>
                  </p>
                  <button
                    type="button"
                    className="btn-secondary btn-compact"
                    onClick={() => {
                      onSheetOpenChange(false)
                      onLogout()
                    }}
                  >
                    Salir
                  </button>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
