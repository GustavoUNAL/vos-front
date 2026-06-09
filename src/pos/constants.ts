import type { OrderStatus, PaymentMethod, TableStatus } from './types'

export const TABLE_STATUS_LABEL: Record<TableStatus, string> = {
  free: 'Libre',
  occupied: 'Ocupada',
  reserved: 'Reservada',
  closing: 'Cerrando',
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  other: 'Otro',
}

/** Mesas iniciales del salón (se pueden agregar más con + Mesa). */
export const DEMO_TABLE_COUNT = 4

export const POS_STORAGE_KEY = 'vos_pos_state_v1'

export const POS_WS_PATH = '/pos/ws'
export const SHOP_WS_PATH = '/shop/ws'

export const SHOP_ORDERS_CACHE_KEY = 'pos:shop-orders-active'
export const SHOP_ORDERS_CACHE_TTL_MS = 2 * 60 * 1000

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  open: 'Abierta',
  closing: 'Cerrando',
  closed: 'Cerrada',
  paid: 'Pagada',
}

export const TABLE_SECTION_PRESETS = [
  'Salón',
  'Terraza',
  'Barra',
  'VIP',
] as const

/** Personal que puede atender pedidos en el POS. */
export const POS_STAFF = ['David', 'Gustavo', 'Sonia'] as const

/** Billetes frecuentes en Colombia para calcular el cambio. */
export const CASH_BILL_PRESETS_COP = [
  2_000, 5_000, 10_000, 20_000, 50_000, 100_000,
] as const
