import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { formatCOP, parseMoney } from '../../lib/money'

type Props = {
  open: boolean
  busy?: boolean
  error?: string | null
  onClose: () => void
  onConfirm: (payload: {
    name: string
    amountCOP: number
    detail: string
  }) => void | Promise<void>
}

export function PosOpenProductModal({
  open,
  busy = false,
  error = null,
  onClose,
  onConfirm,
}: Props) {
  const titleId = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [detail, setDetail] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName('')
    setAmount('')
    setDetail('')
    setLocalError(null)
    const id = window.requestAnimationFrame(() => nameRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [open])

  if (!open) return null

  const amountCOP = parseMoney(amount)
  const nameTrim = name.trim()
  const canSave = nameTrim.length > 0 && amountCOP > 0 && !busy

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!nameTrim) {
      setLocalError('Escriba qué se vendió.')
      return
    }
    if (amountCOP <= 0) {
      setLocalError('Escriba el valor.')
      return
    }
    setLocalError(null)
    await onConfirm({
      name: nameTrim,
      amountCOP,
      detail: detail.trim(),
    })
  }

  const displayError = localError || error

  return (
    <div className="pos-modal-backdrop" role="presentation" onClick={busy ? undefined : onClose}>
      <div
        className="pos-modal pos-modal--extra-charge"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pos-modal__head">
          <h2 id={titleId}>Producto genérico</h2>
          <button
            type="button"
            className="pos-modal__close"
            disabled={busy}
            aria-label="Cerrar"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <form className="pos-modal__body pos-extra-charge" onSubmit={(e) => void handleSubmit(e)}>
          <p className="pos-extra-charge__lead muted small">
            Para algo que no está en la carta. El nombre, el valor y el detalle quedan en el ticket.
          </p>

          <label className="pos-extra-charge__field">
            <span className="pos-extra-charge__label">Qué se vendió</span>
            <input
              ref={nameRef}
              className="pos-input"
              value={name}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Sándwich especial"
              required
            />
          </label>

          <label className="pos-extra-charge__field">
            <span className="pos-extra-charge__label">Valor (COP)</span>
            <input
              type="number"
              className="pos-input pos-extra-charge__amount"
              min={0}
              step={500}
              inputMode="numeric"
              value={amount}
              disabled={busy}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ej. 20000"
              required
            />
            {amountCOP > 0 ? (
              <span className="pos-extra-charge__amount-preview mono muted small">
                {formatCOP(amountCOP)}
              </span>
            ) : null}
          </label>

          <label className="pos-extra-charge__field">
            <span className="pos-extra-charge__label">Detalle</span>
            <textarea
              className="pos-input pos-extra-charge__reason"
              rows={3}
              value={detail}
              disabled={busy}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Descripción, tamaño, nota…"
            />
          </label>

          {displayError ? (
            <p className="pos-extra-charge__error" role="alert">
              {displayError}
            </p>
          ) : null}

          <button type="submit" className="pos-btn pos-btn--primary pos-btn--block" disabled={!canSave}>
            {busy ? 'Agregando…' : 'Agregar al pedido'}
          </button>
        </form>
      </div>
    </div>
  )
}
