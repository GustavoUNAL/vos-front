import { useEffect, useState } from 'react'
import { formatCOP, parseMoney } from '../../lib/money'

type Props = {
  discountCOP: number
  discountReason: string
  maxDiscountCOP: number
  disabled?: boolean
  onDiscountCOP: (value: number) => void
  onDiscountReason: (value: string) => void
}

export function PosOrderDiscount({
  discountCOP,
  discountReason,
  maxDiscountCOP,
  disabled = false,
  onDiscountCOP,
  onDiscountReason,
}: Props) {
  const hasDiscount = discountCOP > 0 || discountReason.trim().length > 0
  const [open, setOpen] = useState(hasDiscount)
  const needsReason = discountCOP > 0 && !discountReason.trim()
  const canAdd = maxDiscountCOP > 0
  const showFields = open || hasDiscount

  useEffect(() => {
    if (hasDiscount) setOpen(true)
  }, [hasDiscount])

  const handleToggle = (e: React.MouseEvent | React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return

    if (showFields) {
      setOpen(false)
      onDiscountCOP(0)
      onDiscountReason('')
      return
    }

    if (!canAdd) return

    setOpen(true)
    if (discountCOP <= 0) {
      onDiscountCOP(Math.min(1_000, maxDiscountCOP))
    }
  }

  return (
    <div
      className={`pos-order-discount${showFields ? ' pos-order-discount--active' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="pos-order-discount__head">
        <span className="pos-order-discount__label">Descuento</span>
        <button
          type="button"
          className={`pos-order-discount__toggle${showFields ? ' pos-order-discount__toggle--active' : ''}`}
          disabled={disabled || (!showFields && !canAdd)}
          aria-expanded={showFields}
          onClick={handleToggle}
        >
          {showFields ? 'Quitar' : 'Agregar'}
        </button>
      </div>

      {!canAdd && !showFields ? (
        <p className="pos-order-discount__hint muted small">
          Agregá productos para aplicar un descuento.
        </p>
      ) : null}

      {showFields ? (
        <div className="pos-order-discount__fields">
          <label className="pos-order-discount__field">
            <span className="pos-order-discount__field-label">Monto</span>
            <input
              type="number"
              className="pos-input pos-input--compact pos-order-discount__amount"
              min={0}
              max={maxDiscountCOP}
              step={500}
              inputMode="numeric"
              value={discountCOP || ''}
              disabled={disabled || !canAdd}
              onChange={(e) => {
                const raw = parseMoney(e.target.value)
                onDiscountCOP(Math.min(Math.max(0, raw), maxDiscountCOP))
              }}
              placeholder="0"
              aria-label="Monto del descuento en pesos"
            />
          </label>

          <label className="pos-order-discount__field pos-order-discount__field--reason">
            <span className="pos-order-discount__field-label">
              Motivo{discountCOP > 0 ? ' *' : ''}
            </span>
            <textarea
              className="pos-input pos-input--textarea pos-order-discount__reason"
              value={discountReason}
              disabled={disabled}
              onChange={(e) => onDiscountReason(e.target.value)}
              placeholder="Ej. cliente frecuente, error en pedido, promoción…"
              rows={2}
              aria-invalid={needsReason}
            />
          </label>

          {needsReason ? (
            <p className="pos-order-discount__error" role="alert">
              Justificá el descuento para continuar.
            </p>
          ) : null}

          {discountCOP > 0 ? (
            <p className="pos-order-discount__hint muted small">
              Se descontarán {formatCOP(discountCOP)} del total.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
