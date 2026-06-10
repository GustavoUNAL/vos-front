import { hasTransferReceipt } from '../../lib/transferReceipt'
import { PosTransferQr } from './PosTransferQr'
import { PosTransferReceiptCapture } from './PosTransferReceiptCapture'

type Props = {
  open: boolean
  amountCOP: number
  orderCode: string
  receiptDataUrl: string | null
  onReceiptChange: (dataUrl: string | null) => void
  onClose: () => void
}

export function PosTransferReceiptSheet({
  open,
  amountCOP,
  orderCode,
  receiptDataUrl,
  onReceiptChange,
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
            className="pos-transfer-sheet__close"
            aria-label="Cerrar"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="pos-transfer-sheet__scroll">
          <PosTransferQr amountCOP={amountCOP} orderCode={orderCode} sheet />

          <PosTransferReceiptCapture
            amountCOP={amountCOP}
            orderCode={orderCode}
            receiptDataUrl={receiptDataUrl}
            onReceiptChange={onReceiptChange}
            showQr={false}
            sheet
          />
        </div>

        <footer className="pos-transfer-sheet__footer">
          <button
            type="button"
            className="pos-btn pos-btn--primary pos-btn--block pos-modal--payment__btn"
            disabled={!canContinue}
            onClick={onClose}
          >
            Listo
          </button>
        </footer>
      </div>
    </div>
  )
}
