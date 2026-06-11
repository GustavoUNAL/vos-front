import { useCallback, useEffect, useState } from 'react'
import { MOBILE_FILTER_BREAKPOINT } from '../../../components/MobileAwareFilterBar'
import { useMatchMedia } from '../../../hooks/useMatchMedia'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { usePosCatalog } from '../../hooks/usePosCatalog'
import { usePosCheckout } from '../../hooks/usePosCheckout'
import { usePosSalesRanking } from '../../hooks/usePosSalesRanking'
import { usePosOrder } from '../../hooks/usePosOrder'
import { DEFAULT_POS_STAFF } from '../../constants'
import { formatPosOrderCode } from '../../lib/orderCode'
import { usePosStore } from '../../store/posStore'
import type { PaymentMethod } from '../../types'
import { PosErrorBanner } from '../ui/PosErrorBanner'
import { PosLoader } from '../ui/PosLoader'
import { PosOrderComanda } from './PosOrderComanda'
import { PosOrderPaymentModal } from './PosOrderPaymentModal'

type Props = { baseUrl: string }

export function PosOrderView({ baseUrl }: Props) {
  const { state, navigate } = usePosStore()
  const table = state.tables.find((t) => t.id === state.selectedTableId)
  const isDockMobile = useMatchMedia(MOBILE_FILTER_BREAKPOINT)

  const {
    order,
    totals,
    meta,
    error: orderError,
    loading: orderSaving,
    addProduct,
    setQuantity,
    setLineNotes,
    removeLine,
    updateMeta,
  } = usePosOrder(baseUrl)

  const { busy: confirmBusy, confirmSale } = usePosCheckout(baseUrl)

  const {
    products,
    categories,
    loading: catalogLoading,
    refreshing: catalogRefreshing,
    error: catalogError,
    usingDemoCatalog,
  } = usePosCatalog(baseUrl)

  const { unitsSoldByProductId, topProductIds, hasRanking } =
    usePosSalesRanking(baseUrl)

  const catalogHint = usingDemoCatalog
    ? 'Carta de demostración (sin API). Cuando levantes vos-api verás tus productos reales.'
    : null

  const [addedFlash, setAddedFlash] = useState<string | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  useEffect(() => {
    setPaymentOpen(false)
    setConfirmError(null)
  }, [order?.id])

  const handleAdd = useCallback(
    async (p: { id: string; name: string; price: number }) => {
      await addProduct(p)
      setAddedFlash(p.id)
      window.setTimeout(() => setAddedFlash(null), 400)
    },
    [addProduct],
  )

  const handleOpenPayment = useCallback(() => {
    if (!order || order.lines.length === 0) return
    const discount = meta?.discountCOP ?? 0
    const reason = meta?.discountReason?.trim() ?? ''
    if (discount > 0 && !reason) {
      setConfirmError('Justificá el descuento antes de cobrar.')
      return
    }
    setConfirmError(null)
    setPaymentOpen(true)
    updateMeta({
      attendedBy: order.attendedBy ?? meta?.attendedBy ?? DEFAULT_POS_STAFF,
      paymentMethod: null,
      transferReceiptDataUrl: null,
      transferReference: null,
      cashTenderedCOP: null,
    })
  }, [meta?.attendedBy, meta?.discountCOP, meta?.discountReason, order, updateMeta])

  const handleClosePayment = useCallback(() => {
    if (confirmBusy) return
    setPaymentOpen(false)
    setConfirmError(null)
  }, [confirmBusy])

  const handleConfirm = useCallback(async () => {
    if (!order || !meta) return
    setConfirmError(null)

    const paymentMethod: PaymentMethod | null = meta.paymentMethod ?? order.paymentMethod ?? null
    if (!paymentMethod) {
      setConfirmError('Elegí efectivo o transferencia.')
      return
    }

    const result = await confirmSale({
      order,
      totalCOP: totals.totalCOP,
      paymentMethod,
      attendedBy: order.attendedBy ?? meta.attendedBy ?? DEFAULT_POS_STAFF,
      cashTenderedCOP: meta.cashTenderedCOP,
      transferReceiptDataUrl: meta.transferReceiptDataUrl,
      discountCOP: meta.discountCOP,
      discountReason: meta.discountReason,
      notes: meta.notes,
    })

    if (result.ok) {
      setPaymentOpen(false)
      return
    }

    setConfirmError(result.message)
  }, [confirmSale, meta, order, totals.totalCOP])

  useKeyboardShortcuts(
    {
      '/': () => {
        window.requestAnimationFrame(() => {
          document.querySelector<HTMLInputElement>('.pos-order-cart .pos-input--search')?.focus()
        })
      },
      'mod+enter': () => {
        if (paymentOpen) void handleConfirm()
        else handleOpenPayment()
      },
      escape: () => {
        if (paymentOpen) handleClosePayment()
        else navigate('tables')
      },
    },
    Boolean(order),
  )

  if (!order || !meta) {
    return <PosLoader label="Cargando cuenta…" />
  }

  const tableLabel = table?.name ?? order.tableName ?? 'Mesa'

  return (
    <div className="pos-screen pos-screen--order">
      <header className="pos-order-header">
        <button
          type="button"
          className="pos-btn pos-btn--ghost pos-btn--compact"
          onClick={() => navigate('tables')}
        >
          ← Mesas
        </button>
        {!isDockMobile ? (
          <div className="pos-order-header__title-wrap">
            <h1 className="pos-order-header__title">{tableLabel}</h1>
            <p className="pos-order-header__sub muted">
              Agregá productos y tocá Cobrar cuando esté listo
            </p>
          </div>
        ) : null}
      </header>

      <PosErrorBanner message={orderError ?? ''} />
      <PosErrorBanner message={catalogError ?? ''} />
      {catalogHint && (
        <p className="pos-banner pos-banner--info" role="status">
          {catalogHint}
        </p>
      )}
      {catalogRefreshing && !catalogLoading ? (
        <p className="pos-banner pos-banner--info pos-banner--subtle" role="status">
          Actualizando carta…
        </p>
      ) : null}

      <div className="pos-order-layout pos-order-layout--comanda pos-order-layout--cart-only">
        <section className="pos-order-comanda-wrap" aria-label="Datos del pedido">
          <PosOrderComanda
            order={order}
            tableName={tableLabel}
            totalCOP={totals.totalCOP}
            grossTotalCOP={totals.grossTotalCOP}
            discountCOP={meta.discountCOP}
            discountReason={meta.discountReason}
            mesa={meta.mesa}
            catalogProducts={products}
            catalogCategories={categories}
            catalogLoading={catalogLoading}
            topProductIds={hasRanking ? topProductIds : []}
            unitsSoldByProductId={unitsSoldByProductId}
            highlightId={addedFlash}
            onMesa={(value) => updateMeta({ mesa: value })}
            onDiscountCOP={(value) => updateMeta({ discountCOP: value })}
            onDiscountReason={(value) => updateMeta({ discountReason: value })}
            onOpenPayment={handleOpenPayment}
            onAddProduct={(p) => void handleAdd(p)}
            onQty={(id, q) => void setQuantity(id, q)}
            onLineNotes={(id, n) => void setLineNotes(id, n)}
            onRemove={(id) => void removeLine(id)}
            paymentBusy={confirmBusy}
          />
        </section>
      </div>

      <PosOrderPaymentModal
        open={paymentOpen}
        tableName={tableLabel}
        orderCode={formatPosOrderCode(order)}
        grossTotalCOP={totals.grossTotalCOP}
        discountCOP={meta.discountCOP}
        discountReason={meta.discountReason}
        totalCOP={totals.totalCOP}
        paymentMethod={meta.paymentMethod ?? order.paymentMethod ?? null}
        transferReceiptDataUrl={meta.transferReceiptDataUrl}
        cashTenderedCOP={meta.cashTenderedCOP}
        saleComment={meta.notes}
        confirmBusy={confirmBusy}
        confirmError={confirmError}
        onClose={handleClosePayment}
        onDiscountCOP={(value) => updateMeta({ discountCOP: value })}
        onDiscountReason={(value) => updateMeta({ discountReason: value })}
        onPaymentMethod={(method) => {
          updateMeta({
            paymentMethod: method,
            ...(method === 'cash'
              ? { transferReceiptDataUrl: null, transferReference: null }
              : { cashTenderedCOP: null }),
          })
        }}
        onTransferReceipt={(dataUrl) => updateMeta({ transferReceiptDataUrl: dataUrl })}
        onCashTendered={(value) => updateMeta({ cashTenderedCOP: value })}
        onCommentChange={(value) => updateMeta({ notes: value })}
        onConfirm={() => void handleConfirm()}
      />
      {orderSaving && <div className="pos-saving-indicator" aria-hidden />}
    </div>
  )
}
