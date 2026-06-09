import { useCallback, useState } from 'react'
import { formatCOP } from '../../lib/money'
import {
  collectPlatformShopOrderPayment,
  updatePlatformShopOrderStatus,
  type PlatformShopOrder,
} from '../../../api'
import { useShopOrdersFeed } from '../../hooks/useShopOrdersFeed'
import { PosErrorBanner } from '../ui/PosErrorBanner'
import { PosLoader } from '../ui/PosLoader'

type Props = { baseUrl: string; onBack: () => void }

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Recibido',
  PREPARING: 'En preparación',
  DELIVERED: 'Entregado',
  PAID: 'Pagado',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Expirado',
}

export function ShopOrdersView({ baseUrl, onBack }: Props) {
  const {
    orders,
    loading,
    refreshing,
    error,
    refresh,
  } = useShopOrdersFeed(baseUrl)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [payOrder, setPayOrder] = useState<PlatformShopOrder | null>(null)
  const [payMethod, setPayMethod] = useState<'CASH' | 'NEQUI' | 'BREB'>('CASH')
  const [actionError, setActionError] = useState<string | null>(null)

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id)
    setActionError(null)
    try {
      await fn()
      await refresh(true)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusyId(null)
    }
  }

  const collect = async () => {
    if (!payOrder) return
    await run(payOrder.id, async () => {
      await collectPlatformShopOrderPayment(baseUrl, payOrder.id, payMethod)
      setPayOrder(null)
    })
  }

  const handleRefresh = useCallback(() => {
    void refresh(true)
  }, [refresh])

  return (
    <div className="pos-screen pos-screen--shop-orders">
      <header className="pos-topbar">
        <div>
          <h1 className="pos-topbar__title">Pedidos tienda</h1>
          <p className="pos-topbar__sub muted">
            Recibidos desde el carrito en línea
            {refreshing ? ' · actualizando…' : ' · en vivo'}
          </p>
        </div>
        <div className="pos-topbar__actions">
          <button
            type="button"
            className="pos-btn pos-btn--ghost"
            onClick={() => {
              window.open(`${window.location.origin}${window.location.pathname}#/tienda`, '_blank')
            }}
          >
            Ver tienda
          </button>
          <button type="button" className="pos-btn pos-btn--ghost" onClick={handleRefresh}>
            Actualizar
          </button>
          <button type="button" className="pos-btn pos-btn--ghost" onClick={onBack}>
            ← Mesas
          </button>
        </div>
      </header>

      <PosErrorBanner message={actionError ?? error ?? ''} />

      {loading && orders.length === 0 ? <PosLoader label="Cargando pedidos…" /> : null}

      {!loading && orders.length === 0 ? (
        <p className="muted pos-empty-inline">No hay pedidos pendientes.</p>
      ) : null}

      <ul className="pos-shop-order-list">
        {orders.map((o) => (
          <li key={o.id} className="pos-shop-order-card">
            <div className="pos-shop-order-card__head">
              <div>
                <strong>{o.orderCode}</strong>
                <span className="pos-pill">{STATUS_LABEL[o.status] ?? o.status}</span>
              </div>
              <strong>{formatCOP(o.total)}</strong>
            </div>
            <p className="muted small">
              {o.customerName?.trim() || 'Cliente'} · {o.customerPhone}
            </p>
            <ul className="pos-shop-order-lines">
              {o.items.map((ln, i) => (
                <li key={`${ln.productId}-${i}`}>
                  {ln.quantity}× {ln.productName} — {formatCOP(ln.quantity * ln.unitPrice)}
                </li>
              ))}
            </ul>
            <div className="pos-shop-order-card__actions">
              {o.status === 'PENDING' ? (
                <button
                  type="button"
                  className="pos-btn pos-btn--primary"
                  disabled={busyId === o.id}
                  onClick={() =>
                    void run(o.id, async () => {
                      await updatePlatformShopOrderStatus(baseUrl, o.id, 'PREPARING')
                    })
                  }
                >
                  Preparar
                </button>
              ) : null}
              {o.status === 'PENDING' || o.status === 'PREPARING' ? (
                <button
                  type="button"
                  className="pos-btn pos-btn--secondary"
                  disabled={busyId === o.id}
                  onClick={() =>
                    void run(o.id, async () => {
                      await updatePlatformShopOrderStatus(baseUrl, o.id, 'DELIVERED')
                    })
                  }
                >
                  Marcar entregado
                </button>
              ) : null}
              {o.status === 'DELIVERED' ? (
                <button
                  type="button"
                  className="pos-btn pos-btn--primary"
                  disabled={busyId === o.id}
                  onClick={() => {
                    setPayMethod('CASH')
                    setPayOrder(o)
                  }}
                >
                  Cobrar y facturar
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {payOrder ? (
        <div className="pos-modal-backdrop" role="presentation">
          <div className="pos-modal" role="dialog" aria-label="Cobrar pedido">
            <h2>Cobrar {payOrder.orderCode}</h2>
            <p className="pos-modal__total">{formatCOP(payOrder.total)}</p>
            <fieldset className="pos-pay-methods">
              <legend>Forma de pago</legend>
              {(['CASH', 'NEQUI', 'BREB'] as const).map((m) => (
                <label key={m}>
                  <input
                    type="radio"
                    name="shopPay"
                    checked={payMethod === m}
                    onChange={() => setPayMethod(m)}
                  />
                  {m === 'CASH' ? 'Efectivo' : m === 'NEQUI' ? 'Nequi' : 'Bre-B'}
                </label>
              ))}
            </fieldset>
            <p className="muted small">
              Se registra la venta y se envía el comprobante por WhatsApp al cliente y al
              grupo interno.
            </p>
            <div className="pos-modal__actions">
              <button
                type="button"
                className="pos-btn pos-btn--ghost"
                onClick={() => setPayOrder(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="pos-btn pos-btn--primary"
                disabled={busyId === payOrder.id}
                onClick={() => void collect()}
              >
                Confirmar cobro
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
