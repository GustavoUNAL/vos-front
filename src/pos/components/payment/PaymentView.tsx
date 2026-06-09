import { useMemo, useState } from 'react'
import { PAYMENT_METHOD_LABEL } from '../../constants'
import { isValidColombiaMobile } from '../../lib/phone'
import { formatCOP } from '../../lib/money'
import { payPosOrder } from '../../services/posApi'
import { registerPlatformSaleFromPosOrder } from '../../services/platformPosPay'
import { usePosStore } from '../../store/posStore'
import type { PaymentMethod, PaymentSplit } from '../../types'
import { PosErrorBanner } from '../ui/PosErrorBanner'
import { PosMoney } from '../ui/PosMoney'

const METHODS: PaymentMethod[] = [
  'cash',
  'card',
  'transfer',
  'nequi',
  'daviplata',
  'other',
]

type Props = { baseUrl: string }

export function PaymentView({ baseUrl }: Props) {
  const { state, navigate, setActiveOrder } = usePosStore()
  const order = state.activeOrder
  const [splits, setSplits] = useState<PaymentSplit[]>([
    { method: 'cash', amountCOP: order?.totalCOP ?? 0 },
  ])
  const [tipCOP, setTipCOP] = useState(0)
  const [splitMode, setSplitMode] = useState(false)
  const [guests, setGuests] = useState(2)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [printReceipt, setPrintReceipt] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [customerPhone, setCustomerPhone] = useState('')
  const [saleComment, setSaleComment] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)

  const totalDue = order?.totalCOP ?? 0
  const paid = splits.reduce((s, x) => s + x.amountCOP, 0)
  const change = paid - totalDue - tipCOP

  const perGuest = useMemo(() => {
    if (!splitMode || guests < 1) return totalDue
    return Math.ceil(totalDue / guests)
  }, [splitMode, guests, totalDue])

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

  const addSplit = () => {
    const remaining = Math.max(0, totalDue + tipCOP - paid)
    setSplits((prev) => [...prev, { method: 'card', amountCOP: remaining }])
  }

  const updateSplit = (idx: number, patch: Partial<PaymentSplit>) => {
    setSplits((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    )
  }

  const confirmPay = async () => {
    const phone = customerPhone.trim()
    if (!phone) {
      setFieldError('Ingresá el celular del cliente para enviar la factura por WhatsApp.')
      return
    }
    if (!isValidColombiaMobile(phone)) {
      setFieldError('Celular inválido. Usá 10 dígitos (ej. 300 123 4567).')
      return
    }

    setBusy(true)
    setError(null)
    setFieldError(null)
    try {
      const payload = {
        splits,
        tipCOP,
        printReceipt,
        customerPhone: phone,
        saleComment: saleComment.trim() || undefined,
      }
      const sale = await registerPlatformSaleFromPosOrder(baseUrl, order, payload)
      const result = await payPosOrder(baseUrl, order.id, {
        splits: payload.splits,
        tipCOP: payload.tipCOP,
        printReceipt: payload.printReceipt,
        customerPhone: phone,
      })
      setActiveOrder(result)
      setConfirmOpen(false)
      if (sale && !sale.whatsappSent) {
        setError(
          sale.whatsappConfigured === false
            ? 'Venta registrada. Configure WhatsApp en el servidor para enviar comprobantes.'
            : 'Venta registrada. No se pudo enviar WhatsApp al cliente o al grupo interno.',
        )
      }
      navigate('tables')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cobrar')
    } finally {
      setBusy(false)
    }
  }

  const requestConfirmPay = () => {
    if (paid < totalDue + tipCOP) return
    setFieldError(null)
    setConfirmOpen(true)
  }

  return (
    <div className="pos-screen pos-screen--payment">
      <header className="pos-topbar">
        <div>
          <h1 className="pos-topbar__title">Cobrar</h1>
          <p className="pos-topbar__sub muted">{order.tableName ?? 'Mesa'}</p>
        </div>
        <button type="button" className="pos-btn pos-btn--ghost" onClick={() => navigate('order', order.tableId)}>
          ← Volver al pedido
        </button>
      </header>

      <PosErrorBanner message={error ?? ''} />

      <div className="pos-payment-layout">
        <section className="pos-payment-panel">
          <p className="pos-payment-due">
            Total a pagar <PosMoney value={totalDue + tipCOP} className="pos-payment-due__amount" />
          </p>

          <label className="pos-field">
            <span>Propina</span>
            <input
              type="number"
              className="pos-input"
              min={0}
              step={500}
              value={tipCOP || ''}
              onChange={(e) => setTipCOP(Number(e.target.value) || 0)}
            />
          </label>

          <label className="pos-check">
            <input
              type="checkbox"
              checked={splitMode}
              onChange={(e) => setSplitMode(e.target.checked)}
            />
            Dividir cuenta
          </label>
          {splitMode && (
            <label className="pos-field">
              <span>Comensales</span>
              <input
                type="number"
                className="pos-input"
                min={1}
                max={20}
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value) || 1)}
              />
              <p className="muted small">≈ {formatCOP(perGuest)} por persona</p>
            </label>
          )}

          <h2 className="pos-section-title">Métodos de pago</h2>
          {splits.map((split, idx) => (
            <div key={idx} className="pos-split-row">
              <select
                className="pos-input"
                value={split.method}
                onChange={(e) =>
                  updateSplit(idx, { method: e.target.value as PaymentMethod })
                }
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABEL[m]}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className="pos-input"
                min={0}
                value={split.amountCOP || ''}
                onChange={(e) =>
                  updateSplit(idx, { amountCOP: Number(e.target.value) || 0 })
                }
              />
            </div>
          ))}
          <button type="button" className="pos-btn pos-btn--ghost" onClick={addSplit}>
            + Pago mixto
          </button>

          {change >= 0 && paid > 0 && (
            <p className="pos-change">Cambio: {formatCOP(change)}</p>
          )}

          <label className="pos-check">
            <input
              type="checkbox"
              checked={printReceipt}
              onChange={(e) => setPrintReceipt(e.target.checked)}
            />
            Imprimir recibo
          </label>
        </section>

        <section className="pos-payment-summary">
          <dl className="pos-totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatCOP(order.subtotalCOP)}</dd>
            </div>
            <div>
              <dt>Impuestos</dt>
              <dd>{formatCOP(order.taxCOP)}</dd>
            </div>
            <div>
              <dt>Propina</dt>
              <dd>{formatCOP(tipCOP)}</dd>
            </div>
            <div className="pos-totals__grand">
              <dt>Total</dt>
              <dd>
                <PosMoney value={totalDue + tipCOP} />
              </dd>
            </div>
          </dl>
          <button
            type="button"
            className="pos-btn pos-btn--accent pos-btn--block pos-btn--xl"
            disabled={busy || paid < totalDue + tipCOP}
            onClick={requestConfirmPay}
          >
            Confirmar pago
          </button>
        </section>
      </div>

      {confirmOpen && (
        <div
          className="pos-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setConfirmOpen(false)
          }}
        >
          <div
            className="pos-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="pos-close-sale-title"
            aria-describedby="pos-close-sale-desc"
          >
            <h2 id="pos-close-sale-title" className="pos-modal__title">
              ¿Cerrar la venta?
            </h2>
            <p id="pos-close-sale-desc" className="pos-modal__text muted">
              Se registrará la venta de{' '}
              <strong>{order.tableName ?? 'esta mesa'}</strong> por{' '}
              <strong>{formatCOP(totalDue + tipCOP)}</strong> ({order.lines.length}{' '}
              {order.lines.length === 1 ? 'producto' : 'productos'}). El comprobante se
              enviará por WhatsApp al cliente y al grupo interno del local.
            </p>
            <div className="pos-modal__form">
              <label className="pos-field">
                <span>Celular cliente (WhatsApp) *</span>
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
              <label className="pos-field">
                <span>Comentario</span>
                <textarea
                  className="pos-input pos-input--textarea"
                  rows={2}
                  value={saleComment}
                  onChange={(e) => setSaleComment(e.target.value)}
                  placeholder="Ej. propina en efectivo, mesa al fondo, factura a nombre de…"
                />
              </label>
              {fieldError ? (
                <p className="pos-modal__error" role="alert">
                  {fieldError}
                </p>
              ) : null}
            </div>
            <div className="pos-modal__actions pos-modal__actions--padded">
              <button
                type="button"
                className="pos-btn pos-btn--ghost"
                disabled={busy}
                onClick={() => setConfirmOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="pos-btn pos-btn--accent"
                disabled={busy}
                onClick={() => void confirmPay()}
              >
                {busy ? 'Cobrando…' : 'Sí, cerrar venta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
