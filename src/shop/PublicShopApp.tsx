import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'
import { formatCOP } from '../lib/money'
import { PublicThemeSwitch } from '../components/PublicThemeSwitch'
import '../public-shell.css'
import {
  checkoutShop,
  fetchShopCatalog,
  fetchShopOrder,
  fetchShopOrderByCode,
  getShopSlugFromHash,
  isShopEmbedMode,
  navigateShop,
  parseShopRoute,
  shopCartStorageKey,
  SHOP_STATUS_LABEL,
  type ShopCartLine,
  type ShopCatalog,
  type ShopOrder,
  type ShopProduct,
} from './shopApi'
import {
  groupProductsByCategory,
  initialsHue,
  productInitials,
  productThumbEmoji,
} from './shopProductUi'
import './shop.css'

function loadCart(key: string): ShopCartLine[] {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ShopCartLine[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveCart(key: string, lines: ShopCartLine[]) {
  window.localStorage.setItem(key, JSON.stringify(lines))
}

function useVosTheme(): ['dark' | 'light', () => void] {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = window.localStorage.getItem('vos_theme')
    return stored === 'light' ? 'light' : 'dark'
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('vos_theme', theme)
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}

function ShopHomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ShopCartIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden>
      <circle cx="9" cy="21" r="1" stroke="currentColor" strokeWidth="2" />
      <circle cx="20" cy="21" r="1" stroke="currentColor" strokeWidth="2" />
      <path
        d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ShopProductThumb({
  name,
  imageUrl,
}: {
  name: string
  imageUrl: string | null
}) {
  if (imageUrl) {
    return <img src={imageUrl} alt="" loading="lazy" />
  }
  const emoji = productThumbEmoji(name)
  const initials = productInitials(name)
  const hue = initialsHue(name)
  return (
    <div
      className={`shop-card__initials${emoji ? ' shop-card__initials--emoji' : ''}`}
      style={
        {
          '--shop-initial-hue': hue,
        } as CSSProperties
      }
      aria-hidden
    >
      <span>{emoji ?? initials}</span>
    </div>
  )
}

function orderStatusClass(status: ShopOrder['status']): string {
  switch (status) {
    case 'PREPARING':
      return 'shop-status--preparing'
    case 'DELIVERED':
      return 'shop-status--delivered'
    case 'PAID':
      return 'shop-status--paid'
    default:
      return 'shop-status--pending'
  }
}

export function PublicShopApp() {
  const slug = getShopSlugFromHash()
  const cartKey = shopCartStorageKey(slug)
  const embed = isShopEmbedMode()
  const [route, setRoute] = useState(parseShopRoute)
  const [catalog, setCatalog] = useState<ShopCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cart, setCart] = useState<ShopCartLine[]>(() => loadCart(cartKey))
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState<'idle' | 'payment' | 'confirm'>('idle')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'NEQUI' | 'CASH' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [activeOrder, setActiveOrder] = useState<ShopOrder | null>(null)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [theme, toggleTheme] = useVosTheme()
  const [orderComment, setOrderComment] = useState('')

  const syncRoute = useCallback(() => setRoute(parseShopRoute()), [])

  useEffect(() => {
    window.addEventListener('hashchange', syncRoute)
    window.addEventListener('popstate', syncRoute)
    return () => {
      window.removeEventListener('hashchange', syncRoute)
      window.removeEventListener('popstate', syncRoute)
    }
  }, [syncRoute])

  useEffect(() => {
    setCart(loadCart(cartKey))
  }, [cartKey])

  useEffect(() => {
    saveCart(cartKey, cart)
  }, [cart, cartKey])

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
    if (route.screen !== 'pedido' && route.screen !== 'payment' && route.screen !== 'success') return
    let cancelled = false
    const load = async () => {
      try {
        let order: ShopOrder
        if (route.screen === 'success') {
          order = await fetchShopOrder(route.orderId)
        } else if (route.orderId) {
          order = await fetchShopOrder(route.orderId)
        } else if (route.orderCode) {
          order = await fetchShopOrderByCode(slug, route.orderCode)
        } else return
        if (!cancelled) {
          setActiveOrder(order)
          if (order.status === 'PAID' && route.screen === 'pedido') {
            navigateShop(`exito/${order.id}`)
            setRoute({ screen: 'success', orderId: order.id })
          }
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    }
    void load()
    const poll = window.setInterval(() => void load(), 8000)
    return () => {
      cancelled = true
      window.clearInterval(poll)
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

  const renderShopHeader = (options?: { showCart?: boolean }) => {
    if (embed) return null
    return (
      <header className="shop-header shop-header--minimal">
        <div className="shop-header__actions">
          <a href="#/" className="shop-header-btn" aria-label="Inicio VOS AI">
            <ShopHomeIcon />
          </a>
          <PublicThemeSwitch
            theme={theme}
            onToggle={toggleTheme}
            compact
            className="shop-theme"
          />
          {options?.showCart !== false ? (
            <button
              type="button"
              className="shop-cart-btn"
              onClick={() => setCartOpen(true)}
              aria-label={`Carrito, ${cartCount} productos`}
            >
              <ShopCartIcon />
              {cartCount > 0 ? (
                <span className="shop-cart-btn__badge">{cartCount}</span>
              ) : null}
            </button>
          ) : null}
        </div>
      </header>
    )
  }

  const renderMobileCartFab = () =>
    cartOpen ? null : (
      <button
        type="button"
        className="shop-cart-fab"
        onClick={() => setCartOpen(true)}
        aria-label={`Abrir carrito, ${cartCount} productos`}
      >
        <ShopCartIcon size={22} />
        {cartCount > 0 ? (
          <span className="shop-cart-fab__badge">{cartCount}</span>
        ) : null}
      </button>
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

  const catalogProducts = useMemo(() => {
    if (!catalog) return []
    if (categoryId) return products
    return groupProductsByCategory(products, catalog.categories).flatMap(
      (g) => g.products,
    )
  }, [catalog, categoryId, products])

  const renderCartLines = () => {
    if (!cart.length) {
      return (
        <div className="shop-cart-panel__empty">
          <ShopCartIcon size={28} />
          <p>Carrito vacío</p>
          <span className="muted small">Elegí productos del menú</span>
        </div>
      )
    }
    return (
      <ul className="shop-cart-list">
        {cart.map((line) => (
          <li key={line.productId} className="shop-cart-item">
            <div className="shop-cart-item__info">
              <strong>{line.productName}</strong>
              <span className="shop-cart-item__unit">
                {formatCOP(line.unitPrice)} c/u
              </span>
            </div>
            <div className="shop-cart-item__actions">
              <div className="shop-qty">
                <button
                  type="button"
                  className="shop-icon-btn"
                  aria-label="Quitar uno"
                  onClick={() => updateQty(line.productId, line.quantity - 1)}
                >
                  −
                </button>
                <span>{line.quantity}</span>
                <button
                  type="button"
                  className="shop-icon-btn"
                  aria-label="Agregar uno"
                  onClick={() => updateQty(line.productId, line.quantity + 1)}
                >
                  +
                </button>
              </div>
              <span className="shop-cart-item__subtotal">
                {formatCOP(line.quantity * line.unitPrice)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  const renderCartFooter = () => (
    <footer className="shop-sheet__foot">
      <p className="shop-sheet__total">
        Total <strong>{formatCOP(cartTotal)}</strong>
      </p>
      <button
        type="button"
        className="shop-btn shop-btn--primary shop-btn--block"
        disabled={!cart.length}
        onClick={openPaymentStep}
      >
        Elegir método de pago
      </button>
    </footer>
  )

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
    if (window.matchMedia('(max-width: 767px)').matches) {
      setCartOpen(true)
    }
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
    if (!cart.length || !paymentMethod) return
    setSubmitting(true)
    setError(null)
    try {
      const order = await checkoutShop(slug, {
        items: cart,
        customerPhone,
        customerName: customerName.trim() || undefined,
        paymentMethod,
        customerNotes: orderComment.trim() || undefined,
      })
      setCart([])
      setCheckoutStep('idle')
      setCartOpen(false)
      setOrderComment('')
      setPaymentMethod(null)
      setActiveOrder(order)
      navigateShop(`pedido/${order.id}`)
      setRoute({ screen: 'pedido', orderId: order.id })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const closeCheckout = () => {
    setCheckoutStep('idle')
  }

  const openPaymentStep = () => {
    if (!cart.length) return
    setCartOpen(false)
    setCheckoutStep('payment')
  }

  const selectPaymentMethod = (method: 'CASH' | 'NEQUI') => {
    setPaymentMethod(method)
    setCheckoutStep('confirm')
  }

  const paymentMethodLabel =
    paymentMethod === 'CASH' ? 'Efectivo' : paymentMethod === 'NEQUI' ? 'Nequi' : ''

  if (route.screen === 'success' && activeOrder) {
    return (
      <div className={`shop-app${embed ? ' shop-app--embed' : ''}`}>
        {renderShopHeader({ showCart: false })}
        <main className="shop-main shop-main--center">
          <section className="shop-success">
            <div className="shop-success__icon" aria-hidden>
              ✓
            </div>
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
                navigateShop(slug)
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

  if ((route.screen === 'pedido' || route.screen === 'payment') && activeOrder) {
    return (
      <div className={`shop-app${embed ? ' shop-app--embed' : ''}`}>
        {renderShopHeader({ showCart: false })}
        <main className="shop-main shop-main--narrow">
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          <section className="shop-payment">
            <h1>Estado de tu pedido</h1>
            <p className="shop-payment__total">{formatCOP(activeOrder.total)}</p>
            <p
              className={`shop-status ${orderStatusClass(activeOrder.status)}`}
              role="status"
            >
              {SHOP_STATUS_LABEL[activeOrder.status] ?? activeOrder.status}
            </p>
            <ul className="shop-cart-list">
              {(activeOrder.items as ShopCartLine[]).map((ln) => (
                <li key={ln.productId} className="shop-cart-item">
                  <div className="shop-cart-item__info">
                    <strong>
                      {ln.quantity}× {ln.productName}
                    </strong>
                    <span className="shop-cart-item__unit">
                      {formatCOP(ln.unitPrice)} c/u
                    </span>
                  </div>
                  <span className="shop-cart-item__subtotal">
                    {formatCOP(ln.quantity * ln.unitPrice)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="muted small">
              Preferencia de pago:{' '}
              <strong>
                {activeOrder.paymentMethodLabel ??
                  (activeOrder.paymentMethod === 'CASH'
                    ? 'Efectivo en caja'
                    : activeOrder.paymentMethod === 'NEQUI'
                      ? 'Nequi'
                      : 'Bre-B')}
              </strong>
            </p>
            {activeOrder.paymentInstructions ? (
              <pre className="shop-payment__instructions">
                {activeOrder.paymentInstructions}
              </pre>
            ) : null}
            {activeOrder.status === 'DELIVERED' ? (
              <p className="muted">
                Tu pedido fue entregado. Acercate a caja para pagar (efectivo, Nequi o Bre-B).
              </p>
            ) : activeOrder.status === 'PAID' ? (
              <p className="muted">Pago confirmado. Revisá tu WhatsApp para el comprobante.</p>
            ) : (
              <p className="muted">
                El local recibió tu pedido y lo preparará. Esta pantalla se actualiza sola.
              </p>
            )}
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className={`shop-app${embed ? ' shop-app--embed' : ''}`}>
      {renderShopHeader()}

      <main className="shop-main">
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? (
          <p className="shop-loading" aria-live="polite">
            <span className="shop-loading__dot" aria-hidden />
            Cargando menú…
          </p>
        ) : null}

        {!loading && catalog ? (
          <div className="shop-layout">
            <div className="shop-layout__catalog">
              <div className="shop-toolbar shop-toolbar--combined">
                <input
                  type="search"
                  className="shop-search"
                  placeholder="Buscar…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Buscar productos"
                />
                <div
                  className="shop-filters-scroll"
                  role="group"
                  aria-label="Categorías"
                >
                  <div className="shop-filters-track">
                    <button
                      type="button"
                      className={`shop-filter-chip${categoryId === '' ? ' shop-filter-chip--active' : ''}`}
                      onClick={() => setCategoryId('')}
                    >
                      Todos
                    </button>
                    {catalog.categories.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`shop-filter-chip${categoryId === c.id ? ' shop-filter-chip--active' : ''}`}
                        onClick={() => setCategoryId(c.id)}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {catalogProducts.length === 0 ? (
                <p className="shop-empty-grid">No hay productos con ese filtro.</p>
              ) : (
                <ul className="shop-grid">
                  {catalogProducts.map((p) => (
                    <li key={p.id} className="shop-card">
                      <div className="shop-card__media">
                        <ShopProductThumb name={p.name} imageUrl={p.imageUrl} />
                      </div>
                      <div className="shop-card__body">
                        <h3 className="shop-card__title">{p.name}</h3>
                        {p.description ? (
                          <p className="shop-card__desc">{p.description}</p>
                        ) : (
                          <p className="shop-card__desc" aria-hidden>
                            &nbsp;
                          </p>
                        )}
                        <div className="shop-card__foot">
                          <p className="shop-card__price">{formatCOP(p.price)}</p>
                          <button
                            type="button"
                            className="shop-btn shop-btn--primary shop-btn--add"
                            onClick={() => addToCart(p)}
                            aria-label={`Agregar ${p.name} al carrito`}
                          >
                            <ShopCartIcon size={18} />
                            <span>Agregar</span>
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {!embed ? (
                <>
                  <div className="shop-note shop-note--info">
                    Productos artesanales. La disponibilidad puede variar según el día.
                  </div>
                  <div className="shop-note shop-note--warn">
                    Prohibida la venta de bebidas alcohólicas a menores de edad.
                  </div>
                </>
              ) : null}
            </div>

            <aside className="shop-layout__cart shop-cart-panel" aria-label="Carrito">
              {renderCartLines()}
              {renderCartFooter()}
            </aside>
          </div>
        ) : null}
      </main>

      {renderMobileCartFab()}

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
              <h2>Carrito</h2>
              <button type="button" className="shop-icon-btn" onClick={() => setCartOpen(false)}>
                ×
              </button>
            </header>
            {renderCartLines()}
            {renderCartFooter()}
          </aside>
        </div>
      ) : null}

      {checkoutStep === 'payment' ? (
        <div
          className="shop-sheet-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeCheckout()
          }}
        >
          <aside className="shop-sheet shop-sheet--step" role="dialog" aria-label="Método de pago">
            <header className="shop-sheet__head">
              <h2>Elegir método de pago</h2>
              <button
                type="button"
                className="shop-icon-btn"
                aria-label="Cerrar"
                onClick={closeCheckout}
              >
                ×
              </button>
            </header>
            <p className="shop-checkout-intro muted">
              Total del pedido: <strong>{formatCOP(cartTotal)}</strong>
              <br />
              Pagás al recibir tu pedido en el local.
            </p>
            <div className="shop-pay-methods" role="group" aria-label="Formas de pago">
              <button
                type="button"
                className={`shop-pay-method-card${paymentMethod === 'CASH' ? ' shop-pay-method-card--active' : ''}`}
                onClick={() => selectPaymentMethod('CASH')}
              >
                <span className="shop-pay-method-card__icon" aria-hidden>
                  💵
                </span>
                <strong>Efectivo</strong>
                <span className="shop-pay-method-card__hint">Pagás en caja al recibir</span>
              </button>
              <button
                type="button"
                className={`shop-pay-method-card${paymentMethod === 'NEQUI' ? ' shop-pay-method-card--active' : ''}`}
                onClick={() => selectPaymentMethod('NEQUI')}
              >
                <span className="shop-pay-method-card__icon" aria-hidden>
                  📱
                </span>
                <strong>Nequi</strong>
                <span className="shop-pay-method-card__hint">Transferencia al recibir</span>
              </button>
            </div>
            <button
              type="button"
              className="shop-btn shop-btn--ghost shop-btn--block"
              onClick={() => {
                closeCheckout()
                setCartOpen(true)
              }}
            >
              Volver al carrito
            </button>
          </aside>
        </div>
      ) : null}

      {checkoutStep === 'confirm' ? (
        <div
          className="shop-sheet-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeCheckout()
          }}
        >
          <aside className="shop-sheet shop-sheet--step" role="dialog" aria-label="Confirmar pedido">
            <header className="shop-sheet__head">
              <h2>Confirmar compra</h2>
              <button
                type="button"
                className="shop-icon-btn"
                aria-label="Cerrar"
                onClick={closeCheckout}
              >
                ×
              </button>
            </header>

            <div className="shop-checkout-summary">
              <div className="shop-checkout-summary__row">
                <span className="muted small">Método de pago</span>
                <div className="shop-checkout-summary__value">
                  <strong>{paymentMethodLabel}</strong>
                  <button
                    type="button"
                    className="shop-text-btn"
                    onClick={() => setCheckoutStep('payment')}
                  >
                    Cambiar
                  </button>
                </div>
              </div>
              <div className="shop-checkout-summary__row">
                <span className="muted small">Productos</span>
                <strong>
                  {cartCount} {cartCount === 1 ? 'ítem' : 'ítems'}
                </strong>
              </div>
              <div className="shop-checkout-summary__row shop-checkout-summary__row--total">
                <span>Total</span>
                <strong>{formatCOP(cartTotal)}</strong>
              </div>
            </div>

            <ul className="shop-checkout-items">
              {cart.map((line) => (
                <li key={line.productId}>
                  <span>
                    {line.quantity}× {line.productName}
                  </span>
                  <span>{formatCOP(line.quantity * line.unitPrice)}</span>
                </li>
              ))}
            </ul>

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
            <label className="shop-field">
              <span>Comentario (opcional)</span>
              <input
                value={orderComment}
                onChange={(e) => setOrderComment(e.target.value)}
                placeholder="Ej. sin cebolla, mesa 3, para llevar…"
              />
            </label>

            <p className="shop-checkout-note">
              Al confirmar, enviamos tu pedido al local. Pagás con{' '}
              <strong>{paymentMethodLabel.toLowerCase()}</strong> al recibirlo.
            </p>

            <button
              type="button"
              className="shop-btn shop-btn--primary shop-btn--block"
              disabled={submitting || !customerPhone.trim() || !paymentMethod}
              onClick={() => void startCheckout()}
            >
              {submitting ? 'Confirmando…' : 'Confirmar compra'}
            </button>
            <button
              type="button"
              className="shop-btn shop-btn--ghost shop-btn--block"
              disabled={submitting}
              onClick={() => setCheckoutStep('payment')}
            >
              Volver a método de pago
            </button>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
