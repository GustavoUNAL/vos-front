import { readApiCache, writeApiCache } from './apiCache'
import type { MonthCalendarDay } from '../components/MonthCalendar'

export const CALENDAR_MONTH_TTL_MS = 20 * 60 * 1000

export function calendarMonthCacheKey(
  namespace: string,
  year: number,
  month: number,
): string {
  return `calendar:${namespace}:${year}-${month}`
}

export function peekCalendarMonth(
  namespace: string,
  year: number,
  month: number,
): MonthCalendarDay[] | null {
  return (
    readApiCache<MonthCalendarDay[]>(
      calendarMonthCacheKey(namespace, year, month),
    )?.data ?? null
  )
}

export function storeCalendarMonth(
  namespace: string,
  year: number,
  month: number,
  days: MonthCalendarDay[],
): void {
  writeApiCache(
    calendarMonthCacheKey(namespace, year, month),
    days,
    CALENDAR_MONTH_TTL_MS,
  )
}
