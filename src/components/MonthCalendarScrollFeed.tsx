import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MonthCalendarDay } from './MonthCalendar'
import {
  canNavigateToMonth,
  monthsBackFromInauguration,
} from '../lib/calendarBounds'
import {
  peekCalendarMonth,
  storeCalendarMonth,
} from '../lib/calendarCache'
import { InlineLoader } from './InlineLoader'
import { MonthCalendar } from './MonthCalendar'

const INITIAL_MONTHS_BACK = 2
const LOAD_MORE_STEP = 4
const MAX_MONTHS_BACK = 59

type MonthRef = { year: number; month: number }

function monthKey({ year, month }: MonthRef): string {
  return `${year}-${month}`
}

function buildMonthList(
  monthsBack: number,
  inaugurationDate?: string | null,
): MonthRef[] {
  const now = new Date()
  const cap = monthsBackFromInauguration(inaugurationDate, MAX_MONTHS_BACK)
  const capped = Math.min(monthsBack, cap)
  const out: MonthRef[] = []
  for (let i = 0; i <= capped; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    if (!canNavigateToMonth(year, month, inaugurationDate)) break
    out.push({ year, month })
  }
  return out
}

function formatInaugurationLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return date
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

type MonthCalendarScrollFeedProps = {
  baseUrl: string
  countLabel: string
  cacheNamespace: 'sales' | 'purchases'
  selectedDate?: string | null
  onDayClick: (date: string) => void
  onGoToToday?: (date: string) => void
  refreshKey?: number
  inaugurationDate?: string | null
  ariaLabel?: string
  fetchMonth: (
    baseUrl: string,
    year: number,
    month: number,
  ) => Promise<{ days: MonthCalendarDay[] }>
}

function todayDateKey(): string {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

function isCurrentMonth(m: MonthRef, year: number, month: number): boolean {
  return m.year === year && m.month === month
}

export function MonthCalendarScrollFeed({
  baseUrl,
  countLabel,
  cacheNamespace,
  selectedDate = null,
  onDayClick,
  onGoToToday,
  refreshKey = 0,
  inaugurationDate = null,
  ariaLabel = 'Calendario por mes',
  fetchMonth,
}: MonthCalendarScrollFeedProps) {
  const maxMonthsBack = useMemo(
    () => monthsBackFromInauguration(inaugurationDate, MAX_MONTHS_BACK),
    [inaugurationDate],
  )
  const [monthsBack, setMonthsBack] = useState(() =>
    Math.min(INITIAL_MONTHS_BACK, maxMonthsBack),
  )
  const [dataByMonth, setDataByMonth] = useState<Record<string, MonthCalendarDay[]>>({})
  const [loadingCurrent, setLoadingCurrent] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const canLoadMore = monthsBack < maxMonthsBack

  const months = useMemo(
    () => buildMonthList(monthsBack, inaugurationDate),
    [monthsBack, inaugurationDate],
  )

  const today = useMemo(() => new Date(), [])
  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth() + 1

  useEffect(() => {
    setMonthsBack((n) => Math.min(n, maxMonthsBack))
  }, [maxMonthsBack])

  useEffect(() => {
    setDataByMonth({})
    setError(null)
    setLoadingCurrent(true)
    setLoadingMore(false)
  }, [refreshKey, inaugurationDate, cacheNamespace])

  useEffect(() => {
    setDataByMonth((prev) => {
      const next = { ...prev }
      let changed = false
      for (const m of months) {
        const key = monthKey(m)
        if (next[key]) continue
        const cached = peekCalendarMonth(cacheNamespace, m.year, m.month)
        if (cached) {
          next[key] = cached
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [months, cacheNamespace])

  const monthsToFetch = useMemo(
    () => months.filter((m) => !dataByMonth[monthKey(m)]),
    [months, dataByMonth],
  )

  useEffect(() => {
    if (monthsToFetch.length === 0) {
      setLoadingCurrent(false)
      setLoadingMore(false)
      return
    }

    let cancelled = false
    const needsCurrent = monthsToFetch.some((m) =>
      isCurrentMonth(m, todayYear, todayMonth),
    )

    if (needsCurrent) setLoadingCurrent(true)
    else setLoadingCurrent(false)
    if (monthsToFetch.some((m) => !isCurrentMonth(m, todayYear, todayMonth))) {
      setLoadingMore(true)
    }

    const ordered = [...monthsToFetch].sort((a, b) => {
      const aCur = isCurrentMonth(a, todayYear, todayMonth) ? 0 : 1
      const bCur = isCurrentMonth(b, todayYear, todayMonth) ? 0 : 1
      return aCur - bCur || b.year - a.year || b.month - a.month
    })

    const loadOne = async (m: MonthRef) => {
      const key = monthKey(m)
      const res = await fetchMonth(baseUrl, m.year, m.month)
      storeCalendarMonth(cacheNamespace, m.year, m.month, res.days)
      return { key, days: res.days, isCurrent: isCurrentMonth(m, todayYear, todayMonth) }
    }

    void (async () => {
      try {
        for (const m of ordered) {
          if (cancelled) return
          const row = await loadOne(m)
          if (cancelled) return
          setDataByMonth((prev) => ({ ...prev, [row.key]: row.days }))
          setError(null)
          if (row.isCurrent) setLoadingCurrent(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error al cargar calendario')
        }
      } finally {
        if (!cancelled) {
          setLoadingCurrent(false)
          setLoadingMore(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    baseUrl,
    cacheNamespace,
    fetchMonth,
    monthsToFetch,
    todayMonth,
    todayYear,
  ])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !canLoadMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          !loadingCurrent &&
          !loadingMore
        ) {
          setMonthsBack((n) => Math.min(n + LOAD_MORE_STEP, maxMonthsBack))
        }
      },
      { rootMargin: '120px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [canLoadMore, loadingCurrent, loadingMore, maxMonthsBack])

  const scrollToToday = useCallback(() => {
    document
      .getElementById('month-calendar-current')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    onGoToToday?.(todayDateKey())
  }, [onGoToToday])

  if (error && Object.keys(dataByMonth).length === 0) {
    return <p className="error-text month-calendar-error">{error}</p>
  }

  return (
    <div className="month-calendar-scroll-feed" aria-label={ariaLabel}>
      <div className="month-calendar-scroll-feed__jump">
        <button
          type="button"
          className="btn-secondary btn-compact"
          onClick={scrollToToday}
        >
          Ir a hoy
        </button>
        {loadingCurrent && !dataByMonth[monthKey({ year: todayYear, month: todayMonth })] ? (
          <span className="month-calendar-scroll-feed__sync muted small">
            Sincronizando…
          </span>
        ) : null}
      </div>
      {months.map(({ year, month }) => {
        const key = monthKey({ year, month })
        const isCurrent = year === todayYear && month === todayMonth
        const monthLoading =
          !dataByMonth[key] && (loadingCurrent || loadingMore)
        return (
          <div
            key={key}
            id={isCurrent ? 'month-calendar-current' : undefined}
            className="month-calendar-scroll-feed__month"
          >
            {monthLoading ? (
              <div className="month-calendar-scroll-feed__month-loading">
                <p className="month-calendar-scroll-feed__month-title muted">
                  {new Date(year, month - 1, 1).toLocaleDateString('es-CO', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <InlineLoader size="sm" label="Cargando mes…" />
              </div>
            ) : (
              <MonthCalendar
                year={year}
                month={month}
                days={dataByMonth[key] ?? []}
                countLabel={countLabel}
                selectedDate={selectedDate}
                inaugurationDate={inaugurationDate}
                hideNav
                onDayClick={onDayClick}
              />
            )}
          </div>
        )
      })}
      {canLoadMore ? (
        <div
          ref={sentinelRef}
          className="month-calendar-scroll-feed__sentinel"
          aria-hidden={!loadingMore}
        >
          {loadingMore ? (
            <InlineLoader size="sm" label="Cargando meses anteriores…" />
          ) : (
            <span className="muted small">Deslizá para ver meses anteriores</span>
          )}
        </div>
      ) : inaugurationDate ? (
        <p className="muted small month-calendar-scroll-feed__end">
          Historial desde el {formatInaugurationLabel(inaugurationDate)}
        </p>
      ) : (
        <p className="muted small month-calendar-scroll-feed__end">
          Mostrando los últimos {months.length} meses
        </p>
      )}
    </div>
  )
}
