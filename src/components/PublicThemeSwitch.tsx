type Props = {
  theme: 'dark' | 'light'
  onToggle: () => void
  className?: string
  compact?: boolean
}

export function PublicThemeSwitch({
  theme,
  onToggle,
  className = '',
  compact = false,
}: Props) {
  const isLight = theme === 'light'

  return (
    <div
      className={`public-theme-switch${compact ? ' public-theme-switch--compact' : ''}${className ? ` ${className}` : ''}`}
    >
      {!compact ? <span className="public-theme-switch__label">Oscuro</span> : null}
      <button
        type="button"
        role="switch"
        aria-checked={isLight}
        aria-label={isLight ? 'Tema claro activo' : 'Tema oscuro activo'}
        className={`public-theme-switch__track${isLight ? ' public-theme-switch__track--on' : ''}`}
        onClick={onToggle}
      >
        <span className="public-theme-switch__thumb" aria-hidden />
      </button>
      {!compact ? <span className="public-theme-switch__label">Claro</span> : null}
    </div>
  )
}
