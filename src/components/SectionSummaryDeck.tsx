import { useEffect, useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  sectionSummaryHeading,
  type SectionSummaryItem,
  type SectionSummarySection,
} from './SectionSummaryBar'

export function SectionSummaryDeck({
  section,
  items,
  loading,
  suspendDetailWhileLoading,
  ariaLabel,
  modalSubtitle = 'Valores según filtros y página actuales.',
}: {
  section: SectionSummarySection
  items: SectionSummaryItem[]
  loading?: boolean
  /** Mientras `loading` es true, solo se muestra el estado de carga (sin botón). */
  suspendDetailWhileLoading?: boolean
  ariaLabel?: string
  modalSubtitle?: ReactNode
}) {
  const [detailOpen, setDetailOpen] = useState(false)
  const detailTitleId = useId()
  const detailDialogId = useId()
  const title = sectionSummaryHeading(section)
  const regionLabel = ariaLabel ?? title

  useEffect(() => {
    if (!detailOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detailOpen])

  if (!loading && items.length === 0) return null

  const loadingOnly = Boolean(
    loading && (suspendDetailWhileLoading || items.length === 0),
  )
  const showDetailTrigger = !loadingOnly && items.length > 0

  return (
    <div className="product-summary-deck" aria-label={regionLabel}>
      <h3 className="sr-only">{title}</h3>

      {loadingOnly && (
        <p className="product-summary-deck__status muted">Cargando resumen…</p>
      )}

      {showDetailTrigger && (
        <button
          type="button"
          className="btn-summary-detail btn-summary-detail--magnifier"
          aria-expanded={detailOpen}
          aria-controls={detailDialogId}
          aria-label={`Ver resumen: ${title}`}
          title="Ver resumen"
          onClick={() => setDetailOpen(true)}
        >
          <span className="btn-summary-detail__icon" aria-hidden />
        </button>
      )}

      {showDetailTrigger &&
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
                  <h2 id={detailTitleId}>{title}</h2>
                  {modalSubtitle ? (
                    <p className="muted small modal-subtitle">{modalSubtitle}</p>
                  ) : null}
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
                <div className="section-summary-pills-row section-summary-pills-row--in-modal">
                  {items.map((it) => (
                    <span
                      key={it.label}
                      className="section-summary-pill"
                      title={it.title}
                    >
                      <span className="section-summary-pill-label">
                        {it.label}
                      </span>
                      <strong className="section-summary-pill-value">
                        {it.value}
                      </strong>
                    </span>
                  ))}
                </div>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </div>
  )
}
