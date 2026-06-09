import { useEffect } from 'react'
import { type PurchaseLotRow } from '../api'
import { DayPurchasesListPanel } from './DayPurchasesListPanel'
import { Button } from './ui/button'

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
  refreshKey?: number
  onClose: () => void
  onCreatePurchase: () => void
  onEditLot?: (lotId: string, row: PurchaseLotRow) => void
}

export function DayPurchasesModal({
  baseUrl,
  date,
  refreshKey = 0,
  onClose,
  onCreatePurchase,
  onEditLot,
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
        className="modal sales-day-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchases-day-modal-title"
      >
        <header className="sales-day-modal__head">
          <h2 id="purchases-day-modal-title" className="sales-day-modal__title">
            Compras · {formatModalDate(date)}
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
          <DayPurchasesListPanel
            baseUrl={baseUrl}
            date={date}
            refreshKey={refreshKey}
            onCreatePurchase={onCreatePurchase}
            onEditLot={onEditLot}
          />
        </div>
      </div>
    </div>
  )
}
