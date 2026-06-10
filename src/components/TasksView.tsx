import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  fetchTasksCalendar,
  type AuthUser,
  type TasksCalendarResponse,
} from '../api'
import { useMatchMedia } from '../hooks/useMatchMedia'
import { invalidateCalendarNamespace } from '../lib/calendarCache'
import { mobileViewClass } from './mobile/mobileView'
import { MonthCalendar } from './MonthCalendar'
import type { MonthCalendarDay } from './MonthCalendar'
import { MonthCalendarScrollFeed } from './MonthCalendarScrollFeed'
import { DayTasksModal } from './DayTasksModal'
import { ViewBootSplash } from './DataLoadingSplash'
import { MOBILE_FILTER_BREAKPOINT } from './MobileAwareFilterBar'

function localDateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function mapTasksCalendarDays(res: TasksCalendarResponse): MonthCalendarDay[] {
  return res.days.map((d) => ({
    date: d.date,
    count: d.count,
    pendingCount: d.pendingCount,
    completedCount: d.completedCount,
  }))
}

type Props = {
  baseUrl: string
  user: AuthUser | null
}

export function TasksView({ baseUrl, user }: Props) {
  const isMobile = useMatchMedia(MOBILE_FILTER_BREAKPOINT)
  const todayKey = useMemo(() => localDateKey(), [])
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear())
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth() + 1)
  const [calendarData, setCalendarData] = useState<MonthCalendarDay[] | null>(null)
  const [calendarLoading, setCalendarLoading] = useState(true)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0)
  const [dayPanelRefresh, setDayPanelRefresh] = useState(0)
  const [dayModalDate, setDayModalDate] = useState<string | null>(null)

  const fetchTasksMonth = useCallback(
    async (url: string, year: number, month: number) => {
      const res = await fetchTasksCalendar(url, year, month)
      return { days: mapTasksCalendarDays(res) }
    },
    [],
  )

  useEffect(() => {
    if (isMobile) return
    let cancelled = false
    setCalendarLoading(true)
    setCalendarError(null)
    void fetchTasksCalendar(baseUrl, calendarYear, calendarMonth)
      .then((res) => {
        if (!cancelled) setCalendarData(mapTasksCalendarDays(res))
      })
      .catch((e: Error) => {
        if (!cancelled) setCalendarError(e.message)
      })
      .finally(() => {
        if (!cancelled) setCalendarLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [baseUrl, calendarYear, calendarMonth, calendarRefreshKey, isMobile])

  const bumpCalendar = useCallback(() => {
    invalidateCalendarNamespace('tasks')
    setCalendarRefreshKey((k) => k + 1)
    setDayPanelRefresh((k) => k + 1)
    if (!isMobile) {
      void fetchTasksCalendar(baseUrl, calendarYear, calendarMonth)
        .then((res) => setCalendarData(mapTasksCalendarDays(res)))
        .catch(() => {})
    }
  }, [baseUrl, calendarMonth, calendarYear, isMobile])

  const openDay = useCallback((date: string) => {
    setDayModalDate(date)
    const [y, m] = date.split('-').map(Number)
    if (y && m) {
      setCalendarYear(y)
      setCalendarMonth(m)
    }
  }, [])

  const monthTotals = useMemo(() => {
    const days = calendarData ?? []
    let total = 0
    let pending = 0
    for (const d of days) {
      total += d.count
      pending += d.pendingCount ?? 0
    }
    return { total, pending }
  }, [calendarData])

  return (
    <div className={mobileViewClass('tasks', 'tasks-view tasks-view--calendar page-pane')}>
      <header className="tasks-view__head tasks-view__head--calendar">
        <div>
          <h1 className="page-title">Tareas</h1>
          <p className="muted small tasks-view__lead">
            Calendario compartido del equipo · todo list por día
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary btn-compact tasks-view__refresh"
          onClick={bumpCalendar}
          title="Actualizar calendario"
        >
          <RefreshCw aria-hidden strokeWidth={2} size={16} />
          Actualizar
        </button>
      </header>

      {!isMobile && monthTotals.total > 0 ? (
        <p className="tasks-view__month-stats muted small">
          Este mes: {monthTotals.total} tarea{monthTotals.total !== 1 ? 's' : ''}
          {monthTotals.pending > 0 ? ` · ${monthTotals.pending} pendientes` : ''}
        </p>
      ) : null}

      {isMobile ? (
        <MonthCalendarScrollFeed
          baseUrl={baseUrl}
          cacheNamespace="tasks"
          countLabel="tarea"
          metricMode="tasks"
          selectedDate={dayModalDate}
          refreshKey={calendarRefreshKey}
          ariaLabel="Calendario de tareas por mes"
          fetchMonth={fetchTasksMonth}
          onDayClick={openDay}
          onGoToToday={(date) => openDay(date)}
        />
      ) : (
        <MonthCalendar
          year={calendarYear}
          month={calendarMonth}
          days={calendarData ?? []}
          loading={calendarLoading}
          error={calendarError}
          countLabel="tarea"
          metricMode="tasks"
          showZeroForPastDays
          selectedDate={dayModalDate}
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
            const now = new Date()
            setCalendarYear(now.getFullYear())
            setCalendarMonth(now.getMonth() + 1)
            openDay(todayKey)
          }}
          onDayClick={openDay}
        />
      )}

      <p className="muted small month-calendar-hint">
        {isMobile
          ? 'Tocá un día para ver y gestionar las tareas de toda la empresa.'
          : 'Hacé clic en un día para ver y gestionar las tareas de toda la empresa.'}
      </p>

      {dayModalDate ? (
        <DayTasksModal
          baseUrl={baseUrl}
          date={dayModalDate}
          user={user}
          refreshKey={dayPanelRefresh}
          onClose={() => setDayModalDate(null)}
          onMutate={bumpCalendar}
        />
      ) : null}

      <ViewBootSplash
        ready={isMobile || !calendarLoading}
        label="Cargando calendario de tareas…"
      />
    </div>
  )
}
