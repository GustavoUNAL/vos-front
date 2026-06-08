const POS_TABLE_KEY = 'vos.pendingPosTableId'

export function setPendingPosTableId(tableId: string): void {
  try {
    sessionStorage.setItem(POS_TABLE_KEY, tableId)
  } catch {
    /* ignore */
  }
}

export function consumePendingPosTableId(): string | null {
  try {
    const v = sessionStorage.getItem(POS_TABLE_KEY)
    if (v) sessionStorage.removeItem(POS_TABLE_KEY)
    return v
  } catch {
    return null
  }
}
