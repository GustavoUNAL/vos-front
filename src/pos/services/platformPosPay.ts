import { createSale } from '../../api'
import { PLATFORM_MODE } from '../../appScope'
import { PAYMENT_METHOD_LABEL } from '../constants'
import { formatCOP } from '../lib/money'
import type { PayOrderPayload, PosOrder } from '../types'

export async function registerPlatformSaleFromPosOrder(
  baseUrl: string,
  order: PosOrder,
  payload: PayOrderPayload,
): Promise<void> {
  if (!PLATFORM_MODE || order.lines.length === 0) return

  const paymentMethod = payload.splits
    .filter((s) => s.amountCOP > 0)
    .map((s) => `${PAYMENT_METHOD_LABEL[s.method]} ${formatCOP(s.amountCOP)}`)
    .join(' · ')

  const notes = [
    payload.tipCOP > 0 ? `Propina: ${formatCOP(payload.tipCOP)}` : null,
    payload.printReceipt ? 'Recibo POS' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  await createSale(baseUrl, {
    saleDate: new Date().toISOString(),
    paymentMethod: paymentMethod || undefined,
    source: 'POS',
    mesa: order.tableName?.trim() || undefined,
    notes: notes || undefined,
    lines: order.lines.map((line) => ({
      productId: line.productId,
      productName: line.productName,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })),
  })
}
