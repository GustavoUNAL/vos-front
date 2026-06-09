import { useState } from 'react'
import { formatPosOrderCode } from '../../lib/orderCode'
import type { CategoryRef, ProductRow } from '../../../api'
import type { PaymentMethod, PosOrder, PosStaffMember } from '../../types'
import { PosTransferReceiptSheet } from '../payment/PosTransferReceiptSheet'
import { PosMoney } from '../ui/PosMoney'
import { PosStaffPicker } from '../ui/PosStaffPicker'
import { PosOrderPaymentPicker } from './PosOrderPaymentPicker'
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
  paymentMethod: PaymentMethod | null
  transferReceiptDataUrl: string | null
  transferReference: string
  attendedBy: PosStaffMember | null
  catalogProducts: ProductRow[]
  catalogCategories: CategoryRef[]
  catalogLoading?: boolean
  topProductIds?: string[]
  unitsSoldByProductId?: Map<string, number>
  highlightId?: string | null
  onMesa: (value: string) => void
  onPaymentMethod: (method: PaymentMethod) => void
  onTransferReceipt: (dataUrl: string | null) => void
  onTransferReference: (value: string) => void
  cashTenderedCOP: number
  onCashTendered: (value: number) => void
  onAttendedBy: (staff: PosStaffMember) => void
  onAddProduct: (product: ProductPick) => void
  onQty: (lineId: string, qty: number) => void
  onLineNotes: (lineId: string, notes: string) => void
  onRemove: (lineId: string) => void
  onConfirm: () => void
  confirmBusy?: boolean
  confirmError?: string | null
  transferSheetOpen?: boolean
  onTransferSheetOpenChange?: (open: boolean) => void
}

export function PosOrderComanda({
  order,
  tableName,
  totalCOP,
  mesa,
  paymentMethod,
  transferReceiptDataUrl,
  transferReference,
  attendedBy,
  catalogProducts,
  catalogCategories,
  catalogLoading,
  topProductIds,
  unitsSoldByProductId,
  highlightId,
  onMesa,
  onPaymentMethod,
  onTransferReceipt,
  onTransferReference,
  cashTenderedCOP,
  onCashTendered,
  onAttendedBy,
  onAddProduct,
  onQty,
  onLineNotes,
  onRemove,
  onConfirm,
  confirmBusy = false,
  confirmError = null,
  transferSheetOpen: transferSheetOpenProp,
  onTransferSheetOpenChange,
}: Props) {
  const refCode = formatPosOrderCode(order)
  const isTransfer = paymentMethod === 'transfer'
  const canConfirm = order.lines.length > 0 && attendedBy != null
  const isEmpty = order.lines.length === 0
  const [pickerActive, setPickerActive] = useState(false)
  const [transferSheetLocal, setTransferSheetLocal] = useState(false)
  const transferSheetOpen = transferSheetOpenProp ?? transferSheetLocal
  const setTransferSheetOpen = onTransferSheetOpenChange ?? setTransferSheetLocal

  return (
    <article
      className={`pos-order-comanda${isEmpty ? ' pos-order-comanda--building' : ''}${pickerActive ? ' pos-order-comanda--picking' : ''}${transferSheetOpen ? ' pos-order-comanda--transfer-sheet' : ''}${isTransfer && !isEmpty && !pickerActive ? ' pos-order-comanda--transfer' : ''}`}
      aria-label="Comanda del pedido"
    >
      <header className="pos-order-comanda__top">
        <h2 className="pos-order-comanda__table-name">{tableName}</h2>
        <div className="pos-order-comanda__meta-row">
          <input
            className="pos-order-comanda__name-inline"
            value={mesa}
            onChange={(e) => onMesa(e.target.value)}
            placeholder="Cliente o etiqueta (opcional)"
            aria-label="Cliente o etiqueta"
          />
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

        {!isEmpty && !pickerActive && !transferSheetOpen ? (
          <PosStaffPicker
            value={attendedBy}
            onChange={onAttendedBy}
            compact
          />
        ) : null}

        {!isEmpty && !pickerActive && !transferSheetOpen ? (
          <PosOrderPaymentPicker
            paymentMethod={paymentMethod}
            transferReceiptDataUrl={transferReceiptDataUrl}
            amountDueCOP={totalCOP}
            cashTenderedCOP={cashTenderedCOP}
            onPaymentMethod={onPaymentMethod}
            onOpenTransferSheet={() => setTransferSheetOpen(true)}
            onCashTenderedChange={onCashTendered}
          />
        ) : null}
      </div>

      <footer className="pos-order-comanda__footer">
        {!isEmpty && !pickerActive && !transferSheetOpen ? (
          <div className="pos-order-comanda__total-row">
            <span>Total</span>
            <PosMoney value={totalCOP} className="pos-totals__total" />
          </div>
        ) : null}
        {confirmError && !transferSheetOpen ? (
          <p className="pos-order-comanda__pay-hint pos-order-comanda__pay-hint--error" role="alert">
            {confirmError}
          </p>
        ) : null}
        {!isEmpty && !pickerActive && !transferSheetOpen ? (
          <button
            type="button"
            className="pos-btn pos-btn--primary pos-btn--block pos-btn--xl"
            disabled={!canConfirm || confirmBusy}
            onClick={onConfirm}
          >
            {confirmBusy ? 'Procesando…' : 'Confirmar venta'}
          </button>
        ) : null}
      </footer>

      <PosTransferReceiptSheet
        open={transferSheetOpen && isTransfer}
        amountCOP={totalCOP}
        orderCode={refCode}
        receiptDataUrl={transferReceiptDataUrl}
        transferReference={transferReference}
        onReceiptChange={onTransferReceipt}
        onTransferReferenceChange={onTransferReference}
        onClose={() => setTransferSheetOpen(false)}
      />
    </article>
  )
}
