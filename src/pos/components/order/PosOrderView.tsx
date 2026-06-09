import { useCallback, useState } from 'react'
import { MOBILE_FILTER_BREAKPOINT } from '../../../components/MobileAwareFilterBar'
import { useMatchMedia } from '../../../hooks/useMatchMedia'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { usePosCatalog } from '../../hooks/usePosCatalog'
import { usePosCheckout } from '../../hooks/usePosCheckout'
import { usePosSalesRanking } from '../../hooks/usePosSalesRanking'
import { usePosOrder } from '../../hooks/usePosOrder'
import { usePosStore } from '../../store/posStore'
import type { PaymentMethod } from '../../types'
import { PosErrorBanner } from '../ui/PosErrorBanner'
import { PosLoader } from '../ui/PosLoader'
import { PosOrderComanda } from './PosOrderComanda'

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
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [transferSheetOpen, setTransferSheetOpen] = useState(false)

  const handleAdd = useCallback(
    async (p: { id: string; name: string; price: number }) => {
      await addProduct(p)
      setAddedFlash(p.id)
      window.setTimeout(() => setAddedFlash(null), 400)
    },
    [addProduct],
  )

  const handleConfirm = useCallback(async () => {
    if (!order || !meta) return
    setConfirmError(null)

    const paymentMethod: PaymentMethod = meta.paymentMethod ?? 'cash'
    const result = await confirmSale({
      order,
      totalCOP: totals.totalCOP,
      paymentMethod,
      attendedBy: meta.attendedBy,
      cashTenderedCOP: meta.cashTenderedCOP,
      transferReceiptDataUrl: meta.transferReceiptDataUrl,
      notes: meta.notes,
    })

    if (result.ok) return

    setConfirmError(result.message)
    if (result.reason === 'transfer') setTransferSheetOpen(true)
  }, [confirmSale, meta, order, totals.totalCOP])

  useKeyboardShortcuts(
    {
      '/': () => {
        window.requestAnimationFrame(() => {
          document.querySelector<HTMLInputElement>('.pos-order-cart .pos-input--search')?.focus()
        })
      },
      'mod+enter': () => void handleConfirm(),
      escape: () => navigate('tables'),
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
              Agregá productos y confirmá la venta
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
            mesa={meta.mesa}
            paymentMethod={meta.paymentMethod ?? 'cash'}
            transferReceiptDataUrl={meta.transferReceiptDataUrl}
            transferReference={meta.transferReference}
            cashTenderedCOP={meta.cashTenderedCOP}
            attendedBy={meta.attendedBy}
            catalogProducts={products}
            catalogCategories={categories}
            catalogLoading={catalogLoading}
            topProductIds={hasRanking ? topProductIds : []}
            unitsSoldByProductId={unitsSoldByProductId}
            highlightId={addedFlash}
            transferSheetOpen={transferSheetOpen}
            onTransferSheetOpenChange={setTransferSheetOpen}
            onMesa={(value) => updateMeta({ mesa: value })}
            onPaymentMethod={(method) => {
              updateMeta({
                paymentMethod: method,
                ...(method === 'cash'
                  ? { transferReceiptDataUrl: null, transferReference: null }
                  : { cashTenderedCOP: null }),
              })
              if (method === 'transfer') setTransferSheetOpen(true)
              else setTransferSheetOpen(false)
            }}
            onTransferReceipt={(dataUrl) =>
              updateMeta({ transferReceiptDataUrl: dataUrl })
            }
            onTransferReference={(value) =>
              updateMeta({ transferReference: value.trim() || null })
            }
            onCashTendered={(value) => updateMeta({ cashTenderedCOP: value })}
            onAttendedBy={(staff) => updateMeta({ attendedBy: staff })}
            onAddProduct={(p) => void handleAdd(p)}
            onQty={(id, q) => void setQuantity(id, q)}
            onLineNotes={(id, n) => void setLineNotes(id, n)}
            onRemove={(id) => void removeLine(id)}
            onConfirm={() => void handleConfirm()}
            confirmBusy={confirmBusy}
            confirmError={confirmError}
          />
        </section>
      </div>
      {orderSaving && <div className="pos-saving-indicator" aria-hidden />}
    </div>
  )
}
