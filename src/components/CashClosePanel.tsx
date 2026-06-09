import { useCallback, useEffect, useState } from 'react'
import {
  fetchDailyCashClose,
  type DailyCashClose,
} from '../api'
import { DayComandasList } from './DayComandasList'
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
  refreshKey?: number
  onOpenSales?: (date: string) => void
  onOpenPurchases?: (date: string) => void
  companyName?: string | null
}

/** Resumen del día + comandas (solo Inicio / detalle del día). */
export function CashClosePanel({
  baseUrl,
  date,
  refreshKey = 0,
  onOpenSales,
  onOpenPurchases,
  companyName,
}: Props) {
  const [data, setData] = useState<DailyCashClose | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchDailyCashClose(baseUrl, date))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el detalle del día')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [baseUrl, date])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  return (
    <section className="cash-close-panel" aria-labelledby="cash-close-title">
      <p id="cash-close-title" className="cash-close-panel__toolbar-date muted">
        {formatLongDate(date)}
      </p>

      {loading ? <p className="muted">Cargando detalle del día…</p> : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <div className="cash-close-panel__overview">
            <h2 className="cash-close-panel__section-label">Resumen del día</h2>

            <div className="cash-close-panel__summary">
              <div className="cash-close-kpi">
                <span className="cash-close-kpi__label">Ventas</span>
                <strong>{formatCOP(data.summary.salesTotalCOP)}</strong>
                <span className="muted small">
                  {data.summary.saleCount} comanda
                  {data.summary.saleCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="cash-close-kpi">
                <span className="cash-close-kpi__label">Compras</span>
                <strong>{formatCOP(data.summary.purchasesTotalCOP)}</strong>
                <span className="muted small">
                  {data.summary.purchaseCount} lote
                  {data.summary.purchaseCount !== 1 ? 's' : ''}
                </span>
                {onOpenPurchases && data.summary.purchaseCount > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="cash-close-panel__module-link"
                    onClick={() => onOpenPurchases(date)}
                  >
                    Ver en Compras
                  </Button>
                ) : null}
              </div>
              <div className="cash-close-kpi cash-close-kpi--accent">
                <span className="cash-close-kpi__label">Neto del día</span>
                <strong>{formatCOP(data.summary.netCOP)}</strong>
              </div>
            </div>

            {data.paymentsByMethod.length > 0 ? (
              <div className="cash-close-panel__overview-block">
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
              <div className="cash-close-panel__overview-block">
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
          </div>

          <div className="cash-close-panel__sales-zone">
            <div className="cash-close-panel__sales-zone-head">
              <h2 className="cash-close-panel__section-label">Comandas</h2>
              <div className="cash-close-panel__sales-zone-actions">
                <span className="cash-close-panel__sales-count muted small">
                  {data.sales.length} venta{data.sales.length !== 1 ? 's' : ''}
                </span>
                {onOpenSales ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenSales(date)}
                  >
                    Ir a Ventas
                  </Button>
                ) : null}
              </div>
            </div>

            <DayComandasList
              baseUrl={baseUrl}
              sales={data.sales}
              companyName={companyName}
              emptyMessage="No hay comandas este día."
            />
          </div>
        </>
      ) : null}
    </section>
  )
}
