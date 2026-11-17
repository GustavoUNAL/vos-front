import { PLATFORM_MODE } from '../appScope'
import { BRAND_NAME } from '../lib/brand'
import { displayCompanyName } from '../lib/displayLabels'
import { isBookingLedCompany } from '../lib/permissions'
import { greetUser, namedCopy } from '../lib/userIdentity'
import { buildLauncherApps } from '../lib/appLauncher'
import { AppLauncherIcon, LAUNCHER_GROUP_CLASS } from './AppLauncherIcon'
import { landingIcon } from './landing/landingIcons'
import { mobileViewClass } from './mobile/mobileView'
import { type CSSProperties } from 'react'
import { useSessionUser } from '../hooks/useSessionUser'
import { OperationsPulse } from './OperationsPulse'

export function OdooHomeScreen({
  onOpenApp,
  user = null,
  canViewFinance = false,
  canViewTasks = false,
  companyName,
  baseUrl,
}: {
  onOpenApp: (view: string) => void
  user?: import('../api').AuthUser | null
  canViewFinance?: boolean
  canViewTasks?: boolean
  companyName?: string | null
  baseUrl?: string
}) {
  const sessionUser = useSessionUser()
  const who = user ?? sessionUser
  const apps = buildLauncherApps({ user: who, canViewFinance, canViewTasks })
  const hello = greetUser(who?.name)
  const company = displayCompanyName(companyName ?? who?.companyName)

  return (
    <div className={mobileViewClass('home', 'odoo-home')}>
      <header className="odoo-home__hero">
        <p className="odoo-home__brand muted small">
          {company ? `${BRAND_NAME} · ${company}` : BRAND_NAME}
        </p>
        <h1 className="odoo-home__title">{hello}</h1>
        <p className="odoo-home__lead muted">
          {namedCopy(
            who?.name,
            isBookingLedCompany(who)
              ? '{name}, las reservas llegan por el enlace público. Atienda, marque el servicio como terminado y revíselo en el cierre del día.'
              : PLATFORM_MODE
                ? '{name}, seleccione un módulo para comenzar el día.'
                : '{name}, este es su espacio de trabajo.',
            isBookingLedCompany(who)
              ? 'Las reservas llegan por el enlace público. Atienda, marque el servicio como terminado y revíselo en el cierre del día.'
              : PLATFORM_MODE
                ? 'Seleccione un módulo para comenzar.'
                : 'Su espacio de trabajo.',
          )}
        </p>
      </header>
      {baseUrl ? (
        <OperationsPulse baseUrl={baseUrl} onOpenApp={onOpenApp} companyName={company} />
      ) : null}
      <ul className="odoo-home__grid">
        {apps.map((app, index) => {
          const art = landingIcon(app.view)
          return (
          <li
            key={app.view}
            className="odoo-home__cell"
            style={{ '--launcher-i': index } as CSSProperties}
          >
            <button
              type="button"
              className={`odoo-app-tile odoo-app-tile--home ${LAUNCHER_GROUP_CLASS[app.group]}`}
              onClick={() => onOpenApp(app.view)}
            >
              <span className={`odoo-app-tile__icon${art ? ' odoo-app-tile__icon--art' : ''}`} aria-hidden>
                {art ? <img src={art} alt="" /> : <AppLauncherIcon view={app.view} />}
              </span>
              <span className="odoo-app-tile__label">{app.label}</span>
            </button>
          </li>
          )
        })}
      </ul>
    </div>
  )
}
