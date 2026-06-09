export function ThemeSwitch({
  theme,
  onToggle,
  compact = false,
}: {
  theme: 'dark' | 'light'
  onToggle: () => void
  compact?: boolean
}) {
  const themeLabel = theme === 'light' ? 'Claro' : 'Oscuro'
  return (
    <div
      className={compact ? 'theme-switch theme-switch--compact' : 'theme-switch'}
      title="Cambiar tema"
    >
      <span className="muted small" id="theme-switch-label">
        Tema
      </span>
      <button
        type="button"
        role="switch"
        className={`theme-switch__track${theme === 'light' ? ' theme-switch__track--on' : ''}`}
        aria-checked={theme === 'light'}
        aria-labelledby="theme-switch-label"
        onClick={onToggle}
      >
        <span className="theme-switch__thumb" aria-hidden />
      </button>
      <span className="theme-switch__value muted small">{themeLabel}</span>
    </div>
  )
}
