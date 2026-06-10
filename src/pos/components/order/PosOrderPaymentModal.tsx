import { hasTransferReceipt } from '../../lib/transferReceipt'
import type { PaymentMethod } from '../../types'
import { PosTransferReceiptSheet } from '../payment/PosTransferReceiptSheet'
import { PosMoney } from '../ui/PosMoney'
import { PosOrderPaymentPicker } from './PosOrderPaymentPicker'

type Props = {
  open: boolean
  tableName: string
  orderCode: string
  totalCOP: number
  paymentMethod: PaymentMethod | null
  transferReceiptDataUrl: string | null
  cashTenderedCOP: number
  saleComment: string
  confirmBusy?: boolean
  confirmError?: string | null
  transferSheetOpen?: boolean
  onClose: () => void
  onPaymentMethod: (method: PaymentMethod) => void
  onTransferReceipt: (dataUrl: string | null) => void
  onCashTendered: (value: number) => void
  onCommentChange: (value: string) => void
  onTransferSheetOpenChange?: (open: boolean) => void
  onConfirm: () => void
}

export function PosOrderPaymentModal({
  open,
  tableName,
  orderCode,
  totalCOP,
  paymentMethod,
  transferReceiptDataUrl,
  cashTenderedCOP,
  saleComment,
  confirmBusy = false,
  confirmError = null,
  transferSheetOpen = false,
  onClose,
  onPaymentMethod,
  onTransferReceipt,
  onCashTendered,
  onCommentChange,
  onTransferSheetOpenChange,
  onConfirm,
}: Props) {
  if (!open) return null

  const isTransfer = paymentMethod === 'transfer'
  const canConfirm =
    paymentMethod != null &&
    (paymentMethod === 'cash'
      ? cashTenderedCOP >= totalCOP
      : paymentMethod === 'transfer'
        ? hasTransferReceipt(transferReceiptDataUrl)
        : true)

  return (
    <>
      <div
        className="pos-modal-backdrop pos-modal-backdrop--payment"
        role="presentation"
        onClick={onClose}
      >
        <div
          className="pos-modal pos-modal--payment"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pos-payment-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="pos-modal__head">
            <div>
              <h2 id="pos-payment-modal-title">Forma de pago</h2>
              <p className="pos-modal--payment__sub muted small">
                {tableName} · <span className="mono">{orderCode}</span>
              </p>
            </div>
            <button
              type="button"
              className="pos-btn pos-btn--ghost pos-btn--icon"
              aria-label="Cerrar"
              disabled={confirmBusy}
              onClick={onClose}
            >
              ×
            </button>
          </header>

          <div className="pos-modal--payment__body">
            <div className="pos-modal--payment__total">
              <span>Total a pagar</span>
              <PosMoney value={totalCOP} className="pos-modal--payment__amount" />
            </div>

            <PosOrderPaymentPicker
              paymentMethod={paymentMethod}
              transferReceiptDataUrl={transferReceiptDataUrl}
              amountDueCOP={totalCOP}
              cashTenderedCOP={cashTenderedCOP}
              onPaymentMethod={onPaymentMethod}
              onOpenTransferSheet={() => onTransferSheetOpenChange?.(true)}
              onCashTenderedChange={onCashTendered}
            />

            {confirmError ? (
              <p className="pos-modal__error" role="alert">
                {confirmError}
              </p>
            ) : null}

            <label className="pos-modal--payment__comment">
              <span className="pos-modal--payment__comment-label">Comentario (opcional)</span>
              <textarea
                className="pos-input pos-input--textarea pos-modal--payment__comment-input"
                value={saleComment}
                onChange={(e) => onCommentChange(e.target.value)}
                placeholder="Notas del pedido, cocina, cliente…"
                rows={2}
                disabled={confirmBusy}
              />
            </label>
          </div>

          <footer className="pos-modal__actions pos-modal__actions--stack pos-modal__actions--padded pos-modal--payment__footer">
            <button
              type="button"
              className="pos-btn pos-btn--primary pos-btn--block pos-modal--payment__btn"
              disabled={!canConfirm || confirmBusy}
              onClick={onConfirm}
            >
              {confirmBusy ? 'Procesando…' : 'Confirmar venta'}
            </button>
            <button
              type="button"
              className="pos-btn pos-btn--ghost pos-btn--block pos-modal--payment__btn pos-modal--payment__btn--secondary"
              disabled={confirmBusy}
              onClick={onClose}
            >
              Volver al pedido
            </button>
          </footer>
        </div>
      </div>

      <PosTransferReceiptSheet
        open={transferSheetOpen && isTransfer}
        amountCOP={totalCOP}
        orderCode={orderCode}
        receiptDataUrl={transferReceiptDataUrl}
        onReceiptChange={onTransferReceipt}
        onClose={() => onTransferSheetOpenChange?.(false)}
      />
    </>
  )
}
