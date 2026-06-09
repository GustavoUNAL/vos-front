import { hasTransferReceipt } from '../../lib/transferReceipt'
import { PosTransferQr } from './PosTransferQr'
import { PosTransferReceiptCapture } from './PosTransferReceiptCapture'

type Props = {
  open: boolean
  amountCOP: number
  orderCode: string
  receiptDataUrl: string | null
  transferReference: string
  onReceiptChange: (dataUrl: string | null) => void
  onTransferReferenceChange: (value: string) => void
  onClose: () => void
}

export function PosTransferReceiptSheet({
  open,
  amountCOP,
  orderCode,
  receiptDataUrl,
  transferReference,
  onReceiptChange,
  onTransferReferenceChange,
  onClose,
}: Props) {
  if (!open) return null

  const canContinue = hasTransferReceipt(receiptDataUrl)

  return (
    <div className="pos-transfer-sheet" role="presentation">
      <div
        className="pos-transfer-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-transfer-sheet-title"
      >
        <header className="pos-transfer-sheet__head">
          <h2 id="pos-transfer-sheet-title">Transferencia</h2>
          <button
            type="button"
            className="pos-btn pos-btn--ghost pos-btn--icon"
            aria-label="Cerrar"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="pos-transfer-sheet__scroll">
          <PosTransferQr amountCOP={amountCOP} orderCode={orderCode} sheet />

          <label className="pos-order-payment__ref-field pos-order-payment__ref-field--sheet">
            <span className="pos-order-payment__ref-label">ID transferencia (opcional)</span>
            <input
              type="text"
              className="pos-input"
              value={transferReference}
              onChange={(e) => onTransferReferenceChange(e.target.value)}
              placeholder="Ej. 1234567890"
              inputMode="numeric"
              autoComplete="off"
            />
          </label>

          <PosTransferReceiptCapture
            amountCOP={amountCOP}
            orderCode={orderCode}
            receiptDataUrl={receiptDataUrl}
            onReceiptChange={onReceiptChange}
            showQr={false}
          />
        </div>

        <footer className="pos-transfer-sheet__footer">
          <button
            type="button"
            className="pos-btn pos-btn--primary pos-btn--block pos-btn--xl"
            disabled={!canContinue}
            onClick={onClose}
          >
            {canContinue ? 'Listo' : 'Tomá foto del comprobante'}
          </button>
        </footer>
      </div>
    </div>
  )
}
