const KEY = 'vos_pos_daily_sales_v1'

export function bogotaDateKey(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d)
}

function todayKey(): string {
  return bogotaDateKey()
}

function readStore(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, number>
  } catch {
    return {}
  }
}

function writeStore(store: Record<string, number>): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* ignore */
  }
}

export function getDailySalesCount(): number {
  return readStore()[todayKey()] ?? 0
}

export function incrementDailySalesCount(): number {
  const day = todayKey()
  const store = readStore()
  const next = (store[day] ?? 0) + 1
  store[day] = next
  writeStore(store)
  return next
}
