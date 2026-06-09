/** Utilidades de calendario acotadas por fecha de inauguración (YYYY-MM-DD). */

export function parseMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function inaugurationMonthKey(inaugurationDate: string): string | null {
  const trimmed = inaugurationDate.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  return trimmed.slice(0, 7)
}

export function isDateBeforeInauguration(
  date: string,
  inaugurationDate: string | null | undefined,
): boolean {
  if (!inaugurationDate?.trim()) return false
  return date < inaugurationDate.trim()
}

export function monthsBackFromInauguration(
  inaugurationDate: string | null | undefined,
  cap = 59,
): number {
  if (!inaugurationDate?.trim()) return cap
  const monthKey = inaugurationMonthKey(inaugurationDate)
  if (!monthKey) return cap
  const [y, m] = monthKey.split('-').map(Number)
  if (!y || !m) return cap
  const start = new Date(y, m - 1, 1)
  const now = new Date()
  const diff =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth())
  return Math.max(0, Math.min(diff, cap))
}

function normalizeYearMonth(year: number, month: number): { year: number; month: number } {
  let y = year
  let m = month
  while (m < 1) {
    m += 12
    y -= 1
  }
  while (m > 12) {
    m -= 12
    y += 1
  }
  return { year: y, month: m }
}

export function canNavigateToMonth(
  year: number,
  month: number,
  inaugurationDate: string | null | undefined,
): boolean {
  if (!inaugurationDate?.trim()) return true
  const minMonthKey = inaugurationMonthKey(inaugurationDate)
  if (!minMonthKey) return true
  const normalized = normalizeYearMonth(year, month)
  return parseMonthKey(normalized.year, normalized.month) >= minMonthKey
}
