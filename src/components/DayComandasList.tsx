import { useState } from 'react'
import { type DailyCashClose } from '../api'
import {
  saleDisplayClient,
  saleDisplayCode,
  saleDisplayExtras,
  saleDisplayTime,
} from '../lib/saleListDisplay'
import { SaleComandaDetailModal } from './SaleComandaDetailModal'

function formatCOP(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

type DayComandasListProps = {
  baseUrl: string
  sales: DailyCashClose['sales']
  emptyMessage?: string
  companyName?: string | null
  onEditSale?: (saleId: string) => void
}

export function DayComandasList({
  baseUrl,
  sales,
  emptyMessage = 'No hay comandas este día.',
  companyName,
  onEditSale,
}: DayComandasListProps) {
  const [detailSale, setDetailSale] = useState<DailyCashClose['sales'][number] | null>(
    null,
  )

  if (sales.length === 0) {
    return <p className="muted small cash-close-panel__empty">{emptyMessage}</p>
  }

  return (
    <>
      <ul className="cash-close-panel__sales">
        {sales.map((s) => {
          const display = {
            id: s.id,
            code: s.code,
            saleDate: s.saleDate,
            mesa: s.mesa,
            customer: s.customer,
            paymentMethod: s.paymentMethod,
            notes: s.notes,
            source: s.source,
            lineCount: s.lineCount,
            customerPhone: s.customerPhone,
          }
          const client = saleDisplayClient(display)
          const extras = saleDisplayExtras(display)
          return (
            <li key={s.id} className="cash-close-sale-item">
              <button
                type="button"
                className="cash-close-sale-item__head cash-close-sale-item__head--rich"
                aria-haspopup="dialog"
                onClick={() => setDetailSale(s)}
              >
                <span className="cash-close-sale-item__main cash-close-sale-item__main--rich">
                  <span className="cash-close-sale-item__topline">
                    <span className="cash-close-sale-item__id mono">
                      {saleDisplayCode(display)}
                    </span>
                    <span className="cash-close-sale-item__time muted">
                      {saleDisplayTime(s.saleDate)}
                    </span>
                  </span>
                  <span className="cash-close-sale-item__label">{client}</span>
                  {extras.length > 0 ? (
                    <span className="cash-close-sale-item__meta-line muted small">
                      {extras.join(' · ')}
                    </span>
                  ) : null}
                </span>
                <span className="cash-close-sale-item__total mono">
                  {formatCOP(s.total)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {detailSale ? (
        <SaleComandaDetailModal
          baseUrl={baseUrl}
          sale={detailSale}
          companyName={companyName}
          onClose={() => setDetailSale(null)}
          onEditSale={onEditSale}
        />
      ) : null}
    </>
  )
}
