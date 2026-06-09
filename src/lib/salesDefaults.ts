const PARTY_KEY = 'vos_sales_default_party'

export function readDefaultSaleParty(): string {
  try {
    return window.localStorage.getItem(PARTY_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function writeDefaultSaleParty(value: string): void {
  const v = value.trim()
  try {
    if (v) window.localStorage.setItem(PARTY_KEY, v)
    else window.localStorage.removeItem(PARTY_KEY)
  } catch {
    /* ignore */
  }
}
