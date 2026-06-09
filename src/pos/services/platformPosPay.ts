import { createSale, type SaleDetail } from '../../api'
import { PLATFORM_MODE } from '../../appScope'
import { PAYMENT_METHOD_LABEL } from '../constants'
import { formatCOP } from '../lib/money'
import type { PayOrderPayload, PosOrder } from '../types'

export async function registerPlatformSaleFromPosOrder(
  baseUrl: string,
  order: PosOrder,
  payload: PayOrderPayload,
): Promise<SaleDetail | null> {
  if (!PLATFORM_MODE || order.lines.length === 0) return null

  const paymentMethod = payload.splits
    .filter((s) => s.amountCOP > 0)
    .map((s) => `${PAYMENT_METHOD_LABEL[s.method]} ${formatCOP(s.amountCOP)}`)
    .join(' · ')

  const phone = payload.customerPhone?.trim() ?? ''

  const notes = [
    payload.attendedBy ? `Atendió: ${payload.attendedBy}` : null,
    order.transferReceiptDataUrl
      ? 'Comprobante transferencia (foto POS)'
      : order.transferReference?.trim()
        ? `Transf. ${order.transferReference.trim()}`
        : null,
    payload.cashTenderedCOP != null && payload.cashTenderedCOP > 0
      ? `Recibido: ${formatCOP(payload.cashTenderedCOP)}`
      : null,
    payload.saleComment?.trim() || null,
    payload.tipCOP > 0 ? `Propina: ${formatCOP(payload.tipCOP)}` : null,
    payload.printReceipt ? 'Recibo POS' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return createSale(baseUrl, {
    saleDate: new Date().toISOString(),
    paymentMethod: paymentMethod || undefined,
    source: 'POS',
    mesa: order.mesa?.trim() || order.tableName?.trim() || undefined,
    customerPhone: phone || undefined,
    notes: notes || undefined,
    receiptImageDataUrl:
      payload.transferReceiptDataUrl?.trim() ||
      order.transferReceiptDataUrl?.trim() ||
      undefined,
    lines: order.lines.map((line) => ({
      productId: line.productId,
      productName: line.productName,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })),
  })
}
