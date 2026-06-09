import { useEffect } from 'react'
import { PLATFORM_MODE } from '../../../appScope'

type Props = {
  message: string
  orderCode: string
  onOpen?: () => void
  onDismiss: () => void
}

export function PosShopOrderToast({
  message,
  orderCode,
  onOpen,
  onDismiss,
}: Props) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 8000)
    return () => window.clearTimeout(timer)
  }, [onDismiss, orderCode])

  if (!PLATFORM_MODE) return null

  return (
    <div className="pos-shop-toast" role="status" aria-live="polite">
      <div className="pos-shop-toast__body">
        <strong>{message}</strong>
        <p className="muted small">Pedido desde el carrito en línea</p>
      </div>
      <div className="pos-shop-toast__actions">
        {onOpen ? (
          <button type="button" className="pos-btn pos-btn--primary pos-btn--compact" onClick={onOpen}>
            Ver pedidos
          </button>
        ) : null}
        <button
          type="button"
          className="pos-btn pos-btn--ghost pos-btn--compact"
          onClick={onDismiss}
          aria-label="Cerrar aviso"
        >
          ×
        </button>
      </div>
    </div>
  )
}
