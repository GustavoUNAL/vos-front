import { formatCOP } from '../../lib/money'
import {
  POS_TRANSFER_BREB_KEY,
  POS_TRANSFER_QR_IMAGE,
} from '../../config/transferPayment'

type Props = {
  amountCOP: number
  orderCode: string
  brebKey?: string
  compact?: boolean
  /** QR grande para pantalla de transferencia (sheet). */
  sheet?: boolean
}

export function PosTransferQr({
  amountCOP,
  orderCode,
  brebKey = POS_TRANSFER_BREB_KEY,
  compact = false,
  sheet = false,
}: Props) {
  const label = sheet
    ? `Escaneá para transferir ${formatCOP(amountCOP)} · Ref. ${orderCode.trim().toUpperCase()}`
    : 'Escaneá para transferir (Bre-B)'

  return (
    <div
      className={`pos-transfer-qr${compact ? ' pos-transfer-qr--compact' : ''}${sheet ? ' pos-transfer-qr--sheet' : ''}`}
    >
      <p className="pos-transfer-qr__label muted small">{label}</p>
      <div className="pos-transfer-qr__frame">
        <img
          src={POS_TRANSFER_QR_IMAGE}
          alt={`Código QR de pago Bre-B ${brebKey}`}
          className="pos-transfer-qr__img"
        />
      </div>
      <p className="pos-transfer-qr__key">{brebKey}</p>
    </div>
  )
}
