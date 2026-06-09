import { useEffect, useMemo, useRef, useState } from 'react'
import type { CategoryRef, ProductRow } from '../../../api'
import { formatCOP } from '../../lib/money'
import type { OrderLine } from '../../types'
import { PosMiniCartPicker } from './PosMiniCartPicker'
import { PosOrderLineNoteModal } from './PosOrderLineNoteModal'

type ProductPick = { id: string; name: string; price: number }

type Props = {
  lines: OrderLine[]
  totalCOP: number
  products: ProductRow[]
  categories: CategoryRef[]
  topProductIds?: string[]
  unitsSoldByProductId?: Map<string, number>
  highlightId?: string | null
  catalogLoading?: boolean
  onPickerActiveChange?: (active: boolean) => void
  onAdd: (product: ProductPick) => void
  onQty: (lineId: string, qty: number) => void
  onNotes: (lineId: string, notes: string) => void
  onRemove: (lineId: string) => void
}

export function PosOrderProductsSection({
  lines,
  totalCOP,
  products,
  categories,
  topProductIds = [],
  unitsSoldByProductId = new Map(),
  highlightId,
  catalogLoading,
  onPickerActiveChange,
  onAdd,
  onQty,
  onNotes,
  onRemove,
}: Props) {
  const isEmpty = lines.length === 0
  const [pickerOpen, setPickerOpen] = useState(false)
  const [notesLineId, setNotesLineId] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const notesLine = useMemo(
    () => lines.find((l) => l.id === notesLineId) ?? null,
    [lines, notesLineId],
  )

  const openNotesModal = (line: OrderLine) => {
    setNotesLineId(line.id)
    setNotesDraft(line.notes ?? '')
  }

  const closeNotesModal = () => setNotesLineId(null)

  const saveNotes = () => {
    if (!notesLineId) return
    onNotes(notesLineId, notesDraft)
    closeNotesModal()
  }

  useEffect(() => {
    onPickerActiveChange?.(pickerOpen)
  }, [pickerOpen, onPickerActiveChange])

  const lineCount = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity, 0),
    [lines],
  )

  const openPicker = () => {
    setPickerOpen(true)
    window.requestAnimationFrame(() => searchRef.current?.focus())
  }

  const closePicker = () => setPickerOpen(false)

  return (
    <div
      className={`pos-order-products${isEmpty ? ' pos-order-products--empty' : ''}${pickerOpen ? ' pos-order-products--picking' : ''}`}
    >
      {!pickerOpen ? (
        <div className="pos-order-products__head">
          <h2 className="pos-order-lines__title">Productos del pedido</h2>
          {!isEmpty ? (
            <span className="pos-order-products__count muted small">
              {lineCount} {lineCount === 1 ? 'unidad' : 'unidades'}
            </span>
          ) : null}
        </div>
      ) : null}

      {pickerOpen ? (
        <div className="pos-order-cart pos-order-cart--mini" aria-label="Seleccionar productos">
          <PosMiniCartPicker
            products={products}
            categories={categories}
            lines={lines}
            totalCOP={totalCOP}
            topProductIds={topProductIds}
            unitsSoldByProductId={unitsSoldByProductId}
            highlightId={highlightId}
            searchInputRef={searchRef}
            onAdd={onAdd}
            onQty={onQty}
            onClose={closePicker}
          />
        </div>
      ) : isEmpty ? (
        <div className="pos-order-products__empty-state">
          <button
            type="button"
            className="pos-btn pos-btn--primary pos-btn--block pos-order-products__add-btn"
            disabled={catalogLoading}
            onClick={openPicker}
          >
            {catalogLoading ? 'Cargando carta…' : '+ Agregar productos'}
          </button>
        </div>
      ) : (
        <>
          <div className="pos-order-lines__table-wrap">
            <table className="cash-close-lines-table pos-order-lines__table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Cant.</th>
                  <th className="num">Precio</th>
                  <th className="num">Total</th>
                  <th aria-hidden />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      <span className="pos-order-lines__name">{line.productName}</span>
                      {line.notes ? (
                        <button
                          type="button"
                          className="pos-order-lines__note pos-order-lines__note-btn muted small"
                          onClick={() => openNotesModal(line)}
                        >
                          {line.notes}
                        </button>
                      ) : null}
                    </td>
                    <td className="num">
                      <div className="pos-order-lines__qty">
                        <button
                          type="button"
                          className="pos-order-lines__qty-btn"
                          aria-label="Menos"
                          onClick={() => onQty(line.id, line.quantity - 1)}
                        >
                          −
                        </button>
                        <span className="pos-order-lines__qty-value mono">{line.quantity}</span>
                        <button
                          type="button"
                          className="pos-order-lines__qty-btn"
                          aria-label="Más"
                          onClick={() => onQty(line.id, line.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="num mono">{formatCOP(line.unitPrice)}</td>
                    <td className="num mono">
                      {formatCOP(line.quantity * line.unitPrice)}
                    </td>
                    <td className="pos-order-lines__actions">
                      <button
                        type="button"
                        className="pos-order-lines__action-btn"
                        onClick={() => openNotesModal(line)}
                      >
                        Nota
                      </button>
                      <button
                        type="button"
                        className="pos-order-lines__action-btn pos-order-lines__action-btn--remove"
                        aria-label="Quitar"
                        onClick={() => onRemove(line.id)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            className="pos-order-products__more-toggle"
            onClick={openPicker}
          >
            + Agregar más productos
          </button>

          <PosOrderLineNoteModal
            open={notesLineId !== null}
            productName={notesLine?.productName ?? ''}
            notes={notesDraft}
            onNotesChange={setNotesDraft}
            onClose={closeNotesModal}
            onSave={saveNotes}
          />
        </>
      )}
    </div>
  )
}
