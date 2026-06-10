import type { PosOrder } from '../types'
import { DEFAULT_POS_STAFF } from '../constants'

const KEY = 'vos_pos_order_meta_v1'

type OrderMeta = Pick<
  PosOrder,
  | 'mesa'
  | 'customerPhone'
  | 'paymentMethod'
  | 'transferReference'
  | 'transferReceiptDataUrl'
  | 'notes'
  | 'attendedBy'
  | 'cashTenderedCOP'
>

type Store = Record<string, OrderMeta>

function readStore(): Store {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Store
  } catch {
    return {}
  }
}

function writeStore(store: Store): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* ignore quota */
  }
}

export function readCachedOrderMeta(orderId: string): OrderMeta {
  return readStore()[orderId] ?? {}
}

export function writeCachedOrderMeta(orderId: string, meta: OrderMeta): void {
  const store = readStore()
  store[orderId] = {
    mesa: meta.mesa ?? null,
    customerPhone: meta.customerPhone ?? null,
    paymentMethod: meta.paymentMethod ?? null,
    transferReference: meta.transferReference ?? null,
    transferReceiptDataUrl: meta.transferReceiptDataUrl ?? null,
    notes: meta.notes ?? null,
    attendedBy: meta.attendedBy ?? null,
    cashTenderedCOP: meta.cashTenderedCOP ?? null,
  }
  writeStore(store)
}

export function mergeOrderMeta(order: PosOrder): PosOrder {
  const cached = readCachedOrderMeta(order.id)
  return {
    ...order,
    mesa: order.mesa ?? cached.mesa ?? order.tableName ?? null,
    customerPhone: order.customerPhone ?? cached.customerPhone ?? null,
    paymentMethod:
      order.paymentMethod ?? cached.paymentMethod ?? ('cash' as const),
    transferReference: order.transferReference ?? cached.transferReference ?? null,
    transferReceiptDataUrl:
      order.transferReceiptDataUrl ?? cached.transferReceiptDataUrl ?? null,
    notes: order.notes ?? cached.notes ?? null,
    attendedBy: order.attendedBy ?? cached.attendedBy ?? DEFAULT_POS_STAFF,
    cashTenderedCOP: order.cashTenderedCOP ?? cached.cashTenderedCOP ?? null,
  }
}

export function pickOrderMeta(order: PosOrder): OrderMeta {
  return {
    mesa: order.mesa ?? null,
    customerPhone: order.customerPhone ?? null,
    paymentMethod: order.paymentMethod ?? null,
    transferReference: order.transferReference ?? null,
    transferReceiptDataUrl: order.transferReceiptDataUrl ?? null,
    notes: order.notes ?? null,
    attendedBy: order.attendedBy ?? null,
    cashTenderedCOP: order.cashTenderedCOP ?? null,
  }
}
