import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import {
  deletePlatformAccessRequest,
  deletePlatformUser,
  enterPlatformCompany,
  fetchPlatformAccessRequests,
  fetchPlatformCompanies,
  fetchPlatformCompanyDetail,
  fetchPlatformOverview,
  fetchPlatformUserDetail,
  fetchPlatformUsers,
  patchPlatformAccessRequest,
  patchPlatformCompanyModule,
  patchPlatformCompanyPlan,
  patchPlatformUser,
  type AuthUser,
  type PlatformCompanyDetail,
  type PlatformCompanyRow,
  type PlatformModuleToggle,
  type PlatformOverview,
  type PlatformUserDetail,
  type PlatformUserRow,
  type AccessRequestRow,
} from '../api'
import { BRAND_NAME } from '../lib/brand'
import { companyPlanLabel, type CompanyPlanId } from '../lib/plans'
import { buildCompanyViewHash, type AppView } from '../lib/companyRoutes'
import { navigateToLogin } from '../lib/authRoutes'
import { setAccessToken } from '../api'
import { BrandMark } from './BrandMark'
import { PublicThemeSwitch } from './PublicThemeSwitch'
import { AdminConfirmDialog } from './AdminConfirmDialog'
import { Button } from './ui/button'
import { AppLauncherIcon } from './AppLauncherIcon'
import { usePublicTheme } from '../hooks/usePublicTheme'
import '../public-shell.css'
import { ViewBootSplash } from './DataLoadingSplash'
import '../platform-admin.css'

type Tab = 'overview' | 'companies' | 'users' | 'requests'
type AdminScreen = 'hub' | 'panel'
type RequestFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'

const SUPPORT_NAV_REASON = 'Navegación de soporte desde el menú de la plataforma'

function platformScreenFromHash(): AdminScreen {
  const raw = (window.location.hash ?? '').replace(/^#/, '').split('?')[0] ?? ''
  const parts = raw.split('/').filter(Boolean)
  return parts[0] === 'platform' && parts[1] === 'admin' ? 'panel' : 'hub'
}

function navigatePlatformScreen(screen: AdminScreen, replace = false): void {
  const hash = screen === 'panel' ? '#/platform/admin' : '#/platform'
  if (replace) window.location.replace(hash)
  else window.location.hash = hash
}

type ConfirmAction =
  | { kind: 'delete-user'; userId: string; name: string }
  | { kind: 'toggle-user'; userId: string; name: string; active: boolean }
  | { kind: 'delete-request'; id: string; companyName: string }
  | { kind: 'approve-request'; id: string; companyName: string }
  | { kind: 'reject-request'; id: string; companyName: string }

function requestStatusLabel(status: string): string {
  if (status === 'APPROVED') return 'Aprobada'
  if (status === 'REJECTED') return 'Rechazada'
  return 'Pendiente'
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = n
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${value < 10 && i > 0 ? value.toFixed(1) : Math.round(value)} ${units[i]}`
}

function formatWhen(iso?: string | null): string {
  if (!iso) return 'Sin actividad'
  return new Date(iso).toLocaleString('es-CO')
}

function formatAgo(iso?: string | null): string {
  if (!iso) return 'Nunca'
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return 'Nunca'
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000))
  if (sec < 45) return 'Hace un momento'
  const min = Math.round(sec / 60)
  if (min < 60) return `Hace ${min} min`
  const hours = Math.round(min / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.round(hours / 24)
  if (days < 30) return `Hace ${days} d`
  return new Date(t).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n)
}

function taskKindLabel(kind: PlatformUserDetail['recentTasks'][number]['kind']): string {
  if (kind === 'assigned') return 'Asignada'
  if (kind === 'created_assigned') return 'Creó y tiene asignada'
  return 'Creó'
}

function auditLabel(action: string, tableName: string): string {
  return `${action} · ${tableName}`
}

function companyInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return 'V'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name
}

function isUnlimitedPlan(plan?: string | null): boolean {
  return plan === 'PRO' || plan === 'BUSINESS'
}

function StorageBar({
  used,
  limit,
  unlimited,
}: {
  used: number
  limit: number
  unlimited?: boolean
}) {
  if (unlimited || limit <= 0) {
    return (
      <div className="platform-admin__storage">
        <div className="platform-admin__storage-meta">
          <span>{formatBytes(used)} usados</span>
          <span>Sin tope</span>
        </div>
        <div className="platform-admin__storage-track platform-admin__storage-track--free">
          <span style={{ width: '14%' }} />
        </div>
      </div>
    )
  }
  const pct = Math.min(100, Math.round((used / limit) * 100))
  const left = Math.max(0, limit - used)
  const tone = pct >= 90 ? 'is-full' : pct >= 70 ? 'is-warn' : ''
  return (
    <div className="platform-admin__storage">
      <div className="platform-admin__storage-meta">
        <span>
          {formatBytes(used)} de {formatBytes(limit)}
        </span>
        <span>Quedan {formatBytes(left)}</span>
      </div>
      <div className="platform-admin__storage-track">
        <span className={tone} style={{ width: `${Math.max(pct, 3)}%` }} />
      </div>
    </div>
  )
}

function ModuleToggles({
  modules,
  busy,
  onToggle,
}: {
  modules: PlatformModuleToggle[]
  busy: boolean
  onToggle: (slug: string, enabled: boolean) => void
}) {
  const core = modules.filter((m) => m.core)
  const extra = modules.filter((m) => !m.core)
  return (
    <div className="platform-admin__mods">
      <p className="platform-admin__mods-label">Principales</p>
      <div className="platform-admin__mod-toggles">
        {core.map((m) => (
          <label
            key={m.slug}
            className={`platform-admin__mod-toggle${m.enabled ? ' is-on' : ''}${m.slug === 'booking' ? ' is-booking' : ''}`}
          >
            <input
              type="checkbox"
              checked={m.enabled}
              disabled={busy}
              onChange={() => onToggle(m.slug, !m.enabled)}
            />
            {m.name}
          </label>
        ))}
      </div>
      {extra.length ? (
        <>
          <p className="platform-admin__mods-label">Más módulos</p>
          <div className="platform-admin__mod-toggles">
            {extra.map((m) => (
              <label key={m.slug} className={`platform-admin__mod-toggle${m.enabled ? ' is-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={m.enabled}
                  disabled={busy}
                  onChange={() => onToggle(m.slug, !m.enabled)}
                />
                {m.name}
              </label>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

const EXTRA_MODULE_VIEWS: Array<{ view: AppView; label: string; hint: string }> = [
  { view: 'home', label: 'Inicio', hint: 'Panel del negocio' },
  { view: 'pos', label: 'Punto de venta', hint: 'Cobrar y comandas' },
  { view: 'shop', label: 'Tienda online', hint: 'Pedidos web' },
  { view: 'cash-close', label: 'Cierre de caja', hint: 'Totales del día' },
  { view: 'analytics', label: 'Finanzas', hint: 'Ventas y utilidad' },
  { view: 'settings', label: 'Ajustes', hint: 'Configuración' },
]

const MODULE_VIEW: Record<string, AppView> = {
  products: 'products',
  inventory: 'inventory',
  sales: 'sales',
  purchases: 'purchases',
  staff: 'staff',
  finance: 'analytics',
  booking: 'booking',
  tasks: 'tasks',
  projects: 'projects',
}

/** Accesos rápidos organizados para operar una empresa desde el admin. */
const COMPANY_QUICK_LINKS: Array<{
  view: AppView
  label: string
  hint: string
  group: 'operar' | 'gestionar' | 'control'
}> = [
  { view: 'home', label: 'Inicio', hint: 'Panel del negocio', group: 'operar' },
  { view: 'pos', label: 'Punto de venta', hint: 'Cobrar y comandas', group: 'operar' },
  { view: 'sales', label: 'Ventas', hint: 'Historial de ventas', group: 'operar' },
  { view: 'shop', label: 'Tienda', hint: 'Pedidos web', group: 'operar' },
  { view: 'products', label: 'Productos', hint: 'Catálogo', group: 'gestionar' },
  { view: 'inventory', label: 'Inventario', hint: 'Existencias', group: 'gestionar' },
  { view: 'purchases', label: 'Compras', hint: 'Lotes y proveedores', group: 'gestionar' },
  { view: 'staff', label: 'Personal', hint: 'Equipo', group: 'gestionar' },
  { view: 'booking', label: 'Agenda', hint: 'Citas y horarios', group: 'gestionar' },
  { view: 'analytics', label: 'Finanzas', hint: 'Ventas y utilidad', group: 'control' },
  { view: 'cash-close', label: 'Cierre de caja', hint: 'Totales del día', group: 'control' },
  { view: 'tasks', label: 'Tareas', hint: 'Pendientes', group: 'control' },
  { view: 'settings', label: 'Ajustes', hint: 'Configuración', group: 'control' },
]

type Props = {
  baseUrl: string
  user: AuthUser
  onEnterCompany: (user: AuthUser, view: AppView) => void
  onLogout: () => void
}

export function PlatformAdminView({ baseUrl, user, onEnterCompany, onLogout }: Props) {
  const [screen, setScreen] = useState<AdminScreen>(() => platformScreenFromHash())
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<PlatformOverview | null>(null)
  const [companies, setCompanies] = useState<PlatformCompanyRow[]>([])
  const [users, setUsers] = useState<PlatformUserRow[]>([])
  const [requests, setRequests] = useState<AccessRequestRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<PlatformCompanyDetail | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [userDetail, setUserDetail] = useState<PlatformUserDetail | null>(null)
  const [userBusy, setUserBusy] = useState(false)
  const [moduleBusy, setModuleBusy] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [entering, setEntering] = useState(false)
  const [userQuery, setUserQuery] = useState('')
  const [planBusyId, setPlanBusyId] = useState<string | null>(null)
  const [mobileDetail, setMobileDetail] = useState(false)
  const [focusCompanyId, setFocusCompanyId] = useState<string | null>(null)
  const [requestFilter, setRequestFilter] = useState<RequestFilter>('PENDING')
  const [requestBusyId, setRequestBusyId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [companyQuery, setCompanyQuery] = useState('')
  const [companyScope, setCompanyScope] = useState<'all' | 'mine' | 'other'>('all')
  const [exitMenuOpen, setExitMenuOpen] = useState(false)
  const { theme, toggleTheme } = usePublicTheme()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ov, co, us, req] = await Promise.all([
        fetchPlatformOverview(baseUrl),
        fetchPlatformCompanies(baseUrl),
        fetchPlatformUsers(baseUrl),
        fetchPlatformAccessRequests(baseUrl),
      ])
      setOverview(ov)
      setCompanies(co)
      setUsers(us)
      setRequests(req)
      const mine = new Set((user.companies ?? []).map((c) => c.id))
      const firstMine = co.find((c) => mine.has(c.id))?.id ?? co[0]?.id ?? null
      setSelectedId((prev) => prev ?? firstMine)
      setSelectedUserId((prev) => prev ?? us[0]?.id ?? null)
      setFocusCompanyId((prev) => prev ?? firstMine)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el panel')
    } finally {
      setLoading(false)
    }
  }, [baseUrl, user.companies])

  useEffect(() => {
    document.title =
      screen === 'hub' ? `Menú · ${BRAND_NAME}` : `Admin · ${BRAND_NAME}`
    void load()
  }, [load, screen])

  useEffect(() => {
    const onHash = () => setScreen(platformScreenFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  function openAdminPanel() {
    setScreen('panel')
    navigatePlatformScreen('panel')
  }

  function openMainMenu() {
    setScreen('hub')
    setExitMenuOpen(false)
    navigatePlatformScreen('hub')
  }

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    let cancelled = false
    fetchPlatformCompanyDetail(baseUrl, selectedId)
      .then((d) => {
        if (!cancelled) setDetail(d)
      })
      .catch(() => {
        if (!cancelled) setDetail(null)
      })
    return () => {
      cancelled = true
    }
  }, [baseUrl, selectedId])

  useEffect(() => {
    if (!selectedUserId) {
      setUserDetail(null)
      return
    }
    let cancelled = false
    fetchPlatformUserDetail(baseUrl, selectedUserId)
      .then((d) => {
        if (!cancelled) {
          setUserDetail(d)
          setEditName(d.name)
          setEditEmail(d.email)
        }
      })
      .catch(() => {
        if (!cancelled) setUserDetail(null)
      })
    return () => {
      cancelled = true
    }
  }, [baseUrl, selectedUserId])

  async function enterCompany(companyId: string, view: AppView) {
    const company =
      companies.find((c) => c.id === companyId) ??
      (detail && detail.id === companyId ? detail : null)
    if (!company || entering) return
    setEntering(true)
    setExitMenuOpen(false)
    setError(null)
    try {
      const res = await enterPlatformCompany(baseUrl, companyId, SUPPORT_NAV_REASON)
      onEnterCompany(res.user, view)
      window.location.hash = buildCompanyViewHash(company.slug, view)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir la empresa')
    } finally {
      setEntering(false)
    }
  }

  async function openModule(view: AppView) {
    if (!detail) return
    await enterCompany(detail.id, view)
  }

  async function setCompanyPlan(companyId: string, plan: CompanyPlanId) {
    setPlanBusyId(companyId)
    setError(null)
    try {
      await patchPlatformCompanyPlan(baseUrl, companyId, plan)
      setCompanies((prev) =>
        prev.map((c) => (c.id === companyId ? { ...c, plan } : c)),
      )
      setUsers((prev) =>
        prev.map((u) => ({
          ...u,
          companies: u.companies.map((c) => (c.id === companyId ? { ...c, plan } : c)),
        })),
      )
      setOverview((ov) =>
        ov
          ? {
              ...ov,
              companyStats: ov.companyStats?.map((c) =>
                c.id === companyId ? { ...c, plan } : c,
              ),
            }
          : ov,
      )
      setDetail((d) => (d && d.id === companyId ? { ...d, plan } : d))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el plan')
    } finally {
      setPlanBusyId(null)
    }
  }

  async function saveUser() {
    if (!userDetail) return
    setUserBusy(true)
    setError(null)
    try {
      const updated = await patchPlatformUser(baseUrl, userDetail.id, {
        name: editName.trim(),
        email: editEmail.trim().toLowerCase(),
      })
      setUserDetail(updated)
      setEditName(updated.name)
      setEditEmail(updated.email)
      setUsers((prev) =>
        prev.map((u) =>
          u.id === updated.id
            ? {
                ...u,
                name: updated.name,
                email: updated.email,
                active: updated.active,
              }
            : u,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el usuario')
    } finally {
      setUserBusy(false)
    }
  }

  async function setUserActive(userId: string, active: boolean) {
    const row = users.find((u) => u.id === userId)
    setConfirm({
      kind: 'toggle-user',
      userId,
      name: row?.name ?? 'esta cuenta',
      active,
    })
  }

  async function removeUser(userId: string) {
    const row = users.find((u) => u.id === userId) ?? (userDetail?.id === userId ? userDetail : null)
    setConfirm({
      kind: 'delete-user',
      userId,
      name: row?.name ?? 'esta cuenta',
    })
  }

  async function runConfirm() {
    if (!confirm || confirmBusy) return
    const action = confirm
    setConfirmBusy(true)
    setError(null)
    try {
      if (action.kind === 'delete-user') {
        setUserBusy(true)
        await deletePlatformUser(baseUrl, action.userId)
        setUsers((prev) => prev.filter((u) => u.id !== action.userId))
        setSelectedUserId((prev) => (prev === action.userId ? null : prev))
        setUserDetail(null)
        setMobileDetail(false)
      } else if (action.kind === 'toggle-user') {
        setUserBusy(true)
        const updated = await patchPlatformUser(baseUrl, action.userId, {
          active: action.active,
        })
        setUserDetail(updated)
        setUsers((prev) =>
          prev.map((u) =>
            u.id === action.userId
              ? {
                  ...u,
                  active: updated.active,
                  lastLoginAt: updated.lastLoginAt,
                  lastActivityAt: updated.lastActivityAt,
                  storageUsedBytes: updated.storageUsedBytes,
                }
              : u,
          ),
        )
      } else if (action.kind === 'delete-request') {
        setRequestBusyId(action.id)
        const prevStatus = requests.find((r) => r.id === action.id)?.status
        await deletePlatformAccessRequest(baseUrl, action.id)
        setRequests((prev) => prev.filter((r) => r.id !== action.id))
        setOverview((ov) =>
          ov
            ? {
                ...ov,
                pendingRequests: Math.max(
                  0,
                  ov.pendingRequests - (prevStatus === 'PENDING' ? 1 : 0),
                ),
                recentRequests: ov.recentRequests.filter((r) => r.id !== action.id),
              }
            : ov,
        )
      } else if (action.kind === 'approve-request' || action.kind === 'reject-request') {
        setRequestBusyId(action.id)
        const status = action.kind === 'approve-request' ? 'APPROVED' : 'REJECTED'
        const prevStatus = requests.find((r) => r.id === action.id)?.status
        const updated = await patchPlatformAccessRequest(baseUrl, action.id, status)
        setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
        setOverview((ov) => {
          if (!ov) return ov
          return {
            ...ov,
            pendingRequests: Math.max(
              0,
              ov.pendingRequests - (prevStatus === 'PENDING' ? 1 : 0),
            ),
            recentRequests: ov.recentRequests
              .map((r) =>
                r.id === updated.id ? { ...r, status: updated.status } : r,
              )
              .filter((r) => r.status === 'PENDING'),
          }
        })
      }
      setConfirm(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo completar la acción',
      )
    } finally {
      setConfirmBusy(false)
      setUserBusy(false)
      setRequestBusyId(null)
    }
  }

  async function toggleCompanyModule(companyId: string, slug: string, enabled: boolean) {
    setModuleBusy(true)
    setError(null)
    try {
      const res = await patchPlatformCompanyModule(baseUrl, companyId, slug, enabled)
      setUserDetail((prev) =>
        prev
          ? {
              ...prev,
              companies: prev.companies.map((c) =>
                c.id === companyId ? { ...c, modules: res.modules } : c,
              ),
            }
          : prev,
      )
      setDetail((d) =>
        d && d.id === companyId
          ? {
              ...d,
              allModules: res.modules,
              modules: res.modules.filter((m) => m.enabled).map((m) => ({ slug: m.slug, name: m.name })),
            }
          : d,
      )
      setCompanies((prev) =>
        prev.map((c) =>
          c.id === companyId
            ? {
                ...c,
                modules: res.modules
                  .filter((m) => m.enabled)
                  .map((m) => ({ slug: m.slug, name: m.name })),
              }
            : c,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el módulo')
    } finally {
      setModuleBusy(false)
    }
  }

  const filteredUsers = users.filter((u) => {
    const q = userQuery.trim().toLowerCase()
    if (!q) return true
    const hay = [
      u.name,
      u.email,
      u.isPlatformAdmin ? 'admin plataforma' : '',
      ...u.companies.map((c) => `${c.name} ${c.slug} ${c.plan ?? ''}`),
    ]
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
  const listedUsers = [...filteredUsers].sort((a, b) => {
    const ta = a.lastLoginAt ? Date.parse(a.lastLoginAt) : 0
    const tb = b.lastLoginAt ? Date.parse(b.lastLoginAt) : 0
    return tb - ta
  })
  const filteredRequests = requests.filter((r) =>
    requestFilter === 'ALL' ? true : r.status === requestFilter,
  )
  const pendingRequestCount = requests.filter((r) => r.status === 'PENDING').length

  function openTab(id: Tab) {
    setTab(id)
    setMobileDetail(false)
  }

  function openCompany(id: string) {
    setSelectedId(id)
    setMobileDetail(true)
  }

  function openUser(id: string) {
    setSelectedUserId(id)
    setTab('users')
    setMobileDetail(true)
  }

  function focusCompany(id: string) {
    setFocusCompanyId(id)
    setSelectedId(id)
  }

  const membershipIds = new Set((user.companies ?? []).map((c) => c.id))
  const myCompanies = companies.filter((c) => membershipIds.has(c.id))
  const otherCompanies = companies.filter((c) => !membershipIds.has(c.id))
  const focused =
    companies.find((c) => c.id === focusCompanyId) ??
    myCompanies[0] ??
    companies[0] ??
    null
  const focusedStats =
    overview?.companyStats?.find((c) => c.id === focused?.id) ?? null
  const totals = overview?.totals ?? {
    salesCount: companies.reduce((n, c) => n + (c.salesCount ?? 0), 0),
    salesTotal: overview?.companyStats?.reduce((n, c) => n + (c.salesTotal ?? 0), 0) ?? 0,
    productsCount: companies.reduce((n, c) => n + (c.productsCount ?? 0), 0),
    inventoryCount: overview?.companyStats?.reduce((n, c) => n + (c.inventoryCount ?? 0), 0) ?? 0,
  }
  const recentLogins = [...users]
    .filter((u) => !u.isPlatformAdmin)
    .sort((a, b) => {
      const ta = a.lastLoginAt ? Date.parse(a.lastLoginAt) : 0
      const tb = b.lastLoginAt ? Date.parse(b.lastLoginAt) : 0
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
    })
    .slice(0, 6)

  const companyQueryNorm = companyQuery.trim().toLowerCase()
  const listedCompanies = companies.filter((c) => {
    if (companyScope === 'mine' && !membershipIds.has(c.id) && myCompanies.length > 0) {
      return false
    }
    if (companyScope === 'other' && membershipIds.has(c.id)) return false
    if (!companyQueryNorm) return true
    const hay = `${c.name} ${c.slug} ${c.shopSlug ?? ''} ${c.email ?? ''} ${c.plan ?? ''}`.toLowerCase()
    return hay.includes(companyQueryNorm)
  })

  const exitTargets = myCompanies.length ? myCompanies : companies
  const hubCompanies = myCompanies.length ? myCompanies : companies

  /** Sale del panel admin e entra a operar una empresa. */
  async function leaveAdminToCompany(companyId?: string) {
    if (!exitTargets.length) {
      setError('No hay empresas disponibles para entrar.')
      return
    }
    if (companyId) {
      await enterCompany(companyId, 'home')
      return
    }
    if (exitTargets.length === 1) {
      await enterCompany(exitTargets[0].id, 'home')
      return
    }
    setExitMenuOpen((open) => !open)
  }

  function handleLogout() {
    setAccessToken(null)
    onLogout()
    navigateToLogin()
  }

  function railCards(list: PlatformCompanyRow[]) {
    return list.map((c) => {
      const stats = overview?.companyStats?.find((s) => s.id === c.id)
      const active = focused?.id === c.id
      const isMine = membershipIds.has(c.id)
      return (
        <div
          key={c.id}
          role="listitem"
          className={`platform-admin__rail-card${active ? ' is-active' : ''}`}
        >
          <button
            type="button"
            className="platform-admin__rail-card-main"
            onClick={() => focusCompany(c.id)}
          >
            <span className="platform-admin__avatar" aria-hidden>
              {companyInitials(c.name)}
            </span>
            <strong>{c.name}</strong>
            <span>
              {companyPlanLabel(c.plan)}
              {isMine ? ' · Suya' : ''}
              {c.status && c.status !== 'ACTIVE' ? ` · ${c.status}` : ''}
            </span>
            <small>
              {c.salesCount} ventas · {stats?.membersCount ?? c.membersCount} personas
              {stats?.salesTotal != null ? ` · ${formatMoney(stats.salesTotal)}` : ''}
            </small>
          </button>
          <div className="platform-admin__rail-card-actions">
            <button
              type="button"
              className="platform-admin__rail-enter"
              disabled={entering}
              onClick={() => void enterCompany(c.id, 'home')}
            >
              Entrar
            </button>
            <button
              type="button"
              className="platform-admin__rail-enter platform-admin__rail-enter--ghost"
              disabled={entering}
              onClick={() => {
                setSelectedId(c.id)
                setTab('companies')
                setMobileDetail(true)
              }}
            >
              Gestionar
            </button>
          </div>
        </div>
      )
    })
  }

  return (
    <div className={`platform-admin${screen === 'hub' ? ' platform-admin--hub' : ''}`}>
      {screen === 'hub' ? (
        <>
          <div className="platform-admin__chrome">
            <div className="platform-admin__chrome-inner">
              <header className="platform-admin__topbar">
                <BrandMark size="sm" />
                <div className="platform-admin__topbar-meta">
                  <span className="platform-admin__badge">Menú</span>
                  <span className="platform-admin__who">{firstNameOf(user.name)}</span>
                </div>
                <div className="platform-admin__topbar-actions">
                  <PublicThemeSwitch theme={theme} onToggle={toggleTheme} compact />
                  <Button type="button" variant="secondary" size="sm" onClick={handleLogout}>
                    Cerrar sesión
                  </Button>
                </div>
              </header>
            </div>
          </div>

          {error ? (
            <div className="platform-admin__error" role="alert">
              {error}
            </div>
          ) : null}

          {loading ? (
            <p className="platform-admin__loading">Cargando menú…</p>
          ) : (
            <div className="platform-admin__body platform-admin__body--hub">
              <div className="odoo-home platform-hub">
                <header className="odoo-home__hero">
                  <p className="odoo-home__brand muted small">{BRAND_NAME}</p>
                  <h1 className="odoo-home__title">Hola, {firstNameOf(user.name)}</h1>
                  <p className="odoo-home__lead muted">
                    Entrá a una empresa o abrí el panel para gestionar la plataforma.
                  </p>
                </header>

                <ul className="platform-hub__list">
                  {hubCompanies.map((c, index) => (
                    <li
                      key={c.id}
                      className="platform-hub__item"
                      style={{ '--launcher-i': index } as CSSProperties}
                    >
                      <button
                        type="button"
                        className="platform-hub__card"
                        disabled={entering}
                        onClick={() => void enterCompany(c.id, 'home')}
                      >
                        <span className="platform-hub__mark" aria-hidden>
                          {companyInitials(c.name)}
                        </span>
                        <span className="platform-hub__copy">
                          <strong>{c.name}</strong>
                          <span>
                            {c.membersCount} personas · {c.salesCount} ventas
                          </span>
                        </span>
                        <span
                          className={`platform-hub__plan${
                            c.plan === 'PRO' || c.plan === 'BUSINESS' ? ' is-paid' : ' is-trial'
                          }`}
                        >
                          {companyPlanLabel(c.plan)}
                        </span>
                        <span className="platform-hub__go" aria-hidden>
                          →
                        </span>
                      </button>
                    </li>
                  ))}
                  <li
                    className="platform-hub__item"
                    style={{ '--launcher-i': hubCompanies.length } as CSSProperties}
                  >
                    <button
                      type="button"
                      className="platform-hub__card platform-hub__card--admin"
                      onClick={openAdminPanel}
                    >
                      <span className="platform-hub__mark" aria-hidden>
                        <AppLauncherIcon view="settings" />
                      </span>
                      <span className="platform-hub__copy">
                        <strong>Panel admin</strong>
                        <span>Empresas, cuentas y solicitudes</span>
                      </span>
                      <span className="platform-hub__go" aria-hidden>
                        →
                      </span>
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
      <div className="platform-admin__chrome">
        <div className="platform-admin__chrome-inner">
          <header className="platform-admin__topbar">
            <BrandMark size="sm" />
            <div className="platform-admin__topbar-meta">
              <span className="platform-admin__badge">Admin</span>
              <span className="platform-admin__who">{firstNameOf(user.name)}</span>
            </div>
            <div className="platform-admin__topbar-actions">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={openMainMenu}
              >
                Menú principal
              </Button>
              <div className="platform-admin__exit-wrap">
                <Button
                  type="button"
                  size="sm"
                  disabled={entering || exitTargets.length === 0}
                  onClick={() => void leaveAdminToCompany()}
                  aria-expanded={exitMenuOpen}
                  aria-haspopup="menu"
                >
                  {entering
                    ? 'Entrando…'
                    : exitTargets.length <= 1
                      ? 'Ir a mi empresa'
                      : 'Ir a una empresa'}
                </Button>
                {exitMenuOpen && exitTargets.length > 1 ? (
                  <div className="platform-admin__exit-menu" role="menu">
                    <p className="platform-admin__exit-menu-title">Entrar a una empresa</p>
                    {exitTargets.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        role="menuitem"
                        className="platform-admin__exit-menu-item"
                        disabled={entering}
                        onClick={() => void leaveAdminToCompany(c.id)}
                      >
                        <strong>{c.name}</strong>
                        <span>/{c.slug}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      className="platform-admin__exit-menu-cancel"
                      onClick={() => setExitMenuOpen(false)}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : null}
              </div>
              <PublicThemeSwitch theme={theme} onToggle={toggleTheme} compact />
              <Button type="button" variant="secondary" size="sm" onClick={handleLogout}>
                Cerrar sesión
              </Button>
            </div>
          </header>

          <nav className="platform-admin__tabs" aria-label="Secciones del panel">
            {(
              [
                ['overview', 'Panorama'],
                ['companies', 'Empresas'],
                ['users', 'Cuentas'],
                ['requests', 'Solicitudes'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`platform-admin__tab${tab === id ? ' platform-admin__tab--active' : ''}`}
                onClick={() => openTab(id)}
              >
                {label}
                {id === 'users' ? ` (${users.length})` : ''}
                {id === 'requests' && pendingRequestCount
                  ? ` (${pendingRequestCount})`
                  : ''}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {error ? (
        <div className="platform-admin__error" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="platform-admin__loading">Cargando panel…</p>
      ) : (
        <div className="platform-admin__body">
          {tab === 'overview' && overview ? (
            <section className="platform-admin__panel platform-admin__panorama">
              <div className="platform-admin__panorama-head">
                <header className="platform-admin__hero">
                  <p className="platform-admin__kicker">Panel de plataforma</p>
                  <h1>Hola, {firstNameOf(user.name)}</h1>
                  <p className="platform-admin__hero-copy">
                    Aquí tiene el control de todos sus negocios. Para operar el día a día, use{' '}
                    <strong>Salir del panel admin</strong> e entre a una de sus empresas. Desde cada
                    tarjeta también puede <strong>Entrar</strong> o <strong>Gestionar</strong> módulos.
                  </p>
                  {exitTargets.length > 0 ? (
                    <div className="platform-admin__hero-actions">
                      <Button
                        type="button"
                        disabled={entering}
                        onClick={() => void leaveAdminToCompany()}
                      >
                        {exitTargets.length === 1
                          ? `Entrar a ${exitTargets[0].name}`
                          : 'Salir del panel e ir a una empresa'}
                      </Button>
                    </div>
                  ) : null}
                </header>

                <div className="platform-admin__stats platform-admin__stats--wide">
                  <article className="platform-admin__stat">
                    <span>Negocios</span>
                    <strong>{overview.companiesCount}</strong>
                    <small>{overview.activeCompanies} activos</small>
                  </article>
                  <article className="platform-admin__stat">
                    <span>Cuentas</span>
                    <strong>{overview.usersCount}</strong>
                    <small>
                      {overview.pendingRequests
                        ? `${overview.pendingRequests} solicitudes`
                        : 'Sin pendientes'}
                    </small>
                  </article>
                  <article className="platform-admin__stat">
                    <span>Ventas en la app</span>
                    <strong>{totals.salesCount}</strong>
                    <small>{formatMoney(totals.salesTotal)}</small>
                  </article>
                  <article className="platform-admin__stat">
                    <span>Catálogo</span>
                    <strong>{totals.productsCount}</strong>
                    <small>{totals.inventoryCount} en inventario</small>
                  </article>
                </div>
              </div>

              <div className="platform-admin__panorama-main">
                <div className="platform-admin__panorama-primary">
                  <h2>Sus empresas</h2>
                  <p className="platform-admin__hint">
                    Elija un negocio para ver el panorama. Desde cada tarjeta puede entrar al panel o
                    abrir la gestión completa.
                  </p>
                  <div className="platform-admin__rail" role="list">
                    {railCards(myCompanies.length ? myCompanies : companies)}
                  </div>
                  {myCompanies.length > 0 && otherCompanies.length > 0 ? (
                    <>
                      <h2>Otras cuentas de la plataforma</h2>
                      <p className="platform-admin__hint">
                        Negocios donde usted no es miembro, pero puede entrar como administrador.
                      </p>
                      <div className="platform-admin__rail" role="list">
                        {railCards(otherCompanies)}
                      </div>
                    </>
                  ) : null}

                  {focused ? (
                    <article className="platform-admin__focus">
                      <header>
                        <div>
                          <span
                            className="platform-admin__avatar platform-admin__avatar--lg"
                            aria-hidden
                          >
                            {companyInitials(focused.name)}
                          </span>
                          <div>
                            <p className="platform-admin__kicker">Negocio en foco</p>
                            <h2>{focused.name}</h2>
                            <p>
                              {companyPlanLabel(focused.plan)} · {focused.membersCount} usuarios · /
                              {focused.slug}
                              {focusedStats?.lastSaleAt
                                ? ` · Última venta ${formatAgo(focusedStats.lastSaleAt)}`
                                : ' · Sin ventas aún'}
                            </p>
                          </div>
                        </div>
                        <div className="platform-admin__focus-actions">
                          <Button
                            type="button"
                            disabled={entering}
                            onClick={() => void enterCompany(focused.id, 'home')}
                          >
                            Entrar al negocio
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={entering}
                            onClick={() => void enterCompany(focused.id, 'pos')}
                          >
                            Punto de venta
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              setSelectedId(focused.id)
                              setTab('companies')
                              setMobileDetail(true)
                            }}
                          >
                            Control completo
                          </Button>
                        </div>
                      </header>

                      <div className="platform-admin__focus-grid">
                        <div>
                          <strong>{focusedStats?.salesCount ?? focused.salesCount}</strong>
                          <span>Ventas</span>
                          <small>{formatMoney(focusedStats?.salesTotal ?? 0)}</small>
                        </div>
                        <div>
                          <strong>{focused.productsCount}</strong>
                          <span>Productos</span>
                        </div>
                        <div>
                          <strong>{focusedStats?.inventoryCount ?? 0}</strong>
                          <span>Inventario</span>
                        </div>
                        <div>
                          <strong>{focused.shopOrdersCount}</strong>
                          <span>Pedidos web</span>
                        </div>
                      </div>

                      {(focusedStats?.moduleNames ?? focused.modules.map((m) => m.name)).length ? (
                        <p className="platform-admin__chips">
                          {(
                            focusedStats?.moduleNames ?? focused.modules.map((m) => m.name)
                          ).map((name) => (
                            <span key={name}>{name}</span>
                          ))}
                        </p>
                      ) : (
                        <p className="platform-admin__hint">Sin módulos activos.</p>
                      )}

                      <p className="platform-admin__section-label">Acceso rápido</p>
                      <div className="platform-admin__jump">
                        {COMPANY_QUICK_LINKS.filter((l) => l.group === 'operar').map((link) => (
                          <button
                            key={link.view}
                            type="button"
                            className="platform-admin__jump-btn"
                            disabled={entering}
                            onClick={() => void enterCompany(focused.id, link.view)}
                          >
                            {link.label}
                          </button>
                        ))}
                        {COMPANY_QUICK_LINKS.filter((l) => l.group === 'control')
                          .slice(0, 3)
                          .map((link) => (
                            <button
                              key={link.view}
                              type="button"
                              className="platform-admin__jump-btn"
                              disabled={entering}
                              onClick={() => void enterCompany(focused.id, link.view)}
                            >
                              {link.label}
                            </button>
                          ))}
                      </div>
                    </article>
                  ) : null}
                </div>

                <aside className="platform-admin__panorama-side">
                  <section className="platform-admin__side-card">
                    <h2>Quién entró</h2>
                    <ul className="platform-admin__people">
                      {recentLogins.length === 0 ? (
                        <li className="platform-admin__hint">Todavía no hay accesos.</li>
                      ) : (
                        recentLogins.map((u) => (
                          <li key={u.id}>
                            <button type="button" onClick={() => openUser(u.id)}>
                              <span className="platform-admin__avatar" aria-hidden>
                                {companyInitials(u.name)}
                              </span>
                              <span>
                                <strong>{u.name}</strong>
                                <small>
                                  {formatAgo(u.lastLoginAt)}
                                  {u.companies[0] ? ` · ${u.companies[0].name}` : ''}
                                </small>
                              </span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  </section>

                  <section className="platform-admin__side-card">
                    <h2>Solicitudes</h2>
                    {overview.recentRequests.length === 0 ? (
                      <p className="platform-admin__hint">No hay solicitudes pendientes.</p>
                    ) : (
                      <ul className="platform-admin__people">
                        {overview.recentRequests.map((r) => (
                          <li key={r.id}>
                            <button type="button" onClick={() => openTab('requests')}>
                              <span className="platform-admin__avatar" aria-hidden>
                                {companyInitials(r.companyName)}
                              </span>
                              <span>
                                <strong>{r.companyName}</strong>
                                <small>
                                  {r.contactName} · {formatAgo(r.createdAt)}
                                </small>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </aside>
              </div>
            </section>
          ) : null}

          {tab === 'companies' ? (
            <section className={`platform-admin__split${mobileDetail ? ' is-detail' : ''}`}>
              <div className="platform-admin__list">
                <h1>Empresas</h1>
                <p className="platform-admin__hint">
                  {companies.length} negocio{companies.length === 1 ? '' : 's'} en la plataforma.
                  Busque, filtre y entre a operar o gestionar cada uno.
                </p>
                <label className="platform-admin__search">
                  <span className="sr-only">Buscar empresas</span>
                  <input
                    type="search"
                    value={companyQuery}
                    onChange={(e) => setCompanyQuery(e.target.value)}
                    placeholder="Buscar por nombre, slug o plan…"
                    enterKeyHint="search"
                  />
                </label>
                <div className="platform-admin__scope" role="group" aria-label="Filtrar empresas">
                  {(
                    [
                      ['all', 'Todas'],
                      ['mine', 'Mías'],
                      ['other', 'Otras'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`platform-admin__scope-btn${companyScope === id ? ' is-active' : ''}`}
                      onClick={() => setCompanyScope(id)}
                    >
                      {label}
                      {id === 'mine' ? ` (${myCompanies.length || companies.length})` : ''}
                      {id === 'other' ? ` (${otherCompanies.length})` : ''}
                      {id === 'all' ? ` (${companies.length})` : ''}
                    </button>
                  ))}
                </div>
                <ul className="platform-admin__company-list">
                  {listedCompanies.length === 0 ? (
                    <li className="platform-admin__hint">No hay empresas con ese criterio.</li>
                  ) : (
                    listedCompanies.map((c) => {
                      const stats = overview?.companyStats?.find((s) => s.id === c.id)
                      const isMine = membershipIds.has(c.id)
                      return (
                        <li key={c.id} className="platform-admin__company-row">
                          <button
                            type="button"
                            className={`platform-admin__company-btn${
                              selectedId === c.id ? ' platform-admin__company-btn--active' : ''
                            }`}
                            onClick={() => openCompany(c.id)}
                          >
                            <span className="platform-admin__account-head">
                              <strong>{c.name}</strong>
                              <span
                                className={`platform-admin__pill${
                                  c.status === 'ACTIVE' || !c.status ? ' is-on' : ' is-off'
                                }`}
                              >
                                {c.status === 'ACTIVE' || !c.status ? 'Activa' : c.status}
                              </span>
                            </span>
                            <span>
                              /{c.slug} · {companyPlanLabel(c.plan)}
                              {isMine ? ' · Suya' : ''}
                            </span>
                            <small>
                              {c.productsCount} prod · {c.salesCount} ventas ·{' '}
                              {stats?.membersCount ?? c.membersCount} usuarios
                              {stats?.salesTotal != null ? ` · ${formatMoney(stats.salesTotal)}` : ''}
                            </small>
                          </button>
                          <div className="platform-admin__company-row-actions">
                            <button
                              type="button"
                              className="platform-admin__rail-enter"
                              disabled={entering}
                              onClick={() => void enterCompany(c.id, 'home')}
                            >
                              Entrar
                            </button>
                            <button
                              type="button"
                              className="platform-admin__rail-enter platform-admin__rail-enter--ghost"
                              disabled={entering}
                              onClick={() => void enterCompany(c.id, 'pos')}
                            >
                              POS
                            </button>
                          </div>
                        </li>
                      )
                    })
                  )}
                </ul>
              </div>

              <div className="platform-admin__detail">
                {detail ? (
                  <>
                    <header className="platform-admin__detail-head">
                      <div>
                        <button
                          type="button"
                          className="platform-admin__back"
                          onClick={() => setMobileDetail(false)}
                        >
                          ← Empresas
                        </button>
                        <h2>{detail.name}</h2>
                        <p>
                          Plan {companyPlanLabel(detail.plan)} · Tenant{' '}
                          <code>#/e/{detail.slug}/…</code>
                          {detail.shopSlug ? (
                            <>
                              {' '}
                              · Tienda <code>#/tienda/{detail.shopSlug}</code>
                            </>
                          ) : null}
                        </p>
                      </div>
                      <div className="platform-admin__detail-actions">
                        <Button
                          type="button"
                          disabled={entering}
                          onClick={() => openModule('home')}
                        >
                          Entrar al negocio
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={entering}
                          onClick={() => openModule('pos')}
                        >
                          Punto de venta
                        </Button>
                        <label className="platform-admin__plan-select">
                          <span className="sr-only">Plan</span>
                          <select
                            value={
                              detail.plan === 'BUSINESS' || detail.plan === 'PRO'
                                ? detail.plan
                                : 'TRIAL'
                            }
                            disabled={planBusyId === detail.id}
                            onChange={(e) =>
                              void setCompanyPlan(detail.id, e.target.value as CompanyPlanId)
                            }
                          >
                            <option value="TRIAL">Free</option>
                            <option value="PRO">Pro</option>
                            <option value="BUSINESS">Empresa</option>
                          </select>
                        </label>
                      </div>
                    </header>

                    <div className="platform-admin__counts">
                      <span>{detail.counts.products} productos</span>
                      <span>{detail.counts.inventoryItems} inventario</span>
                      <span>{detail.counts.sales} ventas</span>
                      <span>{detail.counts.purchaseLots} compras</span>
                      <span>{detail.counts.staffMembers} personal</span>
                      <span>{detail.counts.shopOrders} pedidos web</span>
                    </div>

                    <h3>Entrar y operar</h3>
                    <p className="platform-admin__hint">
                      Elegí el área y entrás directo. Podés volver al panel desde la barra superior.
                    </p>
                    <div className="platform-admin__hub">
                      {(
                        [
                          ['operar', 'Operación'],
                          ['gestionar', 'Gestión'],
                          ['control', 'Control'],
                        ] as const
                      ).map(([group, title]) => (
                        <div key={group} className="platform-admin__hub-group">
                          <p className="platform-admin__section-label">{title}</p>
                          <div className="platform-admin__modules">
                            {COMPANY_QUICK_LINKS.filter((l) => l.group === group).map((link) => (
                              <button
                                key={link.view}
                                type="button"
                                className="platform-admin__module"
                                disabled={entering}
                                onClick={() => openModule(link.view)}
                              >
                                <strong>{link.label}</strong>
                                <span>{link.hint}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <h3>Módulos activos</h3>
                    <p className="platform-admin__hint">
                      Active solo lo que el negocio necesita. Ventas, Inventario y Agenda son los
                      principales.
                    </p>
                    <ModuleToggles
                      modules={detail.allModules ?? []}
                      busy={moduleBusy}
                      onToggle={(slug, enabled) =>
                        void toggleCompanyModule(detail.id, slug, enabled)
                      }
                    />

                    {detail.modules.length > 0 ? (
                      <>
                        <h3>Atajos de módulos habilitados</h3>
                        <div className="platform-admin__modules">
                          {detail.modules.map((m) => {
                            const view = MODULE_VIEW[m.slug]
                            if (!view) return null
                            return (
                              <button
                                key={m.slug}
                                type="button"
                                className="platform-admin__module platform-admin__module--extra"
                                disabled={entering}
                                onClick={() => openModule(view)}
                              >
                                <strong>{m.name}</strong>
                                <span>Ir al módulo</span>
                              </button>
                            )
                          })}
                          {EXTRA_MODULE_VIEWS.map((m) => (
                            <button
                              key={m.view}
                              type="button"
                              className="platform-admin__module platform-admin__module--extra"
                              disabled={entering}
                              onClick={() => openModule(m.view)}
                            >
                              <strong>{m.label}</strong>
                              <span>{m.hint}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}

                    <h3>Equipo de la empresa</h3>
                    <ul className="platform-admin__members">
                      {detail.members.length === 0 ? (
                        <li className="platform-admin__hint">Sin miembros registrados.</li>
                      ) : (
                        detail.members.map((m) => (
                          <li key={m.id}>
                            <strong>{m.name}</strong> — {m.email}
                            <span>
                              {m.roles.join(', ') || 'Sin rol'}
                              {!m.active ? ' · Inactivo' : ''}
                            </span>
                          </li>
                        ))
                      )}
                    </ul>
                  </>
                ) : (
                  <p className="platform-admin__hint">Seleccione una empresa de la lista.</p>
                )}
              </div>
            </section>
          ) : null}

          {tab === 'users' ? (
            <section className={`platform-admin__split${mobileDetail ? ' is-detail' : ''}`}>
              <div className="platform-admin__list">
                <h1>Cuentas</h1>
                <p className="platform-admin__hint">
                  {users.length} cuenta{users.length === 1 ? '' : 's'}. Puede abrir una para ver el
                  último acceso, desactivarla o quitarla.
                </p>
                <label className="platform-admin__search">
                  <span className="sr-only">Buscar cuentas</span>
                  <input
                    type="search"
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    placeholder="Buscar por nombre, email o empresa…"
                    enterKeyHint="search"
                  />
                </label>
                <ul className="platform-admin__company-list">
                  {listedUsers.length === 0 ? (
                    <li className="platform-admin__hint">No hay cuentas con ese criterio.</li>
                  ) : (
                    listedUsers.map((u) => {
                      const canRemove = !u.isPlatformAdmin && u.id !== user.sub
                      return (
                        <li key={u.id} className="platform-admin__account-row">
                          <button
                            type="button"
                            className={`platform-admin__company-btn platform-admin__account-btn${
                              selectedUserId === u.id ? ' platform-admin__company-btn--active' : ''
                            }`}
                            onClick={() => openUser(u.id)}
                          >
                            <span className="platform-admin__account-head">
                              <strong>
                                {u.name}
                                {u.isPlatformAdmin ? ' · Admin' : ''}
                              </strong>
                              <span
                                className={`platform-admin__pill${u.active ? ' is-on' : ' is-off'}`}
                              >
                                {u.active ? 'Activo' : 'Inactivo'}
                              </span>
                            </span>
                            <span className="platform-admin__account-email">{u.email}</span>
                            <small className="platform-admin__login">
                              Último acceso: {formatAgo(u.lastLoginAt)}
                            </small>
                            <small>
                              {u.companies.length
                                ? u.companies.map((c) => c.name).join(' · ')
                                : 'Sin empresa'}
                            </small>
                            <StorageBar
                              used={u.storageUsedBytes ?? 0}
                              limit={u.storageLimitBytes ?? 0}
                              unlimited={u.storageUnlimited}
                            />
                          </button>
                          {canRemove ? (
                            <button
                              type="button"
                              className="platform-admin__remove"
                              disabled={userBusy}
                              onClick={() => void removeUser(u.id)}
                            >
                              Quitar
                            </button>
                          ) : null}
                        </li>
                      )
                    })
                  )}
                </ul>
              </div>

              <div className="platform-admin__detail">
                {userDetail ? (
                  <>
                    <header className="platform-admin__detail-head">
                      <div>
                        <button
                          type="button"
                          className="platform-admin__back"
                          onClick={() => setMobileDetail(false)}
                        >
                          ← Cuentas
                        </button>
                        <h2>{userDetail.name}</h2>
                        <p>
                          {userDetail.email}
                          {userDetail.isPlatformAdmin ? ' · Administrador de plataforma' : ''}
                          {' · '}
                          {userDetail.active ? 'Cuenta activa' : 'Cuenta inactiva'}
                        </p>
                      </div>
                      <div className="platform-admin__detail-actions">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={userBusy || userDetail.isPlatformAdmin}
                          onClick={() => void setUserActive(userDetail.id, !userDetail.active)}
                        >
                          {userDetail.active ? 'Desactivar' : 'Activar'}
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          disabled={userBusy || userDetail.isPlatformAdmin || userDetail.id === user.sub}
                          onClick={() => void removeUser(userDetail.id)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </header>

                    <form
                      className="platform-admin__edit"
                      onSubmit={(e) => {
                        e.preventDefault()
                        void saveUser()
                      }}
                    >
                      <label>
                        Nombre
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          autoComplete="name"
                          disabled={userBusy}
                        />
                      </label>
                      <label>
                        Email
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          autoComplete="email"
                          disabled={userBusy || userDetail.isPlatformAdmin}
                        />
                      </label>
                      <Button type="submit" size="sm" disabled={userBusy}>
                        Guardar
                      </Button>
                    </form>

                    <div className="platform-admin__counts">
                      <span>Alta {formatWhen(userDetail.createdAt)}</span>
                      <span className="platform-admin__count-strong">
                        Último acceso {formatAgo(userDetail.lastLoginAt)}
                      </span>
                      <span>Última actividad {formatAgo(userDetail.lastActivityAt)}</span>
                      <span>{userDetail.salesCount ?? 0} ventas</span>
                      <span>{userDetail.tasksCount ?? 0} tareas</span>
                      <span>{userDetail.cashClosesCount ?? 0} cierres</span>
                      <span>{userDetail.auditCount ?? 0} eventos</span>
                    </div>

                    <h3>Espacio y módulos</h3>
                    {userDetail.companies.length ? (
                      <div className="platform-admin__company-cards">
                        {userDetail.companies.map((c) => {
                          const used = c.usage?.storageUsedBytes ?? c.storageUsedBytes ?? 0
                          const unlimited = isUnlimitedPlan(c.plan)
                          const limit = unlimited
                            ? 0
                            : c.usage?.storageLimitBytes || c.storageLimitBytes || 0
                          return (
                            <article key={c.id} className="platform-admin__company-card">
                              <header>
                                <div>
                                  <strong>{c.name}</strong>
                                  <span>
                                    {c.role} · {companyPlanLabel(c.plan)}
                                  </span>
                                </div>
                                {c.plan !== 'PRO' && c.plan !== 'BUSINESS' ? (
                                  <button
                                    type="button"
                                    className="platform-admin__link-btn"
                                    disabled={planBusyId === c.id}
                                    onClick={() => void setCompanyPlan(c.id, 'PRO')}
                                  >
                                    Pasar a Pro
                                  </button>
                                ) : null}
                              </header>
                              <StorageBar used={used} limit={limit} unlimited={unlimited} />
                              {c.usage ? (
                                <p className="platform-admin__hint">
                                  {c.usage.products} prod · {c.usage.sales} ventas · {c.usage.purchases}{' '}
                                  compras · {c.usage.inventory} inv · {c.usage.appointments} citas
                                </p>
                              ) : null}
                              <ModuleToggles
                                modules={c.modules ?? []}
                                busy={moduleBusy}
                                onToggle={(slug, enabled) =>
                                  void toggleCompanyModule(c.id, slug, enabled)
                                }
                              />
                            </article>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="platform-admin__hint">Este usuario no tiene empresas.</p>
                    )}

                    <h3>Ventas registradas</h3>
                    {userDetail.recentSales.length ? (
                      <div className="platform-admin__table-wrap">
                        <table className="platform-admin__table">
                          <thead>
                            <tr>
                              <th>Fecha</th>
                              <th>Empresa</th>
                              <th>Código</th>
                              <th>Total</th>
                              <th>Pago</th>
                            </tr>
                          </thead>
                          <tbody>
                            {userDetail.recentSales.map((s) => (
                              <tr key={s.id}>
                                <td data-label="Fecha">{formatWhen(s.saleDate)}</td>
                                <td data-label="Empresa">{s.companyName}</td>
                                <td data-label="Código">{s.code ?? '—'}</td>
                                <td data-label="Total">{formatMoney(s.total)}</td>
                                <td data-label="Pago">{s.paymentMethod ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="platform-admin__hint">Todavía no registró ventas.</p>
                    )}

                    <h3>Tareas</h3>
                    {userDetail.recentTasks.length ? (
                      <ul className="platform-admin__activity">
                        {userDetail.recentTasks.map((t) => (
                          <li key={t.id}>
                            <strong>{t.title}</strong>
                            <span>
                              {t.companyName} · {taskKindLabel(t.kind)} · {t.taskDate}
                              {t.completed ? ' · Hecha' : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="platform-admin__hint">Sin tareas creadas o asignadas.</p>
                    )}

                    <h3>Cierres de caja</h3>
                    {userDetail.recentCashCloses.length ? (
                      <ul className="platform-admin__activity">
                        {userDetail.recentCashCloses.map((c) => (
                          <li key={c.id}>
                            <strong>{c.companyName}</strong>
                            <span>
                              {formatWhen(c.closedAt ?? c.closeDate)} · {c.status} ·{' '}
                              {formatMoney(c.salesTotalCOP)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="platform-admin__hint">Sin cierres de caja.</p>
                    )}

                    <h3>Eventos recientes</h3>
                    {userDetail.recentLogs.length ? (
                      <ul className="platform-admin__activity">
                        {userDetail.recentLogs.map((l) => (
                          <li key={l.id}>
                            <strong>{auditLabel(l.action, l.tableName)}</strong>
                            <span>
                              {l.companyName ?? 'Plataforma'} · {formatWhen(l.createdAt)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="platform-admin__hint">Sin eventos de auditoría.</p>
                    )}
                  </>
                ) : (
                  <p>Seleccione un usuario.</p>
                )}
              </div>
            </section>
          ) : null}

          {tab === 'requests' ? (
            <section className="platform-admin__panel platform-admin__requests">
              <header className="platform-admin__section-head">
                <div>
                  <h1>Solicitudes</h1>
                  <p className="platform-admin__hint">
                    Registros y pedidos de Pro o Empresa. Apruebe, rechace o elimine
                    cada solicitud.
                  </p>
                </div>
              </header>

              <div className="platform-admin__filters" role="tablist" aria-label="Estado">
                {(
                  [
                    ['PENDING', 'Pendientes'],
                    ['APPROVED', 'Aprobadas'],
                    ['REJECTED', 'Rechazadas'],
                    ['ALL', 'Todas'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={requestFilter === id}
                    className={`platform-admin__filter${
                      requestFilter === id ? ' is-active' : ''
                    }`}
                    onClick={() => setRequestFilter(id)}
                  >
                    {label}
                    {id === 'PENDING' ? ` (${pendingRequestCount})` : ''}
                  </button>
                ))}
              </div>

              {filteredRequests.length === 0 ? (
                <p className="platform-admin__empty">No hay solicitudes en este filtro.</p>
              ) : (
                <ul className="platform-admin__request-list">
                  {filteredRequests.map((r) => {
                    const busy = requestBusyId === r.id
                    return (
                      <li key={r.id} className="platform-admin__request-card">
                        <div className="platform-admin__request-top">
                          <span className="platform-admin__avatar" aria-hidden>
                            {companyInitials(r.companyName)}
                          </span>
                          <div className="platform-admin__request-meta">
                            <strong>{r.companyName}</strong>
                            <span>
                              {r.contactName} · {formatAgo(r.createdAt)}
                            </span>
                          </div>
                          <span
                            className={`platform-admin__pill platform-admin__pill--req is-${r.status.toLowerCase()}`}
                          >
                            {requestStatusLabel(r.status)}
                          </span>
                        </div>

                        <dl className="platform-admin__request-fields">
                          <div>
                            <dt>Email</dt>
                            <dd>
                              <a href={`mailto:${r.email}`}>{r.email}</a>
                            </dd>
                          </div>
                          <div>
                            <dt>Teléfono</dt>
                            <dd>
                              {r.phone ? (
                                <a href={`tel:${r.phone.replace(/\s+/g, '')}`}>{r.phone}</a>
                              ) : (
                                '—'
                              )}
                            </dd>
                          </div>
                          <div className="platform-admin__request-msg">
                            <dt>Mensaje</dt>
                            <dd>{r.message?.trim() || 'Sin mensaje'}</dd>
                          </div>
                          <div>
                            <dt>Fecha</dt>
                            <dd>{formatWhen(r.createdAt)}</dd>
                          </div>
                        </dl>

                        <div className="platform-admin__request-actions">
                          {r.status !== 'APPROVED' ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled={busy || confirmBusy}
                              onClick={() =>
                                setConfirm({
                                  kind: 'approve-request',
                                  id: r.id,
                                  companyName: r.companyName,
                                })
                              }
                            >
                              Aprobar
                            </Button>
                          ) : null}
                          {r.status !== 'REJECTED' ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={busy || confirmBusy}
                              onClick={() =>
                                setConfirm({
                                  kind: 'reject-request',
                                  id: r.id,
                                  companyName: r.companyName,
                                })
                              }
                            >
                              Rechazar
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            disabled={busy || confirmBusy}
                            onClick={() =>
                              setConfirm({
                                kind: 'delete-request',
                                id: r.id,
                                companyName: r.companyName,
                              })
                            }
                          >
                            Eliminar
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          ) : null}
        </div>
      )}
        </>
      )}

      <AdminConfirmDialog
        open={Boolean(confirm)}
        busy={confirmBusy}
        danger={
          confirm?.kind === 'delete-user' ||
          confirm?.kind === 'delete-request' ||
          confirm?.kind === 'reject-request' ||
          (confirm?.kind === 'toggle-user' && !confirm.active)
        }
        title={
          confirm?.kind === 'delete-user'
            ? 'Eliminar cuenta'
            : confirm?.kind === 'toggle-user'
              ? confirm.active
                ? 'Activar cuenta'
                : 'Desactivar cuenta'
              : confirm?.kind === 'delete-request'
                ? 'Eliminar solicitud'
                : confirm?.kind === 'approve-request'
                  ? 'Aprobar solicitud'
                  : confirm?.kind === 'reject-request'
                    ? 'Rechazar solicitud'
                    : 'Confirmar'
        }
        message={
          confirm?.kind === 'delete-user'
            ? `¿Eliminar a ${confirm.name}? Se quita el acceso. Las empresas y sus datos siguen en la plataforma.`
            : confirm?.kind === 'toggle-user'
              ? confirm.active
                ? `¿Activar de nuevo la cuenta de ${confirm.name}?`
                : `¿Desactivar la cuenta de ${confirm.name}? No podrá iniciar sesión.`
              : confirm?.kind === 'delete-request'
                ? `¿Eliminar la solicitud de ${confirm.companyName}? Esta acción no se puede deshacer.`
                : confirm?.kind === 'approve-request'
                  ? `¿Marcar como aprobada la solicitud de ${confirm.companyName}? Luego puede crear la cuenta manualmente.`
                  : confirm?.kind === 'reject-request'
                    ? `¿Rechazar la solicitud de ${confirm.companyName}?`
                    : ''
        }
        confirmLabel={
          confirm?.kind === 'delete-user' || confirm?.kind === 'delete-request'
            ? 'Eliminar'
            : confirm?.kind === 'approve-request'
              ? 'Aprobar'
              : confirm?.kind === 'reject-request'
                ? 'Rechazar'
                : confirm?.kind === 'toggle-user'
                  ? confirm.active
                    ? 'Activar'
                    : 'Desactivar'
                  : 'Confirmar'
        }
        onCancel={() => {
          if (!confirmBusy) setConfirm(null)
        }}
        onConfirm={() => void runConfirm()}
      />

      <ViewBootSplash ready={!loading} label="Cargando panel de administración…" />
    </div>
  )
}
