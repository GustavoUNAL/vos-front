import { PAYMENT_METHOD_LABEL } from '../../constants'
import { hasTransferReceipt } from '../../lib/transferReceipt'
import type { PaymentMethod } from '../../types'
import { PosCashInline } from '../payment/PosCashInline'

const PAYMENT_OPTIONS: PaymentMethod[] = ['cash', 'transfer']

type Props = {
  paymentMethod: PaymentMethod | null
  transferReceiptDataUrl: string | null
  amountDueCOP: number
  cashTenderedCOP: number
  onPaymentMethod: (method: PaymentMethod) => void
  onOpenTransferSheet: () => void
  onCashTenderedChange: (value: number) => void
}

export function PosOrderPaymentPicker({
  paymentMethod,
  transferReceiptDataUrl,
  amountDueCOP,
  cashTenderedCOP,
  onPaymentMethod,
  onOpenTransferSheet,
  onCashTenderedChange,
}: Props) {
  const isTransfer = paymentMethod === 'transfer'
  const isCash = paymentMethod === 'cash' || paymentMethod == null
  const hasReceipt = hasTransferReceipt(transferReceiptDataUrl)

  const handleMethodClick = (method: PaymentMethod) => {
    if (method === 'transfer') {
      onPaymentMethod('transfer')
      onOpenTransferSheet()
      return
    }
    onPaymentMethod(method)
  }

  return (
    <div className="pos-order-payment">
      <span className="pos-order-payment__label">Forma de pago</span>
      <div className="pos-order-payment__methods" role="group" aria-label="Forma de pago">
        {PAYMENT_OPTIONS.map((method) => {
          const active =
            paymentMethod === method || (method === 'cash' && paymentMethod == null)
          return (
            <button
              key={method}
              type="button"
              className={`pos-order-payment__method${active ? ' pos-order-payment__method--active' : ''}`}
              aria-pressed={active}
              onClick={() => handleMethodClick(method)}
            >
              <span className="pos-order-payment__method-label">
                {PAYMENT_METHOD_LABEL[method]}
              </span>
            </button>
          )
        })}
      </div>

      {isCash ? (
        <PosCashInline
          amountDueCOP={amountDueCOP}
          tenderedCOP={cashTenderedCOP}
          onTenderedChange={onCashTenderedChange}
        />
      ) : null}

      {isTransfer ? (
        <button
          type="button"
          className="pos-order-payment__extra-btn"
          onClick={onOpenTransferSheet}
        >
          {hasReceipt ? (
            <>
              <span className="pos-order-payment__receipt-thumb-wrap">
                <img
                  src={transferReceiptDataUrl!}
                  alt=""
                  className="pos-order-payment__receipt-thumb"
                />
              </span>
              <span>QR, comprobante e ID · Editar</span>
            </>
          ) : (
            <span>Abrir QR y comprobante de transferencia</span>
          )}
        </button>
      ) : null}
    </div>
  )
}
