import { useCallback, useEffect, useState } from 'react'
import { useMatchMedia } from '../../../hooks/useMatchMedia'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { usePosCatalog } from '../../hooks/usePosCatalog'
import { usePosOrder } from '../../hooks/usePosOrder'
import { usePosStore } from '../../store/posStore'
import { PosErrorBanner } from '../ui/PosErrorBanner'
import { PosLoader } from '../ui/PosLoader'
import { CartPanel } from './CartPanel'
import { ProductGrid } from './ProductGrid'

type Props = { baseUrl: string }
type MobilePanel = 'products' | 'cart'

export function PosOrderView({ baseUrl }: Props) {
  const { state, navigate } = usePosStore()
  const table = state.tables.find((t) => t.id === state.selectedTableId)
  const isMobile = useMatchMedia('(max-width: 959px)')
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('products')

  const {
    order,
    totals,
    error: orderError,
    loading: orderSaving,
    addProduct,
    setQuantity,
    setLineNotes,
    removeLine,
  } = usePosOrder(baseUrl)

  const {
    products,
    categories,
    loading: catalogLoading,
    error: catalogError,
    usingDemoCatalog,
    reload: reloadCatalog,
  } = usePosCatalog(baseUrl)

  const catalogHint = usingDemoCatalog
    ? 'Carta de demostración (sin API). Cuando levantes arandano-api verás tus productos reales.'
    : null

  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [addedFlash, setAddedFlash] = useState<string | null>(null)

  useEffect(() => {
    if (!order?.lines.length) setMobilePanel('products')
  }, [order?.id])

  const handleAdd = useCallback(
    async (p: { id: string; name: string; price: number }) => {
      await addProduct(p)
      setAddedFlash(p.id)
      window.setTimeout(() => setAddedFlash(null), 400)
      if (isMobile && order && order.lines.length === 0) {
        setMobilePanel('cart')
      }
    },
    [addProduct, isMobile, order],
  )

  const goPay = useCallback(
    () => navigate('payment', state.selectedTableId),
    [navigate, state.selectedTableId],
  )

  useKeyboardShortcuts(
    {
      '/': () => {
        setMobilePanel('products')
        window.requestAnimationFrame(() => {
          document.querySelector<HTMLInputElement>('.pos-input--search')?.focus()
        })
      },
      'mod+enter': goPay,
      escape: () => navigate('tables'),
    },
    Boolean(order),
  )

  if (!order) {
    return <PosLoader label="Cargando cuenta…" />
  }

  const tableLabel = table?.name ?? order.tableName ?? 'Mesa'
  const showProducts = !isMobile || mobilePanel === 'products'
  const showCart = !isMobile || mobilePanel === 'cart'

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
        <div className="pos-order-header__title-wrap">
          <h1 className="pos-order-header__title">{tableLabel}</h1>
          <p className="pos-order-header__sub muted">
            Agregá productos de la carta al pedido
          </p>
        </div>
        {isMobile && (
          <div className="pos-order-tabs" role="tablist" aria-label="Vista del pedido">
            <button
              type="button"
              role="tab"
              aria-selected={mobilePanel === 'products'}
              className={`pos-order-tab${mobilePanel === 'products' ? ' pos-order-tab--active' : ''}`}
              onClick={() => setMobilePanel('products')}
            >
              Productos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobilePanel === 'cart'}
              className={`pos-order-tab${mobilePanel === 'cart' ? ' pos-order-tab--active' : ''}`}
              onClick={() => setMobilePanel('cart')}
            >
              Cuenta ({order.lines.length})
            </button>
          </div>
        )}
      </header>

      <PosErrorBanner message={orderError ?? ''} />
      <PosErrorBanner message={catalogError ?? ''} />
      {catalogHint && (
        <p className="pos-banner pos-banner--info" role="status">
          {catalogHint}
        </p>
      )}

      <div className="pos-order-layout">
        {showProducts && (
          <section className="pos-order-main" aria-label="Catálogo de productos">
            {catalogLoading ? (
              <PosLoader label="Cargando productos…" />
            ) : (
              <ProductGrid
                products={products}
                categories={categories}
                activeCategoryId={categoryId}
                search={search}
                highlightId={addedFlash}
                onSearch={setSearch}
                onCategory={setCategoryId}
                onAdd={(p) => void handleAdd(p)}
                onRetry={() => void reloadCatalog()}
                catalogError={catalogError}
              />
            )}
          </section>
        )}
        {showCart && (
          <CartPanel
            lines={order.lines}
            subtotalCOP={totals.subtotalCOP}
            taxCOP={totals.taxCOP}
            totalCOP={totals.totalCOP}
            tableName={tableLabel}
            onQty={(id, q) => void setQuantity(id, q)}
            onNotes={(id, n) => void setLineNotes(id, n)}
            onRemove={(id) => void removeLine(id)}
            onPay={goPay}
            onBack={() => (isMobile ? setMobilePanel('products') : navigate('tables'))}
            backLabel={isMobile ? '← Productos' : undefined}
          />
        )}
      </div>
      {orderSaving && <div className="pos-saving-indicator" aria-hidden />}
    </div>
  )
}
