import { useEffect, useRef } from 'react'

type Props = {
  open: boolean
  productName: string
  notes: string
  onNotesChange: (value: string) => void
  onClose: () => void
  onSave: () => void
}

export function PosOrderLineNoteModal({
  open,
  productName,
  notes,
  onNotesChange,
  onClose,
  onSave,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    const id = window.requestAnimationFrame(() => textareaRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [open])

  if (!open) return null

  return (
    <div className="pos-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="pos-modal pos-modal--note"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-order-line-note-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pos-modal__head">
          <h2 id="pos-order-line-note-title">Nota para cocina</h2>
          <button
            type="button"
            className="pos-btn pos-btn--ghost pos-btn--icon"
            aria-label="Cerrar"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <p className="pos-modal__status muted small">{productName}</p>

        <form
          className="pos-modal__form"
          onSubmit={(e) => {
            e.preventDefault()
            onSave()
          }}
        >
          <label className="pos-field">
            <span>Instrucciones</span>
            <textarea
              ref={textareaRef}
              className="pos-input pos-input--textarea"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Ej. sin azúcar, extra hielo…"
              rows={3}
            />
          </label>

          <footer className="pos-modal__actions">
            <button type="button" className="pos-btn pos-btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="pos-btn pos-btn--primary">
              Guardar
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
