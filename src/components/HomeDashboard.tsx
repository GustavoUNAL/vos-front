import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchPurchaseLotsCalendar,
  fetchSale,
  fetchSales,
  fetchSalesCalendar,
  saleListRowLineCount,
  saleRowTotalNumeric,
  type SaleListRow,
} from '../api'
import { useMatchMedia } from '../hooks/useMatchMedia'
import { BRAND_NAME } from '../lib/brand'
import { displayCompanyName } from '../lib/displayLabels'
import { MOBILE_FILTER_BREAKPOINT } from './MobileAwareFilterBar'
import { mobileViewClass } from './mobile/mobileView'
import { DayDetailModal } from './DayDetailModal'
import { ViewBootSplash } from './DataLoadingSplash'
import { MonthCalendar } from './MonthCalendar'
import {
  getOpenPosTables,
  type OpenPosTableSnapshot,
} from '../pos/lib/openTablesSnapshot'

function localDateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

/** Encabezado corto para móvil (sin año; cabe en una línea). */
function formatMobileTodayTitle(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d, 12, 0, 0)
  const label = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(dt)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

const MOBILE_SALES_PREVIEW = 5

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CO', { timeStyle: 'short' }).format(d)
}

type ProductAgg = {
  name: string
  quantity: number
  revenue: number
}

type HomeDashboardProps = {
  baseUrl: string
  companyName?: string | null
  inaugurationDate?: string | null
  onOpenSales: (date: string) => void
  onOpenPurchases: (date: string) => void
  onOpenPos: (tableId?: string) => void
}

export function HomeDashboard({
  baseUrl,
  companyName,
  inaugurationDate = null,
  onOpenSales,
  onOpenPurchases,
  onOpenPos,
}: HomeDashboardProps) {
  const isMobile = useMatchMedia(MOBILE_FILTER_BREAKPOINT)
  const todayKey = useMemo(() => localDateKey(), [])
  const now = new Date()
  const [calendarYear, setCalendarYear] = useState(now.getFullYear())
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth() + 1)
  const [dayDetailDate, setDayDetailDate] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [salesToday, setSalesToday] = useState<SaleListRow[]>([])
  const [topProducts, setTopProducts] = useState<ProductAgg[]>([])
  const [salesCalendar, setSalesCalendar] = useState<
    Awaited<ReturnType<typeof fetchSalesCalendar>> | null
  >(null)
  const [purchasesCalendar, setPurchasesCalendar] = useState<
    Awaited<ReturnType<typeof fetchPurchaseLotsCalendar>> | null
  >(null)
  const [openPosTables, setOpenPosTables] = useState<OpenPosTableSnapshot[]>(() =>
    getOpenPosTables(),
  )

  const refreshOpenPosTables = useCallback(() => {
    setOpenPosTables(getOpenPosTables())
  }, [])

  useEffect(() => {
    refreshOpenPosTables()
    const onFocus = () => refreshOpenPosTables()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshOpenPosTables])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const salesResPromise = fetchSales(baseUrl, {
        dateFrom: todayKey,
        dateTo: todayKey,
        limit: 100,
        page: 1,
      })
      const salesCalPromise = fetchSalesCalendar(
        baseUrl,
        calendarYear,
        calendarMonth,
      )
      const purchasesCalPromise = isMobile
        ? Promise.resolve(null)
        : fetchPurchaseLotsCalendar(baseUrl, calendarYear, calendarMonth)

      const [salesRes, salesCal, purchasesCal] = await Promise.all([
        salesResPromise,
        salesCalPromise,
        purchasesCalPromise,
      ])
      setSalesToday(salesRes.data)
      setSalesCalendar(salesCal)
      setPurchasesCalendar(purchasesCal)

      if (isMobile) {
        setTopProducts([])
        return
      }

      const ids = salesRes.data.map((s) => s.id).slice(0, 40)
      if (ids.length === 0) {
        setTopProducts([])
        return
      }
      const details = await Promise.all(
        ids.map((id) => fetchSale(baseUrl, id).catch(() => null)),
      )
      const agg = new Map<string, ProductAgg>()
      for (const detail of details) {
        if (!detail?.lines) continue
        for (const line of detail.lines) {
          const qty = parseFloat(String(line.quantity))
          const unit = parseFloat(String(line.unitPrice ?? line.unitPriceCOP ?? 0))
          if (!Number.isFinite(qty) || qty <= 0) continue
          const revenue = Number.isFinite(unit) ? qty * unit : 0
          const name = line.productName?.trim() || 'Sin nombre'
          const prev = agg.get(name)
          if (prev) {
            prev.quantity += qty
            prev.revenue += revenue
          } else {
            agg.set(name, { name, quantity: qty, revenue })
          }
        }
      }
      setTopProducts(
        [...agg.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar inicio')
    } finally {
      setLoading(false)
    }
  }, [baseUrl, calendarMonth, calendarYear, isMobile, todayKey])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    let total = 0
    for (const row of salesToday) {
      const n = saleRowTotalNumeric(row)
      if (n != null && Number.isFinite(n)) total += n
    }
    const count = salesToday.length
    const avg = count > 0 ? total / count : 0
    const byPayment = new Map<string, number>()
    for (const row of salesToday) {
      const pm = row.paymentMethod?.trim() || 'Sin especificar'
      byPayment.set(pm, (byPayment.get(pm) ?? 0) + 1)
    }
    return { count, total, avg, byPayment }
  }, [salesToday])

  const todayPurchase = useMemo(() => {
    const day = purchasesCalendar?.days.find((d) => d.date === todayKey)
    return {
      count: day?.count ?? 0,
      total: parseFloat(day?.totalCOP ?? '0') || 0,
    }
  }, [purchasesCalendar, todayKey])

  const isEmptyDay = stats.count === 0
  const brandLine = (() => {
    const name = displayCompanyName(companyName)
    return name ? `${BRAND_NAME} · ${name}` : BRAND_NAME
  })()
  const salesPreview = isMobile
    ? salesToday.slice(0, MOBILE_SALES_PREVIEW)
    : salesToday
  const hasMoreSales = isMobile && salesToday.length > MOBILE_SALES_PREVIEW

  return (
    <div
      className={mobileViewClass(
        'home',
        'home-dashboard',
        isMobile && 'home-dashboard--compact',
      )}
    >
      <header
        className={`home-dashboard__hero${isMobile ? ' home-dashboard__hero--compact' : ''}`}
      >
        {!isMobile ? (
          <p className="home-dashboard__brand muted small">{brandLine}</p>
        ) : null}
        <h1 className="home-dashboard__title">
          {isMobile ? formatMobileTodayTitle(todayKey) : formatLongDate(todayKey)}
        </h1>
        {!isMobile ? (
          <p className="home-dashboard__subtitle muted">
            Resumen de ventas y actividad del día
          </p>
        ) : null}
        {!isMobile ? (
          <div className="home-dashboard__hero-actions">
            <button
              type="button"
              className="btn-secondary btn-compact"
              onClick={() => {
                window.location.hash = '#/shop'
              }}
            >
              Tienda en línea
            </button>
            <button
              type="button"
              className="btn-secondary btn-compact"
              onClick={() => onOpenPos()}
            >
              POS
            </button>
          </div>
        ) : null}
      </header>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      {openPosTables.length > 0 ? (
        <section
          className="home-dashboard__pos-alert"
          aria-labelledby="home-open-tables"
        >
          <div className="home-dashboard__pos-alert-head">
            <div>
              <h2 id="home-open-tables">Mesas abiertas en POS</h2>
              <p className="muted small">
                {isMobile
                  ? `${openPosTables.length} pendiente${openPosTables.length !== 1 ? 's' : ''} de cobro`
                  : `${openPosTables.length} comanda${openPosTables.length !== 1 ? 's' : ''} pendiente${openPosTables.length !== 1 ? 's' : ''} de cobro en este dispositivo`}
              </p>
            </div>
            {!isMobile ? (
              <button
                type="button"
                className="btn-primary btn-compact"
                onClick={() => onOpenPos()}
              >
                Ir al POS
              </button>
            ) : null}
          </div>
          <ul className="home-dashboard__open-tables">
            {openPosTables.map((table) => (
              <li key={table.tableId} className="home-dashboard__open-table">
                <div>
                  <span className="home-dashboard__open-table-name">
                    {table.tableName}
                  </span>
                  <span className="home-dashboard__open-table-meta muted small">
                    {table.lineCount}{' '}
                    {table.lineCount === 1 ? 'producto' : 'productos'}
                    {table.openedAt
                      ? ` · abierta ${formatTime(table.openedAt)}`
                      : ''}
                    {table.status === 'closing' ? ' · cerrando' : ''}
                  </span>
                </div>
                <div className="home-dashboard__open-table-actions">
                  <strong className="mono">{formatCOP(table.totalCOP)}</strong>
                  <button
                    type="button"
                    className="btn-secondary btn-compact"
                    onClick={() => onOpenPos(table.tableId)}
                  >
                    Continuar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        className={`home-dashboard__kpi-grid${isEmptyDay ? ' home-dashboard__kpi-grid--empty' : ''}${isMobile ? ' home-dashboard__kpi-grid--mobile' : ''}`}
        aria-label="Indicadores del día"
      >
        <article className="home-dashboard__kpi home-dashboard__kpi--primary">
          <span className="home-dashboard__kpi-label">Ventas hoy</span>
          <strong className="home-dashboard__kpi-value">
            {loading ? '…' : stats.count}
          </strong>
        </article>
        <article className="home-dashboard__kpi home-dashboard__kpi--primary">
          <span className="home-dashboard__kpi-label">Total vendido</span>
          <strong className="home-dashboard__kpi-value">
            {loading ? '…' : formatCOP(stats.total)}
          </strong>
        </article>
        {!isMobile ? (
          <>
            <article className="home-dashboard__kpi">
              <span className="home-dashboard__kpi-label">Ticket promedio</span>
              <strong className="home-dashboard__kpi-value">
                {loading ? '…' : formatCOP(stats.avg)}
              </strong>
            </article>
            <article className="home-dashboard__kpi">
              <span className="home-dashboard__kpi-label">Compras hoy</span>
              <strong className="home-dashboard__kpi-value">
                {loading
                  ? '…'
                  : `${todayPurchase.count} · ${formatCOP(todayPurchase.total)}`}
              </strong>
            </article>
          </>
        ) : null}
      </section>

      {isEmptyDay && !loading ? (
        <p className="home-dashboard__empty-day" role="status">
          Hoy no se ha registrado ninguna venta todavía.
        </p>
      ) : null}

      <div className="home-dashboard__columns">
        <section className="home-dashboard__panel" aria-labelledby="home-sales-list">
          <div className="home-dashboard__panel-head">
            <h2 id="home-sales-list">Ventas de hoy</h2>
            <button
              type="button"
              className="btn-secondary btn-compact"
              onClick={() => onOpenSales(todayKey)}
            >
              Ver todas
            </button>
          </div>
          {loading ? (
            <p className="muted">Cargando ventas…</p>
          ) : salesToday.length === 0 ? (
            <p className="muted">Sin ventas registradas.</p>
          ) : (
            <ul className="home-dashboard__sale-list">
              {salesPreview.map((row) => (
                <li key={row.id} className="home-dashboard__sale-item">
                  <div>
                    <span className="home-dashboard__sale-time">
                      {formatTime(row.saleDate)}
                    </span>
                    <span className="home-dashboard__sale-meta muted small">
                      {row.paymentMethod?.trim() || '—'}
                      {row.mesa?.trim() ? ` · ${row.mesa.trim()}` : ''}
                      {!isMobile && saleListRowLineCount(row) > 0
                        ? ` · ${saleListRowLineCount(row)} ítems`
                        : ''}
                    </span>
                  </div>
                  <strong className="mono">
                    {formatCOP(saleRowTotalNumeric(row) ?? Number.NaN)}
                  </strong>
                </li>
              ))}
            </ul>
          )}
          {hasMoreSales ? (
            <p className="home-dashboard__sale-more muted small">
              +{salesToday.length - MOBILE_SALES_PREVIEW} ventas más hoy
            </p>
          ) : null}
        </section>

        {!isMobile ? (
        <section className="home-dashboard__panel" aria-labelledby="home-top-products">
          <h2 id="home-top-products">Productos vendidos hoy</h2>
          {loading ? (
            <p className="muted">Cargando detalle…</p>
          ) : topProducts.length === 0 ? (
            <p className="muted">Sin productos todavía.</p>
          ) : (
            <ul className="home-dashboard__product-list">
              {topProducts.map((p) => (
                <li key={p.name} className="home-dashboard__product-item">
                  <span>
                    {p.name}
                    <span className="muted small"> × {p.quantity}</span>
                  </span>
                  <span className="mono">{formatCOP(p.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
          {stats.byPayment.size > 0 ? (
            <div className="home-dashboard__payments">
              <h3 className="home-dashboard__payments-title">Formas de pago</h3>
              <ul className="home-dashboard__payments-list">
                {[...stats.byPayment.entries()].map(([method, n]) => (
                  <li key={method}>
                    <span>{method}</span>
                    <span className="muted">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
        ) : null}
      </div>

      <section
        className={`home-dashboard__calendars${isMobile ? ' home-dashboard__calendars--single' : ''}`}
        aria-label="Calendarios del mes"
      >
        <div className="home-dashboard__calendar-block">
          <MonthCalendar
            year={calendarYear}
            month={calendarMonth}
            days={salesCalendar?.days ?? []}
            loading={loading && !salesCalendar}
            error={null}
            countLabel="venta"
            showZeroForPastDays
            inaugurationDate={inaugurationDate}
            onPrevMonth={() => {
              const prev = new Date(calendarYear, calendarMonth - 2, 1)
              setCalendarYear(prev.getFullYear())
              setCalendarMonth(prev.getMonth() + 1)
            }}
            onNextMonth={() => {
              const next = new Date(calendarYear, calendarMonth, 1)
              setCalendarYear(next.getFullYear())
              setCalendarMonth(next.getMonth() + 1)
            }}
            onToday={() => {
              const t = new Date()
              setCalendarYear(t.getFullYear())
              setCalendarMonth(t.getMonth() + 1)
            }}
            onDayClick={(date) => setDayDetailDate(date)}
          />
        </div>
        {!isMobile ? (
          <div className="home-dashboard__calendar-block">
            <MonthCalendar
              year={calendarYear}
              month={calendarMonth}
              days={purchasesCalendar?.days ?? []}
              loading={loading && !purchasesCalendar}
              error={null}
              countLabel="compra"
              showZeroForPastDays
              inaugurationDate={inaugurationDate}
              onPrevMonth={() => {
                const prev = new Date(calendarYear, calendarMonth - 2, 1)
                setCalendarYear(prev.getFullYear())
                setCalendarMonth(prev.getMonth() + 1)
              }}
              onNextMonth={() => {
                const next = new Date(calendarYear, calendarMonth, 1)
                setCalendarYear(next.getFullYear())
                setCalendarMonth(next.getMonth() + 1)
              }}
              onToday={() => {
                const t = new Date()
                setCalendarYear(t.getFullYear())
                setCalendarMonth(t.getMonth() + 1)
              }}
              onDayClick={(date) => onOpenPurchases(date)}
            />
          </div>
        ) : null}
      </section>

      <ViewBootSplash ready={!loading} label="Cargando inicio…" />

      {dayDetailDate ? (
        <DayDetailModal
          baseUrl={baseUrl}
          date={dayDetailDate}
          companyName={companyName}
          onClose={() => setDayDetailDate(null)}
          onOpenSales={(d) => {
            setDayDetailDate(null)
            onOpenSales(d)
          }}
          onOpenPurchases={(d) => {
            setDayDetailDate(null)
            onOpenPurchases(d)
          }}
        />
      ) : null}
    </div>
  )
}
