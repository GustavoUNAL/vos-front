import { Bell, Bot, Settings, User } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AuthUser } from '../api'
import { buildHeaderNotifications } from '../lib/headerNotifications'
import { ThemeSwitch } from './ThemeSwitch'
import { ProfilePopup } from './ProfilePopup'
import { UserAvatar } from './UserAvatar'
import { firstName } from '../lib/userIdentity'

type SystrayPanelId = 'notifications' | 'settings' | 'profile'

function SystrayPanel({
  id,
  title,
  children,
  align = 'right',
}: {
  id: string
  title: string
  children: ReactNode
  align?: 'right' | 'center'
}) {
  return (
    <div
      id={id}
      className={`header-systray__panel header-systray__panel--${align}`}
      role="dialog"
      aria-label={title}
    >
      <header className="header-systray__panel-head">
        <h3 className="header-systray__panel-title">{title}</h3>
      </header>
      <div className="header-systray__panel-body">{children}</div>
    </div>
  )
}

export function HeaderSystray({
  user,
  theme,
  onToggleTheme,
  onLogout,
  onOpenAssistant,
  assistantOpen = false,
  backendDown = false,
  onRetryApi,
  baseUrl,
  onSwitchCompany,
  variant = 'navbar',
}: {
  user: AuthUser
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  onLogout: () => void
  onOpenAssistant?: () => void
  assistantOpen?: boolean
  backendDown?: boolean
  onRetryApi?: () => void
  baseUrl?: string
  onSwitchCompany?: (user: AuthUser) => void
  variant?: 'navbar' | 'mobile'
}) {
  const [openPanel, setOpenPanel] = useState<SystrayPanelId | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const notifications = useMemo(
    () => buildHeaderNotifications({ backendDown, onRetryApi }),
    [backendDown, onRetryApi],
  )
  const notificationCount = notifications.length
  const hello = firstName(user.name)

  const closePanel = useCallback(() => setOpenPanel(null), [])

  const togglePanel = (panel: SystrayPanelId) => {
    setOpenPanel((cur) => (cur === panel ? null : panel))
  }

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (openPanel === 'profile') return
      if (!rootRef.current?.contains(e.target as Node)) closePanel()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [closePanel, openPanel])

  return (
    <div
      ref={rootRef}
      className={`header-systray${variant === 'mobile' ? ' header-systray--mobile' : ''}`}
      aria-label="Acciones de usuario"
    >
      <div className="header-systray__item">
        <button
          type="button"
          className={`header-systray__btn${openPanel === 'notifications' ? ' header-systray__btn--active' : ''}`}
          aria-expanded={openPanel === 'notifications'}
          aria-controls="header-systray-notifications"
          title="Notificaciones"
          onClick={() => togglePanel('notifications')}
        >
          <Bell className="header-systray__icon" strokeWidth={2} aria-hidden />
          {notificationCount > 0 ? (
            <span className="header-systray__badge" aria-hidden>
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          ) : null}
          <span className="sr-only">Notificaciones</span>
        </button>
        {openPanel === 'notifications' ? (
          <SystrayPanel id="header-systray-notifications" title="Notificaciones">
            {notifications.length === 0 ? (
              <p className="header-systray__empty muted small">
                No hay notificaciones nuevas.
              </p>
            ) : (
              <ul className="header-systray__notifications">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`header-systray__notification header-systray__notification--${n.severity}`}
                  >
                    <strong className="header-systray__notification-title">{n.title}</strong>
                    <p className="header-systray__notification-msg muted small">{n.message}</p>
                    {n.actionLabel && n.onAction ? (
                      <button
                        type="button"
                        className="btn-secondary btn-compact header-systray__notification-action"
                        onClick={() => {
                          n.onAction?.()
                          closePanel()
                        }}
                      >
                        {n.actionLabel}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </SystrayPanel>
        ) : null}
      </div>

      <div className="header-systray__item">
        <button
          type="button"
          className={`header-systray__btn${openPanel === 'settings' ? ' header-systray__btn--active' : ''}`}
          aria-expanded={openPanel === 'settings'}
          aria-controls="header-systray-settings"
          title="Configuración"
          onClick={() => togglePanel('settings')}
        >
          <Settings className="header-systray__icon" strokeWidth={2} aria-hidden />
          <span className="sr-only">Configuración</span>
        </button>
        {openPanel === 'settings' ? (
          <SystrayPanel id="header-systray-settings" title="Configuración">
            <div className="header-systray__settings">
              <div className="header-systray__settings-row">
                <div className="header-systray__settings-copy">
                  <span className="header-systray__settings-label">Tema</span>
                  <span className="header-systray__settings-hint muted small">
                    Apariencia clara u oscura de la interfaz
                  </span>
                </div>
                <ThemeSwitch theme={theme} onToggle={onToggleTheme} compact />
              </div>
            </div>
          </SystrayPanel>
        ) : null}
      </div>

      {onOpenAssistant ? (
        <div className="header-systray__item">
          <button
            type="button"
            className={`header-systray__btn header-systray__btn--assistant${assistantOpen ? ' header-systray__btn--active' : ''}`}
            title="VOS IA"
            aria-expanded={assistantOpen}
            onClick={() => {
              closePanel()
              onOpenAssistant()
            }}
          >
            <Bot className="header-systray__icon" strokeWidth={2} aria-hidden />
            <span className="sr-only">VOS IA</span>
          </button>
        </div>
      ) : null}

      <div className="header-systray__item">
        <button
          type="button"
          className={`header-systray__btn header-systray__btn--profile${openPanel === 'profile' ? ' header-systray__btn--active' : ''}`}
          aria-expanded={openPanel === 'profile'}
          aria-controls="header-systray-profile"
          title={hello ? `Perfil de ${hello}` : 'Mi perfil'}
          onClick={() => togglePanel('profile')}
        >
          <UserAvatar
            name={user.name}
            url={user.avatarUrl}
            className="header-systray__avatar"
          />
          {hello ? <span className="header-systray__hello">{hello}</span> : null}
          <User className="header-systray__icon header-systray__icon--profile-fallback" strokeWidth={2} aria-hidden />
          <span className="sr-only">Perfil de {user.name}</span>
        </button>
      </div>
      {openPanel === 'profile' ? (
        <ProfilePopup
          user={user}
          baseUrl={baseUrl}
          onClose={closePanel}
          onSwitchCompany={onSwitchCompany}
          onLogout={() => {
            closePanel()
            onLogout()
          }}
        />
      ) : null}
    </div>
  )
}
