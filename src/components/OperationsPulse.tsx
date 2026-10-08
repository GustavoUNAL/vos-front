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

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function OperationsPulse({
  baseUrl,
  onOpenApp,
}: {
  baseUrl: string
  onOpenApp: (view: string) => void
}) {
  const [day, setDay] = useState<OperationsDay | null>(null)
  const [hidden, setHidden] = useState(false)

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

  return (
    <section className="ops-pulse" aria-label="Qué pasó hoy">
      <div className="ops-pulse__head">
        <h2>Hoy en el local</h2>
        <button type="button" className="btn-secondary btn-compact" onClick={() => onOpenApp('cash-close')}>
          Ver caja
        </button>
      </div>
      {day.alerts.length > 0 ? (
        <ul className="ops-pulse__alerts">
          {day.alerts.map((alert) => (
            <li key={alert.code} className={`ops-pulse__alert ops-pulse__alert--${alert.severity}`}>
              <strong>{alert.title}</strong>
              <span>{alert.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {day.events.length > 0 ? (
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
      ) : (
        <p className="muted small">Todavía no hay movimientos hoy.</p>
      )}
    </section>
  )
}
