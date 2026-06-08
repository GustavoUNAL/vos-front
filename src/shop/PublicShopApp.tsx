import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  checkoutShop,
  confirmShopPayment,
  fetchShopCatalog,
  fetchShopOrder,
  fetchShopOrderByCode,
  getShopSlugFromHash,
  type ShopCartLine,
  type ShopCatalog,
  type ShopOrder,
  type ShopProduct,
} from './shopApi'
import './shop.css'

const CART_KEY = 'vos_shop_cart'

function formatCOP(n: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n)
}

function loadCart(): ShopCartLine[] {
  try {
    const raw = window.localStorage.getItem(CART_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ShopCartLine[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveCart(lines: ShopCartLine[]) {
  window.localStorage.setItem(CART_KEY, JSON.stringify(lines))
}

function parseShopRoute():
  | { screen: 'catalog' }
  | { screen: 'payment'; orderId?: string; orderCode?: string }
  | { screen: 'success'; orderId: string } {
  const raw = (window.location.hash ?? '').replace(/^#/, '')
  const parts = raw.split('/').filter(Boolean)
  if (parts[0] !== 'tienda') return { screen: 'catalog' }
  if (parts[1] === 'pago') {
    const token = parts[2] ?? ''
    if (token.startsWith('SHOP-')) return { screen: 'payment', orderCode: token }
    if (token) return { screen: 'payment', orderId: token }
    return { screen: 'catalog' }
  }
  if (parts[1] === 'exito' && parts[2]) {
    return { screen: 'success', orderId: parts[2] }
  }
  return { screen: 'catalog' }
}

export function PublicShopApp() {
  const slug = getShopSlugFromHash()
  const [route, setRoute] = useState(parseShopRoute)
  const [catalog, setCatalog] = useState<ShopCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cart, setCart] = useState<ShopCartLine[]>(() => loadCart())
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'NEQUI' | 'BREB'>('NEQUI')
  const [submitting, setSubmitting] = useState(false)
  const [activeOrder, setActiveOrder] = useState<ShopOrder | null>(null)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')

  const syncRoute = useCallback(() => setRoute(parseShopRoute()), [])

  useEffect(() => {
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [syncRoute])

  useEffect(() => {
    saveCart(cart)
  }, [cart])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchShopCatalog(slug)
      .then((c) => {
        if (!cancelled) setCatalog(c)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (route.screen !== 'payment' && route.screen !== 'success') return
    let cancelled = false
    const load = async () => {
      try {
        let order: ShopOrder
        if (route.screen === 'payment') {
          if (route.orderId) {
            order = await fetchShopOrder(route.orderId)
          } else if (route.orderCode) {
            order = await fetchShopOrderByCode(slug, route.orderCode)
          } else return
        } else {
          order = await fetchShopOrder(route.orderId)
        }
        if (!cancelled) setActiveOrder(order)
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [route, slug])

  const cartTotal = useMemo(
    () => cart.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
    [cart],
  )

  const cartCount = useMemo(
    () => cart.reduce((s, l) => s + l.quantity, 0),
    [cart],
  )

  const products = useMemo(() => {
    if (!catalog) return []
    let list = catalog.products
    if (categoryId) list = list.filter((p) => p.categoryId === categoryId)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q),
      )
    }
    return list
  }, [catalog, categoryId, search])

  const addToCart = (product: ShopProduct) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id)
      if (existing) {
        return prev.map((l) =>
          l.productId === product.id
            ? { ...l, quantity: l.quantity + 1 }
            : l,
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.price,
        },
      ]
    })
    setCartOpen(true)
  }

  const updateQty = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((l) => l.productId !== productId))
      return
    }
    setCart((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, quantity } : l)),
    )
  }

  const startCheckout = async () => {
    if (!cart.length) return
    setSubmitting(true)
    setError(null)
    try {
      const order = await checkoutShop(slug, {
        items: cart,
        customerPhone,
        customerName: customerName.trim() || undefined,
        paymentMethod,
      })
      setCart([])
      setCheckoutOpen(false)
      setCartOpen(false)
      setActiveOrder(order)
      window.location.hash = `#/tienda/pago/${order.id}`
      setRoute({ screen: 'payment', orderId: order.id })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const confirmPayment = async () => {
    if (!activeOrder) return
    setSubmitting(true)
    setError(null)
    try {
      const order = await confirmShopPayment(activeOrder.id)
      setActiveOrder(order)
      window.location.hash = `#/tienda/exito/${order.id}`
      setRoute({ screen: 'success', orderId: order.id })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (route.screen === 'success' && activeOrder) {
    return (
      <div className="shop-app">
        <header className="shop-header">
          <div className="shop-brand">
            <span className="shop-brand__berry" aria-hidden />
            <div>
              <strong>{activeOrder.companyName}</strong>
              <span className="shop-brand__tag">Pedido confirmado</span>
            </div>
          </div>
        </header>
        <main className="shop-main shop-main--center">
          <section className="shop-success">
            <h1>¡Gracias por tu compra!</h1>
            <p>
              Pedido <strong>{activeOrder.orderCode}</strong>
              {activeOrder.saleCode ? (
                <>
                  {' '}
                  · Venta <strong>{activeOrder.saleCode}</strong>
                </>
              ) : null}
            </p>
            <p className="shop-success__total">{formatCOP(activeOrder.total)}</p>
            {activeOrder.whatsappSent ? (
              <p className="banner-warn" role="status">
                Enviamos el comprobante a tu WhatsApp ({activeOrder.customerPhone}).
              </p>
            ) : (
              <p className="muted">
                La venta quedó registrada. Si configuraste WhatsApp en el servidor,
                el comprobante se enviará automáticamente.
              </p>
            )}
            <button
              type="button"
              className="shop-btn shop-btn--primary"
              onClick={() => {
                window.location.hash = '#/tienda'
                setRoute({ screen: 'catalog' })
                setActiveOrder(null)
              }}
            >
              Seguir comprando
            </button>
          </section>
        </main>
      </div>
    )
  }

  if (route.screen === 'payment' && activeOrder) {
    return (
      <div className="shop-app">
        <header className="shop-header">
          <div className="shop-brand">
            <span className="shop-brand__berry" aria-hidden />
            <div>
              <strong>{activeOrder.companyName}</strong>
              <span className="shop-brand__tag">Pago · {activeOrder.orderCode}</span>
            </div>
          </div>
        </header>
        <main className="shop-main shop-main--narrow">
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          <section className="shop-payment">
            <h1>Completa tu pago</h1>
            <p className="shop-payment__total">{formatCOP(activeOrder.total)}</p>
            <p className="muted">
              Método:{' '}
              <strong>
                {activeOrder.paymentMethod === 'NEQUI' ? 'Nequi' : 'Bre-B'}
              </strong>
            </p>
            {activeOrder.paymentInstructions ? (
              <pre className="shop-payment__instructions">
                {activeOrder.paymentInstructions}
              </pre>
            ) : null}
            {activeOrder.paymentLink ? (
              <a
                className="shop-btn shop-btn--secondary"
                href={activeOrder.paymentLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir enlace de pago
              </a>
            ) : null}
            <button
              type="button"
              className="shop-btn shop-btn--primary"
              disabled={submitting || activeOrder.status === 'PAID'}
              onClick={() => void confirmPayment()}
            >
              {submitting ? 'Confirmando…' : 'Ya pagué — confirmar pedido'}
            </button>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="shop-app">
      <header className="shop-header">
        <div className="shop-brand">
          <span className="shop-brand__berry" aria-hidden />
          <div>
            <strong>{catalog?.company.name ?? 'Arándano Café Bar'}</strong>
            <span className="shop-brand__tag">Tienda en línea</span>
          </div>
        </div>
        <button
          type="button"
          className="shop-cart-btn"
          onClick={() => setCartOpen(true)}
          aria-label={`Carrito, ${cartCount} productos`}
        >
          <span aria-hidden>🛒</span>
          {cartCount > 0 ? <span className="shop-cart-btn__badge">{cartCount}</span> : null}
        </button>
      </header>

      <main className="shop-main">
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? <p className="muted">Cargando menú…</p> : null}

        {!loading && catalog ? (
          <>
            <div className="shop-toolbar">
              <input
                type="search"
                className="shop-search"
                placeholder="Buscar en la carta…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="shop-filter"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Todas las categorías</option>
                {catalog.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <ul className="shop-grid">
              {products.map((p) => (
                <li key={p.id} className="shop-card">
                  <div className="shop-card__body">
                    <span className="shop-card__category muted small">
                      {p.category.name}
                    </span>
                    <h2 className="shop-card__title">{p.name}</h2>
                    {p.description ? (
                      <p className="shop-card__desc muted small">{p.description}</p>
                    ) : null}
                    <p className="shop-card__price">{formatCOP(p.price)}</p>
                  </div>
                  <button
                    type="button"
                    className="shop-btn shop-btn--primary shop-btn--block"
                    onClick={() => addToCart(p)}
                  >
                    Agregar
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </main>

      {cartOpen ? (
        <div
          className="shop-sheet-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCartOpen(false)
          }}
        >
          <aside className="shop-sheet" role="dialog" aria-label="Carrito">
            <header className="shop-sheet__head">
              <h2>Tu pedido</h2>
              <button type="button" className="shop-icon-btn" onClick={() => setCartOpen(false)}>
                ×
              </button>
            </header>
            {cart.length === 0 ? (
              <p className="muted">El carrito está vacío.</p>
            ) : (
              <ul className="shop-cart-list">
                {cart.map((line) => (
                  <li key={line.productId} className="shop-cart-line">
                    <div>
                      <strong>{line.productName}</strong>
                      <span className="muted small">{formatCOP(line.unitPrice)}</span>
                    </div>
                    <div className="shop-cart-line__qty">
                      <button
                        type="button"
                        className="shop-icon-btn"
                        onClick={() => updateQty(line.productId, line.quantity - 1)}
                      >
                        −
                      </button>
                      <span>{line.quantity}</span>
                      <button
                        type="button"
                        className="shop-icon-btn"
                        onClick={() => updateQty(line.productId, line.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <footer className="shop-sheet__foot">
              <p className="shop-sheet__total">
                Total <strong>{formatCOP(cartTotal)}</strong>
              </p>
              <button
                type="button"
                className="shop-btn shop-btn--primary shop-btn--block"
                disabled={!cart.length}
                onClick={() => {
                  setCartOpen(false)
                  setCheckoutOpen(true)
                }}
              >
                Ir a pagar
              </button>
            </footer>
          </aside>
        </div>
      ) : null}

      {checkoutOpen ? (
        <div
          className="shop-sheet-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCheckoutOpen(false)
          }}
        >
          <aside className="shop-sheet" role="dialog" aria-label="Checkout">
            <header className="shop-sheet__head">
              <h2>Datos para el pago</h2>
              <button
                type="button"
                className="shop-icon-btn"
                onClick={() => setCheckoutOpen(false)}
              >
                ×
              </button>
            </header>
            <label className="shop-field">
              <span>Nombre (opcional)</span>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Tu nombre"
              />
            </label>
            <label className="shop-field">
              <span>Celular WhatsApp *</span>
              <input
                type="tel"
                inputMode="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="300 123 4567"
              />
            </label>
            <fieldset className="shop-pay-methods">
              <legend>Método de pago</legend>
              <label>
                <input
                  type="radio"
                  name="pay"
                  checked={paymentMethod === 'NEQUI'}
                  onChange={() => setPaymentMethod('NEQUI')}
                />
                Nequi
              </label>
              <label>
                <input
                  type="radio"
                  name="pay"
                  checked={paymentMethod === 'BREB'}
                  onChange={() => setPaymentMethod('BREB')}
                />
                Bre-B
              </label>
            </fieldset>
            <p className="muted small">
              Total a pagar: <strong>{formatCOP(cartTotal)}</strong>
            </p>
            <button
              type="button"
              className="shop-btn shop-btn--primary shop-btn--block"
              disabled={submitting || !customerPhone.trim()}
              onClick={() => void startCheckout()}
            >
              {submitting ? 'Procesando…' : 'Generar link de pago'}
            </button>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
