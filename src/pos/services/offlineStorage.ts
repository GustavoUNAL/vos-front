import { DEMO_TABLE_COUNT, POS_STORAGE_KEY } from '../constants'
import { DEFAULT_TAX_RATE, computeOrderTotals } from '../lib/money'
import type {
  CreateTablePayload,
  PosOrder,
  PosTable,
  UpdateTablePayload,
} from '../types'

const STATE_VERSION = 2

export type PosLocalState = {
  tables: PosTable[]
  orders: Record<string, PosOrder>
  version: number
}

function migrateState(parsed: PosLocalState): PosLocalState {
  if ((parsed.version ?? 1) >= STATE_VERSION) return parsed
  const sorted = [...parsed.tables].sort((a, b) => a.number - b.number)
  const kept = sorted.slice(0, DEMO_TABLE_COUNT)
  const defaults = createDemoTables()
  const tables =
    kept.length >= DEMO_TABLE_COUNT
      ? kept
      : defaults.map((d, i) => kept[i] ?? d)
  const keptIds = new Set(tables.map((t) => t.id))
  const orders = { ...parsed.orders }
  for (const [id, order] of Object.entries(orders)) {
    if (!keptIds.has(order.tableId)) delete orders[id]
  }
  return { tables, orders, version: STATE_VERSION }
}

function newId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function createDemoTables(): PosTable[] {
  return Array.from({ length: DEMO_TABLE_COUNT }, (_, i) => {
    const n = i + 1
    return {
      id: `table-${n}`,
      number: n,
      name: `Mesa ${n}`,
      status: 'free',
      openedAt: null,
      totalCOP: 0,
      orderId: null,
    }
  })
}

export function loadLocalState(): PosLocalState {
  try {
    const raw = window.localStorage.getItem(POS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as PosLocalState
      if (parsed?.tables?.length && parsed.orders) {
        return migrateState(parsed)
      }
    }
  } catch {
    /* ignore */
  }
  return { tables: createDemoTables(), orders: {}, version: STATE_VERSION }
}

export function saveLocalState(state: PosLocalState): void {
  try {
    window.localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

function syncTableFromOrder(
  tables: PosTable[],
  order: PosOrder,
): PosTable[] {
  return tables.map((t) => {
    if (t.id !== order.tableId) return t
    const status =
      order.status === 'closing'
        ? 'closing'
        : order.status === 'open'
          ? 'occupied'
          : 'free'
    return {
      ...t,
      status,
      openedAt:
        order.status === 'open' || order.status === 'closing'
          ? order.openedAt
          : null,
      totalCOP: order.status === 'paid' || order.status === 'closed' ? 0 : order.totalCOP,
      orderId:
        order.status === 'open' || order.status === 'closing' ? order.id : null,
    }
  })
}

export const localPosApi = {
  getTables(): PosTable[] {
    return loadLocalState().tables
  },

  getOrder(id: string): PosOrder | null {
    return loadLocalState().orders[id] ?? null
  },

  openTable(tableId: string): PosOrder {
    const state = loadLocalState()
    const table = state.tables.find((t) => t.id === tableId)
    if (!table) throw new Error('Mesa no encontrada')
    if (table.orderId) {
      const existing = state.orders[table.orderId]
      if (existing) return existing
    }
    const order: PosOrder = {
      id: newId(),
      tableId,
      tableName: table.name,
      status: 'open',
      lines: [],
      subtotalCOP: 0,
      taxRate: DEFAULT_TAX_RATE,
      taxCOP: 0,
      totalCOP: 0,
      openedAt: new Date().toISOString(),
    }
    state.orders[order.id] = order
    state.tables = syncTableFromOrder(state.tables, order)
    saveLocalState(state)
    return order
  },

  updateOrder(order: PosOrder): PosOrder {
    const totals = computeOrderTotals(order.lines, order.taxRate)
    const next: PosOrder = { ...order, ...totals }
    const state = loadLocalState()
    state.orders[next.id] = next
    state.tables = syncTableFromOrder(state.tables, next)
    saveLocalState(state)
    return next
  },

  closeTable(tableId: string): void {
    const state = loadLocalState()
    const table = state.tables.find((t) => t.id === tableId)
    if (!table?.orderId) {
      state.tables = state.tables.map((t) =>
        t.id === tableId
          ? { ...t, status: 'free', openedAt: null, totalCOP: 0, orderId: null }
          : t,
      )
      saveLocalState(state)
      return
    }
    const order = state.orders[table.orderId]
    if (order) {
      order.status = 'closing'
      state.orders[order.id] = order
      state.tables = syncTableFromOrder(state.tables, order)
    }
    saveLocalState(state)
  },

  payOrder(orderId: string): PosOrder {
    const state = loadLocalState()
    const order = state.orders[orderId]
    if (!order) throw new Error('Orden no encontrada')
    order.status = 'paid'
    order.paidAt = new Date().toISOString()
    order.closedAt = order.paidAt
    state.orders[orderId] = order
    state.tables = syncTableFromOrder(
      state.tables.map((t) =>
        t.id === order.tableId
          ? { ...t, status: 'free', openedAt: null, totalCOP: 0, orderId: null }
          : t,
      ),
      order,
    )
    saveLocalState(state)
    return order
  },

  listOrders(opts?: {
    status?: string
    dateFrom?: string
    dateTo?: string
  }): PosOrder[] {
    const orders = Object.values(loadLocalState().orders)
    return orders.filter((o) => {
      if (opts?.status && o.status !== opts.status) return false
      const day = o.openedAt.slice(0, 10)
      if (opts?.dateFrom && day < opts.dateFrom) return false
      if (opts?.dateTo && day > opts.dateTo) return false
      return true
    })
  },

  reserveTable(tableId: string): PosTable {
    const state = loadLocalState()
    state.tables = state.tables.map((t) =>
      t.id === tableId && t.status === 'free'
        ? { ...t, status: 'reserved' as const }
        : t,
    )
    saveLocalState(state)
    const t = state.tables.find((x) => x.id === tableId)
    if (!t) throw new Error('Mesa no encontrada')
    return t
  },

  unreserveTable(tableId: string): PosTable {
    const state = loadLocalState()
    state.tables = state.tables.map((t) =>
      t.id === tableId && t.status === 'reserved'
        ? { ...t, status: 'free' as const }
        : t,
    )
    saveLocalState(state)
    const t = state.tables.find((x) => x.id === tableId)
    if (!t) throw new Error('Mesa no encontrada')
    return t
  },

  updateTable(tableId: string, payload: UpdateTablePayload): PosTable {
    const state = loadLocalState()
    const idx = state.tables.findIndex((t) => t.id === tableId)
    if (idx < 0) throw new Error('Mesa no encontrada')
    const current = state.tables[idx]!
    if (
      payload.number != null &&
      payload.number !== current.number &&
      (current.status === 'occupied' || current.status === 'closing')
    ) {
      throw new Error('No podés cambiar el número con la mesa en uso')
    }
    if (
      payload.number != null &&
      state.tables.some(
        (t) => t.id !== tableId && t.number === payload.number,
      )
    ) {
      throw new Error('Ya existe otra mesa con ese número')
    }
    const next: PosTable = {
      ...current,
      ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
      ...(payload.number !== undefined ? { number: payload.number } : {}),
      ...(payload.section !== undefined
        ? { section: payload.section?.trim() || null }
        : {}),
      ...(payload.capacity !== undefined ? { capacity: payload.capacity } : {}),
      ...(payload.notes !== undefined
        ? { notes: payload.notes?.trim() || null }
        : {}),
    }
    state.tables[idx] = next
    for (const order of Object.values(state.orders)) {
      if (order.tableId === tableId) {
        order.tableName = next.name
        state.orders[order.id] = order
      }
    }
    saveLocalState(state)
    return next
  },

  createTable(payload: CreateTablePayload): PosTable {
    const state = loadLocalState()
    if (state.tables.some((t) => t.number === payload.number)) {
      throw new Error('Ya existe una mesa con ese número')
    }
    const id = `table-${payload.number}-${Date.now()}`
    const table: PosTable = {
      id,
      number: payload.number,
      name: payload.name.trim() || `Mesa ${payload.number}`,
      status: 'free',
      openedAt: null,
      totalCOP: 0,
      orderId: null,
      section: payload.section?.trim() || null,
      capacity: payload.capacity,
      notes: payload.notes?.trim() || null,
    }
    state.tables.push(table)
    state.tables.sort((a, b) => a.number - b.number)
    saveLocalState(state)
    return table
  },
}
