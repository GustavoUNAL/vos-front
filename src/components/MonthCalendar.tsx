import { useMemo } from 'react'

export type MonthCalendarDay = {
  date: string
  count: number
  totalCOP: string
}

type MonthCalendarProps = {
  year: number
  month: number
  days: MonthCalendarDay[]
  loading?: boolean
  error?: string | null
  /** Etiqueta singular para el contador, ej. "venta" o "compra". */
  countLabel: string
  /** Días pasados/hoy sin movimiento: mostrar 0 y fondo rojo suave. */
  showZeroForPastDays?: boolean
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
  onDayClick: (date: string) => void
}

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

const WEEKDAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

function formatCOP(value: string): string {
  const n = parseFloat(String(value).replace(',', '.'))
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n)
}

function padDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function MonthCalendar({
  year,
  month,
  days,
  loading,
  error,
  countLabel,
  showZeroForPastDays = true,
  onPrevMonth,
  onNextMonth,
  onToday,
  onDayClick,
}: MonthCalendarProps) {
  const dayMap = useMemo(
    () => new Map(days.map((d) => [d.date, d])),
    [days],
  )

  const cells = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate()
    const leading = (new Date(year, month - 1, 1).getDay() + 6) % 7
    const out: Array<{ date: string | null; data?: MonthCalendarDay }> = []
    for (let i = 0; i < leading; i += 1) out.push({ date: null })
    for (let d = 1; d <= daysInMonth; d += 1) {
      const date = padDate(year, month, d)
      out.push({ date, data: dayMap.get(date) })
    }
    return out
  }, [dayMap, month, year])

  const monthSummary = useMemo(() => {
    let count = 0
    let total = 0
    for (const d of days) {
      count += d.count
      const n = parseFloat(d.totalCOP)
      if (Number.isFinite(n)) total += n
    }
    return { count, total }
  }, [days])

  if (loading) return <p className="muted month-calendar-loading">Cargando calendario…</p>
  if (error) return <p className="error-text month-calendar-error">{error}</p>

  const today = new Date()
  const todayKey = padDate(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate(),
  )

  return (
    <section className="month-calendar" aria-label={`Calendario ${MONTH_NAMES[month - 1]} ${year}`}>
      <header className="month-calendar__head">
        <div className="month-calendar__nav">
          <button type="button" className="btn-secondary btn-compact" onClick={onPrevMonth}>
            ‹
          </button>
          <button type="button" className="btn-secondary btn-compact" onClick={onToday}>
            Hoy
          </button>
          <button type="button" className="btn-secondary btn-compact" onClick={onNextMonth}>
            ›
          </button>
        </div>
        <h3 className="month-calendar__title">
          {MONTH_NAMES[month - 1]} {year}
        </h3>
        <p className="month-calendar__summary muted small">
          {monthSummary.count}{' '}
          {countLabel}
          {monthSummary.count !== 1 ? 's' : ''} ·{' '}
          {formatCOP(String(monthSummary.total))}
        </p>
      </header>

      <div className="month-calendar__weekdays" aria-hidden>
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="month-calendar__weekday">
            {label}
          </span>
        ))}
      </div>

      <div className="month-calendar__grid">
        {cells.map((cell, idx) => {
          if (!cell.date) {
            return (
              <div
                key={`blank-${idx}`}
                className="month-calendar__day month-calendar__day--blank"
                aria-hidden
              />
            )
          }
          const count = cell.data?.count ?? 0
          const hasData = count > 0
          const isToday = cell.date === todayKey
          const isPastOrToday = cell.date <= todayKey
          const showZero =
            showZeroForPastDays && isPastOrToday && !hasData
          return (
            <button
              key={cell.date}
              type="button"
              className={[
                'month-calendar__day',
                hasData ? 'month-calendar__day--has-data' : '',
                showZero ? 'month-calendar__day--no-sales' : '',
                isToday ? 'month-calendar__day--today' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onDayClick(cell.date!)}
              aria-label={
                hasData
                  ? `${cell.date}: ${count} ${countLabel}${count !== 1 ? 's' : ''}, ${formatCOP(cell.data!.totalCOP)}`
                  : showZero
                    ? `${cell.date}: 0 ${countLabel}s, ${formatCOP('0')}`
                    : `${cell.date}: sin ${countLabel}s`
              }
            >
              <span className="month-calendar__day-num">
                {parseInt(cell.date.slice(8), 10)}
              </span>
              {hasData ? (
                <>
                  <span className="month-calendar__day-count">{count}</span>
                  <span className="month-calendar__day-total">
                    {formatCOP(cell.data!.totalCOP)}
                  </span>
                </>
              ) : showZero ? (
                <>
                  <span className="month-calendar__day-count">0</span>
                  <span className="month-calendar__day-total">
                    {formatCOP('0')}
                  </span>
                </>
              ) : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}
