import { BarChart3 } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CategoryRef, ProductsCatalogSummary } from '../api'
import { Button } from './ui/button'

function formatCOP(n: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n)
}

function categoryLabel(categoryId: string, categories: CategoryRef[]): string {
  const hit = categories.find((c) => c.id === categoryId)
  return hit?.name ?? categoryId
}

type ProductSummaryCardProps = {
  summary: ProductsCatalogSummary | null
  categories: CategoryRef[]
  loading?: boolean
}

export function ProductSummaryCard({
  summary,
  categories,
  loading,
}: ProductSummaryCardProps) {
  const [detailOpen, setDetailOpen] = useState(false)
  const detailTitleId = useId()
  const detailDialogId = useId()

  useEffect(() => {
    if (!detailOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detailOpen])

  return (
    <div className="product-summary-deck" aria-label="Resumen de productos a la venta">
      <h3 className="sr-only">Resumen de productos a la venta</h3>

      {loading && !summary && (
        <p className="product-summary-deck__status muted">Calculando resumen…</p>
      )}

      {!loading && !summary && (
        <p className="product-summary-deck__status muted">
          No se pudo cargar el resumen.
        </p>
      )}

      {summary && (
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          className="btn-summary-detail shrink-0"
          aria-expanded={detailOpen}
          aria-controls={detailDialogId}
          aria-label="Ver resumen de productos a la venta"
          title="Ver resumen"
          onClick={() => setDetailOpen(true)}
        >
          <BarChart3 className="h-[1rem] w-[1.1rem]" strokeWidth={2} aria-hidden />
        </Button>
      )}

      {summary &&
        detailOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="modal-backdrop product-summary-detail-backdrop"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setDetailOpen(false)
            }}
          >
            <section
              id={detailDialogId}
              className="modal modal--popup product-summary-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby={detailTitleId}
            >
              <header className="modal-head">
                <div className="modal-head-title">
                  <h2 id={detailTitleId}>Productos a la venta</h2>
                  <p className="muted small modal-subtitle">
                    Vista global sin filtros de búsqueda.
                  </p>
                </div>
                <div className="modal-head-actions">
                  <button
                    type="button"
                    className="btn-ghost icon-close"
                    onClick={() => setDetailOpen(false)}
                    aria-label="Cerrar"
                  />
                </div>
              </header>
              <div className="modal-body">
                <dl className="product-summary-detail-stats">
                  <div>
                    <dt>Productos a la venta</dt>
                    <dd>{summary.total}</dd>
                  </div>
                  <div>
                    <dt>Categorías definidas</dt>
                    <dd>{categories.length}</dd>
                  </div>
                  <div>
                    <dt>Precio medio</dt>
                    <dd className="mono">{formatCOP(summary.averagePriceCOP)}</dd>
                  </div>
                </dl>
                <h3 className="product-summary-detail-section-title">Por categoría</h3>
                {summary.perCategory.length === 0 ? (
                  <p className="muted small">No hay reparto por categoría.</p>
                ) : (
                  <ul className="product-summary-detail-categories">
                    {summary.perCategory.map((row) => (
                      <li key={row.categoryId}>
                        <span className="product-summary-detail-categories__name">
                          {categoryLabel(row.categoryId, categories)}
                        </span>
                        <span className="product-summary-detail-categories__count mono">
                          {row.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>,
          document.body,
        )}
    </div>
  )
}
