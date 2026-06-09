import { useEffect } from 'react'
import { CashClosePanel } from './CashClosePanel'
import { Button } from './ui/button'

type Props = {
  baseUrl: string
  date: string
  refreshKey?: number
  onClose: () => void
  onEditSale: (saleId: string) => void
  onCreateSale: () => void
}

export function DaySalesModal({
  baseUrl,
  date,
  refreshKey = 0,
  onClose,
  onEditSale,
  onCreateSale,
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
            Ventas del día
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
            onEditSale={onEditSale}
            onCreateSale={onCreateSale}
          />
        </div>
      </div>
    </div>
  )
}
