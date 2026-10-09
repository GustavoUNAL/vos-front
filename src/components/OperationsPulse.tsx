import { useEffect, useState } from 'react'
import { fetchOperationsDay, type OperationsDay } from '../api'
import { formatCOP } from '../lib/money'

const KIND_LABEL: Record<OperationsDay['events'][number]['kind'], string> = {
  sale: 'Venta',
  purchase: 'Compra',
  waste: 'Merma',
  count: 'Conteo',
  adjustment: 'Ajuste',
  shift: 'Turno',
  cash: 'Caja',
}

const PULSE_MODE_KEY = 'vos-ops-pulse-mode'
type PulseMode = 'open' | 'min' | 'closed'

function readPulseMode(): PulseMode {
  try {
    const stored = localStorage.getItem(PULSE_MODE_KEY)
    if (stored === 'min' || stored === 'closed' || stored === 'open') return stored
  } catch {
    /* el navegador puede bloquear el almacenamiento */
  }
  return 'open'
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
}

export function OperationsPulse({
  baseUrl,
  onOpenApp,
  companyName,
}: {
  baseUrl: string
  onOpenApp: (view: string) => void
  companyName?: string | null
}) {
  const [day, setDay] = useState<OperationsDay | null>(null)
  const [hidden, setHidden] = useState(false)
  const [mode, setMode] = useState<PulseMode>(readPulseMode)

  function setPulseMode(next: PulseMode) {
    setMode(next)
    try {
      localStorage.setItem(PULSE_MODE_KEY, next)
    } catch {
      /* seguir en memoria si no se puede guardar */
    }
  }

  useEffect(() => {
    let cancelled = false
    void fetchOperationsDay(baseUrl)
      .then((data) => {
        if (!cancelled) setDay(data)
      })
      .catch(() => {
        if (!cancelled) setHidden(true)
      })
    return () => {
      cancelled = true
    }
  }, [baseUrl])

  if (hidden || !day) return null
  if (day.alerts.length === 0 && day.events.length === 0) return null

  const noticeCount = day.alerts.length
  const place = companyName?.trim()
  const title = place ? `Hoy en ${place}` : 'Hoy en el local'

  if (mode === 'closed') {
    return (
      <button
        type="button"
        className="ops-pulse ops-pulse--closed"
        onClick={() => setPulseMode('open')}
      >
        <span>{title}</span>
        {noticeCount > 0 ? (
          <span className="ops-pulse__count">{noticeCount} avisos</span>
        ) : (
          <span className="ops-pulse__count">Ver el día</span>
        )}
      </button>
    )
  }

  const collapsed = mode === 'min'

  return (
    <section
      className={`ops-pulse${collapsed ? ' ops-pulse--min' : ''}`}
      aria-label={title}
    >
      <div className="ops-pulse__head">
        <h2>{title}</h2>
        <div className="ops-pulse__actions">
          <button type="button" className="btn-secondary btn-compact" onClick={() => onOpenApp('cash-close')}>
            Ver caja
          </button>
          <button
            type="button"
            className="btn-secondary btn-compact"
            aria-expanded={!collapsed}
            onClick={() => setPulseMode(collapsed ? 'open' : 'min')}
          >
            {collapsed ? 'Mostrar' : 'Minimizar'}
          </button>
          <button
            type="button"
            className="btn-secondary btn-compact"
            onClick={() => setPulseMode('closed')}
          >
            Cerrar
          </button>
        </div>
      </div>
      {collapsed ? null : day.alerts.length > 0 ? (
        <ul className="ops-pulse__alerts">
          {day.alerts.map((alert) => (
            <li key={alert.code} className={`ops-pulse__alert ops-pulse__alert--${alert.severity}`}>
              <strong>{alert.title}</strong>
              <span>{alert.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {!collapsed && day.events.length > 0 ? (
        <ol className="ops-pulse__events">
          {day.events.slice(0, 12).map((event) => (
            <li key={`${event.kind}-${event.at}-${event.title}`}>
              <span className="ops-pulse__time mono">{formatWhen(event.at)}</span>
              <span className="ops-pulse__kind">{KIND_LABEL[event.kind]}</span>
              <span className="ops-pulse__title">
                {event.title}
                {event.actor ? ` · ${event.actor}` : ''}
                {event.detail ? ` · ${event.detail}` : ''}
              </span>
              <span className="ops-pulse__amount mono">
                {event.amountCOP != null ? formatCOP(event.amountCOP) : ''}
              </span>
            </li>
          ))}
        </ol>
      ) : !collapsed ? (
        <p className="muted small">Todavía no hay movimientos hoy.</p>
      ) : null}
    </section>
  )
}
