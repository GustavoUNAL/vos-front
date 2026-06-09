import { useEffect, useState } from 'react'
import { useMatchMedia } from './hooks/useMatchMedia'
import { AccessRequestView } from './components/AccessRequestView'
import { PlatformAdminView } from './components/PlatformAdminView'
import {
  exitToPlatformAdmin,
  fetchMe,
  getAccessToken,
  getApiBase,
  setAccessToken,
  setCompanyId,
  type AuthUser,
} from './api'
import { inaugurationDateForUser } from './config/systemSettings'
import { ProductsManager } from './components/ProductsManager'
import { HomeDashboard } from './components/HomeDashboard'
import { ShopAdminView } from './components/ShopAdminView'
import { StaffManager } from './components/StaffManager'
import { FinanceAnalyticsView } from './components/FinanceAnalyticsView'
import { SalesManager } from './components/SalesManager'
import { InventoryManager } from './components/InventoryManager'
import { CostsView } from './components/CostsView'
import { GastosView } from './components/GastosView'
import { PurchaseLotsView } from './components/PurchaseLotsView'
import { RecipesView } from './components/RecipesView'
import { TableExplorer } from './components/TableExplorer'
import { PosApp } from './pos/PosApp'
import {
  PLATFORM_MODE,
  PLATFORM_NAV_GROUPS,
  resolvePlatformView,
  SALES_FLOOR_ONLY,
  SALES_FLOOR_DEFAULT_VIEW,
  SALES_FLOOR_NAV_GROUPS,
  resolveSalesFloorView,
} from './appScope'
import { useNavigation } from './NavigationContext'
import { NavigationHub, type HubTargetView } from './components/NavigationHub'
import { LoginView } from './components/LoginView'
import { LandingView } from './components/LandingView'
import { BrandMark } from './components/BrandMark'
import { CompanyBrand } from './components/CompanyBrand'
import {
  MobileAppChrome,
  type MobileChromeView,
} from './components/MobileAppChrome'
import { ThemeSwitch } from './components/ThemeSwitch'
import { UserProfileCard } from './components/UserProfileCard'
import { VosAssistantWidget } from './components/VosAssistantWidget'
import type { NavGroupId } from './navTypes'
import {
  setPendingPurchasesDate,
  setPendingSalesDate,
} from './lib/pending-view-filter'
import { setPendingPosTableId } from './lib/pending-pos-navigation'
import {
  isAccessRequestHash,
  isLandingHash,
  isLoginHash,
  navigateAfterLogin,
  navigateToAccessRequest,
  navigateToLanding,
  navigateToLogin,
  navigateToPlatform,
} from './lib/authRoutes'
import {
  buildCompanyViewHash,
  getCompanySlugFromUser,
  parseCompanyAppHash,
  type AppView,
} from './lib/companyRoutes'
import './App.css'

type View = AppView

function getViewFromHash(): View | null {
  return parseCompanyAppHash().view
}

function companyViewHash(user: AuthUser, view: View): string {
  return buildCompanyViewHash(getCompanySlugFromUser(user), view)
}

const VIEW_TO_GROUP: Partial<Record<View, NavGroupId>> = {
  products: 'catalog',
  recipes: 'catalog',
  inventory: 'stock',
  sales: 'sales',
  pos: 'sales',
  shop: 'sales',
  purchases: 'purchases',
  staff: 'staff',
  analytics: 'finance',
  costs: 'finance',
  gastos: 'finance',
  explorer: 'data',
}

function activeNavGroup(view: View): NavGroupId | null {
  if (view === 'menu' || view === 'home') return null
  return VIEW_TO_GROUP[view] ?? null
}

const COLLAPSED_GROUP_LABEL: Record<NavGroupId, string> = {
  catalog: 'Productos a la venta',
  stock: 'Inventario',
  purchases: 'Compras',
  sales: 'Ventas',
  staff: 'Personal',
  finance: 'Finanzas',
  data: 'Datos',
}

function HomeGlyph({ className = 'app-nav-home__icon' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  )
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
    case 'staff':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.35" />
          <path
            d="M5 20c0-3.3 3.1-5 7-5s7 1.7 7 5"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
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
  onHome,
  showHome,
}: {
  view: View
  onPick: (g: NavGroupId) => void
  onHome?: () => void
  showHome?: boolean
}) {
  const groups: NavGroupId[] = PLATFORM_MODE
    ? [...PLATFORM_NAV_GROUPS]
    : SALES_FLOOR_ONLY
      ? [...SALES_FLOOR_NAV_GROUPS]
      : ['catalog', 'stock', 'purchases', 'sales', 'finance', 'data']
  const homeActive = view === 'home' || view === 'menu'
  return (
    <nav
      id="app-sidebar-collapsed-rail"
      className="app-sidebar__collapsed-rail"
      aria-label="Secciones (iconos)"
    >
      {showHome && onHome ? (
        <button
          type="button"
          className={`app-sidebar__icon-btn app-sidebar__icon-btn--home${homeActive ? ' app-sidebar__icon-btn--active' : ''}`}
          title="Inicio"
          aria-label="Inicio"
          aria-current={homeActive ? 'page' : undefined}
          onClick={onHome}
        >
          <HomeGlyph className="app-sidebar__icon-svg" />
        </button>
      ) : null}
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
      const h = getViewFromHash()
      if (PLATFORM_MODE) {
        return resolvePlatformView(h) as View
      }
      if (SALES_FLOOR_ONLY) {
        return resolveSalesFloorView(h) as View
      }
      return h ?? 'menu'
    } catch {
      if (PLATFORM_MODE) return 'home'
      return SALES_FLOOR_ONLY ? SALES_FLOOR_DEFAULT_VIEW : 'menu'
    }
  })
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const t = window.localStorage.getItem('vos_theme')
      return t === 'light' ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })

  const [user, setUser] = useState<AuthUser | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authInitializing, setAuthInitializing] = useState<boolean>(() =>
    Boolean(getAccessToken()),
  )
  const [, setPublicRouteTick] = useState(0)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const v = window.localStorage.getItem('vos_sidebar_collapsed')
      if (v === '0') return false
      if (v === '1') return true
      return true
    } catch {
      return true
    }
  })

  const isMobileNav = useMatchMedia('(max-width: 720px)')
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)

  useEffect(() => {
    if (!isMobileNav) setMobileSheetOpen(false)
  }, [isMobileNav])

  useEffect(() => {
    setMobileSheetOpen(false)
    setAssistantOpen(false)
  }, [view])

  const handleMobileNavigate = (v: MobileChromeView) => {
    setAssistantOpen(false)
    setView(v)
    if (v === 'recipes') {
      window.history.replaceState({}, '', '#/recipes')
    }
  }



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
      case 'staff':
        setView('staff')
        return
      case 'sales':
        setView('sales')
        return
      case 'finance':
        setView(PLATFORM_MODE ? 'analytics' : 'costs')
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
        'vos_sidebar_collapsed',
        sidebarCollapsed ? '1' : '0',
      )
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      window.localStorage.setItem('vos_theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  useEffect(() => {
    if (!getAccessToken()) {
      setAuthInitializing(false)
      return
    }
    let cancelled = false
    setAuthInitializing(true)
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
      .finally(() => {
        if (!cancelled) setAuthInitializing(false)
      })
    return () => {
      cancelled = true
    }
  }, [baseUrl])

  useEffect(() => {
    const onLogout = () => {
      setCompanyId(null)
      setUser(null)
      setAuthError('Sesión expirada. Iniciá sesión nuevamente.')
      navigateToLogin()
    }
    const onTenantDenied = (ev: Event) => {
      const detail = (ev as CustomEvent<{ message?: string }>).detail
      const msg = detail?.message?.trim()
      setAuthError(
        msg ||
          'Sin acceso a esta empresa. Volvé a iniciar sesión o elegí la empresa desde el panel admin.',
      )
      if (user?.isPlatformAdmin) {
        void exitToPlatformAdmin(baseUrl)
          .then((res) => {
            setUser(res.user)
            navigateToPlatform(true)
          })
          .catch(() => navigateToLogin())
      } else {
        navigateToLogin()
      }
    }
    window.addEventListener('auth:logout', onLogout)
    window.addEventListener('auth:tenant-denied', onTenantDenied)
    return () => {
      window.removeEventListener('auth:logout', onLogout)
      window.removeEventListener('auth:tenant-denied', onTenantDenied)
    }
  }, [baseUrl, user?.isPlatformAdmin])

  useEffect(() => {
    if (user) return
    const onHash = () => setPublicRouteTick((n) => n + 1)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [user])

  useEffect(() => {
    if (authInitializing || user) return
    if (isLoginHash() || isLandingHash() || isAccessRequestHash()) return
    navigateToLanding()
  }, [authInitializing, user])

  useEffect(() => {
    if (!user) return
    if (user.isPlatformAdmin && user.platformView) return
    const parsed = parseCompanyAppHash()
    const slug = getCompanySlugFromUser(user)
    if (parsed.companySlug !== slug) {
      window.history.replaceState({}, '', companyViewHash(user, view))
    }
  }, [user, view])

  // Sync view from URL hash.
  useEffect(() => {
    const onHash = () => {
      const v = getViewFromHash()
      if (PLATFORM_MODE) {
        setView(resolvePlatformView(v) as View)
        return
      }
      if (SALES_FLOOR_ONLY) {
        setView(resolveSalesFloorView(v) as View)
        return
      }
      if (v) setView(v)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Sync URL hash from view (without clobbering the recipeId deep link).
  useEffect(() => {
    if (!user) return
    if (user.isPlatformAdmin && user.platformView) return
    const desired = companyViewHash(user, view)
    const current = window.location.hash ?? ''
    const slug = getCompanySlugFromUser(user)
    if (view === 'recipes' && (current.includes(`/${slug}/recipes`) || current.startsWith('#/recipes'))) {
      return
    }
    if (
      view === 'purchases' &&
      (current.includes(`/${slug}/purchases`) || current.startsWith('#/purchases'))
    ) {
      return
    }
    if (current === desired) return
    window.history.replaceState({}, '', desired)
  }, [view, user])

  if (authInitializing) {
    return (
      <div className="app-initial-boot" aria-busy="true" aria-label="Cargando VOS AI">
        <BrandMark size="lg" className="brand-mark--splash" />
      </div>
    )
  }

  if (!user) {
    if (isLandingHash()) {
      return (
        <LandingView
          onLoginClick={() => navigateToLogin(false)}
          onAccessRequestClick={() => navigateToAccessRequest(false)}
        />
      )
    }
    if (isAccessRequestHash()) {
      return <AccessRequestView baseUrl={baseUrl} />
    }
    if (isLoginHash()) {
      return (
        <LoginView
          baseUrl={baseUrl}
          initialMessage={authError}
          onLogin={(u) => {
            setUser(u)
            setAuthError(null)
            setView('home')
            navigateAfterLogin(u)
          }}
        />
      )
    }
    navigateToLanding()
    return null
  }

  const showPlatformAdmin =
    user.isPlatformAdmin &&
    (user.platformView === true || !user.companyId?.trim())

  if (showPlatformAdmin) {
    return (
      <PlatformAdminView
        baseUrl={baseUrl}
        user={user}
        onEnterCompany={(u, nextView) => {
          setUser(u)
          setAuthError(null)
          setView(nextView)
        }}
        onLogout={() => {
          setCompanyId(null)
          setUser(null)
        }}
      />
    )
  }

  async function returnToPlatformPanel() {
    try {
      const res = await exitToPlatformAdmin(baseUrl)
      setUser(res.user)
      setAuthError(null)
      navigateToPlatform(true)
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'No se pudo volver al panel admin')
    }
  }

  return (
    <div
      className={`app-shell${isMobileNav ? ' app-shell--mobile-dock' : ''}`}
    >
      <a href="#main-content" className="skip-to-main">
        Saltar al contenido
      </a>
      {authError && (
        <div className="app-banner" role="status">
          <span className="banner-warn">Auth: {authError}</span>
        </div>
      )}
      {user.isPlatformAdmin && !user.platformView ? (
        <div className="app-banner app-banner--platform" role="status">
          <span>
            Modo administrador — viendo <strong>{user.companyName}</strong>
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void returnToPlatformPanel()}>
            Volver al panel admin
          </button>
        </div>
      ) : null}
      {backendDown && (
        <div className="app-banner app-banner--api-down" role="alert">
          <span className="banner-warn">
            API apagado (puerto 3000). Ventas y productos a la venta necesitan vos-api.
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={retryApiProbe}>
            Reintentar conexión
          </button>
        </div>
      )}

      <div className="app-body">
        <main className="app-main" id="main-content" tabIndex={-1}>
          {isMobileNav ? (
            <MobileAppChrome
              view={view}
              onNavigate={handleMobileNavigate}
              onHome={() => setView(PLATFORM_MODE ? 'home' : 'menu')}
              theme={theme}
              onToggleTheme={() =>
                setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
              }
              user={user}
              onLogout={() => {
                setAccessToken(null)
                setUser(null)
                setAuthError(null)
                navigateToLogin()
              }}
              sheetOpen={mobileSheetOpen}
              onSheetOpenChange={setMobileSheetOpen}
              assistantOpen={assistantOpen}
              onAssistantOpenChange={setAssistantOpen}
            />
          ) : null}
          {view === 'menu' && !SALES_FLOOR_ONLY && !PLATFORM_MODE && (
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
          {PLATFORM_MODE && view === 'home' && (
            <HomeDashboard
              baseUrl={baseUrl}
              companyName={user?.companyName}
              inaugurationDate={inaugurationDateForUser(user)}
              onOpenSales={(date) => {
                setPendingSalesDate(date)
                setView('sales')
              }}
              onOpenPurchases={(date) => {
                setPendingPurchasesDate(date)
                setView('purchases')
              }}
              onOpenPos={(tableId) => {
                if (tableId) setPendingPosTableId(tableId)
                setView('pos')
              }}
            />
          )}
          {PLATFORM_MODE && view === 'shop' && (
            <ShopAdminView
              baseUrl={baseUrl}
              onOpenProducts={() => setView('products')}
              onOpenPos={() => setView('pos')}
            />
          )}
          {view === 'products' && <ProductsManager baseUrl={baseUrl} />}
          {!SALES_FLOOR_ONLY && !PLATFORM_MODE && view === 'recipes' && (
            <RecipesView baseUrl={baseUrl} />
          )}
          {!SALES_FLOOR_ONLY && view === 'inventory' && (
            <InventoryManager baseUrl={baseUrl} />
          )}
          {view === 'sales' && (
            <SalesManager
              baseUrl={baseUrl}
              inaugurationDate={inaugurationDateForUser(user)}
              companyName={user.companyName}
            />
          )}
          {!SALES_FLOOR_ONLY && view === 'pos' && <PosApp />}
          {(PLATFORM_MODE || (!SALES_FLOOR_ONLY && !PLATFORM_MODE)) &&
            view === 'purchases' && (
              <PurchaseLotsView
                baseUrl={baseUrl}
                inaugurationDate={inaugurationDateForUser(user)}
              />
            )}
          {PLATFORM_MODE && view === 'staff' && (
            <StaffManager baseUrl={baseUrl} />
          )}
          {PLATFORM_MODE && view === 'analytics' && (
            <FinanceAnalyticsView baseUrl={baseUrl} />
          )}
          {!SALES_FLOOR_ONLY && !PLATFORM_MODE && view === 'costs' && (
            <CostsView baseUrl={baseUrl} />
          )}
          {!SALES_FLOOR_ONLY && !PLATFORM_MODE && view === 'gastos' && (
            <GastosView baseUrl={baseUrl} />
          )}
          {!SALES_FLOOR_ONLY && !PLATFORM_MODE && view === 'explorer' && (
            <TableExplorer baseUrl={baseUrl} />
          )}
        </main>

        {!isMobileNav ? (
        <aside
          id="app-sidebar"
          className={`app-sidebar${sidebarCollapsed ? ' app-sidebar--collapsed' : ''}`}
          aria-label="Navegación principal"
        >
          <div className="app-sidebar__brand">
            <div className="app-sidebar__brand-start">
              <button
                type="button"
                className="app-sidebar__logo-btn"
                onClick={() =>
                  setView(
                    PLATFORM_MODE
                      ? 'home'
                      : SALES_FLOOR_ONLY
                        ? 'products'
                        : 'menu',
                  )
                }
                title={
                  PLATFORM_MODE
                    ? 'Inicio'
                    : SALES_FLOOR_ONLY
                      ? 'Productos'
                      : 'Inicio'
                }
                aria-label={
                  PLATFORM_MODE
                    ? 'Ir al inicio'
                    : SALES_FLOOR_ONLY
                      ? 'Ir a productos'
                      : 'Ir al inicio'
                }
              >
                {PLATFORM_MODE ? (
                  <BrandMark size="sm" className="app-sidebar__company-brand" />
                ) : user?.companyName ? (
                  <CompanyBrand
                    name={user.companyName}
                    size="sm"
                    className="app-sidebar__company-brand"
                  />
                ) : null}
              </button>
            </div>
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
          </div>
          <div className="app-sidebar__meta">
            {user && (
              <div className="header-auth header-auth--profile">
                <UserProfileCard user={user} compact />
                <button
                  type="button"
                  className="btn-secondary btn-compact"
                  onClick={() => {
                    setAccessToken(null)
                    setCompanyId(null)
                    setUser(null)
                    setAuthError(null)
                    navigateToLogin()
                  }}
                >
                  Salir
                </button>
              </div>
            )}
            <ThemeSwitch
              theme={theme}
              onToggle={() =>
                setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
              }
            />
          </div>
          {sidebarCollapsed ? (
            <SidebarCollapsedRail
              view={view}
              onPick={goCollapsedGroup}
              showHome={!SALES_FLOOR_ONLY}
              onHome={() => setView(PLATFORM_MODE ? 'home' : 'menu')}
            />
          ) : null}
          <nav
            id="app-sidebar-nav"
            className="app-nav"
            aria-label="Secciones"
            hidden={sidebarCollapsed}
          >
            {!SALES_FLOOR_ONLY && !PLATFORM_MODE && (
              <div className="app-nav-home">
                <ul className="app-nav-list">
                  <li>
                    <button
                      type="button"
                      className={view === 'menu' ? 'active' : ''}
                      onClick={() => setView('menu')}
                    >
                      <HomeGlyph />
                      <span>Inicio</span>
                    </button>
                  </li>
                </ul>
              </div>
            )}
            {PLATFORM_MODE && (
              <div className="app-nav-home">
                <ul className="app-nav-list">
                  <li>
                    <button
                      type="button"
                      className={view === 'home' ? 'active' : ''}
                      onClick={() => setView('home')}
                    >
                      <HomeGlyph />
                      <span>Inicio</span>
                    </button>
                  </li>
                </ul>
              </div>
            )}
            <div className="app-nav-group app-nav-group--catalog">
              <div
                className="app-nav-group__toggle app-nav-group__toggle--static"
                id="nav-head-catalog"
              >
                <span className="app-nav-group__toggle-main">
                  <span className="app-nav-group__title">Productos a la venta</span>
                  <span className="app-nav-group__hint">
                    {PLATFORM_MODE
                      ? 'Catálogo multi-empresa'
                      : SALES_FLOOR_ONLY
                        ? 'Carta, precios y visibilidad'
                        : 'Carta, recetas y fichas'}
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
                {!SALES_FLOOR_ONLY && !PLATFORM_MODE && (
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
                )}
              </ul>
            </div>

            {!SALES_FLOOR_ONLY && PLATFORM_MODE && (
            <div className="app-nav-group app-nav-group--stock">
              <div
                className="app-nav-group__toggle app-nav-group__toggle--static"
                id="nav-head-stock-platform"
              >
                <span className="app-nav-group__toggle-main">
                  <span className="app-nav-group__title">Inventario</span>
                  <span className="app-nav-group__hint">
                    {inventorySubtitle ?? 'Insumos en existencia y stock mínimo'}
                  </span>
                </span>
              </div>
              <ul
                className="app-nav-list"
                aria-labelledby="nav-head-stock-platform"
              >
                <li>
                  <button
                    type="button"
                    className={view === 'inventory' ? 'active' : ''}
                    onClick={() => setView('inventory')}
                  >
                    Stock
                  </button>
                </li>
              </ul>
            </div>
            )}

            {!SALES_FLOOR_ONLY && !PLATFORM_MODE && (
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
            )}

            <div className="app-nav-group app-nav-group--sales">
              <div
                className="app-nav-group__toggle app-nav-group__toggle--static"
                id="nav-head-sales"
              >
                <span className="app-nav-group__toggle-main">
                  <span className="app-nav-group__title">Ventas</span>
                  <span className="app-nav-group__hint">
                    {PLATFORM_MODE
                      ? 'Transacciones diarias'
                      : 'Ingresos del día'}
                  </span>
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
                {!SALES_FLOOR_ONLY && (
                  <li>
                    <button
                      type="button"
                      className={view === 'pos' ? 'active' : ''}
                      onClick={() => setView('pos')}
                    >
                      POS · Mesas
                    </button>
                  </li>
                )}
                {PLATFORM_MODE && (
                  <li>
                    <button
                      type="button"
                      className={view === 'shop' ? 'active' : ''}
                      onClick={() => setView('shop')}
                    >
                      Tienda en línea
                    </button>
                  </li>
                )}
              </ul>
            </div>

            {PLATFORM_MODE && (
            <div className="app-nav-group app-nav-group--purchases">
              <div
                className="app-nav-group__toggle app-nav-group__toggle--static"
                id="nav-head-purchases"
              >
                <span className="app-nav-group__toggle-main">
                  <span className="app-nav-group__title">Compras</span>
                  <span className="app-nav-group__hint">
                    Registro diario de compras
                  </span>
                </span>
              </div>
              <ul
                className="app-nav-list"
                aria-labelledby="nav-head-purchases"
              >
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
            )}

            {PLATFORM_MODE && (
            <div className="app-nav-group app-nav-group--staff">
              <div
                className="app-nav-group__toggle app-nav-group__toggle--static"
                id="nav-head-staff"
              >
                <span className="app-nav-group__toggle-main">
                  <span className="app-nav-group__title">Personal</span>
                  <span className="app-nav-group__hint">
                    Turnos, horas y pago por hora
                  </span>
                </span>
              </div>
              <ul
                className="app-nav-list"
                aria-labelledby="nav-head-staff"
              >
                <li>
                  <button
                    type="button"
                    className={view === 'staff' ? 'active' : ''}
                    onClick={() => setView('staff')}
                  >
                    Personal
                  </button>
                </li>
              </ul>
            </div>
            )}

            {PLATFORM_MODE && (
            <div className="app-nav-group app-nav-group--finance">
              <div
                className="app-nav-group__toggle app-nav-group__toggle--static"
                id="nav-head-finance-platform"
              >
                <span className="app-nav-group__toggle-main">
                  <span className="app-nav-group__title">Finanzas</span>
                  <span className="app-nav-group__hint">
                    Análisis de ventas, compras y nómina
                  </span>
                </span>
              </div>
              <ul
                className="app-nav-list"
                aria-labelledby="nav-head-finance-platform"
              >
                <li>
                  <button
                    type="button"
                    className={view === 'analytics' ? 'active' : ''}
                    onClick={() => setView('analytics')}
                  >
                    Análisis financiero
                  </button>
                </li>
              </ul>
            </div>
            )}

            {!SALES_FLOOR_ONLY && !PLATFORM_MODE && (
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
            )}

            {!SALES_FLOOR_ONLY && !PLATFORM_MODE && (
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
            )}
          </nav>
        </aside>
        ) : null}
      </div>
      {PLATFORM_MODE ? (
        <VosAssistantWidget
          baseUrl={baseUrl}
          open={assistantOpen}
          onOpenChange={setAssistantOpen}
          hideFab={isMobileNav}
        />
      ) : null}
    </div>
  )
}
