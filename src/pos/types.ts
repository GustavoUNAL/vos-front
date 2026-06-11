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

export type PosStaffMember = 'David' | 'Gustavo' | 'Sonia'

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
  /** Código corto: 2 letras + 4 números (ej. AB3847). */
  code?: string | null
  /** Cliente o mesa (etiqueta de la venta). */
  mesa?: string | null
  /** Celular del cliente para comprobante WhatsApp. */
  customerPhone?: string | null
  /** Forma de pago prevista al armar el pedido. */
  paymentMethod?: PaymentMethod | null
  /** @deprecated Usar transferReceiptDataUrl */
  transferReference?: string | null
  /** Foto del comprobante de transferencia (data URL). */
  transferReceiptDataUrl?: string | null
  /** Comentario libre sobre la venta. */
  notes?: string | null
  /** Quién atendió el pedido en salón. */
  attendedBy?: PosStaffMember | null
  /** Efectivo recibido configurado en comanda/cobro. */
  cashTenderedCOP?: number | null
  /** Descuento aplicado al total (COP). */
  discountCOP?: number | null
  /** Motivo obligatorio cuando hay descuento. */
  discountReason?: string | null
}

export type PaymentSplit = {
  method: PaymentMethod
  amountCOP: number
}

export type PayOrderPayload = {
  splits: PaymentSplit[]
  tipCOP: number
  printReceipt?: boolean
  /** Celular del cliente para comprobante WhatsApp (opcional). */
  customerPhone?: string
  /** Comentario libre sobre la venta. */
  saleComment?: string
  /** Quién atendió la venta. */
  attendedBy?: PosStaffMember
  /** Billete recibido en efectivo (para cambio). */
  cashTenderedCOP?: number
  /** Comprobante de transferencia (data URL). */
  transferReceiptDataUrl?: string
  /** Descuento aplicado al cobrar (COP). */
  discountCOP?: number
  /** Motivo del descuento. */
  discountReason?: string
}

export type PosHistoryOrder = PosOrder & {
  tableNumber: number
  paymentMethods?: string[]
}

export type PosWsEvent =
  | { type: 'tables.updated'; tables: PosTable[] }
  | { type: 'order.updated'; order: PosOrder }
  | { type: 'order.closed'; orderId: string; tableId: string }
  | { type: 'shop-order.created'; order: Record<string, unknown> }
  | { type: 'shop-order.updated'; order: Record<string, unknown> }

export type PosScreen = 'tables' | 'order' | 'payment' | 'history' | 'shop-orders'
