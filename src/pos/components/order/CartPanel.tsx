import { useState } from 'react'
import { formatCOP } from '../../lib/money'
import type { OrderLine } from '../../types'
import { PosMoney } from '../ui/PosMoney'

type Props = {
  lines: OrderLine[]
  subtotalCOP: number
  taxCOP: number
  totalCOP: number
  tableName: string
  onQty: (lineId: string, qty: number) => void
  onNotes: (lineId: string, notes: string) => void
  onRemove: (lineId: string) => void
  onPay: () => void
  onBack: () => void
  backLabel?: string
}

export function CartPanel({
  lines,
  subtotalCOP,
  taxCOP,
  totalCOP,
  tableName,
  onQty,
  onNotes,
  onRemove,
  onPay,
  onBack,
  backLabel,
}: Props) {
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState('')

  return (
    <aside className="pos-cart" aria-label="Carrito">
      <header className="pos-cart__head">
        <button
          type="button"
          className={`pos-btn pos-btn--ghost${backLabel ? '' : ' pos-btn--icon'}`}
          onClick={onBack}
        >
          {backLabel ?? '←'}
        </button>
        <div>
          <h2 className="pos-cart__title">{tableName}</h2>
          <p className="muted small">{lines.length} ítems</p>
        </div>
      </header>

      <ul className="pos-cart__lines">
        {lines.length === 0 ? (
          <li className="pos-cart__empty muted">Tocá un producto para agregar</li>
        ) : (
          lines.map((line) => (
            <li key={line.id} className="pos-cart-line">
              <div className="pos-cart-line__main">
                <span className="pos-cart-line__name">{line.productName}</span>
                <span className="pos-cart-line__price">
                  {formatCOP(line.quantity * line.unitPrice)}
                </span>
              </div>
              <div className="pos-cart-line__qty">
                <button
                  type="button"
                  className="pos-qty-btn"
                  aria-label="Menos"
                  onClick={() => onQty(line.id, line.quantity - 1)}
                >
                  −
                </button>
                <span className="pos-qty-value">{line.quantity}</span>
                <button
                  type="button"
                  className="pos-qty-btn"
                  aria-label="Más"
                  onClick={() => onQty(line.id, line.quantity + 1)}
                >
                  +
                </button>
                <button
                  type="button"
                  className="pos-btn pos-btn--ghost pos-btn--compact"
                  onClick={() => {
                    setEditingNotes(line.id)
                    setNotesDraft(line.notes ?? '')
                  }}
                >
                  Nota
                </button>
                <button
                  type="button"
                  className="pos-btn pos-btn--ghost pos-btn--compact pos-btn--danger-text"
                  onClick={() => onRemove(line.id)}
                >
                  ×
                </button>
              </div>
              {line.notes && editingNotes !== line.id && (
                <p className="pos-cart-line__note muted small">{line.notes}</p>
              )}
              {editingNotes === line.id && (
                <div className="pos-cart-line__note-edit">
                  <input
                    className="pos-input"
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder="Notas para cocina…"
                  />
                  <button
                    type="button"
                    className="pos-btn pos-btn--primary pos-btn--compact"
                    onClick={() => {
                      onNotes(line.id, notesDraft)
                      setEditingNotes(null)
                    }}
                  >
                    OK
                  </button>
                </div>
              )}
            </li>
          ))
        )}
      </ul>

      <footer className="pos-cart__footer">
        <dl className="pos-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatCOP(subtotalCOP)}</dd>
          </div>
          <div>
            <dt>Impuestos</dt>
            <dd>{formatCOP(taxCOP)}</dd>
          </div>
          <div className="pos-totals__grand">
            <dt>Total</dt>
            <dd>
              <PosMoney value={totalCOP} className="pos-totals__total" />
            </dd>
          </div>
        </dl>
        <button
          type="button"
          className="pos-btn pos-btn--accent pos-btn--block pos-btn--xl"
          disabled={lines.length === 0}
          onClick={onPay}
        >
          Cobrar
        </button>
      </footer>
    </aside>
  )
}
