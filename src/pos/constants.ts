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
export const DEMO_TABLE_COUNT = 3

export const POS_STORAGE_KEY = 'arandano_pos_state_v1'

export const POS_WS_PATH = '/pos/ws'

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
