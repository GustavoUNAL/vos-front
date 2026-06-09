import { useCallback, useEffect, useState } from 'react'
import {
  downloadSaleInvoicePdf,
  downloadSaleReceiptTxt,
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

function formatSaleTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

type Props = {
  baseUrl: string
  date: string
  refreshKey?: number
  onClose?: () => void
  onEditSale?: (saleId: string) => void
  onCreateSale?: () => void
}

export function CashClosePanel({
  baseUrl,
  date,
  refreshKey = 0,
  onClose,
  onEditSale,
  onCreateSale,
}: Props) {
  const [data, setData] = useState<DailyCashClose | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null)

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
    setExpandedSaleId(null)
    void load()
  }, [load, refreshKey])

  const toggleSale = (id: string) => {
    setExpandedSaleId((prev) => (prev === id ? null : id))
  }

  return (
    <section className="cash-close-panel" aria-labelledby="cash-close-title">
      <header className="cash-close-panel__head">
        <div>
          <h2 id="cash-close-title" className="cash-close-panel__title">
            Detalle del día
          </h2>
          <p className="cash-close-panel__date muted">{formatLongDate(date)}</p>
        </div>
        <div className="cash-close-panel__head-actions">
          {onCreateSale ? (
            <Button type="button" variant="secondary" size="sm" onClick={onCreateSale}>
              Nueva venta
            </Button>
          ) : null}
          {onClose ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cerrar
            </Button>
          ) : null}
        </div>
      </header>

      {loading ? <p className="muted">Cargando ventas del día…</p> : null}
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

          <div className="cash-close-panel__block">
            <h3 className="cash-close-panel__subtitle">
              Ventas del día ({data.sales.length})
            </h3>
            {data.sales.length === 0 ? (
              <p className="muted small cash-close-panel__empty">
                No hay ventas registradas este día.
                {onCreateSale ? ' Podés crear una con el botón «Nueva venta».' : ''}
              </p>
            ) : (
              <ul className="cash-close-panel__sales">
                {data.sales.map((s) => {
                  const expanded = expandedSaleId === s.id
                  return (
                    <li key={s.id} className="cash-close-panel__sale-card">
                      <div className="cash-close-panel__sale-row">
                        <button
                          type="button"
                          className="cash-close-panel__sale-toggle"
                          aria-expanded={expanded}
                          onClick={() => toggleSale(s.id)}
                        >
                          <strong>{s.customer}</strong>
                          <span className="muted small">
                            {formatSaleTime(s.saleDate)} · {s.paymentMethod}
                            {s.code ? ` · ${s.code}` : ''}
                          </span>
                          <span className="muted small">
                            {s.lineCount} línea{s.lineCount !== 1 ? 's' : ''}
                          </span>
                        </button>
                        <div className="cash-close-panel__sale-actions">
                          <span className="mono">{formatCOP(s.total)}</span>
                          {onEditSale ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => onEditSale(s.id)}
                            >
                              Editar
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              void downloadSaleReceiptTxt(baseUrl, s.id, s.code)
                            }
                          >
                            TXT
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              void downloadSaleInvoicePdf(baseUrl, s.id, s.code)
                            }
                          >
                            PDF
                          </Button>
                        </div>
                      </div>
                      {expanded && s.lines.length > 0 ? (
                        <div className="cash-close-panel__sale-lines">
                          <table className="cash-close-lines-table">
                            <thead>
                              <tr>
                                <th>Producto</th>
                                <th className="num">Cant.</th>
                                <th className="num">Precio</th>
                                <th className="num">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {s.lines.map((ln) => (
                                <tr key={ln.id}>
                                  <td>{ln.productName}</td>
                                  <td className="num mono">
                                    {ln.quantity}
                                    {ln.lineUnit ? ` ${ln.lineUnit}` : ''}
                                  </td>
                                  <td className="num mono">{formatCOP(ln.unitPrice)}</td>
                                  <td className="num mono">{formatCOP(ln.lineTotal)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

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
