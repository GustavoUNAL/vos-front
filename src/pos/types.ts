/** Estados visuales de mesa en el salón. */
export type TableStatus = 'free' | 'occupied' | 'reserved' | 'closing'

export type OrderStatus = 'open' | 'closing' | 'closed' | 'paid'

export type PaymentMethod =
  | 'cash'
  | 'card'
  | 'transfer'
  | 'nequi'
  | 'daviplata'
  | 'other'

export type PosTable = {
  id: string
  number: number
  name: string
  status: TableStatus
  openedAt: string | null
  totalCOP: number
  orderId: string | null
  /** Capacidad habitual de comensales. */
  capacity?: number
  guestCount?: number
  section?: string | null
  /** Nota interna (no visible en ticket). */
  notes?: string | null
}

export type UpdateTablePayload = {
  name?: string
  number?: number
  section?: string | null
  capacity?: number
  notes?: string | null
}

export type CreateTablePayload = {
  name: string
  number: number
  section?: string | null
  capacity?: number
  notes?: string | null
}

export type OrderLine = {
  id: string
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  notes?: string | null
}

export type PosOrder = {
  id: string
  tableId: string
  tableName?: string
  status: OrderStatus
  lines: OrderLine[]
  subtotalCOP: number
  taxRate: number
  taxCOP: number
  totalCOP: number
  openedAt: string
  closedAt?: string | null
  paidAt?: string | null
}

export type PaymentSplit = {
  method: PaymentMethod
  amountCOP: number
}

export type PayOrderPayload = {
  splits: PaymentSplit[]
  tipCOP: number
  printReceipt?: boolean
  /** Celular del cliente para comprobante WhatsApp (obligatorio en POS). */
  customerPhone: string
  /** Comentario libre sobre la venta. */
  saleComment?: string
}

export type PosHistoryOrder = PosOrder & {
  tableNumber: number
  paymentMethods?: string[]
}

export type PosWsEvent =
  | { type: 'tables.updated'; tables: PosTable[] }
  | { type: 'order.updated'; order: PosOrder }
  | { type: 'order.closed'; orderId: string; tableId: string }

export type PosScreen = 'tables' | 'order' | 'payment' | 'history' | 'shop-orders'
