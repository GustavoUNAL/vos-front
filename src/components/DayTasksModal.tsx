import { useEffect } from 'react'
import { DayTasksListPanel } from './DayTasksListPanel'
import { Button } from './ui/button'
import type { AuthUser } from '../api'

function formatModalDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d, 12, 0, 0)
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(dt)
}

type Props = {
  baseUrl: string
  date: string
  user: AuthUser | null
  refreshKey?: number
  onClose: () => void
  onMutate?: () => void
}

export function DayTasksModal({
  baseUrl,
  date,
  user,
  refreshKey = 0,
  onClose,
  onMutate,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="modal-backdrop sales-day-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal sales-day-modal tasks-day-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tasks-day-modal-title"
      >
        <header className="sales-day-modal__head">
          <h2 id="tasks-day-modal-title" className="sales-day-modal__title">
            Tareas · {formatModalDate(date)}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </Button>
        </header>
        <div className="sales-day-modal__body">
          <DayTasksListPanel
            baseUrl={baseUrl}
            date={date}
            user={user}
            refreshKey={refreshKey}
            onMutate={onMutate}
          />
        </div>
      </div>
    </div>
  )
}
