import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatCOP } from '../lib/money'
import { BRAND_NAME } from '../lib/brand'
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

function ShopCartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <path
        d="M6 9h15l-1.5 9h-12L6 9Zm0 0L5 3H2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="20" r="1.5" fill="currentColor" />
      <circle cx="18" cy="20" r="1.5" fill="currentColor" />
    </svg>
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
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'NEQUI' | 'BREB' | 'CASH'>('NEQUI')
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

  const renderShopHeader = (
    companyName: string,
    tag: string,
    options?: { showCart?: boolean },
  ) => (
    <header className="shop-header">
      <div className="shop-brand">
        <span className="shop-brand__berry" aria-hidden />
        <div>
          <strong>{companyName}</strong>
          <span className="shop-brand__tag">{tag}</span>
        </div>
      </div>
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
        customerNotes: orderComment.trim() || undefined,
      })
      setCart([])
      setCheckoutOpen(false)
      setCartOpen(false)
      setOrderComment('')
      setActiveOrder(order)
      navigateShop(`pedido/${order.id}`)
      setRoute({ screen: 'pedido', orderId: order.id })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (route.screen === 'success' && activeOrder) {
    return (
      <div className={`shop-app${embed ? ' shop-app--embed' : ''}`}>
        {renderShopHeader(activeOrder.companyName, 'Pedido confirmado', {
          showCart: false,
        })}
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
        {renderShopHeader(
          activeOrder.companyName,
          `Pedido · ${activeOrder.orderCode}`,
          { showCart: false },
        )}
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
      {renderShopHeader(
        catalog?.company.name ?? 'Tienda',
        `Tienda en línea · ${BRAND_NAME}`,
      )}

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
                aria-label="Filtrar por categoría"
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
              {products.length === 0 ? (
                <li className="shop-empty-grid">
                  No hay productos con ese filtro.
                </li>
              ) : null}
              {products.map((p) => (
                <li key={p.id} className="shop-card">
                  <div className="shop-card__media">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" loading="lazy" />
                    ) : (
                      <div className="shop-card__placeholder" aria-hidden />
                    )}
                  </div>
                  <div className="shop-card__body">
                    <span className="shop-card__category">{p.category.name}</span>
                    <h2 className="shop-card__title">{p.name}</h2>
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
                        className="shop-btn shop-btn--primary shop-btn--block"
                        onClick={() => addToCart(p)}
                      >
                        Agregar
                      </button>
                    </div>
                  </div>
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
              <p className="shop-sheet__empty">El carrito está vacío.</p>
            ) : (
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
                Enviar pedido al local
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
              <h2>Datos del pedido</h2>
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
            <label className="shop-field">
              <span>Comentario (opcional)</span>
              <input
                value={orderComment}
                onChange={(e) => setOrderComment(e.target.value)}
                placeholder="Ej. sin cebolla, mesa 3, para llevar…"
              />
            </label>
            <fieldset className="shop-pay-chips">
              <legend className="sr-only">Preferencia de pago en caja</legend>
              {(
                [
                  ['CASH', 'Efectivo'],
                  ['NEQUI', 'Nequi'],
                  ['BREB', 'Bre-B'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`shop-pay-chip${paymentMethod === value ? ' shop-pay-chip--active' : ''}`}
                  onClick={() => setPaymentMethod(value)}
                >
                  {label}
                </button>
              ))}
            </fieldset>
            <p className="shop-checkout-note">
              Total: <strong>{formatCOP(cartTotal)}</strong> · Pagás al recibir el pedido.
            </p>
            <button
              type="button"
              className="shop-btn shop-btn--primary shop-btn--block"
              disabled={submitting || !customerPhone.trim()}
              onClick={() => void startCheckout()}
            >
              {submitting ? 'Enviando…' : 'Confirmar y enviar al POS'}
            </button>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
