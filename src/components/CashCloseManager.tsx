import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchCashCloseCalendar, fetchFinancialAnalytics } from '../api'
import { CashClosePanel } from './CashClosePanel'
import { MonthCalendar } from './MonthCalendar'
import { ViewBootSplash } from './DataLoadingSplash'
import { useFirstName } from '../hooks/useSessionUser'
import { namedCopy } from '../lib/userIdentity'
import {
  getOpenPosTables,
  type OpenPosTableSnapshot,
} from '../pos/lib/openTablesSnapshot'
import { mobileViewClass } from './mobile/mobileView'
import { formatCOP } from '../lib/money'
import { bogotaDateKey } from '../lib/cashCloseTime'

function addDaysKey(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

function mondayOf(ref: string): string {
  const [y, m, d] = ref.split('-').map(Number)
  const noon = new Date(`${ref}T12:00:00-05:00`)
  const dow = noon.getUTCDay()
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  return new Date(Date.UTC(y, m - 1, d + mondayOffset)).toISOString().slice(0, 10)
}

function weekDayKeys(ref: string): string[] {
  const monday = mondayOf(ref)
  return Array.from({ length: 7 }, (_, i) => addDaysKey(monday, i))
}

function weekdayShort(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(`${iso}T12:00:00-05:00`))
}

function dayNum(iso: string): string {
  return iso.slice(8, 10)
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(d)
}

type Props = {
  baseUrl: string
  companyName?: string | null
  inaugurationDate?: string | null
  onOpenSales?: (date: string) => void
  onOpenPurchases?: (date: string) => void
  onOpenPos?: (tableId?: string) => void
}

export function CashCloseManager({
  baseUrl,
  companyName,
  inaugurationDate = null,
  onOpenSales,
  onOpenPurchases,
  onOpenPos,
}: Props) {
  const todayKey = bogotaDateKey()
  const [calendarYear, setCalendarYear] = useState(() => Number(todayKey.slice(0, 4)))
  const [calendarMonth, setCalendarMonth] = useState(() => Number(todayKey.slice(5, 7)))
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [cashCloseCalendar, setCashCloseCalendar] = useState<
    Awaited<ReturnType<typeof fetchCashCloseCalendar>> | null
  >(null)
  const [calendarLoading, setCalendarLoading] = useState(true)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [panelRefreshKey, setPanelRefreshKey] = useState(0)
  const [openPosTables, setOpenPosTables] = useState<OpenPosTableSnapshot[]>(() =>
    getOpenPosTables(),
  )
  const [weekSummary, setWeekSummary] = useState<{
    salesCOP: number
    purchasesCOP: number
    salesCount: number
    purchasesCount: number
    netCOP: number
  } | null>(null)
  const [weekLoading, setWeekLoading] = useState(false)
  const first = useFirstName()

  const weekKeys = useMemo(() => weekDayKeys(selectedDate), [selectedDate])

  const shiftMonth = (delta: number) => {
    const d = new Date(calendarYear, calendarMonth - 1 + delta, 1)
    setCalendarYear(d.getFullYear())
    setCalendarMonth(d.getMonth() + 1)
  }

  const goToday = () => {
    const today = bogotaDateKey()
    const [y, m] = today.split('-').map(Number)
    setCalendarYear(y)
    setCalendarMonth(m)
    setSelectedDate(today)
  }

  const selectDate = (date: string) => {
    setSelectedDate(date)
    const [y, m] = date.split('-').map(Number)
    setCalendarYear(y)
    setCalendarMonth(m)
  }

  useEffect(() => {
    const refresh = () => setOpenPosTables(getOpenPosTables())
    refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])

  useEffect(() => {
    let cancelled = false
    setCalendarLoading(true)
    setCalendarError(null)

    void fetchCashCloseCalendar(baseUrl, calendarYear, calendarMonth)
      .then((calendar) => {
        if (!cancelled) setCashCloseCalendar(calendar)
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setCalendarError(e.message)
          setCashCloseCalendar(null)
        }
      })
      .finally(() => {
        if (!cancelled) setCalendarLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [baseUrl, calendarYear, calendarMonth, panelRefreshKey])

  useEffect(() => {
    let cancelled = false
    setWeekLoading(true)
    const from = weekKeys[0]
    const to = weekKeys[6]
    void fetchFinancialAnalytics(baseUrl, {
      dateFrom: from,
      dateTo: to,
      granularity: 'day',
    })
      .then((res) => {
        if (cancelled) return
        setWeekSummary({
          salesCOP: res.summary.salesCOP,
          purchasesCOP: res.summary.purchasesCOP,
          salesCount: res.sales.totals.count,
          purchasesCount: res.purchases.totals.count,
          netCOP: res.summary.netCOP,
        })
      })
      .catch(() => {
        if (!cancelled) setWeekSummary(null)
      })
      .finally(() => {
        if (!cancelled) setWeekLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [baseUrl, weekKeys, panelRefreshKey])

  const handleSaved = useCallback(() => {
    setPanelRefreshKey((k) => k + 1)
  }, [])

  const dayMeta = useMemo(() => {
    const map = new Map<string, { count: number; totalCOP: number }>()
    for (const day of cashCloseCalendar?.days ?? []) {
      map.set(day.date, {
        count: day.count,
        totalCOP: Number(day.totalCOP) || 0,
      })
    }
    return map
  }, [cashCloseCalendar])

  return (
    <div className={mobileViewClass('cash-close', 'cash-close-manager')}>
      <header className="cash-close-manager__head">
        <div>
          <h1 className="cash-close-manager__title">Cierre del día</h1>
          <p className="cash-close-manager__lead muted">
            {namedCopy(
              first,
              '{name}, seleccione un día en el calendario para registrar el arqueo. El cierre es a las 11:59 p. m.',
              'Seleccione un día en el calendario para registrar el arqueo. El cierre es a las 11:59 p. m.',
            )}
          </p>
        </div>
      </header>

      <section className="cash-close-manager__week" aria-label="Semana en foco">
        <div className="cash-close-manager__week-head">
          <div>
            <p className="cash-close-manager__week-kicker">Semana</p>
            <strong>
              {weekdayShort(weekKeys[0])} {dayNum(weekKeys[0])} –{' '}
              {weekdayShort(weekKeys[6])} {dayNum(weekKeys[6])}
            </strong>
          </div>
          <dl className="cash-close-manager__week-stats">
            <div>
              <dt>Ventas</dt>
              <dd>{weekLoading ? '…' : formatCOP(weekSummary?.salesCOP ?? 0)}</dd>
              <small>
                {weekLoading ? '' : `${weekSummary?.salesCount ?? 0} ops`}
              </small>
            </div>
            <div>
              <dt>Compras</dt>
              <dd>
                {weekLoading ? '…' : formatCOP(weekSummary?.purchasesCOP ?? 0)}
              </dd>
              <small>
                {weekLoading ? '' : `${weekSummary?.purchasesCount ?? 0} lotes`}
              </small>
            </div>
            <div>
              <dt>Neto</dt>
              <dd
                className={
                  (weekSummary?.netCOP ?? 0) < 0 ? 'is-neg' : undefined
                }
              >
                {weekLoading ? '…' : formatCOP(weekSummary?.netCOP ?? 0)}
              </dd>
            </div>
          </dl>
        </div>
        <div className="cash-close-manager__week-strip" role="listbox" aria-label="Días de la semana">
          {weekKeys.map((day) => {
            const meta = dayMeta.get(day)
            const active = day === selectedDate
            return (
              <button
                key={day}
                type="button"
                role="option"
                aria-selected={active}
                className={`cash-close-manager__week-day${active ? ' is-active' : ''}`}
                onClick={() => selectDate(day)}
              >
                <span>{weekdayShort(day)}</span>
                <strong>{dayNum(day)}</strong>
                <small>
                  {meta?.count
                    ? `${meta.count} · ${formatCOP(meta.totalCOP)}`
                    : '—'}
                </small>
              </button>
            )
          })}
        </div>
        <div className="cash-close-manager__day-nav">
          <button
            type="button"
            className="btn-secondary btn-compact"
            onClick={() => selectDate(addDaysKey(selectedDate, -1))}
          >
            ← Día anterior
          </button>
          <button
            type="button"
            className="btn-secondary btn-compact"
            onClick={goToday}
          >
            Hoy
          </button>
          <button
            type="button"
            className="btn-secondary btn-compact"
            onClick={() => selectDate(addDaysKey(selectedDate, 1))}
          >
            Día siguiente →
          </button>
        </div>
      </section>

      {onOpenPos && openPosTables.length > 0 ? (
        <section className="cash-close-manager__pos-alert" aria-label="Mesas abiertas en punto de venta">
          <div className="cash-close-manager__pos-alert-head">
            <div>
              <h2 className="cash-close-manager__pos-alert-title">Mesas abiertas en punto de venta</h2>
              <p className="muted small">
                {openPosTables.length} comanda
                {openPosTables.length !== 1 ? 's' : ''} pendiente
                {openPosTables.length !== 1 ? 's' : ''} de cobro
              </p>
            </div>
            <button
              type="button"
              className="btn-primary btn-compact"
              onClick={() => onOpenPos()}
            >
              Ir al punto de venta
            </button>
          </div>
          <ul className="cash-close-manager__open-tables">
            {openPosTables.map((table) => (
              <li key={table.tableId} className="cash-close-manager__open-table">
                <div>
                  <span className="cash-close-manager__open-table-name">{table.tableName}</span>
                  <span className="muted small">
                    {table.lineCount} {table.lineCount === 1 ? 'producto' : 'productos'}
                    {table.openedAt ? ` · abierta ${formatTime(table.openedAt)}` : ''}
                  </span>
                </div>
                <div className="cash-close-manager__open-table-actions">
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

      <div className="cash-close-manager__layout">
        <aside className="cash-close-manager__calendars" aria-label="Calendario del mes">
          <div className="cash-close-manager__calendar-card">
            <MonthCalendar
              year={calendarYear}
              month={calendarMonth}
              days={cashCloseCalendar?.days ?? []}
              loading={calendarLoading && !cashCloseCalendar}
              error={calendarError}
              countLabel="venta"
              showZeroForPastDays
              selectedDate={selectedDate}
              inaugurationDate={inaugurationDate}
              onDayClick={selectDate}
              onPrevMonth={() => shiftMonth(-1)}
              onNextMonth={() => shiftMonth(1)}
              onToday={goToday}
            />
            <ul className="cash-close-manager__legend" aria-label="Estado del cierre">
              <li>
                <span className="cash-close-manager__legend-dot cash-close-manager__legend-dot--closed" />
                Cerrado
              </li>
              <li>
                <span className="cash-close-manager__legend-dot cash-close-manager__legend-dot--draft" />
                Borrador
              </li>
              <li>
                <span className="cash-close-manager__legend-dot cash-close-manager__legend-dot--open" />
                Abierto
              </li>
            </ul>
            {cashCloseCalendar ? (
              <p className="cash-close-manager__calendar-meta muted small">
                {cashCloseCalendar.totals.closedDays} día
                {cashCloseCalendar.totals.closedDays !== 1 ? 's' : ''} cerrado
                {cashCloseCalendar.totals.closedDays !== 1 ? 's' : ''} este mes
              </p>
            ) : null}
          </div>
        </aside>

        <div className="cash-close-manager__detail">
          {calendarLoading && !cashCloseCalendar ? (
            <ViewBootSplash ready={false} label="Cargando cierre del día…" />
          ) : (
            <CashClosePanel
              baseUrl={baseUrl}
              date={selectedDate}
              refreshKey={panelRefreshKey}
              companyName={companyName}
              onOpenSales={onOpenSales}
              onOpenPurchases={onOpenPurchases}
              onSaved={handleSaved}
              showArqueo
            />
          )}
        </div>
      </div>
    </div>
  )
}
