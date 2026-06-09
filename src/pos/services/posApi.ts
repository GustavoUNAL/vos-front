import { getAccessToken, formatApiErrorFromBody } from '../../api'
import { isBackendDown } from '../../backendHealth'
import { mergeOrderMeta } from '../lib/orderMetaCache'
import type {
  CreateTablePayload,
  PayOrderPayload,
  PosOrder,
  PosTable,
  UpdateTablePayload,
} from '../types'
import { localPosApi } from './offlineStorage'

let useLocalFallback = false

export function isPosDemoMode(): boolean {
  return useLocalFallback
}

export function enablePosLocalFallback(): void {
  useLocalFallback = true
}

class PosApiUnavailableError extends Error {
  constructor() {
    super('POS API no disponible')
    this.name = 'PosApiUnavailableError'
  }
}

function shouldFallbackFromError(e: unknown): boolean {
  if (e instanceof PosApiUnavailableError) return true
  if (e instanceof TypeError) return true
  if (e instanceof Error) {
    return /failed to fetch|network|502|503|504|bad gateway|econnrefused/i.test(
      e.message,
    )
  }
  return false
}

function shouldFallbackFromStatus(status: number): boolean {
  return status === 404 || status === 405 || status === 502 || status === 503 || status === 504
}

async function posFetch(
  base: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = getAccessToken()
  const headers = new Headers(init?.headers ?? undefined)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (isBackendDown()) {
    throw new PosApiUnavailableError()
  }
  try {
    return await fetch(`${base}${path}`, { ...init, headers })
  } catch {
    throw new PosApiUnavailableError()
  }
}

async function parseError(res: Response): Promise<string> {
  const fallback = `${res.status} ${res.statusText}`
  try {
    const body = await res.json().catch(() => ({}))
    return formatApiErrorFromBody(body, fallback)
  } catch {
    return fallback
  }
}

async function withFallback<T>(
  fn: () => Promise<T>,
  local: () => T,
): Promise<T> {
  if (useLocalFallback) return local()
  try {
    return await fn()
  } catch (e) {
    if (shouldFallbackFromError(e)) {
      useLocalFallback = true
      return local()
    }
    throw e
  }
}

async function handleRes<T>(res: Response): Promise<T> {
  if (shouldFallbackFromStatus(res.status)) {
    throw new PosApiUnavailableError()
  }
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<T>
}

export async function probePosApi(base: string): Promise<boolean> {
  try {
    const res = await posFetch(base, '/pos/tables')
    if (shouldFallbackFromStatus(res.status)) {
      useLocalFallback = true
      return false
    }
    useLocalFallback = false
    return res.ok
  } catch {
    useLocalFallback = true
    return false
  }
}

export async function fetchPosTables(base: string): Promise<PosTable[]> {
  return withFallback(
    async () => {
      const res = await posFetch(base, '/pos/tables')
      const data = await handleRes<{ tables?: PosTable[]; data?: PosTable[] }>(
        res,
      )
      return data.tables ?? data.data ?? (data as unknown as PosTable[])
    },
    () => localPosApi.getTables(),
  )
}

export async function openTableAccount(
  base: string,
  tableId: string,
): Promise<PosOrder> {
  const order = await withFallback(
    async () => {
      const res = await posFetch(base, `/pos/tables/${encodeURIComponent(tableId)}/open`, {
        method: 'POST',
      })
      return handleRes<PosOrder>(res)
    },
    () => localPosApi.openTable(tableId),
  )
  return mergeOrderMeta(order)
}

export async function cancelPosOrder(base: string, orderId: string): Promise<void> {
  return withFallback(
    async () => {
      const res = await posFetch(
        base,
        `/pos/orders/${encodeURIComponent(orderId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'closed' }),
        },
      )
      await handleRes<PosOrder>(res)
    },
    () => {
      localPosApi.cancelTableOrder(orderId)
    },
  )
}

export async function closeTableAccount(
  base: string,
  tableId: string,
): Promise<void> {
  return withFallback(
    async () => {
      const res = await posFetch(
        base,
        `/pos/tables/${encodeURIComponent(tableId)}/close`,
        { method: 'POST' },
      )
      await handleRes<{ ok: boolean }>(res)
    },
    () => {
      localPosApi.closeTable(tableId)
    },
  )
}

export async function fetchPosOrder(
  base: string,
  orderId: string,
): Promise<PosOrder> {
  const order = await withFallback(
    async () => {
      const res = await posFetch(
        base,
        `/pos/orders/${encodeURIComponent(orderId)}`,
      )
      return handleRes<PosOrder>(res)
    },
    () => {
      const o = localPosApi.getOrder(orderId)
      if (!o) throw new Error('Orden no encontrada')
      return o
    },
  )
  return mergeOrderMeta(order)
}

export async function updatePosOrder(
  base: string,
  order: PosOrder,
): Promise<PosOrder> {
  return withFallback(
    async () => {
      const res = await posFetch(
        base,
        `/pos/orders/${encodeURIComponent(order.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            lines: order.lines,
            status: order.status,
          }),
        },
      )
      return handleRes<PosOrder>(res)
    },
    () => localPosApi.updateOrder(order),
  )
}

export async function payPosOrder(
  base: string,
  orderId: string,
  payload: PayOrderPayload,
): Promise<PosOrder> {
  return withFallback(
    async () => {
      const res = await posFetch(
        base,
        `/pos/orders/${encodeURIComponent(orderId)}/pay`,
        {
          method: 'POST',
          body: JSON.stringify({
            splits: payload.splits,
            tipCOP: payload.tipCOP,
            printReceipt: payload.printReceipt,
          }),
        },
      )
      return handleRes<PosOrder>(res)
    },
    () => localPosApi.payOrder(orderId),
  )
}

export async function fetchPosOrders(
  base: string,
  opts: {
    status?: string
    dateFrom?: string
    dateTo?: string
  },
): Promise<PosOrder[]> {
  return withFallback(
    async () => {
      const q = new URLSearchParams()
      if (opts.status) q.set('status', opts.status)
      if (opts.dateFrom) q.set('dateFrom', opts.dateFrom)
      if (opts.dateTo) q.set('dateTo', opts.dateTo)
      const qs = q.toString()
      const res = await posFetch(base, `/pos/orders${qs ? `?${qs}` : ''}`)
      const data = await handleRes<{ data?: PosOrder[]; orders?: PosOrder[] }>(
        res,
      )
      return data.data ?? data.orders ?? (data as unknown as PosOrder[])
    },
    () => localPosApi.listOrders(opts),
  )
}

export async function reserveTable(
  base: string,
  tableId: string,
): Promise<PosTable> {
  return withFallback(
    async () => {
      const res = await posFetch(
        base,
        `/pos/tables/${encodeURIComponent(tableId)}/reserve`,
        { method: 'POST' },
      )
      return handleRes<PosTable>(res)
    },
    () => localPosApi.reserveTable(tableId),
  )
}

export async function unreserveTable(
  base: string,
  tableId: string,
): Promise<PosTable> {
  return withFallback(
    async () => {
      const res = await posFetch(
        base,
        `/pos/tables/${encodeURIComponent(tableId)}/unreserve`,
        { method: 'POST' },
      )
      return handleRes<PosTable>(res)
    },
    () => localPosApi.unreserveTable(tableId),
  )
}

export async function updatePosTable(
  base: string,
  tableId: string,
  payload: UpdateTablePayload,
): Promise<PosTable> {
  return withFallback(
    async () => {
      const res = await posFetch(
        base,
        `/pos/tables/${encodeURIComponent(tableId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        },
      )
      return handleRes<PosTable>(res)
    },
    () => localPosApi.updateTable(tableId, payload),
  )
}

export async function createPosTable(
  base: string,
  payload: CreateTablePayload,
): Promise<PosTable> {
  return withFallback(
    async () => {
      const res = await posFetch(base, '/pos/tables', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      return handleRes<PosTable>(res)
    },
    () => localPosApi.createTable(payload),
  )
}
