import type { CategoryRef, ProductRow } from '../../../api'
import { formatCOP, parseMoney } from '../../lib/money'
import { PosEmpty } from '../ui/PosEmpty'

type Props = {
  products: ProductRow[]
  categories: CategoryRef[]
  activeCategoryId: string | null
  search: string
  highlightId?: string | null
  catalogError?: string | null
  onSearch: (v: string) => void
  onCategory: (id: string | null) => void
  onAdd: (p: { id: string; name: string; price: number }) => void
  onRetry?: () => void
}

function productPrice(p: ProductRow): number {
  return parseMoney(p.price)
}

export function ProductGrid({
  products,
  categories,
  activeCategoryId,
  search,
  highlightId,
  catalogError,
  onSearch,
  onCategory,
  onAdd,
  onRetry,
}: Props) {
  const filtered = products.filter((p) => {
    if (!p.active) return false
    if (activeCategoryId && p.categoryId !== activeCategoryId) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      if (!p.name.toLowerCase().includes(q)) return false
    }
    return true
  })

  if (catalogError && products.length === 0) {
    return (
      <PosEmpty
        title="Sin catálogo"
        hint={catalogError}
        action={
          onRetry ? (
            <button type="button" className="pos-btn pos-btn--primary" onClick={onRetry}>
              Reintentar
            </button>
          ) : undefined
        }
      />
    )
  }

  return (
    <div className="pos-products">
      <div className="pos-products__toolbar">
        <label className="pos-products__search-label">
          <span className="sr-only">Buscar productos</span>
          <input
            type="search"
            className="pos-input pos-input--search"
            placeholder="Buscar en la carta… (/)"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            aria-label="Buscar productos"
          />
        </label>
        <div className="pos-categories" role="tablist" aria-label="Categorías">
          <button
            type="button"
            role="tab"
            aria-selected={!activeCategoryId}
            className={`pos-chip${!activeCategoryId ? ' pos-chip--active' : ''}`}
            onClick={() => onCategory(null)}
          >
            Todos
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={activeCategoryId === c.id}
              className={`pos-chip${activeCategoryId === c.id ? ' pos-chip--active' : ''}`}
              onClick={() => onCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <PosEmpty
          title="Ningún producto coincide"
          hint={
            search.trim()
              ? 'Probá otro término o elegí «Todos»'
              : 'No hay productos en esta categoría'
          }
        />
      ) : (
        <div className="pos-product-grid">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`pos-product-tile${highlightId === p.id ? ' pos-product-tile--added' : ''}`}
              onClick={() =>
                onAdd({ id: p.id, name: p.name, price: productPrice(p) })
              }
            >
              <span className="pos-product-tile__name">{p.name}</span>
              <span className="pos-product-tile__price">{formatCOP(productPrice(p))}</span>
              <span className="pos-product-tile__action">+ Agregar</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
