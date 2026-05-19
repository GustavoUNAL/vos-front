import { useMemo, useState } from 'react'
import { PAYMENT_METHOD_LABEL } from '../../constants'
import { formatCOP } from '../../lib/money'
import { payPosOrder } from '../../services/posApi'
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
    setBusy(true)
    setError(null)
    try {
      const result = await payPosOrder(baseUrl, order.id, {
        splits,
        tipCOP,
        printReceipt,
      })
      setActiveOrder(result)
      navigate('tables')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cobrar')
    } finally {
      setBusy(false)
    }
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
            onClick={() => void confirmPay()}
          >
            Confirmar pago
          </button>
        </section>
      </div>
    </div>
  )
}
