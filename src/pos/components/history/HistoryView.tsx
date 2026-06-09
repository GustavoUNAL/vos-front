import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { fetchPosTables } from '../../services/posApi'
import {
  fetchSales,
  formatPurchaseLotDate,
  saleListRowLineCount,
  saleRowTotalNumeric,
  type SaleListRow,
} from '../../../api'
import { ORDER_STATUS_LABEL } from '../../constants'
import { formatCOP } from '../../lib/money'
import { formatPosOrderCode } from '../../lib/orderCode'
import {
  saleDisplayClient,
  saleDisplayCode,
  saleDisplayExtras,
  saleDisplayTime,
  saleRowFromListRow,
} from '../../../lib/saleListDisplay'
import { todayISO } from '../../lib/time'
import { fetchPosOrders } from '../../services/posApi'
import { usePosStore } from '../../store/posStore'
import type { OrderStatus, PosOrder } from '../../types'
import { PosEmpty } from '../ui/PosEmpty'
import { PosErrorBanner } from '../ui/PosErrorBanner'
import { PosLoader } from '../ui/PosLoader'

type Props = { baseUrl: string }
type Tab = 'today' | 'open' | 'closed'

type HistoryRow =
  | {
      kind: 'pos'
      id: string
      at: string
      tableLabel: string
      status: OrderStatus
      lineCount: number
      totalCOP: number
      order: PosOrder
    }
  | {
      kind: 'sale'
      id: string
      at: string
      tableLabel: string
      status: 'paid'
      lineCount: number
      totalCOP: number
      sale: SaleListRow
    }

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: iso, time: '' }
  return {
    date: new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(d),
    time: new Intl.DateTimeFormat('es-CO', { timeStyle: 'short' }).format(d),
  }
}

function saleRowToHistory(sale: SaleListRow): HistoryRow {
  const total = saleRowTotalNumeric(sale) ?? 0
  const at = sale.saleDate
  return {
    kind: 'sale',
    id: sale.id,
    at,
    tableLabel: sale.mesa?.trim() || '—',
    status: 'paid',
    lineCount: saleListRowLineCount(sale),
    totalCOP: total,
    sale,
  }
}

function posRowToHistory(order: PosOrder, tableNumber?: number): HistoryRow {
  const label =
    order.tableName?.trim() ||
    (tableNumber != null ? `Mesa ${tableNumber}` : order.tableId)
  return {
    kind: 'pos',
    id: order.id,
    at: order.paidAt ?? order.closedAt ?? order.openedAt,
    tableLabel: label,
    status: order.status,
    lineCount: order.lines.length,
    totalCOP: order.totalCOP,
    order,
  }
}

export function HistoryView({ baseUrl }: Props) {
  const { navigate } = usePosStore()
  const [tables, setTables] = useState<{ id: string; number: number }[]>([])
  const [tab, setTab] = useState<Tab>('today')
  const [dateFrom, setDateFrom] = useState(todayISO())
  const [dateTo, setDateTo] = useState(todayISO())
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchPosTables(baseUrl)
      .then((list) => setTables(list.map((t) => ({ id: t.id, number: t.number }))))
      .catch(() => {})
  }, [baseUrl])

  const tableById = useMemo(() => {
    const m = new Map<string, { number: number }>()
    for (const t of tables) m.set(t.id, t)
    return m
  }, [tables])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let posStatus: string | undefined
      if (tab === 'open') posStatus = 'open'
      if (tab === 'closed') posStatus = 'paid'

      const [posOrders, salesRes] = await Promise.all([
        fetchPosOrders(baseUrl, {
          status: posStatus,
          dateFrom,
          dateTo,
        }).catch(() => [] as PosOrder[]),
        tab !== 'open'
          ? fetchSales(baseUrl, {
              page: 1,
              limit: 100,
              dateFrom,
              dateTo,
            }).catch(() => null)
          : Promise.resolve(null),
      ])

      const posRows = posOrders.map((o) => {
        const t = tableById.get(o.tableId)
        return posRowToHistory(o, t?.number)
      })

      const saleRows: HistoryRow[] = []
      if (salesRes?.data?.length) {
        for (const s of salesRes.data) {
          saleRows.push(saleRowToHistory(s))
        }
      }

      const merged = [...posRows, ...saleRows]
      const seen = new Set<string>()
      const deduped = merged.filter((r) => {
        const key = `${r.kind}:${r.id}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      let filtered = deduped
      if (tab === 'today') {
        filtered = deduped.filter(
          (r) => r.status === 'paid' || r.status === 'open' || r.status === 'closing',
        )
      } else if (tab === 'open') {
        filtered = deduped.filter(
          (r) => r.kind === 'pos' && (r.status === 'open' || r.status === 'closing'),
        )
      } else if (tab === 'closed') {
        filtered = deduped.filter((r) => r.status === 'paid')
      }

      filtered.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      setRows(filtered)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar ventas')
    } finally {
      setLoading(false)
    }
  }, [baseUrl, tab, dateFrom, dateTo, tableById])

  useEffect(() => {
    void load()
  }, [load])

  const summary = useMemo(() => {
    const paid = rows.filter((r) => r.status === 'paid')
    const total = paid.reduce((s, r) => s + r.totalCOP, 0)
    const open = rows.filter(
      (r) => r.status === 'open' || r.status === 'closing',
    ).length
    return { total, count: paid.length, open }
  }, [rows])

  return (
    <div className="pos-screen pos-screen--history">
      <header className="pos-topbar">
        <div>
          <h1 className="pos-topbar__title">Ventas</h1>
          <p className="pos-topbar__sub muted">
            {summary.count} cobradas · {formatCOP(summary.total)}
            {summary.open > 0 && ` · ${summary.open} abiertas`}
          </p>
        </div>
        <button
          type="button"
          className="pos-btn pos-btn--ghost"
          onClick={() => navigate('tables')}
        >
          ← Mesas
        </button>
      </header>

      <div className="pos-summary-deck">
        <div className="pos-summary-card">
          <span className="pos-summary-card__label">Total cobrado</span>
          <strong className="pos-summary-card__value">{formatCOP(summary.total)}</strong>
        </div>
        <div className="pos-summary-card">
          <span className="pos-summary-card__label">Tickets</span>
          <strong className="pos-summary-card__value">{summary.count}</strong>
        </div>
        <div className="pos-summary-card">
          <span className="pos-summary-card__label">Cuentas abiertas</span>
          <strong className="pos-summary-card__value">{summary.open}</strong>
        </div>
      </div>

      <div className="pos-tabs" role="tablist">
        {(
          [
            ['today', 'Hoy'],
            ['open', 'Abiertas'],
            ['closed', 'Cerradas'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`pos-chip${tab === id ? ' pos-chip--active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="pos-filters">
        <label className="pos-field pos-field--inline">
          <span>Desde</span>
          <input
            type="date"
            className="pos-input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </label>
        <label className="pos-field pos-field--inline">
          <span>Hasta</span>
          <input
            type="date"
            className="pos-input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </label>
        <button type="button" className="pos-btn pos-btn--primary" onClick={() => void load()}>
          Filtrar
        </button>
      </div>

      <PosErrorBanner message={error ?? ''} />

      {loading ? (
        <PosLoader label="Cargando ventas…" />
      ) : rows.length === 0 ? (
        <PosEmpty
          title="Sin ventas en este rango"
          hint="Probá ampliar las fechas o registrá una venta desde el POS"
        />
      ) : (
        <div className="pos-sales-table-wrap">
          <table className="pos-sales-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Hora</th>
                <th>Detalle</th>
                <th className="num">Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rowKey = `${row.kind}:${row.id}`
                const { date } = formatDateTime(row.at)
                const expanded = expandedId === rowKey
                const statusLabel =
                  row.kind === 'pos'
                    ? ORDER_STATUS_LABEL[row.status] ?? row.status
                    : 'Pagada'
                const saleDisplay =
                  row.kind === 'sale'
                    ? saleRowFromListRow(row.sale)
                    : {
                        id: row.id,
                        code: formatPosOrderCode(row.order),
                        saleDate: row.at,
                        mesa: row.order.mesa ?? row.tableLabel,
                        paymentMethod: row.order.paymentMethod ?? undefined,
                        notes: row.order.attendedBy
                          ? `Atendió: ${row.order.attendedBy}`
                          : row.order.notes,
                        source: 'POS',
                        lineCount: row.lineCount,
                      }
                const client = saleDisplayClient(saleDisplay)
                const extras = saleDisplayExtras(saleDisplay)
                return (
                  <Fragment key={rowKey}>
                    <tr
                      className={`pos-sales-row${expanded ? ' pos-sales-row--expanded' : ''}`}
                    >
                      <td className="mono" title={row.id}>
                        <button
                          type="button"
                          className="pos-sales-datetime"
                          onClick={() =>
                            setExpandedId(expanded ? null : rowKey)
                          }
                        >
                          <strong>{saleDisplayCode(saleDisplay)}</strong>
                          <span className="muted small">{date}</span>
                        </button>
                      </td>
                      <td>{client}</td>
                      <td className="mono">{saleDisplayTime(row.at)}</td>
                      <td className="muted small">
                        {extras.length > 0 ? extras.join(' · ') : '—'}
                      </td>
                      <td className="num pos-sales-total">{formatCOP(row.totalCOP)}</td>
                      <td>
                        <span
                          className={`pos-status-tag pos-status-tag--${row.status}`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                    {expanded && row.kind === 'pos' && row.order.lines.length > 0 && (
                      <tr className="pos-sales-detail-row">
                        <td colSpan={6}>
                          <ul className="pos-sales-lines">
                            {row.order.lines.map((l) => (
                              <li key={l.id}>
                                <span>
                                  {l.quantity}× {l.productName}
                                </span>
                                <span className="muted">
                                  {formatCOP(l.quantity * l.unitPrice)}
                                </span>
                                {l.notes && (
                                  <span className="pos-sales-line-note">{l.notes}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                    {expanded && row.kind === 'sale' && (
                      <tr className="pos-sales-detail-row">
                        <td colSpan={6}>
                          <p className="muted small">
                            {row.sale.paymentMethod && (
                              <>Pago: {row.sale.paymentMethod} · </>
                            )}
                            {row.sale.displayPerson && (
                              <>Por: {row.sale.displayPerson} · </>
                            )}
                            {row.sale.saleDateOnly
                              ? formatPurchaseLotDate(row.sale.saleDateOnly, 'medium')
                              : null}
                            {row.sale.notes?.trim() && (
                              <> · {row.sale.notes.trim()}</>
                            )}
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
