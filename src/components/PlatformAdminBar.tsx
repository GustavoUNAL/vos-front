import { landingIcon } from './landing/landingIcons'
import '../platform-admin.css'

type Props = {
  onReturn: () => void
  /** Variante más compacta para header móvil */
  compact?: boolean
}

/** Control sutil para volver al menú de plataforma (integrado en el header). */
export function PlatformAdminBar({ onReturn, compact = false }: Props) {
  return (
    <button
      type="button"
      className={`platform-admin-return${compact ? ' platform-admin-return--compact' : ''}`}
      onClick={onReturn}
      title="Volver al menú principal de plataforma"
      aria-label="Volver al menú principal de plataforma"
    >
      <span className="platform-admin-return__mark" aria-hidden>
        <img src={landingIcon('platform')} alt="" />
      </span>
      <span className="platform-admin-return__label">
        {compact ? 'Panel' : 'Menú plataforma'}
      </span>
    </button>
  )
}
