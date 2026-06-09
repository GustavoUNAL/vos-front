import { useEffect } from 'react'
import { DaySalesListPanel } from './DaySalesListPanel'
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
  onCreateSale: () => void
  onEditSale?: (saleId: string) => void
  companyName?: string | null
}

export function DaySalesModal({
  baseUrl,
  date,
  refreshKey = 0,
  onClose,
  onCreateSale,
  onEditSale,
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
        className="modal sales-day-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sales-day-modal-title"
      >
        <header className="sales-day-modal__head">
          <h2 id="sales-day-modal-title" className="sales-day-modal__title">
            Comandas · {formatModalDate(date)}
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
          <DaySalesListPanel
            baseUrl={baseUrl}
            date={date}
            refreshKey={refreshKey}
            onCreateSale={onCreateSale}
            onEditSale={onEditSale}
            companyName={companyName}
          />
        </div>
      </div>
    </div>
  )
}
