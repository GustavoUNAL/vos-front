const SALES_DATE_KEY = 'vos.pendingSalesDate'
const PURCHASES_DATE_KEY = 'vos.pendingPurchasesDate'

export function setPendingSalesDate(date: string): void {
  try {
    sessionStorage.setItem(SALES_DATE_KEY, date)
  } catch {
    /* ignore */
  }
}

export function consumePendingSalesDate(): string | null {
  try {
    const v = sessionStorage.getItem(SALES_DATE_KEY)
    if (v) sessionStorage.removeItem(SALES_DATE_KEY)
    return v
  } catch {
    return null
  }
}

export function setPendingPurchasesDate(date: string): void {
  try {
    sessionStorage.setItem(PURCHASES_DATE_KEY, date)
  } catch {
    /* ignore */
  }
}

export function consumePendingPurchasesDate(): string | null {
  try {
    const v = sessionStorage.getItem(PURCHASES_DATE_KEY)
    if (v) sessionStorage.removeItem(PURCHASES_DATE_KEY)
    return v
  } catch {
    return null
  }
}
