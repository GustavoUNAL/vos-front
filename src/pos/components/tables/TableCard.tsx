import { useEffect, useRef, useState } from 'react'
import { TABLE_STATUS_LABEL } from '../../constants'
import { formatCOP } from '../../lib/money'
import { formatElapsedSince } from '../../lib/time'
import type { PosTable } from '../../types'

const STATUS_CLASS: Record<PosTable['status'], string> = {
  free: 'pos-table-card--free',
  occupied: 'pos-table-card--occupied',
  reserved: 'pos-table-card--reserved',
  closing: 'pos-table-card--closing',
}

type Props = {
  table: PosTable
  onOpen: () => void
  onEnter: () => void
  onClose: () => void
  onEdit: () => void
  onRename: (name: string) => Promise<void>
  onReserve?: () => void
  busy?: boolean
}

export function TableCard({
  table,
  onOpen,
  onEnter,
  onClose,
  onEdit,
  onRename,
  onReserve,
  busy,
}: Props) {
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(table.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editingName) setNameDraft(table.name)
  }, [table.name, editingName])

  useEffect(() => {
    if (editingName) inputRef.current?.focus()
  }, [editingName])

  const hasAccount = table.status === 'occupied' || table.status === 'closing'
  const canOpen = table.status === 'free' || table.status === 'reserved'

  const commitName = async () => {
    const next = nameDraft.trim()
    setEditingName(false)
    if (!next || next === table.name) return
    await onRename(next)
  }

  return (
    <article
      className={`pos-table-card ${STATUS_CLASS[table.status]}`}
      aria-label={`${table.name}, ${TABLE_STATUS_LABEL[table.status]}`}
    >
      <header className="pos-table-card__head">
        <span className="pos-table-card__number">{table.number}</span>
        <div className="pos-table-card__head-end">
          <span className={`pos-table-card__badge pos-table-card__badge--${table.status}`}>
            {TABLE_STATUS_LABEL[table.status]}
          </span>
          <button
            type="button"
            className="pos-table-card__edit"
            title="Más opciones de mesa"
            aria-label={`Opciones de ${table.name}`}
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
          >
            ⚙
          </button>
        </div>
      </header>

      {editingName ? (
        <div className="pos-table-card__name-edit">
          <input
            ref={inputRef}
            className="pos-input pos-table-card__name-input"
            value={nameDraft}
            disabled={busy}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void commitName()
              if (e.key === 'Escape') {
                setNameDraft(table.name)
                setEditingName(false)
              }
            }}
            onBlur={() => void commitName()}
            aria-label="Nombre de la mesa"
          />
        </div>
      ) : (
        <button
          type="button"
          className="pos-table-card__name-btn"
          disabled={busy}
          title="Tocá para cambiar el nombre"
          onClick={() => setEditingName(true)}
        >
          {table.name}
        </button>
      )}

      <div className="pos-table-card__body">
        <p className="pos-table-card__section muted small">
          {[table.section, table.capacity ? `${table.capacity} pax` : null]
            .filter(Boolean)
            .join(' · ') || '\u00A0'}
        </p>
        <div
          className={`pos-table-card__meta${hasAccount ? '' : ' pos-table-card__meta--empty'}`}
          aria-hidden={!hasAccount}
        >
          <span className="pos-table-card__total">
            {hasAccount ? formatCOP(table.totalCOP) : '—'}
          </span>
          <span className="pos-table-card__time muted">
            {hasAccount ? formatElapsedSince(table.openedAt) : '—'}
          </span>
        </div>
      </div>
      <div className="pos-table-card__actions">
        {canOpen && (
          <>
            <button
              type="button"
              className="pos-btn pos-btn--primary pos-btn--block"
              disabled={busy}
              onClick={onOpen}
            >
              Abrir cuenta
            </button>
            {table.status === 'free' && onReserve && (
              <button
                type="button"
                className="pos-btn pos-btn--ghost pos-btn--block"
                disabled={busy}
                onClick={onReserve}
              >
                Reservar
              </button>
            )}
            {table.status === 'reserved' && onReserve && (
              <button
                type="button"
                className="pos-btn pos-btn--ghost pos-btn--block"
                disabled={busy}
                onClick={onReserve}
              >
                Quitar reserva
              </button>
            )}
          </>
        )}
        {hasAccount && (
          <>
            <button
              type="button"
              className="pos-btn pos-btn--primary pos-btn--block"
              disabled={busy}
              onClick={onEnter}
            >
              Entrar a cuenta
            </button>
            <button
              type="button"
              className="pos-btn pos-btn--ghost pos-btn--block"
              disabled={busy}
              onClick={onClose}
            >
              {table.status === 'closing' ? 'Cobrar' : 'Cerrar mesa'}
            </button>
          </>
        )}
      </div>
    </article>
  )
}
