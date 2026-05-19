import { useEffect, useState } from 'react'
import { TABLE_SECTION_PRESETS, TABLE_STATUS_LABEL } from '../../constants'
import type { CreateTablePayload, PosTable, UpdateTablePayload } from '../../types'

type Props = {
  table: PosTable | null
  mode: 'edit' | 'create'
  nextNumber: number
  open: boolean
  busy?: boolean
  onClose: () => void
  onSave: (payload: UpdateTablePayload | CreateTablePayload) => Promise<void>
}

export function TableEditModal({
  table,
  mode,
  nextNumber,
  open,
  busy,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState('')
  const [number, setNumber] = useState(1)
  const [section, setSection] = useState('')
  const [capacity, setCapacity] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (mode === 'create') {
      setName(`Mesa ${nextNumber}`)
      setNumber(nextNumber)
      setSection('')
      setCapacity('4')
      setNotes('')
      return
    }
    if (table) {
      setName(table.name)
      setNumber(table.number)
      setSection(table.section ?? '')
      setCapacity(table.capacity != null ? String(table.capacity) : '')
      setNotes(table.notes ?? '')
    }
  }, [open, mode, table, nextNumber])

  if (!open) return null

  const locked =
    mode === 'edit' &&
    table != null &&
    (table.status === 'occupied' || table.status === 'closing')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('El nombre es obligatorio')
      return
    }
    if (!Number.isFinite(number) || number < 1) {
      setError('Número de mesa inválido')
      return
    }
    const cap = capacity.trim() ? Number(capacity) : undefined
    if (cap !== undefined && (!Number.isFinite(cap) || cap < 1)) {
      setError('Capacidad inválida')
      return
    }
    const payload = {
      name: trimmedName,
      number,
      section: section.trim() || null,
      capacity: cap,
      notes: notes.trim() || null,
    }
    try {
      await onSave(payload)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    }
  }

  return (
    <div className="pos-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="pos-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-table-edit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pos-modal__head">
          <h2 id="pos-table-edit-title">
            {mode === 'create' ? 'Nueva mesa' : 'Editar mesa'}
          </h2>
          <button
            type="button"
            className="pos-btn pos-btn--ghost pos-btn--icon"
            aria-label="Cerrar"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {table && mode === 'edit' && (
          <p className="pos-modal__status muted small">
            Estado: {TABLE_STATUS_LABEL[table.status]}
            {locked && ' · El número no se puede cambiar con cuenta abierta'}
          </p>
        )}

        <form className="pos-modal__form" onSubmit={(e) => void submit(e)}>
          <label className="pos-field">
            <span>Nombre</span>
            <input
              className="pos-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Mesa terraza 3"
              required
            />
          </label>

          <label className="pos-field">
            <span>Número</span>
            <input
              type="number"
              className="pos-input"
              min={1}
              value={number}
              disabled={locked}
              onChange={(e) => setNumber(Number(e.target.value))}
              required
            />
          </label>

          <label className="pos-field">
            <span>Zona / sección</span>
            <input
              className="pos-input"
              list="pos-section-presets"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="Salón, Terraza…"
            />
            <datalist id="pos-section-presets">
              {TABLE_SECTION_PRESETS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>

          <label className="pos-field">
            <span>Capacidad (comensales)</span>
            <input
              type="number"
              className="pos-input"
              min={1}
              max={99}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Opcional"
            />
          </label>

          <label className="pos-field">
            <span>Notas internas</span>
            <textarea
              className="pos-input pos-input--textarea"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. junto a ventana, solo reservas…"
            />
          </label>

          {error && (
            <p className="pos-modal__error" role="alert">
              {error}
            </p>
          )}

          <footer className="pos-modal__actions">
            <button
              type="button"
              className="pos-btn pos-btn--ghost"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="pos-btn pos-btn--primary"
              disabled={busy}
            >
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
