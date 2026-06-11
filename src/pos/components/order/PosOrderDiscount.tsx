import { ChevronDown, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatCOP, parseMoney } from '../../lib/money'

type Props = {
  discountCOP: number
  discountReason: string
  maxDiscountCOP: number
  disabled?: boolean
  /** `payment`: panel colapsable en el flujo de cobro. `collapsible`: legacy con Agregar/Quitar. */
  variant?: 'collapsible' | 'payment'
  /** Si false, colapsa el panel (p. ej. al cerrar el modal de cobro). */
  active?: boolean
  onDiscountCOP: (value: number) => void
  onDiscountReason: (value: string) => void
}

export function PosOrderDiscount({
  discountCOP,
  discountReason,
  maxDiscountCOP,
  disabled = false,
  variant = 'payment',
  active = true,
  onDiscountCOP,
  onDiscountReason,
}: Props) {
  const hasDiscount = discountCOP > 0 || discountReason.trim().length > 0
  const [expanded, setExpanded] = useState(hasDiscount)
  const needsReason = discountCOP > 0 && !discountReason.trim()
  const canAdd = maxDiscountCOP > 0

  useEffect(() => {
    if (active === false) {
      setExpanded(false)
      return
    }
    if (hasDiscount) setExpanded(true)
  }, [active, hasDiscount])

  const handleRemove = () => {
    onDiscountCOP(0)
    onDiscountReason('')
    setExpanded(false)
  }

  const handleClose = () => {
    if (discountCOP > 0 && needsReason) return
    setExpanded(false)
  }

  const handleOpen = () => {
    if (disabled || !canAdd) return
    setExpanded(true)
  }

  if (variant === 'payment') {
    if (!expanded) {
      return (
        <div className="pos-order-discount pos-order-discount--payment">
          <button
            type="button"
            className="pos-order-discount__payment-trigger"
            disabled={disabled || !canAdd}
            aria-expanded={false}
            onClick={handleOpen}
          >
            <span className="pos-order-discount__payment-trigger-label">Descuento</span>
            <span
              className={`pos-order-discount__payment-trigger-value mono${discountCOP > 0 ? ' pos-order-discount__payment-trigger-value--set' : ''}`}
            >
              {discountCOP > 0 ? formatCOP(-discountCOP) : formatCOP(0)}
            </span>
            <span className="pos-order-discount__payment-trigger-action muted small">
              {discountCOP > 0 ? 'Editar' : 'Agregar'}
            </span>
            <ChevronDown aria-hidden size={16} className="pos-order-discount__payment-chevron" />
          </button>
          {!canAdd ? (
            <p className="pos-order-discount__hint muted small">
              Agregá productos para aplicar un descuento.
            </p>
          ) : null}
        </div>
      )
    }

    return (
      <div
        className="pos-order-discount pos-order-discount--payment pos-order-discount--active"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pos-order-discount__payment-head">
          <span className="pos-order-discount__label">Descuento</span>
          <div className="pos-order-discount__payment-actions">
            {discountCOP > 0 ? (
              <button
                type="button"
                className="pos-order-discount__payment-clear"
                disabled={disabled}
                onClick={handleRemove}
              >
                Quitar
              </button>
            ) : null}
            <button
              type="button"
              className="pos-order-discount__payment-close"
              disabled={disabled || needsReason}
              aria-label="Cerrar descuento"
              title={needsReason ? 'Completá el motivo o quitá el monto' : 'Cerrar'}
              onClick={handleClose}
            >
              <X aria-hidden size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="pos-order-discount__fields">
          <label className="pos-order-discount__field">
            <span className="pos-order-discount__field-label">Monto (COP)</span>
            <input
              type="number"
              className="pos-input pos-input--compact pos-order-discount__amount"
              min={0}
              max={maxDiscountCOP}
              step={500}
              inputMode="numeric"
              value={discountCOP}
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
          ) : (
            <p className="pos-order-discount__hint muted small">
              Dejá el monto en 0 si no aplicás descuento.
            </p>
          )}
        </div>
      </div>
    )
  }

  // collapsible (legacy)
  const showFields = expanded || hasDiscount

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
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (disabled) return
            if (showFields) {
              handleRemove()
            } else if (canAdd) {
              setExpanded(true)
            }
          }}
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
              value={discountCOP}
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
