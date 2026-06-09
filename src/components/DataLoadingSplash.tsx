import { useInitialViewLoad } from '../hooks/useViewBootSplash'
import { BrandMark } from './BrandMark'

type Props = {
  visible: boolean
  progress: number
  label?: string
}

/** Splash de arranque: se muestra hasta que `ready` sea true (primera carga de la vista). */
export function ViewBootSplash({
  ready,
  label = 'Sincronizando con la base de datos…',
}: {
  ready: boolean
  label?: string
}) {
  const { visible, progress } = useInitialViewLoad(ready)
  return <DataLoadingSplash visible={visible} progress={progress} label={label} />
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
      <div className="data-loading-splash__card data-loading-splash__card--slim data-loading-splash__card--brand-only">
        <BrandMark size="md" className="brand-mark--splash" />
        <p className="data-loading-splash__label sr-only">{label}</p>
        <div className="data-loading-splash__track" aria-hidden>
          <div
            className="data-loading-splash__bar"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
