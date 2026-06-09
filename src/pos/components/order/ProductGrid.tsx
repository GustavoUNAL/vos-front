import type { RefObject } from 'react'
import { useMemo } from 'react'
import type { CategoryRef, ProductRow } from '../../../api'
import { formatCOP, parseMoney } from '../../lib/money'
import {
  filterProductsForPos,
  sortProductsForPos,
} from '../../lib/productSearch'
import { PosEmpty } from '../ui/PosEmpty'

type Props = {
  products: ProductRow[]
  categories: CategoryRef[]
  activeCategoryId: string | null
  search: string
  highlightId?: string | null
  catalogError?: string | null
  searchInputRef?: RefObject<HTMLInputElement | null>
  searchOpen?: boolean
  topProductIds?: string[]
  unitsSoldByProductId?: Map<string, number>
  onSearch: (v: string) => void
  onCategory: (id: string | null) => void
  onAdd: (p: { id: string; name: string; price: number }) => void
  onRetry?: () => void
}

function productPrice(p: ProductRow): number {
  return parseMoney(p.price)
}

function ProductTile({
  product,
  highlightId,
  badge,
  onAdd,
}: {
  product: ProductRow
  highlightId?: string | null
  badge?: string | null
  onAdd: (p: { id: string; name: string; price: number }) => void
}) {
  return (
    <button
      type="button"
      className={`pos-product-tile pos-product-tile--subtle${highlightId === product.id ? ' pos-product-tile--added' : ''}${badge ? ' pos-product-tile--featured' : ''}`}
      onClick={() =>
        onAdd({
          id: product.id,
          name: product.name,
          price: productPrice(product),
        })
      }
    >
      {badge ? (
        <span className="pos-product-tile__badge" aria-hidden>
          {badge}
        </span>
      ) : null}
      <span className="pos-product-tile__name">{product.name}</span>
      <span className="pos-product-tile__price">{formatCOP(productPrice(product))}</span>
    </button>
  )
}

export function ProductGrid({
  products,
  categories,
  activeCategoryId,
  search,
  highlightId,
  catalogError,
  searchInputRef,
  searchOpen = true,
  topProductIds = [],
  unitsSoldByProductId = new Map(),
  onSearch,
  onCategory,
  onAdd,
  onRetry,
}: Props) {
  const showFeatured = !search.trim() && !activeCategoryId && topProductIds.length > 0

  const filtered = useMemo(() => {
    const base = filterProductsForPos(products, { activeCategoryId, search })
    return sortProductsForPos(base, {
      search,
      salesUnitsByProductId: unitsSoldByProductId,
    })
  }, [products, activeCategoryId, search, unitsSoldByProductId])

  const productById = useMemo(() => {
    const map = new Map<string, ProductRow>()
    for (const p of products) {
      if (p.active) map.set(p.id, p)
    }
    return map
  }, [products])

  const featuredProducts = useMemo(() => {
    if (!showFeatured) return [] as ProductRow[]
    return topProductIds
      .map((id) => productById.get(id))
      .filter((p): p is ProductRow => Boolean(p))
      .slice(0, 8)
  }, [showFeatured, topProductIds, productById])

  const featuredIds = useMemo(
    () => new Set(featuredProducts.map((p) => p.id)),
    [featuredProducts],
  )

  const gridProducts = showFeatured
    ? filtered.filter((p) => !featuredIds.has(p.id))
    : filtered

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
        {searchOpen ? (
          <label className="pos-products__search-label">
            <span className="sr-only">Buscar productos</span>
            <input
              ref={searchInputRef}
              type="search"
              className="pos-input pos-input--search"
              placeholder="Buscar nombre o código… (/)"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              aria-label="Buscar productos"
              autoComplete="off"
              enterKeyHint="search"
            />
          </label>
        ) : null}
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

      {showFeatured ? (
        <section className="pos-products__featured" aria-label="Más vendidos">
          <div className="pos-products__featured-head">
            <h2 className="pos-products__featured-title">Más vendidos</h2>
            <p className="pos-products__featured-hint muted small">
              Según ventas recientes
            </p>
          </div>
          <div className="pos-products__featured-scroll">
            {featuredProducts.map((p, index) => (
              <ProductTile
                key={p.id}
                product={p}
                highlightId={highlightId}
                badge={index < 3 ? `#${index + 1}` : '★'}
                onAdd={onAdd}
              />
            ))}
          </div>
        </section>
      ) : null}

      {filtered.length === 0 ? (
        <PosEmpty
          title="Ningún producto coincide"
          hint={
            search.trim()
              ? 'Probá otro término, código o elegí «Todos»'
              : 'No hay productos en esta categoría'
          }
        />
      ) : (
        <>
          {showFeatured && gridProducts.length > 0 ? (
            <h2 className="pos-products__section-title">Resto de la carta</h2>
          ) : null}
          <div className="pos-product-grid">
            {(showFeatured ? gridProducts : filtered).map((p) => (
              <ProductTile
                key={p.id}
                product={p}
                highlightId={highlightId}
                badge={
                  !search.trim() &&
                  !activeCategoryId &&
                  topProductIds.slice(0, 3).includes(p.id)
                    ? '★'
                    : null
                }
                onAdd={onAdd}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
