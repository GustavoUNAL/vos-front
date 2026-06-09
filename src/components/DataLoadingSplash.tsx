import { BrandMark } from './BrandMark'

type Props = {
  visible: boolean
  progress: number
  label?: string
}

export function DataLoadingSplash({
  visible,
  progress,
  label = 'Sincronizando con la base de datos…',
}: Props) {
  if (!visible) return null

  const pct = Math.min(100, Math.max(0, Math.round(progress)))

  return (
    <div
      className="data-loading-splash"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="data-loading-splash__card">
        <BrandMark size="lg" showTagline />
        <p className="data-loading-splash__label">{label}</p>
        <div className="data-loading-splash__track" aria-hidden>
          <div
            className="data-loading-splash__bar"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="data-loading-splash__pct mono">{pct}%</span>
      </div>
    </div>
  )
}
