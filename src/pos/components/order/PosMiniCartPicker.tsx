import type { RefObject } from 'react'
import { ChevronDown, ChevronUp, Plus, Search, ShoppingBag } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { CategoryRef, ProductRow } from '../../../api'
import { formatCOP, parseMoney } from '../../lib/money'
import {
  filterProductsForPos,
  sortProductsForPos,
} from '../../lib/productSearch'
import type { OrderLine } from '../../types'

type ProductPick = { id: string; name: string; price: number }

type Props = {
  products: ProductRow[]
  categories: CategoryRef[]
  lines: OrderLine[]
  totalCOP: number
  topProductIds?: string[]
  unitsSoldByProductId?: Map<string, number>
  highlightId?: string | null
  searchInputRef?: RefObject<HTMLInputElement | null>
  onAdd: (product: ProductPick) => void
  onQty: (lineId: string, qty: number) => void
  onClose: () => void
}

function lineForProduct(lines: OrderLine[], productId: string): OrderLine | undefined {
  return lines.find((l) => l.productId === productId)
}

export function PosMiniCartPicker({
  products,
  categories,
  lines,
  totalCOP,
  topProductIds = [],
  unitsSoldByProductId = new Map(),
  highlightId,
  searchInputRef: externalSearchRef,
  onAdd,
  onQty,
  onClose,
}: Props) {
  const internalSearchRef = useRef<HTMLInputElement>(null)
  const searchRef = externalSearchRef ?? internalSearchRef
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [cartOpen, setCartOpen] = useState(false)

  const itemCount = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity, 0),
    [lines],
  )

  const filtered = useMemo(() => {
    const base = filterProductsForPos(products, { activeCategoryId: categoryId, search })
    return sortProductsForPos(base, {
      search,
      salesUnitsByProductId: unitsSoldByProductId,
    })
  }, [products, categoryId, search, unitsSoldByProductId])

  const quickPicks = useMemo(() => {
    if (search.trim() || categoryId) return []
    const byId = new Map(products.filter((p) => p.active).map((p) => [p.id, p]))
    return topProductIds
      .map((id) => byId.get(id))
      .filter((p): p is ProductRow => Boolean(p))
      .slice(0, 6)
  }, [products, topProductIds, search, categoryId])

  const addProduct = (p: ProductRow) => {
    onAdd({ id: p.id, name: p.name, price: parseMoney(p.price) })
  }

  return (
    <div className="pos-mini-cart" aria-label="Mini carrito">
      <div className="pos-mini-cart__toolbar">
        <label className="pos-mini-cart__search">
          <Search className="pos-mini-cart__search-icon" aria-hidden strokeWidth={2} />
          <input
            ref={searchRef}
            type="search"
            className="pos-mini-cart__search-input"
            placeholder="Buscar producto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>
        <div className="pos-mini-cart__categories" role="tablist" aria-label="Categorías">
          <button
            type="button"
            role="tab"
            aria-selected={!categoryId}
            className={`pos-mini-cart__chip${!categoryId ? ' pos-mini-cart__chip--active' : ''}`}
            onClick={() => setCategoryId(null)}
          >
            Todos
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={categoryId === c.id}
              className={`pos-mini-cart__chip${categoryId === c.id ? ' pos-mini-cart__chip--active' : ''}`}
              onClick={() => setCategoryId(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {quickPicks.length > 0 ? (
        <div className="pos-mini-cart__quick" aria-label="Sugeridos">
          <span className="pos-mini-cart__quick-label">Populares</span>
          <div className="pos-mini-cart__quick-scroll">
            {quickPicks.map((p) => {
              const line = lineForProduct(lines, p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`pos-mini-cart__quick-item${line ? ' pos-mini-cart__quick-item--in-cart' : ''}${highlightId === p.id ? ' pos-mini-cart__quick-item--flash' : ''}`}
                  onClick={() => addProduct(p)}
                >
                  <span className="pos-mini-cart__quick-name">{p.name}</span>
                  {line ? (
                    <span className="pos-mini-cart__quick-qty mono">{line.quantity}</span>
                  ) : (
                    <Plus className="pos-mini-cart__quick-plus" aria-hidden strokeWidth={2.5} />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <ul className="pos-mini-cart__catalog">
        {filtered.length === 0 ? (
          <li className="pos-mini-cart__empty muted small">Sin coincidencias en la carta.</li>
        ) : (
          filtered.map((p) => {
            const line = lineForProduct(lines, p.id)
            const price = parseMoney(p.price)
            return (
              <li
                key={p.id}
                className={`pos-mini-cart__row${line ? ' pos-mini-cart__row--active' : ''}${highlightId === p.id ? ' pos-mini-cart__row--flash' : ''}`}
              >
                <div className="pos-mini-cart__row-main">
                  <span className="pos-mini-cart__row-name">{p.name}</span>
                  <span className="pos-mini-cart__row-price mono">{formatCOP(price)}</span>
                </div>
                {line ? (
                  <div className="pos-mini-cart__row-qty">
                    <button
                      type="button"
                      className="pos-mini-cart__qty-btn"
                      aria-label="Menos"
                      onClick={() => onQty(line.id, line.quantity - 1)}
                    >
                      −
                    </button>
                    <span className="pos-mini-cart__qty-value mono">{line.quantity}</span>
                    <button
                      type="button"
                      className="pos-mini-cart__qty-btn"
                      aria-label="Más"
                      onClick={() => onQty(line.id, line.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="pos-mini-cart__add-btn"
                    aria-label={`Agregar ${p.name}`}
                    onClick={() => addProduct(p)}
                  >
                    <Plus aria-hidden strokeWidth={2.5} />
                  </button>
                )}
              </li>
            )
          })
        )}
      </ul>

      {cartOpen && lines.length > 0 ? (
        <div className="pos-mini-cart__drawer" aria-label="Resumen del carrito">
          <ul className="pos-mini-cart__drawer-list">
            {lines.map((line) => (
              <li key={line.id} className="pos-mini-cart__drawer-line">
                <span className="pos-mini-cart__drawer-name">{line.productName}</span>
                <span className="pos-mini-cart__drawer-qty mono">×{line.quantity}</span>
                <span className="pos-mini-cart__drawer-total mono">
                  {formatCOP(line.quantity * line.unitPrice)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <footer className="pos-mini-cart__footer">
        <button
          type="button"
          className="pos-mini-cart__summary"
          aria-expanded={cartOpen}
          disabled={lines.length === 0}
          onClick={() => lines.length > 0 && setCartOpen((v) => !v)}
        >
          <span className="pos-mini-cart__summary-icon" aria-hidden>
            <ShoppingBag strokeWidth={2} />
            {itemCount > 0 ? (
              <span className="pos-mini-cart__badge mono">{itemCount}</span>
            ) : null}
          </span>
          <span className="pos-mini-cart__summary-text">
            <span className="pos-mini-cart__summary-label">
              {itemCount === 0
                ? 'Carrito vacío'
                : `${itemCount} ${itemCount === 1 ? 'producto' : 'productos'}`}
            </span>
            <strong className="pos-mini-cart__summary-total mono">
              {formatCOP(totalCOP)}
            </strong>
          </span>
          {lines.length > 0 ? (
            cartOpen ? (
              <ChevronDown className="pos-mini-cart__chevron" aria-hidden />
            ) : (
              <ChevronUp className="pos-mini-cart__chevron" aria-hidden />
            )
          ) : null}
        </button>
        <button
          type="button"
          className="pos-btn pos-btn--primary pos-mini-cart__done"
          onClick={onClose}
        >
          Listo
        </button>
      </footer>
    </div>
  )
}
