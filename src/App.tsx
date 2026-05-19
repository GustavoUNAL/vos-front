import { useEffect, useState } from 'react'
import { useMatchMedia } from './hooks/useMatchMedia'
import {
  fetchMe,
  getAccessToken,
  getApiBase,
  setAccessToken,
  type AuthUser,
} from './api'
import { InventoryManager } from './components/InventoryManager'
import { ProductsManager } from './components/ProductsManager'
import { CostsView } from './components/CostsView'
import { GastosView } from './components/GastosView'
import { PurchaseLotsView } from './components/PurchaseLotsView'
import { RecipesView } from './components/RecipesView'
import { SalesManager } from './components/SalesManager'
import { TableExplorer } from './components/TableExplorer'
import { PosApp } from './pos/PosApp'
import { useNavigation } from './NavigationContext'
import { NavigationHub, type HubTargetView } from './components/NavigationHub'
import type { NavGroupId } from './navTypes'
import './App.css'

type View =
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

const VIEW_HASH: Record<View, string> = {
  menu: '#/menu',
  products: '#/products',
  recipes: '#/recipes',
  inventory: '#/inventory',
  sales: '#/sales',
  pos: '#/pos',
  purchases: '#/purchases',
  costs: '#/costs',
  gastos: '#/gastos',
  explorer: '#/explorer',
}

const MOBILE_NAV_TITLE: Record<View, string> = {
  menu: 'Inicio',
  products: 'Productos a la venta',
  recipes: 'Recetas',
  inventory: 'Productos',
  sales: 'Ventas',
  pos: 'POS Mesas',
  purchases: 'Compras',
  costs: 'Costos',
  gastos: 'Gastos',
  explorer: 'DB',
}

const VIEW_TO_GROUP: Record<Exclude<View, 'menu'>, NavGroupId> = {
  products: 'catalog',
  recipes: 'catalog',
  inventory: 'stock',
  sales: 'sales',
  pos: 'sales',
  purchases: 'purchases',
  costs: 'finance',
  gastos: 'finance',
  explorer: 'data',
}

function activeNavGroup(view: View): NavGroupId | null {
  if (view === 'menu') return null
  return VIEW_TO_GROUP[view]
}

const COLLAPSED_GROUP_LABEL: Record<NavGroupId, string> = {
  catalog: 'Productos a la venta',
  stock: 'Inventario',
  purchases: 'Compras',
  sales: 'Ventas',
  finance: 'Finanzas',
  data: 'Datos',
}

function NavGlyph({ group }: { group: NavGroupId }) {
  const c = 'app-sidebar__icon-svg'
  switch (group) {
    case 'catalog':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Zm9 0a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V5ZM4 14a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5Zm9 0a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5Z"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'stock':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M21 16.5V8.2a1.9 1.9 0 0 0-.9-1.6l-7-4.1a1.9 1.9 0 0 0-2 0l-7 4.1A1.9 1.9 0 0 0 3 8.2v8.3a1.9 1.9 0 0 0 1 1.6l7 4.1a1.9 1.9 0 0 0 2 0l7-4.1a1.9 1.9 0 0 0 1-1.6Z"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinejoin="round"
          />
          <path
            d="m3.3 7.7 8.7 5 8.7-5M12 22V12.7"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'purchases':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M9 3v2m6-2v2M5 9h14l-1 12H6L5 9Zm0 0-.7-3.5A1 1 0 0 1 5.3 4h13.4a1 1 0 0 1 .9 1.5L19 9"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
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
            strokeWidth="1.35"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="20" r="1.35" fill="currentColor" />
          <circle cx="18" cy="20" r="1.35" fill="currentColor" />
        </svg>
      )
    case 'finance':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 18h16"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
          <path
            d="m7 14 3-3 3 2 4-6"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'data':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <ellipse cx="12" cy="5" rx="7" ry="3" stroke="currentColor" strokeWidth="1.35" />
          <path
            d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinejoin="round"
          />
        </svg>
      )
  }
}

function SidebarCollapsedRail({
  view,
  onPick,
}: {
  view: View
  onPick: (g: NavGroupId) => void
}) {
  const groups: NavGroupId[] = [
    'catalog',
    'stock',
    'purchases',
    'sales',
    'finance',
    'data',
  ]
  return (
    <nav
      id="app-sidebar-collapsed-rail"
      className="app-sidebar__collapsed-rail"
      aria-label="Secciones (iconos)"
    >
      {groups.map((g) => {
        const ag = activeNavGroup(view)
        const active = ag !== null && ag === g
        return (
          <button
            key={g}
            type="button"
            className={`app-sidebar__icon-btn app-sidebar__icon-btn--${g}${active ? ' app-sidebar__icon-btn--active' : ''}`}
            title={COLLAPSED_GROUP_LABEL[g]}
            aria-label={COLLAPSED_GROUP_LABEL[g]}
            aria-current={active ? 'page' : undefined}
            onClick={() => onPick(g)}
          >
            <NavGlyph group={g} />
          </button>
        )
      })}
    </nav>
  )
}

function getViewFromHash(): View | null {
  const raw = (window.location.hash ?? '').replace(/^#/, '')
  const pathOnly = raw.split('?')[0] ?? ''
  const parts = pathOnly.split('/').filter(Boolean)
  const first = parts[0] ?? ''
  if (first === 'products') return 'products'
  if (first === 'recipes') return 'recipes'
  if (first === 'inventory') return 'inventory'
  if (first === 'sales') return 'sales'
  if (first === 'pos') return 'pos'
  if (first === 'purchases') return 'purchases'
  if (first === 'costs') return 'costs'
  if (first === 'gastos') return 'gastos'
  if (first === 'explorer') return 'explorer'
  if (first === 'menu') return 'menu'
  return null
}

export default function App() {
  const {
    inventorySubtitle,
    purchasesSubtitle,
    backendDown,
    retryApiProbe,
  } = useNavigation()
  const [baseUrl] = useState(() => getApiBase())
  const [view, setView] = useState<View>(() => {
    try {
      return getViewFromHash() ?? 'menu'
    } catch {
      return 'menu'
    }
  })
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const t = window.localStorage.getItem('arandano_theme')
      return t === 'light' ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })

  const [user, setUser] = useState<AuthUser | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const v = window.localStorage.getItem('arandano_sidebar_collapsed')
      if (v === '0') return false
      if (v === '1') return true
      return true
    } catch {
      return true
    }
  })

  const isMobileNav = useMatchMedia('(max-width: 720px)')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    if (!isMobileNav) setMobileNavOpen(false)
  }, [isMobileNav])



  useEffect(() => {
    setMobileNavOpen(false)
  }, [view])

  useEffect(() => {
    const root = document.documentElement
    if (!isMobileNav || !mobileNavOpen) {
      root.classList.remove('app--mobile-nav-open')
      return
    }
    root.classList.add('app--mobile-nav-open')
    return () => root.classList.remove('app--mobile-nav-open')
  }, [isMobileNav, mobileNavOpen])

  useEffect(() => {
    if (!isMobileNav || !mobileNavOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isMobileNav, mobileNavOpen])



  const goCollapsedGroup = (g: NavGroupId) => {
    switch (g) {
      case 'catalog':
        setView('products')
        return
      case 'stock':
        setView('inventory')
        return
      case 'purchases':
        setView('purchases')
        return
      case 'sales':
        setView('sales')
        return
      case 'finance':
        setView('costs')
        return
      case 'data':
        setView('explorer')
        return
      default:
        return
    }
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(
        'arandano_sidebar_collapsed',
        sidebarCollapsed ? '1' : '0',
      )
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      window.localStorage.setItem('arandano_theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  useEffect(() => {
    if (!getAccessToken()) return
    let cancelled = false
    fetchMe(baseUrl)
      .then((u) => {
        if (!cancelled) {
          setUser(u)
          setAuthError(null)
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setUser(null)
          setAuthError(e.message)
        }
      })
    return () => {
      cancelled = true
    }
  }, [baseUrl])

  // Sync view from URL hash.
  useEffect(() => {
    const onHash = () => {
      const v = getViewFromHash()
      if (v) setView(v)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Sync URL hash from view (without clobbering the recipeId deep link).
  useEffect(() => {
    const desired = VIEW_HASH[view]
    const current = window.location.hash ?? ''
    if (view === 'recipes' && current.startsWith('#/recipes')) return
    if (view === 'purchases' && current.startsWith('#/purchases')) return
    if (current === desired) return
    window.history.replaceState({}, '', desired)
  }, [view])

  return (
    <div
      className={`app-shell${isMobileNav ? ' app-shell--mobile-nav-drawer' : ''}${mobileNavOpen && isMobileNav ? ' app-shell--mobile-nav-open' : ''}`}
    >
      <a href="#main-content" className="skip-to-main">
        Saltar al contenido
      </a>
      {authError && (
        <div className="app-banner" role="status">
          <span className="banner-warn">Auth: {authError}</span>
        </div>
      )}
      {backendDown && (
        <div className="app-banner app-banner--api-down" role="alert">
          <span className="banner-warn">
            API apagado (puerto 3000). El POS usa modo local; ventas, productos e inventario
            necesitan arandano-api.
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={retryApiProbe}>
            Reintentar conexión
          </button>
        </div>
      )}

      <div className="app-body">
        <main className="app-main" id="main-content" tabIndex={-1}>
          {isMobileNav && (
            <header className="app-mobile-nav-bar">
              <div className="app-mobile-nav-bar__lead">
                <img
                  className="app-mobile-nav-bar__logo"
                  src="/logo.png"
                  width={38}
                  height={38}
                  alt=""
                  decoding="async"
                />
                <p className="app-mobile-nav-bar__title">{MOBILE_NAV_TITLE[view]}</p>
              </div>
              <button
                type="button"
                className="btn-nav-hamburger"
                aria-expanded={mobileNavOpen}
                aria-controls="app-sidebar"
                onClick={() => setMobileNavOpen((o) => !o)}
              >
                <span className="icon-nav-hamburger" aria-hidden />
                <span className="sr-only">
                  {mobileNavOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
                </span>
              </button>
            </header>
          )}
          {view === 'menu' && (
            <NavigationHub
              inventoryHint={
                inventorySubtitle ??
                'Recurso físico: existencias y movimientos'
              }
              purchasesHint={
                purchasesSubtitle ??
                'Registro financiero del lote (proveedor, monto, fecha)'
              }
              onNavigate={(v: HubTargetView) => {
                setView(v)
                if (v === 'recipes') {
                  window.history.replaceState({}, '', '#/recipes')
                }
              }}
            />
          )}
          {view === 'products' && <ProductsManager baseUrl={baseUrl} />}
          {view === 'recipes' && <RecipesView baseUrl={baseUrl} />}
          {view === 'inventory' && <InventoryManager baseUrl={baseUrl} />}
          {view === 'sales' && <SalesManager baseUrl={baseUrl} />}
          {view === 'pos' && <PosApp />}
          {view === 'purchases' && <PurchaseLotsView baseUrl={baseUrl} />}
          {view === 'costs' && <CostsView baseUrl={baseUrl} />}
          {view === 'gastos' && <GastosView baseUrl={baseUrl} />}
          {view === 'explorer' && <TableExplorer baseUrl={baseUrl} />}
        </main>

        {isMobileNav && mobileNavOpen && (
          <button
            type="button"
            className="app-sidebar-backdrop"
            aria-label="Cerrar menú"
            onClick={() => setMobileNavOpen(false)}
          />
        )}

        <aside
          id="app-sidebar"
          className={`app-sidebar${sidebarCollapsed ? ' app-sidebar--collapsed' : ''}`}
          aria-label="Navegación principal"
          onClick={(e) => {
            if (!isMobileNav || !mobileNavOpen) return
            const el = e.target as HTMLElement
            if (el.closest('.theme-switch')) return
            if (el.closest('button, a[href]')) setMobileNavOpen(false)
          }}
        >
          <div className="app-sidebar__brand">
            <div className="app-sidebar__brand-start">
              <button
                type="button"
                className="app-sidebar__logo-btn"
                onClick={() => setView('menu')}
                title="Inicio"
                aria-label="Ir al inicio"
              >
                <img
                  className="app-logo"
                  src="/logo.png"
                  width={40}
                  height={40}
                  alt=""
                  decoding="async"
                />
              </button>
              <div className="app-sidebar__brand-text">
                <span className="app-sidebar__brand-name">Arándano Café</span>
                <span className="app-sidebar__brand-sub muted">
                  Operación del local
                </span>
              </div>
            </div>
            {isMobileNav && mobileNavOpen ? (
              <button
                type="button"
                className="app-sidebar__drawer-close"
                aria-label="Cerrar menú"
                onClick={() => setMobileNavOpen(false)}
              >
                <span className="app-sidebar__drawer-close-icon" aria-hidden>
                  ×
                </span>
              </button>
            ) : (
              !isMobileNav && (
                <button
                  type="button"
                  className="app-sidebar__pin"
                  aria-expanded={!sidebarCollapsed}
                  aria-controls="app-sidebar-nav app-sidebar-collapsed-rail"
                  aria-label={
                    sidebarCollapsed
                      ? 'Expandir barra lateral'
                      : 'Contraer barra lateral'
                  }
                  title={
                    sidebarCollapsed
                      ? 'Expandir barra lateral'
                      : 'Contraer barra lateral'
                  }
                  onClick={() => setSidebarCollapsed((v) => !v)}
                >
                  <span className="app-sidebar__pin-char" aria-hidden>
                    {sidebarCollapsed ? '‹' : '›'}
                  </span>
                </button>
              )
            )}
          </div>
          <div className="app-sidebar__meta">
            {user && (
              <div className="header-auth">
                <span className="muted small" title={user.email}>
                  {user.name} · {user.role}
                </span>
                <button
                  type="button"
                  className="btn-secondary btn-compact"
                  onClick={() => {
                    setAccessToken(null)
                    setUser(null)
                    setAuthError(null)
                  }}
                >
                  Salir
                </button>
              </div>
            )}
            <div className="theme-switch" title="Cambiar tema">
              <span className="muted small" id="theme-switch-label">
                Tema
              </span>
              <button
                type="button"
                role="switch"
                className={`theme-switch__track${theme === 'light' ? ' theme-switch__track--on' : ''}`}
                aria-checked={theme === 'light'}
                aria-labelledby="theme-switch-label"
                onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              >
                <span className="theme-switch__thumb" aria-hidden />
              </button>
              <span className="theme-switch__value muted small">
                {theme === 'light' ? 'Claro' : 'Oscuro'}
              </span>
            </div>
          </div>
          {sidebarCollapsed && !isMobileNav && (
            <SidebarCollapsedRail view={view} onPick={goCollapsedGroup} />
          )}
          <nav
            id="app-sidebar-nav"
            className="app-nav"
            aria-label="Secciones"
            hidden={sidebarCollapsed && !isMobileNav}
          >
            {isMobileNav && (
              <p className="app-nav-mobile-intro muted small">
                Toca una opción para ir a esa pantalla.
              </p>
            )}
            <div className="app-nav-home">
              <ul className="app-nav-list">
                <li>
                  <button
                    type="button"
                    className={view === 'menu' ? 'active' : ''}
                    onClick={() => setView('menu')}
                  >
                    Inicio
                  </button>
                </li>
              </ul>
            </div>
            <div className="app-nav-group app-nav-group--catalog">
              <div
                className="app-nav-group__toggle app-nav-group__toggle--static"
                id="nav-head-catalog"
              >
                <span className="app-nav-group__toggle-main">
                  <span className="app-nav-group__title">Productos a la venta</span>
                  <span className="app-nav-group__hint">
                    Carta, recetas y fichas
                  </span>
                </span>
              </div>
              <ul
                className="app-nav-list"
                aria-labelledby="nav-head-catalog"
              >
                <li>
                  <button
                    type="button"
                    className={view === 'products' ? 'active' : ''}
                    onClick={() => setView('products')}
                  >
                    Productos a la venta
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={view === 'recipes' ? 'active' : ''}
                    onClick={() => {
                      setView('recipes')
                      window.history.replaceState({}, '', '#/recipes')
                    }}
                  >
                    Recetas
                  </button>
                </li>
              </ul>
            </div>

            <div className="app-nav-group app-nav-group--stock">
              <div
                className="app-nav-group__toggle app-nav-group__toggle--static"
                id="nav-head-stock"
              >
                <span className="app-nav-group__toggle-main">
                  <span className="app-nav-group__title">Inventario</span>
                  <span className="app-nav-group__hint">
                    {[inventorySubtitle, purchasesSubtitle]
                      .filter(Boolean)
                      .join(' · ') ||
                      'Insumos en existencia y compras por lote'}
                  </span>
                </span>
              </div>
              <ul
                className="app-nav-list"
                aria-labelledby="nav-head-stock"
              >
                <li>
                  <button
                    type="button"
                    className={view === 'inventory' ? 'active' : ''}
                    onClick={() => setView('inventory')}
                  >
                    Productos
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={view === 'purchases' ? 'active' : ''}
                    onClick={() => setView('purchases')}
                  >
                    Compras
                  </button>
                </li>
              </ul>
            </div>

            <div className="app-nav-group app-nav-group--sales">
              <div
                className="app-nav-group__toggle app-nav-group__toggle--static"
                id="nav-head-sales"
              >
                <span className="app-nav-group__toggle-main">
                  <span className="app-nav-group__title">Ventas</span>
                  <span className="app-nav-group__hint">Ingresos del día</span>
                </span>
              </div>
              <ul
                className="app-nav-list"
                aria-labelledby="nav-head-sales"
              >
                <li>
                  <button
                    type="button"
                    className={view === 'sales' ? 'active' : ''}
                    onClick={() => setView('sales')}
                  >
                    Ventas
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={view === 'pos' ? 'active' : ''}
                    onClick={() => setView('pos')}
                  >
                    POS · Mesas
                  </button>
                </li>
              </ul>
            </div>

            <div className="app-nav-group app-nav-group--finance">
              <div
                className="app-nav-group__toggle app-nav-group__toggle--static"
                id="nav-head-finance"
              >
                <span className="app-nav-group__toggle-main">
                  <span className="app-nav-group__title">Finanzas</span>
                  <span className="app-nav-group__hint">Costos y gastos</span>
                </span>
              </div>
              <ul
                className="app-nav-list"
                aria-labelledby="nav-head-finance"
              >
                <li>
                  <button
                    type="button"
                    className={view === 'costs' ? 'active' : ''}
                    onClick={() => setView('costs')}
                  >
                    Costos
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={view === 'gastos' ? 'active' : ''}
                    onClick={() => setView('gastos')}
                  >
                    Gastos
                  </button>
                </li>
              </ul>
            </div>

            <div className="app-nav-group app-nav-group--data">
              <div
                className="app-nav-group__toggle app-nav-group__toggle--static"
                id="nav-head-data"
              >
                <span className="app-nav-group__toggle-main">
                  <span className="app-nav-group__title">Datos</span>
                  <span className="app-nav-group__hint">Solo lectura</span>
                </span>
              </div>
              <ul
                className="app-nav-list"
                aria-labelledby="nav-head-data"
              >
                <li>
                  <button
                    type="button"
                    className={view === 'explorer' ? 'active' : ''}
                    onClick={() => setView('explorer')}
                  >
                    DB
                  </button>
                </li>
              </ul>
            </div>
          </nav>
        </aside>
      </div>
    </div>
  )
}
