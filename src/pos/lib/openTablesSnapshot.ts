import { loadLocalState } from '../services/offlineStorage'

export type OpenPosTableSnapshot = {
  tableId: string
  tableName: string
  tableNumber: number
  status: 'occupied' | 'closing'
  lineCount: number
  totalCOP: number
  openedAt: string | null
}

/** Mesas con comanda abierta en el POS local (este dispositivo / empresa). */
export function getOpenPosTables(): OpenPosTableSnapshot[] {
  const state = loadLocalState()
  const open: OpenPosTableSnapshot[] = []

  for (const table of state.tables) {
    if (table.status !== 'occupied' && table.status !== 'closing') continue
    if (!table.orderId) continue
    const order = state.orders[table.orderId]
    if (!order || (order.status !== 'open' && order.status !== 'closing')) {
      continue
    }

    open.push({
      tableId: table.id,
      tableName: order.tableName?.trim() || table.name,
      tableNumber: table.number,
      status: table.status === 'closing' ? 'closing' : 'occupied',
      lineCount: order.lines.length,
      totalCOP: order.totalCOP,
      openedAt: table.openedAt,
    })
  }

  return open.sort((a, b) => a.tableNumber - b.tableNumber)
}
