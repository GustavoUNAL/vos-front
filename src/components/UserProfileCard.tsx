import type { AuthUser } from '../api'
import { displayCompanyName, displayUserRole } from '../lib/displayLabels'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

type Props = {
  user: AuthUser
  compact?: boolean
  className?: string
}

export function UserProfileCard({ user, compact = false, className = '' }: Props) {
  const company = displayCompanyName(user.companyName)
  const role = displayUserRole(user.role)

  return (
    <section
      className={`user-profile-card${compact ? ' user-profile-card--compact' : ''}${className ? ` ${className}` : ''}`}
      aria-label="Perfil de usuario"
    >
      <div className="user-profile-card__avatar" aria-hidden>
        {initials(user.name)}
      </div>
      <div className="user-profile-card__body">
        <strong className="user-profile-card__name">{user.name}</strong>
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
    </section>
  )
}
