import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Receipt } from 'lucide-react'
import type { CategoryRef, ProductRow } from '../../../api'
import { formatCOP, parseMoney } from '../../lib/money'
import { isPosExtraChargeLine, isPosExtraChargeProduct } from '../../lib/extraCharge'
import { isPosOpenProduct } from '../../lib/openProduct'
import {
  filterProductsForPos,
  pinPosFeaturedCombos,
  sortProductsForPos,
} from '../../lib/productSearch'
import type { OrderLine } from '../../types'
import { PosMiniCartPicker } from './PosMiniCartPicker'
import { PosOrderExtraChargeModal } from './PosOrderExtraChargeModal'
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
  extraChargeBusy?: boolean
  extraChargeError?: string | null
  onPickerActiveChange?: (active: boolean) => void
  onAdd: (product: ProductPick) => void
  onAddExtraCharge: (payload: {
    amountCOP: number
    reason: string
  }) => boolean | Promise<boolean>
  onQty: (lineId: string, qty: number) => void
  onPrice: (lineId: string, unitPrice: number) => void
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
  extraChargeBusy = false,
  extraChargeError = null,
  onPickerActiveChange,
  onAdd,
  onAddExtraCharge,
  onQty,
  onPrice,
  onNotes,
  onRemove,
}: Props) {
  const isEmpty = lines.length === 0
  const [pickerOpen, setPickerOpen] = useState(false)
  const [extraOpen, setExtraOpen] = useState(false)
  const [notesLineId, setNotesLineId] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const catalogProducts = useMemo(
    () => products.filter((p) => !isPosExtraChargeProduct(p)),
    [products],
  )
  const openProductIds = useMemo(
    () => new Set(products.filter((p) => isPosOpenProduct(p)).map((p) => p.id)),
    [products],
  )

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

  useEffect(() => {
    if (!pickerOpen) return
    const isPhone = window.matchMedia('(max-width: 720px)').matches
    if (isPhone) return
    const t = window.setTimeout(() => searchRef.current?.focus(), 30)
    return () => window.clearTimeout(t)
  }, [pickerOpen])

  const lineCount = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity, 0),
    [lines],
  )

  const topSellers = useMemo(() => {
    const active = filterProductsForPos(catalogProducts, {
      activeCategoryId: null,
      search: '',
    })
    const activeById = new Map(active.map((product) => [product.id, product]))
    const ranked = topProductIds
      .map((id) => activeById.get(id))
      .filter((product): product is ProductRow => Boolean(product))
    const rest =
      ranked.length > 0
        ? ranked
        : sortProductsForPos(active, {
            search: '',
            salesUnitsByProductId: unitsSoldByProductId,
          })
    return pinPosFeaturedCombos(rest, active).slice(0, 12)
  }, [catalogProducts, topProductIds, unitsSoldByProductId])

  const openPicker = () => setPickerOpen(true)
  const closePicker = () => setPickerOpen(false)

  const handleConfirmExtra = async (payload: {
    amountCOP: number
    reason: string
  }) => {
    const ok = await onAddExtraCharge(payload)
    if (ok) setExtraOpen(false)
  }

  const pickerHost =
    typeof document !== 'undefined'
      ? document.querySelector('.pos-root') ?? document.body
      : null

  const extraChargeActions = (
    <button
      type="button"
      className="pos-order-products__extra-btn"
      disabled={catalogLoading || extraChargeBusy}
      onClick={() => setExtraOpen(true)}
    >
      <Receipt size={16} strokeWidth={2.25} aria-hidden />
      Costo adicional
    </button>
  )

  return (
    <div
      className={`pos-order-products${isEmpty ? ' pos-order-products--empty' : ''}`}
    >
      {!pickerOpen ? (
        <div className="pos-order-products__head">
          <h2 className="pos-order-lines__title">
            {isEmpty ? 'Más vendidos' : 'Productos del pedido'}
          </h2>
          {!isEmpty ? (
            <span className="pos-order-products__count muted small">
              {lineCount} {lineCount === 1 ? 'unidad' : 'unidades'}
            </span>
          ) : topSellers.length > 0 ? (
            <span className="pos-order-products__count muted small">Toque para agregar</span>
          ) : null}
        </div>
      ) : null}

      {pickerOpen && pickerHost
        ? createPortal(
            <div
              className="pos-product-picker-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Agregar productos"
            >
              <PosMiniCartPicker
                products={catalogProducts}
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
            </div>,
            pickerHost,
          )
        : null}

      {extraOpen
        ? createPortal(
            <PosOrderExtraChargeModal
              open={extraOpen}
              busy={extraChargeBusy}
              error={extraChargeError}
              onClose={() => {
                if (!extraChargeBusy) setExtraOpen(false)
              }}
              onConfirm={handleConfirmExtra}
            />,
            pickerHost ?? document.body,
          )
        : null}

      {isEmpty ? (
        <>
          {topSellers.length > 0 ? (
            <ul className="pos-order-quick" aria-label="Productos más vendidos">
              {topSellers.map((product, index) => (
                <li key={product.id}>
                  <button
                    type="button"
                    className={`pos-order-quick__item${highlightId === product.id ? ' pos-order-quick__item--flash' : ''}`}
                    onClick={() =>
                      onAdd({
                        id: product.id,
                        name: product.name,
                        price: parseMoney(product.price),
                      })
                    }
                  >
                    {index < 3 ? (
                      <span className="pos-order-quick__rank" aria-hidden>
                        {index + 1}
                      </span>
                    ) : null}
                    <span className="pos-order-quick__text">
                      <span className="pos-order-quick__name">{product.name}</span>
                      <span className="pos-order-quick__price mono">
                        {formatCOP(parseMoney(product.price))}
                      </span>
                    </span>
                    <span className="pos-order-quick__add" aria-hidden>
                      <Plus strokeWidth={2.5} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : catalogLoading ? (
            <p className="pos-order-quick__hint muted small">Cargando carta…</p>
          ) : (
            <p className="pos-order-quick__hint muted small">
              Aún no hay ventas para armar este listado. Use el botón para ver toda la carta.
            </p>
          )}
          <div className="pos-order-products__empty-state">
            <button
              type="button"
              className="pos-btn pos-btn--primary pos-btn--block pos-order-products__add-btn"
              disabled={catalogLoading}
              onClick={openPicker}
            >
              {catalogLoading ? 'Cargando carta…' : '+ Ver toda la carta'}
            </button>
            {extraChargeActions}
          </div>
        </>
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
                {lines.map((line) => {
                  const isExtra = isPosExtraChargeLine(line)
                  return (
                    <tr
                      key={line.id}
                      className={isExtra ? 'pos-order-lines__row--extra' : undefined}
                    >
                      <td>
                        <span className="pos-order-lines__name">
                          {isExtra ? (
                            <span className="pos-order-lines__extra-badge">Cargo</span>
                          ) : null}
                          {line.productName}
                        </span>
                        {line.notes && !isExtra ? (
                          <button
                            type="button"
                            className="pos-order-lines__note pos-order-lines__note-btn muted small"
                            onClick={() => openNotesModal(line)}
                          >
                            {line.notes}
                          </button>
                        ) : null}
                        {isExtra && line.notes ? (
                          <span className="pos-order-lines__note muted small">
                            {line.notes}
                          </span>
                        ) : null}
                      </td>
                      <td className="num">
                        {isExtra ? (
                          <span className="pos-order-lines__qty-value mono">1</span>
                        ) : (
                          <div className="pos-order-lines__qty">
                            <button
                              type="button"
                              className="pos-order-lines__qty-btn"
                              aria-label="Menos"
                              onClick={() => onQty(line.id, line.quantity - 1)}
                            >
                              −
                            </button>
                            <span className="pos-order-lines__qty-value mono">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              className="pos-order-lines__qty-btn"
                              aria-label="Más"
                              onClick={() => onQty(line.id, line.quantity + 1)}
                            >
                              +
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="num mono">
                        {openProductIds.has(line.productId) ? (
                          <input
                            className="pos-input pos-order-lines__price-input mono"
                            inputMode="numeric"
                            aria-label={`Valor de ${line.productName}`}
                            defaultValue={String(line.unitPrice)}
                            key={`${line.id}-${line.unitPrice}`}
                            onBlur={(e) => {
                              const next = parseMoney(e.target.value)
                              if (next !== line.unitPrice) onPrice(line.id, next)
                            }}
                          />
                        ) : (
                          formatCOP(line.unitPrice)
                        )}
                      </td>
                      <td className="num mono">
                        {formatCOP(line.quantity * line.unitPrice)}
                      </td>
                      <td className="pos-order-lines__actions">
                        {!isExtra ? (
                          <button
                            type="button"
                            className="pos-order-lines__action-btn"
                            onClick={() => openNotesModal(line)}
                          >
                            Nota
                          </button>
                        ) : null}
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
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="pos-order-products__more-row">
            <button
              type="button"
              className="pos-order-products__more-toggle"
              onClick={openPicker}
            >
              + Agregar más productos
            </button>
            {extraChargeActions}
          </div>

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
