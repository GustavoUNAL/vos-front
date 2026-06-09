import { useState } from 'react'
import { fetchPurchaseLot, type PurchaseLotRow } from '../api'
import { prefetchPurchaseLot } from '../lib/entityCache'
import {
  formatPurchaseCOP,
  formatPurchaseLotSupplierLabel,
  lotConsumptionStatusLabel,
  purchaseLotCompactRef,
  purchaseLotDisplayName,
  purchaseLotRowTotalCOP,
} from '../lib/purchaseLotUi'
import { PurchaseLotDetailModal } from './PurchaseLotDetailModal'

type Props = {
  baseUrl: string
  lots: PurchaseLotRow[]
  emptyMessage?: string
  onEditLot?: (lotId: string, row: PurchaseLotRow) => void
}

export function DayPurchaseLotsList({
  baseUrl,
  lots,
  emptyMessage = 'No hay compras este día.',
  onEditLot,
}: Props) {
  const [detailLot, setDetailLot] = useState<PurchaseLotRow | null>(null)

  if (lots.length === 0) {
    return <p className="muted small cash-close-panel__empty">{emptyMessage}</p>
  }

  return (
    <>
      <ul className="cash-close-panel__sales">
        {lots.map((row) => {
          const primary = purchaseLotDisplayName(row)
          const supplier = formatPurchaseLotSupplierLabel(row)
          const status = lotConsumptionStatusLabel(
            row.inventoryMetrics?.consumptionStatus,
            row.inventoryMetrics?.isDepleted,
          )
          return (
            <li key={row.id} className="cash-close-sale-item">
              <button
                type="button"
                className="cash-close-sale-item__head"
                aria-haspopup="dialog"
                onClick={() => setDetailLot(row)}
                onMouseEnter={() =>
                  prefetchPurchaseLot(baseUrl, row.id, fetchPurchaseLot)
                }
                onFocus={() =>
                  prefetchPurchaseLot(baseUrl, row.id, fetchPurchaseLot)
                }
              >
                <span className="cash-close-sale-item__main">
                  <span className="cash-close-sale-item__label">{primary}</span>
                  <span className="cash-close-sale-item__ref mono muted">
                    {purchaseLotCompactRef(row)}
                  </span>
                  <span className="cash-close-sale-item__time muted">
                    {supplier} · {status}
                  </span>
                </span>
                <span className="cash-close-sale-item__total mono">
                  {formatPurchaseCOP(purchaseLotRowTotalCOP(row))}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {detailLot ? (
        <PurchaseLotDetailModal
          baseUrl={baseUrl}
          lot={detailLot}
          onClose={() => setDetailLot(null)}
          onEditLot={onEditLot}
        />
      ) : null}
    </>
  )
}
