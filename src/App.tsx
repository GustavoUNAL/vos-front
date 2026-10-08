import { useEffect, useState } from 'react'
import { useMatchMedia } from './hooks/useMatchMedia'
import { SessionUserContext } from './hooks/useSessionUser'
import { rememberSignedInName, firstName } from './lib/userIdentity'
import { displayCompanyName } from './lib/displayLabels'
import { BRAND_NAME } from './lib/brand'
import { AccessRequestView } from './components/AccessRequestView'
import { BusinessSetupView } from './components/BusinessSetupView'
import { PlatformAdminView } from './components/PlatformAdminView'
import { PlatformAdminBar } from './components/PlatformAdminBar'
import {
  exitToPlatformAdmin,
  fetchMe,
  getAccessToken,
  getApiBase,
  getLastCompanyId,
  restorePreferredCompany,
  setAccessToken,
  setCompanyId,
  type AuthUser,
  type CompanyUsage,
} from './api'
import { inaugurationDateForUser } from './config/systemSettings'
import {
  persistTheme,
  readStoredTheme,
  setThemeColor,
  themeColorForScheme,
} from './lib/themeColor'
import { ProductsManager } from './components/ProductsManager'
import { ShopAdminView } from './components/ShopAdminView'
import { StaffManager } from './components/StaffManager'
import { FinanceAnalyticsView } from './components/FinanceAnalyticsView'
import { TasksView } from './components/TasksView'
import { ProjectsHistoryView } from './components/ProjectsHistoryView'
import { canAccessView, canViewFinance, canViewProjects, canViewTasks, hasBookingModule, isHealthClinicCompany } from './lib/permissions'
import { DentalClinicApp } from './dental/DentalClinicApp'
import { isDentalView, type DentalView } from './dental/dentalNav'
import { BookingApp } from './booking/BookingApp'
import { isBookingView, normalizeBookingView } from './booking/bookingNav'
import { SalesManager } from './components/SalesManager'
import { InventoryManager } from './components/InventoryManager'
import { CostsView } from './components/CostsView'
import { GastosView } from './components/GastosView'
import { PurchaseLotsView } from './components/PurchaseLotsView'
import { CashCloseManager } from './components/CashCloseManager'
import { RecipesView } from './components/RecipesView'
import { TableExplorer } from './components/TableExplorer'
import { PosApp } from './pos/PosApp'
import {
  PLATFORM_MODE,
  resolvePlatformView,
  SALES_FLOOR_ONLY,
  SALES_FLOOR_DEFAULT_VIEW,
  resolveSalesFloorView,
} from './appScope'
import { useNavigation } from './NavigationContext'
import { NavigationHub, type HubTargetView } from './components/NavigationHub'
import { LoginView } from './components/LoginView'
import { CompanySelectView } from './components/CompanySelectView'
import { LandingView } from './components/LandingView'
import { LegalPageView } from './components/LegalPageView'
import { BrandMark } from './components/BrandMark'
import {
  isMobileChromeView,
  MobileAppChrome,
  type MobileChromeView,
} from './components/MobileAppChrome'
import { DesktopAppHeader } from './components/DesktopAppHeader'
import { OdooHomeScreen } from './components/OdooHomeScreen'
import { VosAssistantWidget } from './components/VosAssistantWidget'
import { SessionWelcome } from './components/SessionWelcome'
import {
  setPendingPurchasesDate,
  setPendingSalesDate,
} from './lib/pending-view-filter'
import { setPendingPosTableId } from './lib/pending-pos-navigation'
import {
  consumeGoogleAuthHash,
  googleAuthErrorMessage,
  isAccessRequestHash,
  isBusinessSetupHash,
  isGooglePopupHash,
  isGoogleSignupHash,
  isHealthLoginHash,
  isLandingHash,
  isLegalHash,
  isLoginHash,
  isPlatformHash,
  isPrivacyHash,
  isRegisterHash,
  isTermsHash,
  navigateAfterLogin,
  navigateToBusinessSetup,
  navigateToHealthLogin,
  navigateToLanding,
  navigateToLogin,
  navigateToPlatform,
  navigateToRegister,
  navigateToSelectCompany,
  isSelectCompanyHash,
  storeGoogleSignupToken,
} from './lib/authRoutes'
import { HealthLoginView } from './components/HealthLoginView'
import { GoogleAuthPopupView } from './components/GoogleAuthPopupView'
import { GoogleSignupView } from './components/GoogleSignupView'
import { RegisterView } from './components/RegisterView'
import { TrialPaywallModal, TrialQuotaBanner } from './components/TrialPlanOffer'
import { userNeedsCompanyPicker } from './lib/companySelect'
import { userNeedsBusinessSetup } from './lib/businessSetup'
import { isOdooHomeView } from './lib/odooNav'
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

let googleAuthBoot: {
  hasToken: boolean
  error: string | null
  preferredCompanyId: string | null
  fromGoogle: boolean
} | null = null

function readGoogleAuthBoot(): {
  hasToken: boolean
  error: string | null
  preferredCompanyId: string | null
  fromGoogle: boolean
} {
  if (googleAuthBoot) return googleAuthBoot
  if (typeof window !== 'undefined' && isGooglePopupHash()) {
    googleAuthBoot = {
      hasToken: false,
      error: null,
      preferredCompanyId: null,
      fromGoogle: false,
    }
    return googleAuthBoot
  }
  const preferredCompanyId = getLastCompanyId()
  const fromHash = consumeGoogleAuthHash()
  if (fromHash.token) setAccessToken(fromHash.token)
  if (fromHash.signupToken) storeGoogleSignupToken(fromHash.signupToken)
  googleAuthBoot = {
    hasToken: Boolean(getAccessToken()),
    error: googleAuthErrorMessage(fromHash.error),
    preferredCompanyId,
    fromGoogle: Boolean(fromHash.token),
  }
  return googleAuthBoot
}

export default function App() {
  const { backendDown, retryApiProbe } = useNavigation()
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
  const [theme, setTheme] = useState<'dark' | 'light'>(readStoredTheme)

  const [user, setUser] = useState<AuthUser | null>(null)
  const [authError, setAuthError] = useState<string | null>(
    () => readGoogleAuthBoot().error,
  )
  const [companyPickFromLogin, setCompanyPickFromLogin] = useState(false)
  const [authInitializing, setAuthInitializing] = useState<boolean>(() =>
    readGoogleAuthBoot().hasToken,
  )
  const [, setPublicRouteTick] = useState(0)

  const isMobileNav = useMatchMedia('(max-width: 720px)')
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [trialPaywallOpen, setTrialPaywallOpen] = useState(false)
  const [trialPaywallUsage, setTrialPaywallUsage] = useState<CompanyUsage | null>(null)

  useEffect(() => {
    if (!user) return
    rememberSignedInName(user.name)
    const first = firstName(user.name)
    const company = displayCompanyName(user.companyName)
    document.title = first
      ? `${first} · ${company || BRAND_NAME}`
      : company || BRAND_NAME
  }, [user])

  useEffect(() => {
    if (!user) return
    if (!canAccessView(user, view)) {
      setView('home')
    }
  }, [user, view])

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



  useEffect(() => {
    function onLimit(ev: Event) {
      const detail = (ev as CustomEvent<{ usage?: CompanyUsage }>).detail
      if (detail?.usage) setTrialPaywallUsage(detail.usage)
      setTrialPaywallOpen(true)
      void fetchMe(baseUrl)
        .then((u) => setUser(u))
        .catch(() => undefined)
    }
    window.addEventListener('vos:trial-limit', onLimit)
    return () => window.removeEventListener('vos:trial-limit', onLimit)
  }, [baseUrl])

  useEffect(() => {
    if (!user) return
    document.documentElement.dataset.theme = theme
    setThemeColor(themeColorForScheme(theme))
    persistTheme(theme)
  }, [theme, user])

  useEffect(() => {
    if (isHealthClinicCompany(user)) {
      try {
        window.sessionStorage.setItem('vos_portal', 'health')
      } catch {
        /* ignore */
      }
    }
  }, [user])

  useEffect(() => {
    if (isGooglePopupHash()) {
      setAuthInitializing(false)
      return
    }
    if (!getAccessToken()) {
      setAuthInitializing(false)
      return
    }
    let cancelled = false
    setAuthInitializing(true)
    fetchMe(baseUrl)
      .then(async (u) => {
        if (u.isPlatformAdmin) {
          const inCompanyRoute = Boolean(parseCompanyAppHash().companySlug)
          if (inCompanyRoute) return u
          if (!u.platformView) {
            const res = await exitToPlatformAdmin(baseUrl)
            u = res.user
          }
          if (!isPlatformHash()) navigateToPlatform(true)
          return u
        }
        const boot = readGoogleAuthBoot()
        if (!boot.fromGoogle) return u
        return restorePreferredCompany(baseUrl, u, boot.preferredCompanyId)
      })
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
      try {
        if (window.sessionStorage.getItem('vos_portal') === 'health') {
          navigateToHealthLogin()
          return
        }
      } catch {
        /* ignore */
      }
      navigateToLogin()
    }
    const onTenantDenied = (ev: Event) => {
      const detail = (ev as CustomEvent<{ message?: string }>).detail
      const msg = detail?.message?.trim()
      setAuthError(
        msg ||
          'Sin acceso a esta empresa. Vuelva a iniciar sesión o seleccione la empresa desde el panel de administración.',
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
    if (
      isLoginHash() ||
      isHealthLoginHash() ||
      isGooglePopupHash() ||
      isGoogleSignupHash() ||
      isRegisterHash() ||
      isLandingHash() ||
      isAccessRequestHash() ||
      isLegalHash()
    )
      return
    navigateToLanding()
  }, [authInitializing, user])

  useEffect(() => {
    if (!user) return
    if (user.isPlatformAdmin && user.platformView) return
    if (isSelectCompanyHash()) return
    if (userNeedsBusinessSetup(user)) {
      if (!isBusinessSetupHash()) navigateToBusinessSetup(true)
      return
    }
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
    if (isSelectCompanyHash()) return
    if (userNeedsBusinessSetup(user) || isBusinessSetupHash()) return
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

  function completeLogin(u: AuthUser) {
    setAuthError(null)
    if (u.isPlatformAdmin) {
      if (u.platformView) {
        setUser(u)
        navigateToPlatform(true)
        return
      }
      void exitToPlatformAdmin(baseUrl)
        .then((res) => {
          setUser(res.user)
          navigateToPlatform(true)
        })
        .catch(() => {
          setUser(u)
          navigateToPlatform(true)
        })
      return
    }
    setUser(u)
    if (userNeedsCompanyPicker(u)) {
      setCompanyPickFromLogin(true)
      navigateToSelectCompany(true)
      return
    }
    if (userNeedsBusinessSetup(u)) {
      navigateToBusinessSetup(true)
      return
    }
    setView('home')
    navigateAfterLogin(u)
  }

  if (isGooglePopupHash()) {
    return <GoogleAuthPopupView />
  }

  if (authInitializing) {
    return (
      <div className="app-initial-boot" aria-busy="true" aria-label="Cargando VOS-AI">
        <BrandMark size="lg" className="brand-mark--splash" />
      </div>
    )
  }

  if (!user) {
    if (isLandingHash()) {
      return (
        <LandingView
          onLoginClick={() => navigateToLogin(false)}
          onAccessRequestClick={() => navigateToRegister(false)}
          onHealthLoginClick={() => navigateToHealthLogin(false)}
        />
      )
    }
    if (isAccessRequestHash()) {
      return <AccessRequestView baseUrl={baseUrl} />
    }
    if (isRegisterHash()) {
      return <RegisterView baseUrl={baseUrl} onCreated={completeLogin} />
    }
    if (isGoogleSignupHash()) {
      return <GoogleSignupView baseUrl={baseUrl} onCreated={completeLogin} />
    }
    if (isHealthLoginHash()) {
      return (
        <HealthLoginView
          baseUrl={baseUrl}
          initialMessage={authError}
          onLogin={completeLogin}
        />
      )
    }
    if (isLoginHash()) {
      return (
        <LoginView
          baseUrl={baseUrl}
          initialMessage={authError}
          onLogin={completeLogin}
        />
      )
    }
    if (isPrivacyHash()) {
      return <LegalPageView page="privacy" />
    }
    if (isTermsHash()) {
      return <LegalPageView page="terms" />
    }
    navigateToLanding()
    return null
  }

  const trialChrome = (
    <>
      <TrialQuotaBanner
        user={user}
        onUpgrade={() => {
          setTrialPaywallUsage(user.usage ?? null)
          setTrialPaywallOpen(true)
        }}
      />
      {trialPaywallOpen ? (
        <TrialPaywallModal
          user={user}
          usage={trialPaywallUsage ?? user.usage}
          onClose={() => setTrialPaywallOpen(false)}
        />
      ) : null}
    </>
  )

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

  if (userNeedsCompanyPicker(user) && isSelectCompanyHash()) {
    return (
      <CompanySelectView
        baseUrl={baseUrl}
        user={user}
        onSelect={handleSwitchCompany}
        onCancel={
          !companyPickFromLogin && user.companyId?.trim()
            ? () => handleSwitchCompany(user)
            : undefined
        }
        onLogout={() => {
          setAccessToken(null)
          setCompanyId(null)
          setUser(null)
          setAuthError(null)
          navigateToLogin()
        }}
      />
    )
  }

  if (userNeedsBusinessSetup(user)) {
    return (
      <BusinessSetupView
        baseUrl={baseUrl}
        user={user}
        onDone={(u) => {
          setUser(u)
          setAuthError(null)
          setView('home')
          navigateAfterLogin(u)
        }}
        onLogout={() => {
          setAccessToken(null)
          setCompanyId(null)
          setUser(null)
          setAuthError(null)
          navigateToLogin()
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

  function handleSwitchCompany(nextUser: AuthUser) {
    setCompanyPickFromLogin(false)
    setUser(nextUser)
    setAuthError(null)
    setView('home')
    navigateAfterLogin(nextUser)
  }

  if (isHealthClinicCompany(user)) {
    const dentalView: DentalView = isDentalView(view) ? view : 'home'
    return (
      <>
        {trialChrome}
        {user.isPlatformAdmin && !user.platformView ? (
          <div className="platform-admin-return-host platform-admin-return-host--dental">
            <PlatformAdminBar onReturn={() => void returnToPlatformPanel()} />
          </div>
        ) : null}
        <SessionUserContext.Provider value={user}>
          <DentalClinicApp
          user={user}
          baseUrl={baseUrl}
          view={dentalView}
          onNavigate={(v) => setView(v)}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          onLogout={() => {
            setAccessToken(null)
            setCompanyId(null)
            setUser(null)
            setAuthError(null)
            navigateToHealthLogin()
          }}
          inventorySlot={<InventoryManager baseUrl={baseUrl} />}
          analyticsSlot={<FinanceAnalyticsView baseUrl={baseUrl} />}
        />
        </SessionUserContext.Provider>
      </>
    )
  }

  return (
    <SessionUserContext.Provider value={user}>
    <div
      className={`app-shell${isMobileNav ? ' app-shell--mobile-dock' : ' app-shell--desktop-header'}${!isMobileNav && isOdooHomeView(view) ? ' app-shell--odoo-home' : ''}`}
    >
      <a href="#main-content" className="skip-to-main">
        Saltar al contenido
      </a>
      {authError && (
        <div className="app-banner" role="status">
          <span className="banner-warn">Auth: {authError}</span>
        </div>
      )}
      {trialChrome}
      <SessionWelcome user={user} />

      {!isMobileNav ? (
        <DesktopAppHeader
          view={view}
          user={user}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          onNavigate={(v) => {
            setView(v as View)
            if (v === 'recipes') {
              window.history.replaceState({}, '', '#/recipes')
            }
          }}
          onLogout={() => {
            setAccessToken(null)
            setCompanyId(null)
            setUser(null)
            setAuthError(null)
            navigateToLogin()
          }}
          onSwitchCompany={handleSwitchCompany}
          baseUrl={baseUrl}
          onOpenAssistant={PLATFORM_MODE ? () => setAssistantOpen(true) : undefined}
          assistantOpen={assistantOpen}
          canViewFinance={canViewFinance(user)}
          canViewTasks={canViewTasks(user)}
          backendDown={backendDown}
          onRetryApi={retryApiProbe}
          onReturnToPlatform={
            user.isPlatformAdmin && !user.platformView
              ? () => void returnToPlatformPanel()
              : undefined
          }
        />
      ) : null}

      <div className="app-body">
        <main className="app-main" id="main-content" tabIndex={-1}>
          {isMobileNav ? (
            <MobileAppChrome
              view={
                isMobileChromeView(view)
                  ? view
                  : PLATFORM_MODE
                    ? 'home'
                    : 'menu'
              }
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
              onSwitchCompany={handleSwitchCompany}
              baseUrl={baseUrl}
              sheetOpen={mobileSheetOpen}
              onSheetOpenChange={setMobileSheetOpen}
              assistantOpen={assistantOpen}
              onAssistantOpenChange={setAssistantOpen}
              backendDown={backendDown}
              onRetryApi={retryApiProbe}
              onReturnToPlatform={
                user.isPlatformAdmin && !user.platformView
                  ? () => void returnToPlatformPanel()
                  : undefined
              }
            />
          ) : null}
          <div key={view} className="app-view-enter">
          {view === 'menu' && !SALES_FLOOR_ONLY && !PLATFORM_MODE && (
            <NavigationHub
              companyName={user?.companyName}
              onNavigate={(v: HubTargetView) => {
                setView(v)
                if (v === 'recipes') {
                  window.history.replaceState({}, '', '#/recipes')
                }
              }}
            />
          )}
          {PLATFORM_MODE && view === 'home' && (
            <OdooHomeScreen
              companyName={user?.companyName}
              user={user}
              canViewFinance={canViewFinance(user)}
              canViewTasks={canViewTasks(user)}
              baseUrl={baseUrl}
              onOpenApp={(v) => setView(v as View)}
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
              user={user}
              inaugurationDate={inaugurationDateForUser(user)}
              companyName={user.companyName}
            />
          )}
          {PLATFORM_MODE && view === 'cash-close' && (
            <CashCloseManager
              baseUrl={baseUrl}
              companyName={user.companyName}
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
          {!SALES_FLOOR_ONLY && view === 'pos' && <PosApp />}
          {(PLATFORM_MODE || (!SALES_FLOOR_ONLY && !PLATFORM_MODE)) &&
            view === 'purchases' && (
              <PurchaseLotsView
                baseUrl={baseUrl}
                inaugurationDate={inaugurationDateForUser(user)}
              />
            )}
          {PLATFORM_MODE && view === 'staff' && (
            <StaffManager baseUrl={baseUrl} user={user} />
          )}
          {PLATFORM_MODE && view === 'tasks' && canViewTasks(user) && (
            <TasksView baseUrl={baseUrl} user={user} />
          )}
          {PLATFORM_MODE && view === 'projects' && canViewProjects(user) && (
            <ProjectsHistoryView baseUrl={baseUrl} />
          )}
          {PLATFORM_MODE && view === 'analytics' && canViewFinance(user) && (
            <FinanceAnalyticsView baseUrl={baseUrl} />
          )}
          {hasBookingModule(user) && isBookingView(view) && view !== 'home' ? (
            <BookingApp
              user={user}
              baseUrl={baseUrl}
              view={normalizeBookingView(view)}
              onNavigate={(v) => setView(v)}
              embedded
              onHome={() => setView('home')}
              onLogout={() => {
                setAccessToken(null)
                setCompanyId(null)
                setUser(null)
                setAuthError(null)
                navigateToLogin()
              }}
            />
          ) : null}
          {!SALES_FLOOR_ONLY && !PLATFORM_MODE && view === 'costs' && (
            <CostsView baseUrl={baseUrl} />
          )}
          {!SALES_FLOOR_ONLY && !PLATFORM_MODE && view === 'gastos' && (
            <GastosView baseUrl={baseUrl} />
          )}
          {!SALES_FLOOR_ONLY && !PLATFORM_MODE && view === 'explorer' && (
            <TableExplorer baseUrl={baseUrl} />
          )}
          </div>
        </main>

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
    </SessionUserContext.Provider>
  )
}
