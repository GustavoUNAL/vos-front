import type { RefObject } from 'react'
import { ChevronDown, ChevronUp, Plus, Search, ShoppingBag } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { stripInventoryCategoryPrefix } from '../../../inventorySemantics'
import type { CategoryRef, ProductRow } from '../../../api'
import { formatCOP, parseMoney } from '../../lib/money'
import { isPosOpenProduct, openProductPriceLabel } from '../../lib/openProduct'
import {
  filterProductsForPos,
  pinPosFeaturedCombos,
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

function isComboCategory(category: CategoryRef): boolean {
  const slug = (category.slug ?? '').toLowerCase()
  if (slug === 'combos' || slug === 'combo') return true
  return /combo/i.test(category.name)
}

function posSaleCategories(
  categories: CategoryRef[],
  products: ProductRow[],
): CategoryRef[] {
  const byId = new Map<string, CategoryRef>()
  for (const category of categories) byId.set(category.id, category)
  for (const product of products) {
    if (product.category?.id) byId.set(product.category.id, product.category)
  }

  const list = [...byId.values()].filter((category) => {
    const slug = (category.slug ?? '').toLowerCase()
    if (slug === 'insumos') return false
    return !/^inventory::/i.test(category.name)
  })

  list.sort((a, b) => {
    const aCombo = isComboCategory(a)
    const bCombo = isComboCategory(b)
    if (aCombo !== bCombo) return aCombo ? -1 : 1
    return 0
  })
  return list
}

function lineForProduct(lines: OrderLine[], productId: string): OrderLine | undefined {
  return lines.find((l) => l.productId === productId)
}

export function PosMiniCartPicker({
  products,
  categories,
  lines,
  totalCOP,
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

  const saleCategories = useMemo(
    () => posSaleCategories(categories, products),
    [categories, products],
  )

  const filtered = useMemo(() => {
    const base = filterProductsForPos(products, { activeCategoryId: categoryId, search })
    const sorted = sortProductsForPos(base, {
      search,
      salesUnitsByProductId: unitsSoldByProductId,
    })
    return pinPosFeaturedCombos(sorted, categoryId ? base : products)
  }, [products, categoryId, search, unitsSoldByProductId])

  const addProduct = (p: ProductRow) => {
    onAdd({ id: p.id, name: p.name, price: parseMoney(p.price) })
  }

  return (
    <div className="pos-mini-cart" aria-label="Agregar productos">
      <header className="pos-mini-cart__head">
        <h2 className="pos-mini-cart__title">Agregar productos</h2>
      </header>
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
          {saleCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={categoryId === c.id}
              className={`pos-mini-cart__chip${categoryId === c.id ? ' pos-mini-cart__chip--active' : ''}`}
              onClick={() => setCategoryId(c.id)}
            >
              {stripInventoryCategoryPrefix(c.name) || c.name}
            </button>
          ))}
        </div>
      </div>

      <ul className="pos-mini-cart__catalog">
        {filtered.length === 0 ? (
          <li className="pos-mini-cart__empty muted small">Sin coincidencias en la carta.</li>
        ) : (
          filtered.map((p) => {
            const openItem = isPosOpenProduct(p)
            const line = openItem ? undefined : lineForProduct(lines, p.id)
            const price = parseMoney(p.price)
            return (
              <li
                key={p.id}
                className={`pos-mini-cart__row${line ? ' pos-mini-cart__row--active' : ''}${highlightId === p.id ? ' pos-mini-cart__row--flash' : ''}`}
              >
                <div className="pos-mini-cart__row-main">
                  <span className="pos-mini-cart__row-name">{p.name}</span>
                  <span className="pos-mini-cart__row-price mono">
                    {openItem ? openProductPriceLabel() : formatCOP(price)}
                  </span>
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
