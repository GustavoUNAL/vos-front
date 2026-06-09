import { useEffect } from 'react'
import { CashClosePanel } from './CashClosePanel'
import { Button } from './ui/button'

function formatModalDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d, 12, 0, 0)
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(dt)
}

type Props = {
  baseUrl: string
  date: string
  refreshKey?: number
  onClose: () => void
  onOpenSales?: (date: string) => void
  onOpenPurchases?: (date: string) => void
  companyName?: string | null
}

/** Detalle completo del día (solo Inicio). */
export function DayDetailModal({
  baseUrl,
  date,
  refreshKey = 0,
  onClose,
  onOpenSales,
  onOpenPurchases,
  companyName,
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
        className="modal sales-day-modal sales-day-modal--detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-detail-modal-title"
      >
        <header className="sales-day-modal__head">
          <h2 id="day-detail-modal-title" className="sales-day-modal__title">
            Detalle del día · {formatModalDate(date)}
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
          <CashClosePanel
            baseUrl={baseUrl}
            date={date}
            refreshKey={refreshKey}
            companyName={companyName}
            onOpenSales={onOpenSales}
            onOpenPurchases={onOpenPurchases}
          />
        </div>
      </div>
    </div>
  )
}
