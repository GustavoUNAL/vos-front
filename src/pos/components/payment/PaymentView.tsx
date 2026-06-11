import { useEffect, useMemo, useState } from 'react'
import { MOBILE_FILTER_BREAKPOINT } from '../../../components/MobileAwareFilterBar'
import { useMatchMedia } from '../../../hooks/useMatchMedia'
import { DEFAULT_POS_STAFF } from '../../constants'
import { formatPosOrderCode } from '../../lib/orderCode'
import { formatCOP, computeOrderTotals } from '../../lib/money'
import { isValidColombiaMobile } from '../../lib/phone'
import { pickOrderMeta, writeCachedOrderMeta } from '../../lib/orderMetaCache'
import { incrementDailySalesCount } from '../../lib/dailySalesCount'
import { hasTransferReceipt } from '../../lib/transferReceipt'
import { payPosOrder } from '../../services/posApi'
import { registerPlatformSaleFromPosOrder } from '../../services/platformPosPay'
import { usePosStore } from '../../store/posStore'
import type { PaymentMethod, PaymentSplit, PosStaffMember } from '../../types'
import { PosErrorBanner } from '../ui/PosErrorBanner'
import { PosMoney } from '../ui/PosMoney'
import { PosOrderPaymentPicker } from '../order/PosOrderPaymentPicker'
import { PosOrderDiscount } from '../order/PosOrderDiscount'
import { PosStaffPicker } from '../ui/PosStaffPicker'
import { PosCashSheet } from './PosCashSheet'
import { PosCashTender } from './PosCashTender'
import { PosPaymentSuccess } from './PosPaymentSuccess'

type SuccessState = {
  saleId: string
  dailyCount: number
  orderRef: string
  partyName: string
  totalCOP: number
  changeCOP: number
  attendedBy: PosStaffMember
  paymentMethod: PaymentMethod
  whatsappHint: string | null
}

type Props = { baseUrl: string }

const TIP_PRESETS_COP = [1_000, 2_000, 5_000] as const

export function PaymentView({ baseUrl }: Props) {
  const { state, navigate, setActiveOrder } = usePosStore()
  const order = state.activeOrder
  const [tipCOP, setTipCOP] = useState(0)
  const [cashTendered, setCashTendered] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [printReceipt, setPrintReceipt] = useState(true)
  const [customerPhone, setCustomerPhone] = useState('')
  const [attendedBy, setAttendedBy] = useState<PosStaffMember | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [success, setSuccess] = useState<SuccessState | null>(null)
  const [tipOpen, setTipOpen] = useState(false)
  const [cashSheetOpen, setCashSheetOpen] = useState(false)
  const isMobile = useMatchMedia(MOBILE_FILTER_BREAKPOINT)

  const paymentMethod: PaymentMethod = order?.paymentMethod ?? 'cash'
  const isCash = paymentMethod === 'cash'
  const isTransfer = paymentMethod === 'transfer'

  useEffect(() => {
    if (!order) return
    setCustomerPhone(order.customerPhone ?? '')
    setAttendedBy(order.attendedBy ?? DEFAULT_POS_STAFF)
    setCashTendered(order.cashTenderedCOP ?? 0)
    setTipCOP(0)
    setSuccess(null)
    setFieldError(null)
    setError(null)
    setTipOpen(false)
    setCashSheetOpen(false)
  }, [order?.id])

  useEffect(() => {
    if (!order) return
    if (order.paymentMethod === 'cash' && isMobile) {
      setCashSheetOpen(true)
    }
  }, [order?.id, order?.paymentMethod, isMobile])

  const totals = useMemo(() => {
    if (!order) {
      return { subtotalCOP: 0, taxCOP: 0, discountCOP: 0, totalCOP: 0, grossTotalCOP: 0 }
    }
    const computed = computeOrderTotals(
      order.lines,
      order.taxRate,
      order.discountCOP ?? 0,
    )
    return {
      ...computed,
      grossTotalCOP: computed.subtotalCOP + computed.taxCOP,
    }
  }, [order])

  const totalDue = totals.totalCOP
  const amountDue = totalDue + tipCOP
  const change = isCash ? cashTendered - amountDue : 0
  const discountValid =
    totals.discountCOP <= 0 || (order?.discountReason?.trim().length ?? 0) > 0
  const canConfirm = useMemo(() => {
    if (!order) return false
    if (!(attendedBy ?? DEFAULT_POS_STAFF)) return false
    if (!discountValid) return false
    if (isTransfer && !hasTransferReceipt(order.transferReceiptDataUrl)) return false
    if (isCash) return cashTendered >= amountDue
    return true
  }, [order, attendedBy, discountValid, isTransfer, isCash, cashTendered, amountDue])

  if (!order) {
    return (
      <div className="pos-screen">
        <p className="muted">No hay cuenta activa.</p>
        <button type="button" className="pos-btn pos-btn--ghost" onClick={() => navigate('tables')}>
          Volver a mesas
        </button>
      </div>
    )
  }

  if (success) {
    return (
      <div className="pos-screen pos-screen--payment pos-screen--payment-success">
        <PosPaymentSuccess
          saleId={success.saleId}
          dailyCount={success.dailyCount}
          onDone={() => navigate('tables')}
        />
      </div>
    )
  }

  const confirmPay = async () => {
    const staff = attendedBy ?? DEFAULT_POS_STAFF
    if (!staff) {
      setFieldError('Elegí quién atendió la orden.')
      return
    }
    const phone = customerPhone.trim()
    if (phone && !isValidColombiaMobile(phone)) {
      setFieldError('Celular inválido. Usá 10 dígitos (ej. 300 123 4567).')
      return
    }
    if (isCash && cashTendered < amountDue) {
      setFieldError('El efectivo recibido no cubre el total.')
      return
    }
    if (isTransfer && !hasTransferReceipt(order.transferReceiptDataUrl)) {
      setFieldError('Adjuntá el comprobante de transferencia.')
      return
    }
    if (totals.discountCOP > 0 && !order.discountReason?.trim()) {
      setFieldError('Justificá el descuento antes de cobrar.')
      return
    }

    setBusy(true)
    setError(null)
    setFieldError(null)
    try {
      const splits: PaymentSplit[] = [
        { method: paymentMethod, amountCOP: amountDue },
      ]
      const payload = {
        splits,
        tipCOP,
        printReceipt,
        customerPhone: phone || undefined,
        saleComment: order.notes?.trim() || undefined,
        attendedBy: staff,
        cashTenderedCOP: isCash ? cashTendered : undefined,
        transferReceiptDataUrl: order.transferReceiptDataUrl ?? undefined,
        discountCOP: totals.discountCOP > 0 ? totals.discountCOP : undefined,
        discountReason:
          totals.discountCOP > 0 ? order.discountReason?.trim() : undefined,
      }
      const sale = await registerPlatformSaleFromPosOrder(baseUrl, order, payload)
      await payPosOrder(baseUrl, order.id, {
        splits: payload.splits,
        tipCOP: payload.tipCOP,
        printReceipt: payload.printReceipt,
        customerPhone: phone || undefined,
        attendedBy: staff,
        cashTenderedCOP: payload.cashTenderedCOP,
        transferReceiptDataUrl: payload.transferReceiptDataUrl,
        discountCOP: payload.discountCOP,
        discountReason: payload.discountReason,
      })
      setActiveOrder(null)

      const orderRef = formatPosOrderCode(order)
      const partyName = order.mesa?.trim() || order.tableName || 'Sin nombre'
      const saleId = sale?.code?.trim() || sale?.id || orderRef

      let whatsappHint: string | null = null
      if (phone && sale && !sale.whatsappSent) {
        whatsappHint =
          sale.whatsappConfigured === false
            ? 'Venta guardada. Configure WhatsApp en el servidor para enviar comprobantes.'
            : 'Venta guardada. No se pudo enviar el comprobante por WhatsApp.'
      } else if (!phone) {
        whatsappHint = 'Comprobante no enviado (sin WhatsApp del cliente).'
      }

      setSuccess({
        saleId,
        dailyCount: incrementDailySalesCount(),
        orderRef,
        partyName,
        totalCOP: amountDue,
        changeCOP: isCash ? change : 0,
        attendedBy: staff,
        paymentMethod,
        whatsappHint,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cobrar')
    } finally {
      setBusy(false)
    }
  }

  const orderRef = formatPosOrderCode(order)
  const tableLabel = order.tableName?.trim() || 'Mesa'
  const partyName = order.mesa?.trim() || tableLabel

  const setTransferReceipt = (dataUrl: string | null) => {
    const next = {
      ...order,
      transferReceiptDataUrl: dataUrl,
      transferReference: null,
    }
    writeCachedOrderMeta(next.id, pickOrderMeta(next))
    setActiveOrder(next)
    setFieldError(null)
  }

  const updateCashTendered = (value: number) => {
    setCashTendered(value)
    const next = { ...order, cashTenderedCOP: value }
    writeCachedOrderMeta(next.id, pickOrderMeta(next))
    setActiveOrder(next)
  }

  const setPaymentMethod = (method: PaymentMethod) => {
    const next = {
      ...order,
      paymentMethod: method,
      ...(method === 'cash'
        ? { transferReceiptDataUrl: null, transferReference: null }
        : { cashTenderedCOP: null }),
    }
    writeCachedOrderMeta(next.id, pickOrderMeta(next))
    setActiveOrder(next)
    setFieldError(null)
    if (method === 'transfer') {
      setCashSheetOpen(false)
    } else {
      setCashSheetOpen(true)
      if (paymentMethod === 'transfer') {
        setCashTendered(0)
      }
    }
  }

  const setOrderNotes = (value: string) => {
    const next = { ...order, notes: value }
    writeCachedOrderMeta(next.id, pickOrderMeta(next))
    setActiveOrder(next)
  }

  const setDiscountCOP = (value: number) => {
    const next = { ...order, discountCOP: value }
    writeCachedOrderMeta(next.id, pickOrderMeta(next))
    setActiveOrder(next)
  }

  const setDiscountReason = (value: string) => {
    const next = { ...order, discountReason: value }
    writeCachedOrderMeta(next.id, pickOrderMeta(next))
    setActiveOrder(next)
  }

  return (
    <div
      className={`pos-screen pos-screen--payment${paymentMethod === 'transfer' ? ' pos-screen--payment-transfer' : ''}`}
    >
      <header className="pos-topbar">
        <div>
          <h1 className="pos-topbar__title">{tableLabel}</h1>
          <p className="pos-topbar__sub muted">
            Forma de pago
            {partyName !== tableLabel ? ` · ${partyName}` : ''}
            {' · '}
            <span className="mono">{orderRef}</span>
          </p>
        </div>
        <button
          type="button"
          className="pos-btn pos-btn--ghost"
          onClick={() => navigate('order', order.tableId)}
        >
          ← Volver al pedido
        </button>
      </header>

      <PosErrorBanner message={error ?? ''} />

      <div className="pos-payment-checkout">
        <div className="pos-payment-checkout__scroll">
          <div className="pos-payment-layout pos-payment-layout--simple">
            <section className="pos-payment-panel">
              <div className="pos-payment-due-breakdown">
                <p className="pos-payment-due pos-payment-due--muted">
                  Subtotal{' '}
                  <PosMoney value={totals.grossTotalCOP} className="pos-payment-due__amount" />
                </p>
                <p
                  className={`pos-payment-due pos-payment-due--discount${totals.discountCOP <= 0 ? ' pos-payment-due--zero' : ''}`}
                >
                  Descuento{' '}
                  <PosMoney
                    value={-totals.discountCOP}
                    className="pos-payment-due__amount pos-payment-due__amount--discount"
                  />
                </p>
                <p className="pos-payment-due">
                  Total a pagar{' '}
                  <PosMoney value={amountDue} className="pos-payment-due__amount" />
                  {tipCOP > 0 ? (
                    <span className="pos-payment-due__tip muted small">
                      Incluye propina {formatCOP(tipCOP)}
                    </span>
                  ) : null}
                </p>
                {totals.discountCOP > 0 && order.discountReason?.trim() ? (
                  <p className="pos-payment-due__discount-reason muted small">
                    <strong>Motivo:</strong> {order.discountReason.trim()}
                  </p>
                ) : null}
              </div>

              <PosOrderDiscount
                discountCOP={order.discountCOP ?? 0}
                discountReason={order.discountReason ?? ''}
                maxDiscountCOP={totals.grossTotalCOP}
                disabled={busy}
                variant="payment"
                onDiscountCOP={setDiscountCOP}
                onDiscountReason={setDiscountReason}
              />

              <PosStaffPicker value={attendedBy} onChange={setAttendedBy} compact />

              <PosOrderPaymentPicker
                paymentMethod={paymentMethod}
                transferReceiptDataUrl={order.transferReceiptDataUrl ?? null}
                amountDueCOP={amountDue}
                cashTenderedCOP={cashTendered}
                embedTransfer
                orderCode={orderRef}
                onTransferReceipt={setTransferReceipt}
                onPaymentMethod={setPaymentMethod}
                onCashTenderedChange={updateCashTendered}
              />

              {isCash && !isMobile ? (
                <div className="pos-cash-tender--inline">
                  <PosCashTender
                    amountDueCOP={amountDue}
                    tenderedCOP={cashTendered}
                    onTenderedChange={updateCashTendered}
                  />
                </div>
              ) : null}

              <div className="pos-payment-tip">
                <button
                  type="button"
                  className={`pos-payment-tip__toggle${tipCOP > 0 ? ' pos-payment-tip__toggle--set' : ''}${tipOpen ? ' pos-payment-tip__toggle--open' : ''}`}
                  aria-expanded={tipOpen}
                  onClick={() => setTipOpen((v) => !v)}
                >
                  {tipCOP > 0 ? `Propina ${formatCOP(tipCOP)}` : '+ Propina'}
                </button>
                {tipOpen ? (
                  <div className="pos-payment-tip__panel">
                    <div className="pos-payment-tip__presets" role="group" aria-label="Propina rápida">
                      <button
                        type="button"
                        className={`pos-payment-tip__preset${tipCOP === 0 ? ' pos-payment-tip__preset--active' : ''}`}
                        onClick={() => setTipCOP(0)}
                      >
                        Sin
                      </button>
                      {TIP_PRESETS_COP.map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          className={`pos-payment-tip__preset${tipCOP === amount ? ' pos-payment-tip__preset--active' : ''}`}
                          onClick={() => setTipCOP(amount)}
                        >
                          {formatCOP(amount)}
                        </button>
                      ))}
                    </div>
                    <label className="pos-payment-tip__field">
                      <span className="sr-only">Otra propina</span>
                      <input
                        type="number"
                        className="pos-input pos-input--compact"
                        min={0}
                        step={500}
                        inputMode="numeric"
                        value={tipCOP || ''}
                        placeholder="Otro monto"
                        onChange={(e) => setTipCOP(Number(e.target.value) || 0)}
                      />
                    </label>
                  </div>
                ) : null}
              </div>

              <label className="pos-check pos-check--compact">
                <input
                  type="checkbox"
                  checked={printReceipt}
                  onChange={(e) => setPrintReceipt(e.target.checked)}
                />
                Imprimir recibo
              </label>

              <label className="pos-field pos-field--whatsapp">
                <span>WhatsApp (opcional)</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className="pos-input"
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value)
                    setFieldError(null)
                  }}
                  placeholder="300 123 4567"
                />
              </label>

              <label className="pos-order-comments pos-order-comments--payment">
                <span className="pos-order-comments__label">Comentarios</span>
                <textarea
                  className="pos-input pos-input--textarea pos-order-comments__input"
                  value={order.notes ?? ''}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Notas del pedido, cocina, cliente…"
                  rows={2}
                />
              </label>
            </section>
          </div>
        </div>

        <footer className="pos-payment-checkout__footer">
          {fieldError ? (
            <p className="pos-payment-checkout__error" role="alert">
              {fieldError}
            </p>
          ) : null}
          <button
            type="button"
            className="pos-btn pos-btn--primary pos-btn--block pos-btn--xl"
            disabled={busy || !canConfirm}
            onClick={() => void confirmPay()}
          >
            {busy ? 'Procesando…' : 'Confirmar venta'}
          </button>
        </footer>
      </div>

      <PosCashSheet
        open={cashSheetOpen && isCash}
        amountCOP={amountDue}
        tenderedCOP={cashTendered}
        onTenderedChange={updateCashTendered}
        onClose={() => setCashSheetOpen(false)}
        requireCover
      />

    </div>
  )
}
