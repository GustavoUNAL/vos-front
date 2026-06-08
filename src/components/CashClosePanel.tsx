import { useCallback, useEffect, useState } from 'react'
import {
  downloadSaleInvoiceBusinessPdf,
  downloadSaleInvoiceClientPdf,
  fetchDailyCashClose,
  type DailyCashClose,
} from '../api'
import { Button } from './ui/button'

function formatCOP(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatLongDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d, 12, 0, 0)
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dt)
}

type Props = {
  baseUrl: string
  date: string
  onClose?: () => void
}

export function CashClosePanel({ baseUrl, date, onClose }: Props) {
  const [data, setData] = useState<DailyCashClose | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchDailyCashClose(baseUrl, date))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el cierre')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [baseUrl, date])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="cash-close-panel" aria-labelledby="cash-close-title">
      <header className="cash-close-panel__head">
        <div>
          <h2 id="cash-close-title" className="cash-close-panel__title">
            Cierre de caja
          </h2>
          <p className="cash-close-panel__date muted">{formatLongDate(date)}</p>
        </div>
        {onClose ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        ) : null}
      </header>

      {loading ? <p className="muted">Calculando cierre…</p> : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <div className="cash-close-panel__summary">
            <div className="cash-close-kpi">
              <span className="cash-close-kpi__label">Ventas</span>
              <strong>{formatCOP(data.summary.salesTotalCOP)}</strong>
              <span className="muted small">{data.summary.saleCount} comandas</span>
            </div>
            <div className="cash-close-kpi">
              <span className="cash-close-kpi__label">Compras</span>
              <strong>{formatCOP(data.summary.purchasesTotalCOP)}</strong>
              <span className="muted small">{data.summary.purchaseCount} lotes</span>
            </div>
            <div className="cash-close-kpi cash-close-kpi--accent">
              <span className="cash-close-kpi__label">Neto del día</span>
              <strong>{formatCOP(data.summary.netCOP)}</strong>
            </div>
          </div>

          {data.paymentsByMethod.length > 0 ? (
            <div className="cash-close-panel__block">
              <h3 className="cash-close-panel__subtitle">Cobros por método</h3>
              <ul className="cash-close-panel__list">
                {data.paymentsByMethod.map((p) => (
                  <li key={p.method}>
                    <span>{p.method}</span>
                    <span className="mono">{formatCOP(p.totalCOP)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {data.shifts.length > 0 ? (
            <div className="cash-close-panel__block">
              <h3 className="cash-close-panel__subtitle">Turnos</h3>
              <ul className="cash-close-panel__list">
                {data.shifts.map((s) => (
                  <li key={s.id}>
                    <span>
                      {s.staffName}
                      {s.hoursWorked != null ? ` · ${s.hoursWorked.toFixed(1)} h` : ''}
                    </span>
                    <span className="mono">
                      {s.totalPayCOP != null ? formatCOP(s.totalPayCOP) : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {data.sales.length > 0 ? (
            <div className="cash-close-panel__block">
              <h3 className="cash-close-panel__subtitle">Ventas del día</h3>
              <ul className="cash-close-panel__sales">
                {data.sales.map((s) => (
                  <li key={s.id} className="cash-close-panel__sale-row">
                    <div>
                      <strong>{s.customer}</strong>
                      <span className="muted small">
                        {s.code ?? s.id.slice(0, 8)} · {s.paymentMethod}
                      </span>
                    </div>
                    <div className="cash-close-panel__sale-actions">
                      <span className="mono">{formatCOP(s.total)}</span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          void downloadSaleInvoiceClientPdf(baseUrl, s.id, s.code)
                        }
                      >
                        Cliente
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          void downloadSaleInvoiceBusinessPdf(baseUrl, s.id, s.code)
                        }
                      >
                        Negocio
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {data.purchases.length > 0 ? (
            <div className="cash-close-panel__block">
              <h3 className="cash-close-panel__subtitle">Compras del día</h3>
              <ul className="cash-close-panel__list">
                {data.purchases.map((p) => (
                  <li key={p.id}>
                    <span>
                      {p.name}
                      <span className="muted small"> · {p.code}</span>
                    </span>
                    <span className="mono">{formatCOP(p.total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
