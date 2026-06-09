import { useCallback, useEffect, useState } from 'react'
import {
  enterPlatformCompany,
  fetchPlatformAccessRequests,
  fetchPlatformCompanies,
  fetchPlatformCompanyDetail,
  fetchPlatformOverview,
  fetchPlatformUsers,
  type AuthUser,
  type PlatformCompanyDetail,
  type PlatformCompanyRow,
  type PlatformOverview,
  type PlatformUserRow,
  type AccessRequestRow,
} from '../api'
import { BRAND_NAME } from '../lib/brand'
import { buildCompanyViewHash, type AppView } from '../lib/companyRoutes'
import { navigateToLogin } from '../lib/authRoutes'
import { setAccessToken } from '../api'
import { BrandMark } from './BrandMark'
import { PublicThemeSwitch } from './PublicThemeSwitch'
import { Button } from './ui/button'
import { usePublicTheme } from '../hooks/usePublicTheme'
import '../public-shell.css'
import '../platform-admin.css'

type Tab = 'overview' | 'companies' | 'users' | 'requests'

const EXTRA_MODULE_VIEWS: Array<{ view: AppView; label: string }> = [
  { view: 'home', label: 'Inicio' },
  { view: 'pos', label: 'POS' },
  { view: 'shop', label: 'Tienda online' },
]

const MODULE_VIEW: Record<string, AppView> = {
  products: 'products',
  inventory: 'inventory',
  sales: 'sales',
  purchases: 'purchases',
  staff: 'staff',
  finance: 'analytics',
}

type Props = {
  baseUrl: string
  user: AuthUser
  onEnterCompany: (user: AuthUser, view: AppView) => void
  onLogout: () => void
}

export function PlatformAdminView({ baseUrl, user, onEnterCompany, onLogout }: Props) {
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<PlatformOverview | null>(null)
  const [companies, setCompanies] = useState<PlatformCompanyRow[]>([])
  const [users, setUsers] = useState<PlatformUserRow[]>([])
  const [requests, setRequests] = useState<AccessRequestRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<PlatformCompanyDetail | null>(null)
  const [entering, setEntering] = useState(false)
  const { theme, toggleTheme } = usePublicTheme()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ov, co, us, req] = await Promise.all([
        fetchPlatformOverview(baseUrl),
        fetchPlatformCompanies(baseUrl),
        fetchPlatformUsers(baseUrl),
        fetchPlatformAccessRequests(baseUrl, 'PENDING'),
      ])
      setOverview(ov)
      setCompanies(co)
      setUsers(us)
      setRequests(req)
      if (!selectedId && co[0]) setSelectedId(co[0].id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el panel')
    } finally {
      setLoading(false)
    }
  }, [baseUrl, selectedId])

  useEffect(() => {
    document.title = `Admin · ${BRAND_NAME}`
    void load()
  }, [load])

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

  async function openModule(view: AppView) {
    if (!detail || entering) return
    setEntering(true)
    setError(null)
    try {
      const res = await enterPlatformCompany(baseUrl, detail.id)
      onEnterCompany(res.user, view)
      window.location.hash = buildCompanyViewHash(detail.slug, view)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir la empresa')
    } finally {
      setEntering(false)
    }
  }

  function handleLogout() {
    setAccessToken(null)
    onLogout()
    navigateToLogin()
  }

  return (
    <div className="platform-admin">
      <header className="platform-admin__topbar">
        <BrandMark size="sm" />
        <div className="platform-admin__topbar-meta">
          <span className="platform-admin__badge">Administrador de plataforma</span>
          <span>{user.name}</span>
          <span className="platform-admin__email">{user.email}</span>
        </div>
        <PublicThemeSwitch theme={theme} onToggle={toggleTheme} compact />
        <Button type="button" variant="secondary" size="sm" onClick={handleLogout}>
          Cerrar sesión
        </Button>
      </header>

      <nav className="platform-admin__tabs" aria-label="Secciones del panel">
        {(
          [
            ['overview', 'Resumen'],
            ['companies', 'Empresas'],
            ['users', 'Usuarios'],
            ['requests', 'Solicitudes'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`platform-admin__tab${tab === id ? ' platform-admin__tab--active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
            {id === 'requests' && overview?.pendingRequests
              ? ` (${overview.pendingRequests})`
              : ''}
          </button>
        ))}
      </nav>

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
            <section className="platform-admin__panel">
              <h1>Resumen de la plataforma</h1>
              <div className="platform-admin__stats">
                <article className="platform-admin__stat">
                  <strong>{overview.companiesCount}</strong>
                  <span>Empresas</span>
                </article>
                <article className="platform-admin__stat">
                  <strong>{overview.activeCompanies}</strong>
                  <span>Activas</span>
                </article>
                <article className="platform-admin__stat">
                  <strong>{overview.usersCount}</strong>
                  <span>Usuarios</span>
                </article>
                <article className="platform-admin__stat">
                  <strong>{overview.pendingRequests}</strong>
                  <span>Solicitudes pendientes</span>
                </article>
              </div>
              {overview.recentRequests.length > 0 ? (
                <>
                  <h2>Solicitudes recientes</h2>
                  <div className="platform-admin__table-wrap">
                    <table className="platform-admin__table">
                      <thead>
                        <tr>
                          <th>Empresa</th>
                          <th>Contacto</th>
                          <th>Email</th>
                          <th>Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.recentRequests.map((r) => (
                          <tr key={r.id}>
                            <td>{r.companyName}</td>
                            <td>{r.contactName}</td>
                            <td>{r.email}</td>
                            <td>{new Date(r.createdAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </section>
          ) : null}

          {tab === 'companies' ? (
            <section className="platform-admin__split">
              <div className="platform-admin__list">
                <h1>Empresas</h1>
                <ul className="platform-admin__company-list">
                  {companies.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={`platform-admin__company-btn${
                          selectedId === c.id ? ' platform-admin__company-btn--active' : ''
                        }`}
                        onClick={() => setSelectedId(c.id)}
                      >
                        <strong>{c.name}</strong>
                        <span>/{c.slug}</span>
                        <small>
                          {c.productsCount} prod · {c.salesCount} ventas · {c.membersCount} usuarios
                        </small>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="platform-admin__detail">
                {detail ? (
                  <>
                    <header className="platform-admin__detail-head">
                      <div>
                        <h2>{detail.name}</h2>
                        <p>
                          Tenant <code>#/e/{detail.slug}/…</code>
                          {detail.shopSlug ? (
                            <>
                              {' '}
                              · Tienda <code>#/tienda/{detail.shopSlug}</code>
                            </>
                          ) : null}
                        </p>
                      </div>
                      <Button
                        type="button"
                        disabled={entering}
                        onClick={() => openModule('home')}
                      >
                        Abrir panel completo
                      </Button>
                    </header>

                    <div className="platform-admin__counts">
                      <span>{detail.counts.products} productos</span>
                      <span>{detail.counts.inventoryItems} inventario</span>
                      <span>{detail.counts.sales} ventas</span>
                      <span>{detail.counts.purchaseLots} compras</span>
                      <span>{detail.counts.staffMembers} personal</span>
                      <span>{detail.counts.shopOrders} pedidos web</span>
                    </div>

                    <h3>Módulos habilitados</h3>
                    <div className="platform-admin__modules">
                      {detail.modules.map((m) => {
                        const view = MODULE_VIEW[m.slug]
                        if (!view) return null
                        return (
                          <button
                            key={m.slug}
                            type="button"
                            className="platform-admin__module"
                            disabled={entering}
                            onClick={() => openModule(view)}
                          >
                            <strong>{m.name}</strong>
                            <span>Abrir {view}</span>
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
                          <span>Abrir módulo</span>
                        </button>
                      ))}
                    </div>

                    <h3>Usuarios de la empresa</h3>
                    <ul className="platform-admin__members">
                      {detail.members.map((m) => (
                        <li key={m.id}>
                          <strong>{m.name}</strong> — {m.email}
                          <span>{m.roles.join(', ')}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>Seleccioná una empresa.</p>
                )}
              </div>
            </section>
          ) : null}

          {tab === 'users' ? (
            <section className="platform-admin__panel">
              <h1>Usuarios</h1>
              <div className="platform-admin__table-wrap">
                <table className="platform-admin__table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Email</th>
                      <th>Rol</th>
                      <th>Empresas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>{u.name}</td>
                        <td>{u.email}</td>
                        <td>
                          {u.isPlatformAdmin ? 'Admin plataforma' : 'Tenant'}
                          {!u.active ? ' (inactivo)' : ''}
                        </td>
                        <td>
                          {u.companies.length
                            ? u.companies.map((c) => `${c.name} (${c.role})`).join(' · ')
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {tab === 'requests' ? (
            <section className="platform-admin__panel">
              <h1>Solicitudes de acceso</h1>
              <p className="platform-admin__hint">
                Creá manualmente la cuenta del solicitante y marcá la solicitud en la base de datos.
              </p>
              <div className="platform-admin__table-wrap">
                <table className="platform-admin__table">
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>Contacto</th>
                      <th>Email</th>
                      <th>Teléfono</th>
                      <th>Mensaje</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => (
                      <tr key={r.id}>
                        <td>{r.companyName}</td>
                        <td>{r.contactName}</td>
                        <td>{r.email}</td>
                        <td>{r.phone ?? '—'}</td>
                        <td>{r.message ?? '—'}</td>
                        <td>{new Date(r.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}
