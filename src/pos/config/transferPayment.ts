import { formatCOP } from '../lib/money'

/** Llave Bre-B del negocio (sync con SHOP_BREB_KEY en vos-api). */
export const POS_TRANSFER_BREB_KEY = '@ARANDANOCAFE'

export function buildTransferQrPayload(args: {
  brebKey?: string
  amountCOP: number
  orderCode: string
}): string {
  const key = (args.brebKey ?? POS_TRANSFER_BREB_KEY).trim()
  const amount = Math.max(0, Math.round(args.amountCOP))
  return `${key}\n${amount}\n${args.orderCode.trim().toUpperCase()}`
}

export function transferQrCaption(args: {
  amountCOP: number
  orderCode: string
  brebKey?: string
}): string {
  const key = (args.brebKey ?? POS_TRANSFER_BREB_KEY).trim()
  return `${key} · ${formatCOP(args.amountCOP)} · Ref. ${args.orderCode.trim().toUpperCase()}`
}
