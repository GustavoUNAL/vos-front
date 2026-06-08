import { useEffect, useState } from 'react'
import {
  fetchInventoryOptions,
  fetchProduct,
  parseProductRecipeFull,
  type InventoryOption,
  type ProductRecipeFull,
} from '../api'
import { RecipeEditor } from './RecipeEditor'

type ProductRecipePopupProps = {
  baseUrl: string
  productId: string
  productName: string
  initialRecipe: unknown
  onClose: () => void
  onRecipeUpdated: (recipe: ProductRecipeFull | null) => void
}

export function ProductRecipePopup({
  baseUrl,
  productId,
  productName,
  initialRecipe,
  onClose,
  onRecipeUpdated,
}: ProductRecipePopupProps) {
  const [inventory, setInventory] = useState<InventoryOption[]>([])
  const [recipe, setRecipe] = useState<ProductRecipeFull | null>(() =>
    parseProductRecipeFull(initialRecipe),
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      fetchInventoryOptions(baseUrl),
      fetchProduct(baseUrl, productId),
    ])
      .then(([inv, product]) => {
        if (cancelled) return
        setInventory(inv)
        const r =
          'recipe' in product && product.recipe != null
            ? parseProductRecipeFull(product.recipe)
            : parseProductRecipeFull(initialRecipe)
        setRecipe(r)
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
  }, [baseUrl, productId, initialRecipe])

  return (
    <div
      className="modal-backdrop modal-backdrop--config modal-backdrop--product-submodal"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section
        className="modal modal--config modal--config-xl modal--recipe-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-recipe-popup-title"
      >
        <header className="modal-head modal-head--config modal-head--product-submodal">
          <div className="modal-head-title product-submodal-head__copy">
            <h2 id="product-recipe-popup-title">Receta del producto</h2>
            <p className="product-submodal-head__product">{productName.trim() || 'Sin nombre'}</p>
          </div>
          <button
            type="button"
            className="product-editor-close"
            onClick={onClose}
            aria-label="Cerrar receta"
          >
            <span aria-hidden>×</span>
          </button>
        </header>

        <div className="modal-body modal-body--config modal-body--recipe-editor">
          {loading ? <p className="muted">Cargando receta e insumos…</p> : null}
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          {!loading && !error ? (
            <RecipeEditor
              baseUrl={baseUrl}
              productId={productId}
              recipe={recipe}
              inventory={inventory}
              compact
              onRecipeUpdated={(r) => {
                setRecipe(r)
                onRecipeUpdated(r)
              }}
            />
          ) : null}
        </div>

        <footer className="product-editor-footer modal-footer--config product-submodal-footer">
          <button
            type="button"
            className="product-editor-btn product-editor-btn--secondary"
            onClick={onClose}
          >
            Cerrar
          </button>
        </footer>
      </section>
    </div>
  )
}
