import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppTheme } from '../../hooks/useAppTheme'
import { PAYMENT_METHOD_HINT, PAYMENT_METHOD_LABEL } from '../../constants'
import { hasTransferReceipt } from '../../lib/transferReceipt'
import { formatCOP } from '../../lib/money'
import type { PaymentMethod } from '../../types'
import { PosMoney } from '../ui/PosMoney'
import { PosOrderDiscount } from './PosOrderDiscount'
import { PosOrderPaymentPicker } from './PosOrderPaymentPicker'

type PaymentStep = 'method' | 'confirm'

const PAYMENT_STEPS: { id: PaymentStep; label: string }[] = [
  { id: 'method', label: 'Cobrar' },
  { id: 'confirm', label: 'Confirmar' },
]

type Props = {
  open: boolean
  tableName: string
  orderCode: string
  grossTotalCOP: number
  discountCOP: number
  discountReason: string
  totalCOP: number
  paymentMethod: PaymentMethod | null
  transferReceiptDataUrl: string | null
  cashTenderedCOP: number
  saleComment: string
  confirmBusy?: boolean
  confirmError?: string | null
  onClose: () => void
  onDiscountCOP: (value: number) => void
  onDiscountReason: (value: string) => void
  onPaymentMethod: (method: PaymentMethod) => void
  onTransferReceipt: (dataUrl: string | null) => void
  onCashTendered: (value: number) => void
  onCommentChange: (value: string) => void
  onConfirm: () => void
}

export function PosOrderPaymentModal({
  open,
  tableName,
  orderCode,
  grossTotalCOP,
  discountCOP,
  discountReason,
  totalCOP,
  paymentMethod,
  transferReceiptDataUrl,
  cashTenderedCOP,
  saleComment,
  confirmBusy = false,
  confirmError = null,
  onClose,
  onDiscountCOP,
  onDiscountReason,
  onPaymentMethod,
  onTransferReceipt,
  onCashTendered,
  onCommentChange,
  onConfirm,
}: Props) {
  const theme = useAppTheme()
  const [step, setStep] = useState<PaymentStep>('method')

  useEffect(() => {
    if (open) setStep('method')
  }, [open])

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.classList.add('pos-payment-modal-open')
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.classList.remove('pos-payment-modal-open')
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  if (!open) return null

  const isTransfer = paymentMethod === 'transfer'
  const isCash = paymentMethod === 'cash'
  const hasReceipt = hasTransferReceipt(transferReceiptDataUrl)
  const discountValid = discountCOP <= 0 || discountReason.trim().length > 0
  const methodReady =
    paymentMethod != null &&
    discountValid &&
    (isCash
      ? cashTenderedCOP >= totalCOP
      : isTransfer
        ? hasReceipt
        : true)
  const canConfirm = methodReady
  const modalTitle = step === 'method' ? 'Cobrar' : 'Confirmar venta'
  const cashChange = cashTenderedCOP - totalCOP

  return createPortal(
    <div
      className={`pos-payment-portal pos-root pos-root--${theme}`}
      data-theme={theme}
    >
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
              <h2 id="pos-payment-modal-title">{modalTitle}</h2>
              <p className="pos-modal--payment__sub muted small">
                {tableName} · <span className="mono">{orderCode}</span>
              </p>
            </div>
            <button
              type="button"
              className="pos-modal--payment__close"
              aria-label="Cerrar"
              disabled={confirmBusy}
              onClick={onClose}
            >
              ×
            </button>
          </header>

          <div className="pos-modal--payment__body">
            <div className="pos-modal--payment__totals">
              <div className="pos-modal--payment__total pos-modal--payment__total--muted">
                <span>Subtotal</span>
                <PosMoney value={grossTotalCOP} />
              </div>
              <div
                className={`pos-modal--payment__total pos-modal--payment__total--discount${discountCOP <= 0 ? ' pos-modal--payment__total--zero' : ''}`}
              >
                <span>Descuento</span>
                <PosMoney value={-discountCOP} className="pos-modal--payment__discount" />
              </div>
              <div className="pos-modal--payment__total">
                <span>Total a pagar</span>
                <PosMoney value={totalCOP} className="pos-modal--payment__amount" />
              </div>
            </div>

            {discountCOP > 0 && discountReason.trim() ? (
              <p className="pos-modal--payment__discount-reason muted small">
                <strong>Motivo:</strong> {discountReason.trim()}
              </p>
            ) : null}

            {step === 'method' ? (
              <div className="pos-modal--payment__step">
                <div className="pos-modal--payment__checkout">
                  <PosOrderDiscount
                    active={open}
                    discountCOP={discountCOP}
                    discountReason={discountReason}
                    maxDiscountCOP={grossTotalCOP}
                    disabled={confirmBusy}
                    variant="payment"
                    onDiscountCOP={onDiscountCOP}
                    onDiscountReason={onDiscountReason}
                  />

                  <PosOrderPaymentPicker
                    paymentMethod={paymentMethod}
                    transferReceiptDataUrl={transferReceiptDataUrl}
                    amountDueCOP={totalCOP}
                    cashTenderedCOP={cashTenderedCOP}
                    hideHeading={false}
                    embedTransfer
                    orderCode={orderCode}
                    onTransferReceipt={onTransferReceipt}
                    onPaymentMethod={onPaymentMethod}
                    onCashTenderedChange={onCashTendered}
                  />
                </div>
              </div>
            ) : (
              <div className="pos-modal--payment__step">
                <div className="pos-modal--payment__summary">
                  <div className="pos-modal--payment__summary-row">
                    <span className="pos-modal--payment__summary-label muted small">Método</span>
                    <div className="pos-modal--payment__summary-value">
                      <strong>{paymentMethod ? PAYMENT_METHOD_LABEL[paymentMethod] : '—'}</strong>
                      {paymentMethod && PAYMENT_METHOD_HINT[paymentMethod] ? (
                        <span className="pos-modal--payment__summary-hint muted small">
                          {PAYMENT_METHOD_HINT[paymentMethod]}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className="pos-modal--payment__summary-change"
                        disabled={confirmBusy}
                        onClick={() => setStep('method')}
                      >
                        Cambiar
                      </button>
                    </div>
                  </div>

                  {isCash && cashTenderedCOP > 0 ? (
                    <div className="pos-modal--payment__summary-row">
                      <span className="pos-modal--payment__summary-label muted small">
                        Efectivo recibido
                      </span>
                      <strong className="mono">{formatCOP(cashTenderedCOP)}</strong>
                    </div>
                  ) : null}

                  {isCash && cashChange >= 0 ? (
                    <div className="pos-modal--payment__summary-row">
                      <span className="pos-modal--payment__summary-label muted small">Cambio</span>
                      <strong className="mono pos-modal--payment__summary-change-amount">
                        {formatCOP(cashChange)}
                      </strong>
                    </div>
                  ) : null}

                  {isTransfer && hasReceipt ? (
                    <div className="pos-modal--payment__summary-row pos-modal--payment__summary-row--receipt">
                      <span className="pos-modal--payment__summary-label muted small">
                        Comprobante
                      </span>
                      <span className="pos-order-payment__receipt-thumb-wrap">
                        <img
                          src={transferReceiptDataUrl!}
                          alt=""
                          className="pos-order-payment__receipt-thumb"
                        />
                      </span>
                    </div>
                  ) : null}

                  <div className="pos-modal--payment__summary-row">
                    <span className="pos-modal--payment__summary-label muted small">
                      Descuento
                    </span>
                    <div className="pos-modal--payment__summary-value">
                      <strong className="mono">{formatCOP(-discountCOP)}</strong>
                      {discountCOP > 0 && discountReason.trim() ? (
                        <span className="pos-modal--payment__summary-hint muted small">
                          {discountReason.trim()}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

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
            )}
          </div>

          <nav className="pos-modal--payment__pager" aria-label="Pasos del cobro">
            {PAYMENT_STEPS.map((item, index) => {
              const active = step === item.id
              const done = item.id === 'method' && step === 'confirm'
              return (
                <span key={item.id} className="pos-modal--payment__pager-segment">
                  {index > 0 ? (
                    <span
                      className={`pos-modal--payment__pager-line${done || active ? ' is-filled' : ''}`}
                      aria-hidden
                    />
                  ) : null}
                  <div
                    className={`pos-modal--payment__pager-item${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
                    aria-current={active ? 'step' : undefined}
                  >
                    <span className="pos-modal--payment__pager-dot" aria-hidden>
                      {index + 1}
                    </span>
                    <span className="pos-modal--payment__pager-label">{item.label}</span>
                  </div>
                </span>
              )
            })}
          </nav>

          <footer className="pos-modal__actions pos-modal__actions--stack pos-modal__actions--padded pos-modal--payment__footer">
            {step === 'method' ? (
              <>
                <button
                  type="button"
                  className="pos-btn pos-btn--primary pos-btn--block pos-modal--payment__btn"
                  disabled={!methodReady || confirmBusy}
                  onClick={() => setStep('confirm')}
                >
                  Continuar
                </button>
                <button
                  type="button"
                  className="pos-btn pos-btn--ghost pos-btn--block pos-modal--payment__btn pos-modal--payment__btn--secondary"
                  disabled={confirmBusy}
                  onClick={onClose}
                >
                  Volver al pedido
                </button>
              </>
            ) : (
              <>
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
                  onClick={() => setStep('method')}
                >
                  Volver
                </button>
              </>
            )}
          </footer>
        </div>
      </div>
    </div>,
    document.body,
  )
}
