import { LogOut } from 'lucide-react'
import type { AuthUser } from '../api'
import { displayCompanyName, displayUserRole } from '../lib/displayLabels'
import { greetUser } from '../lib/userIdentity'
import { userNeedsCompanyPicker } from '../lib/companySelect'
import { CompanySwitcher } from './CompanySwitcher'
import { UserAvatar } from './UserAvatar'

type Props = {
  user: AuthUser
  compact?: boolean
  className?: string
  baseUrl?: string
  onSwitchCompany?: (user: AuthUser) => void
  onLogout?: () => void
}

export function UserProfileCard({
  user,
  compact = false,
  className = '',
  baseUrl,
  onSwitchCompany,
  onLogout,
}: Props) {
  const company = displayCompanyName(user.companyName)
  const role = displayUserRole(user.role)

  return (
    <section
      className={`user-profile-card${compact ? ' user-profile-card--compact' : ''}${onLogout ? ' user-profile-card--menu' : ''}${className ? ` ${className}` : ''}`}
      aria-label="Perfil de usuario"
    >
      <div className="user-profile-card__main">
        <UserAvatar
          name={user.name}
          url={user.avatarUrl}
          className="user-profile-card__avatar"
        />
        <div className="user-profile-card__body">
          <strong className="user-profile-card__name">{greetUser(user.name)}</strong>
          <p className="user-profile-card__legal-name">{user.name}</p>
          <p className="user-profile-card__email">{user.email}</p>
          {!compact ? (
            <>
              {company ? (
                <p className="user-profile-card__company">
                  <span className="user-profile-card__label">Empresa</span>
                  {company}
                  {user.companySlug ? (
                    <span className="user-profile-card__slug"> · {user.companySlug}</span>
                  ) : null}
                </p>
              ) : null}
              {role ? (
                <p className="user-profile-card__role">
                  <span className="user-profile-card__label">Rol</span>
                  {role}
                </p>
              ) : null}
              {user.isPlatformAdmin && user.platformView ? (
                <p className="user-profile-card__hint muted small">
                  Viendo empresa como administrador de plataforma
                </p>
              ) : null}
            </>
          ) : (
            <p className="user-profile-card__meta muted small">
              {[company, role].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>
      {!compact && baseUrl && onSwitchCompany && userNeedsCompanyPicker(user) ? (
        <CompanySwitcher
          baseUrl={baseUrl}
          user={user}
          onSwitch={onSwitchCompany}
          variant="menu"
        />
      ) : null}
      {onLogout ? (
        <footer className="user-profile-card__footer">
          <button type="button" className="user-profile-card__logout" onClick={onLogout}>
            <LogOut className="user-profile-card__logout-icon" strokeWidth={2} aria-hidden />
            Salir de la cuenta
          </button>
        </footer>
      ) : null}
    </section>
  )
}
