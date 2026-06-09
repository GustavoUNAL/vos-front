import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { formatCOP } from '../../lib/money'
import {
  POS_TRANSFER_BREB_KEY,
  buildTransferQrPayload,
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
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const qrSize = sheet ? 320 : compact ? 160 : 200

  useEffect(() => {
    let cancelled = false
    const payload = buildTransferQrPayload({ brebKey, amountCOP, orderCode })
    void QRCode.toDataURL(payload, {
      width: qrSize,
      margin: 1,
      errorCorrectionLevel: 'M',
    }).then((url) => {
      if (!cancelled) setDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [amountCOP, orderCode, brebKey, qrSize])

  const label = sheet
    ? `Escaneá para transferir ${formatCOP(amountCOP)}`
    : 'Escaneá para transferir (Bre-B)'

  return (
    <div
      className={`pos-transfer-qr${compact ? ' pos-transfer-qr--compact' : ''}${sheet ? ' pos-transfer-qr--sheet' : ''}`}
    >
      <p className="pos-transfer-qr__label muted small">{label}</p>
      <div className="pos-transfer-qr__frame">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`Código QR de pago Bre-B ${brebKey}`}
            width={qrSize}
            height={qrSize}
            className="pos-transfer-qr__img"
          />
        ) : (
          <div className="pos-transfer-qr__placeholder" aria-hidden />
        )}
      </div>
    </div>
  )
}
