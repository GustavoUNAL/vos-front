import { useState } from 'react'
import { formatPosOrderCode } from '../../lib/orderCode'
import type { CategoryRef, ProductRow } from '../../../api'
import type { PosOrder } from '../../types'
import { PosMoney } from '../ui/PosMoney'
import { PosOrderProductsSection } from './PosOrderProductsSection'

function formatOrderTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

type ProductPick = { id: string; name: string; price: number }

type Props = {
  order: PosOrder
  tableName: string
  totalCOP: number
  mesa: string
  catalogProducts: ProductRow[]
  catalogCategories: CategoryRef[]
  catalogLoading?: boolean
  topProductIds?: string[]
  unitsSoldByProductId?: Map<string, number>
  highlightId?: string | null
  onMesa: (value: string) => void
  onOpenPayment: () => void
  onAddProduct: (product: ProductPick) => void
  onQty: (lineId: string, qty: number) => void
  onLineNotes: (lineId: string, notes: string) => void
  onRemove: (lineId: string) => void
  paymentBusy?: boolean
}

export function PosOrderComanda({
  order,
  tableName,
  totalCOP,
  mesa,
  catalogProducts,
  catalogCategories,
  catalogLoading,
  topProductIds,
  unitsSoldByProductId,
  highlightId,
  onMesa,
  onOpenPayment,
  onAddProduct,
  onQty,
  onLineNotes,
  onRemove,
  paymentBusy = false,
}: Props) {
  const refCode = formatPosOrderCode(order)
  const isEmpty = order.lines.length === 0
  const [pickerActive, setPickerActive] = useState(false)

  return (
    <article
      className={`pos-order-comanda${isEmpty ? ' pos-order-comanda--building' : ''}${pickerActive ? ' pos-order-comanda--picking' : ''}`}
      aria-label="Comanda del pedido"
    >
      <header className="pos-order-comanda__top">
        <h2 className="pos-order-comanda__table-name">{tableName}</h2>
        <label className="pos-order-comanda__client-field">
          <span className="pos-order-comanda__client-label">Cliente</span>
          <input
            className="pos-order-comanda__name-inline"
            value={mesa}
            onChange={(e) => onMesa(e.target.value)}
            placeholder="Nombre del cliente"
            aria-label="Nombre del cliente"
          />
        </label>
        <div className="pos-order-comanda__meta-row">
          <span className="pos-order-comanda__ref mono" title="Referencia del pedido">
            {refCode}
          </span>
          <time className="pos-order-comanda__time" dateTime={order.openedAt}>
            {formatOrderTime(order.openedAt)}
          </time>
        </div>
      </header>

      <div
        className={`pos-order-comanda__body${pickerActive ? ' pos-order-comanda__body--picking' : ''}`}
      >
        <PosOrderProductsSection
          lines={order.lines}
          totalCOP={totalCOP}
          products={catalogProducts}
          categories={catalogCategories}
          topProductIds={topProductIds}
          unitsSoldByProductId={unitsSoldByProductId}
          highlightId={highlightId}
          catalogLoading={catalogLoading}
          onPickerActiveChange={setPickerActive}
          onAdd={onAddProduct}
          onQty={onQty}
          onNotes={onLineNotes}
          onRemove={onRemove}
        />
      </div>

      <footer className="pos-order-comanda__footer">
        {!isEmpty && !pickerActive ? (
          <>
            <div className="pos-order-comanda__total-row">
              <span>Total</span>
              <PosMoney value={totalCOP} className="pos-totals__total" />
            </div>
            <button
              type="button"
              className="pos-btn pos-btn--primary pos-btn--block pos-btn--xl"
              disabled={paymentBusy}
              onClick={onOpenPayment}
            >
              Cobrar
            </button>
          </>
        ) : null}
      </footer>
    </article>
  )
}
