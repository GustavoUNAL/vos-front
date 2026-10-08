import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchDailyCashClose,
  finalizeCashClose,
  upsertCashCloseRecord,
  downloadCashClosePdf,
  type DailyCashClose,
} from '../api'
import { downloadCashCloseReport } from '../lib/cashCloseDownload'
import {
  isCashCloseEditable,
  msUntilAutoClose,
} from '../lib/cashCloseTime'
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

function parseNum(v: string): number {
  const n = parseFloat(v.replace(',', '.').trim())
  return Number.isFinite(n) ? n : NaN
}

type Props = {
  baseUrl: string
  date: string
  refreshKey?: number
  onOpenSales?: (date: string) => void
  onOpenPurchases?: (date: string) => void
  companyName?: string | null
  showArqueo?: boolean
  onSaved?: () => void
}

export function CashClosePanel({
  baseUrl,
  date,
  refreshKey = 0,
  onOpenSales,
  onOpenPurchases,
  companyName,
  showArqueo = false,
  onSaved,
}: Props) {
  const [data, setData] = useState<DailyCashClose | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openingFloat, setOpeningFloat] = useState('')
  const [countedCash, setCountedCash] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchDailyCashClose(baseUrl, date)
      setData(res)
      setOpeningFloat(
        res.record?.openingFloatCOP != null
          ? String(res.record.openingFloatCOP)
          : '',
      )
      setCountedCash(
        res.record?.countedCashCOP != null
          ? String(res.record.countedCashCOP)
          : '',
      )
      setNotes(res.record?.notes ?? '')
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

  useEffect(() => {
    const waitMs = msUntilAutoClose(date)
    if (waitMs == null) return
    const timer = window.setTimeout(() => {
      void load()
      onSaved?.()
    }, waitMs + 500)
    return () => window.clearTimeout(timer)
  }, [date, load, onSaved])

  const isEditable =
    data?.meta?.isEditable ??
    isCashCloseEditable(date, data?.record?.status ?? null)
  const isClosed = Boolean(data) && !isEditable
  const expectedCash =
    (data?.summary.expectedCashCOP ?? 0) +
    (parseNum(openingFloat) >= 0 ? Math.round(parseNum(openingFloat)) : 0)
  const countedParsed = parseNum(countedCash)
  const variance =
    Number.isFinite(countedParsed) && countedParsed >= 0
      ? countedParsed - expectedCash
      : null

  const topProducts = useMemo(() => {
    if (!data?.sales.length) return []
    const map = new Map<string, { name: string; quantity: number; revenue: number }>()
    for (const sale of data.sales) {
      for (const line of sale.lines) {
        const key = line.productName.trim() || 'Sin nombre'
        const prev = map.get(key) ?? { name: key, quantity: 0, revenue: 0 }
        prev.quantity += line.quantity
        prev.revenue += line.lineTotal
        map.set(key, prev)
      }
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue)
  }, [data?.sales])

  const avgTicket =
    data && data.summary.saleCount > 0
      ? data.summary.salesTotalCOP / data.summary.saleCount
      : 0

  const saveArqueo = async () => {
    setActionError(null)
    if (!Number.isFinite(countedParsed) || countedParsed < 0) {
      setActionError('Indicá el efectivo contado en caja.')
      return
    }
    setSaving(true)
    try {
      const opening = parseNum(openingFloat)
      const res = await upsertCashCloseRecord(baseUrl, date, {
        openingFloatCOP: Number.isFinite(opening) && opening >= 0 ? Math.round(opening) : undefined,
        countedCashCOP: Math.round(countedParsed),
        notes: notes.trim() || null,
      })
      setData(res)
      onSaved?.()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No se pudo guardar el arqueo')
    } finally {
      setSaving(false)
    }
  }

  const closeDayAndDownload = async () => {
    setActionError(null)
    if (!Number.isFinite(countedParsed) || countedParsed < 0) {
      setActionError('Indicá el efectivo contado antes de cerrar la caja.')
      return
    }
    setSaving(true)
    try {
      const opening = parseNum(openingFloat)
      await upsertCashCloseRecord(baseUrl, date, {
        openingFloatCOP:
          Number.isFinite(opening) && opening >= 0 ? Math.round(opening) : undefined,
        countedCashCOP: Math.round(countedParsed),
        notes: notes.trim() || null,
      })
      const res = await finalizeCashClose(baseUrl, date)
      setData(res)
      onSaved?.()
      await downloadCashClosePdf(baseUrl, date)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No se pudo cerrar la caja')
    } finally {
      setSaving(false)
    }
  }

  const downloadPdf = async () => {
    setActionError(null)
    try {
      await downloadCashClosePdf(baseUrl, date)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No se pudo descargar el PDF')
    }
  }

  return (
    <section className="cash-close-panel" aria-labelledby="cash-close-title">
      <div className="cash-close-panel__toolbar">
        <p id="cash-close-title" className="cash-close-panel__toolbar-date">
          {formatLongDate(date)}
        </p>
        <div className="cash-close-panel__toolbar-actions">
          {data ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void downloadPdf()}
              >
                Descargar PDF
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => downloadCashCloseReport(data)}
              >
                CSV
              </Button>
            </>
          ) : null}
          {isClosed ? (
            <span className="cash-close-panel__status cash-close-panel__status--closed">
              Caja cerrada
            </span>
          ) : isEditable ? (
            <span className="cash-close-panel__status cash-close-panel__status--draft">
              Abierto · cierre 11:59 p. m.
            </span>
          ) : null}
        </div>
      </div>

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
                  {data.summary.saleCount > 0
                    ? ` · ticket ${formatCOP(avgTicket)}`
                    : ''}
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
              <div className="cash-close-kpi">
                <span className="cash-close-kpi__label">Nómina del día</span>
                <strong>{formatCOP(data.summary.laborTotalCOP)}</strong>
                <span className="muted small">
                  {data.summary.shiftCount} turno
                  {data.summary.shiftCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="cash-close-kpi cash-close-kpi--accent">
                <span className="cash-close-kpi__label">Neto del día</span>
                <strong>{formatCOP(data.summary.netCOP)}</strong>
              </div>
            </div>

            <div className="cash-close-panel__channels" aria-label="Cobros del día">
              <div className="cash-close-channel cash-close-channel--nequi">
                <span>Nequi</span>
                <strong className="mono">{formatCOP(data.summary.nequiCOP ?? 0)}</strong>
              </div>
              <div className="cash-close-channel cash-close-channel--cash">
                <span>Caja / efectivo</span>
                <strong className="mono">{formatCOP(data.summary.cashCOP ?? 0)}</strong>
              </div>
              {(data.summary.otherPayCOP ?? 0) > 0 ? (
                <div className="cash-close-channel">
                  <span>Otros medios</span>
                  <strong className="mono">{formatCOP(data.summary.otherPayCOP ?? 0)}</strong>
                </div>
              ) : null}
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

          {showArqueo ? (
            <div className="cash-close-arqueo">
              <h2 className="cash-close-panel__section-label">Arqueo de caja</h2>
              {data.meta?.needsCount ? (
                <p className="banner-warn" role="status">
                  Este día se archivó solo a las 11:59 p. m. El efectivo contado sigue pendiente: anotalo acá.
                </p>
              ) : null}
              <p className="muted small cash-close-arqueo__lead">
                Efectivo esperado según ventas:{' '}
                <strong className="mono">
                  {formatCOP(data.summary.expectedCashCOP ?? 0)}
                </strong>
              </p>
              <div className="cash-close-arqueo__grid">
                <label className="cash-close-arqueo__field">
                  <span>Fondo inicial (COP)</span>
                  <input
                    className="input-cell mono"
                    inputMode="decimal"
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(e.target.value)}
                    disabled={!isEditable || saving}
                    placeholder="0"
                  />
                </label>
                <label className="cash-close-arqueo__field">
                  <span>Efectivo esperado (COP)</span>
                  <input
                    className="input-cell mono cash-close-arqueo__readonly"
                    value={String(Math.round(expectedCash))}
                    readOnly
                  />
                </label>
                <label className="cash-close-arqueo__field">
                  <span>Efectivo contado (COP)</span>
                  <input
                    className="input-cell mono"
                    inputMode="decimal"
                    value={countedCash}
                    onChange={(e) => setCountedCash(e.target.value)}
                    disabled={!isEditable || saving}
                    placeholder="Contá el dinero en caja"
                  />
                </label>
                <label className="cash-close-arqueo__field">
                  <span>Diferencia (COP)</span>
                  <input
                    className={`input-cell mono cash-close-arqueo__readonly${variance != null && variance !== 0 ? ' cash-close-arqueo__variance' : ''}`}
                    value={variance != null ? String(Math.round(variance)) : ''}
                    readOnly
                  />
                </label>
              </div>
              <label className="cash-close-arqueo__field cash-close-arqueo__field--notes">
                <span>Notas del cierre</span>
                <textarea
                  className="input-cell"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!isEditable || saving}
                  placeholder="Observaciones, faltantes, justificación…"
                />
              </label>
              {actionError ? (
                <p className="error" role="alert">
                  {actionError}
                </p>
              ) : null}
              {!isEditable ? (
                data.record?.closedAt ? (
                  <p className="muted small cash-close-arqueo__closed-at">
                    Cerrado el{' '}
                    {new Intl.DateTimeFormat('es-CO', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(data.record.closedAt))}
                  </p>
                ) : (
                  <p className="muted small cash-close-arqueo__closed-at">
                    Cierre automático a las 11:59 p. m.
                  </p>
                )
              ) : (
                <div className="cash-close-arqueo__actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={saving}
                    onClick={() => void saveArqueo()}
                  >
                    {saving ? 'Guardando…' : 'Guardar arqueo'}
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={saving}
                    onClick={() => void closeDayAndDownload()}
                  >
                    {saving ? 'Cerrando…' : 'Cerrar el día y descargar PDF'}
                  </button>
                </div>
              )}
            </div>
          ) : null}

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

          <div className="cash-close-panel__sales-zone">
            <h2 className="cash-close-panel__section-label">Productos vendidos</h2>
            {topProducts.length > 0 ? (
              <ul className="cash-close-panel__product-list">
                {topProducts.map((p) => (
                  <li key={p.name} className="cash-close-panel__product-item">
                    <span>
                      {p.name}
                      <span className="muted small">
                        {' '}
                        · {p.quantity} uds.
                      </span>
                    </span>
                    <span className="mono">{formatCOP(p.revenue)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small cash-close-panel__empty">
                Sin productos vendidos este día.
              </p>
            )}
          </div>

          {data.purchases.length > 0 ? (
            <div className="cash-close-panel__sales-zone">
              <div className="cash-close-panel__sales-zone-head">
                <h2 className="cash-close-panel__section-label">Compras del día</h2>
                {onOpenPurchases ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenPurchases(date)}
                  >
                    Ir a Compras
                  </Button>
                ) : null}
              </div>
              <ul className="cash-close-panel__sales">
                {data.purchases.map((lot) => (
                  <li key={lot.id} className="cash-close-panel__purchase-item">
                    <span>
                      {lot.name || lot.code}
                      <span className="muted small">
                        {' '}
                        · {lot.lineCount} línea
                        {lot.lineCount !== 1 ? 's' : ''}
                      </span>
                    </span>
                    <span className="mono">{formatCOP(lot.total)}</span>
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
