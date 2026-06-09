import {
  saleDisplayClient,
  saleDisplayCode,
  saleDisplayExtras,
  saleDisplayTime,
  type SaleRowDisplayInput,
} from '../lib/saleListDisplay'

type Props = {
  row: SaleRowDisplayInput
  showDate?: string | null
  className?: string
}

/** Resumen compacto de una venta para listas y calendario. */
export function SaleListRowPreview({ row, showDate, className }: Props) {
  const id = saleDisplayCode(row)
  const client = saleDisplayClient(row)
  const time = saleDisplayTime(row.saleDate)
  const extras = saleDisplayExtras(row)

  return (
    <span className={`sale-row-preview${className ? ` ${className}` : ''}`}>
      <span className="sale-row-preview__primary">
        <span className="sale-row-preview__id mono" title={row.id}>
          {id}
        </span>
        <span className="sale-row-preview__client">{client}</span>
      </span>
      <span className="sale-row-preview__secondary muted small">
        {showDate ? (
          <>
            <span>{showDate}</span>
            <span aria-hidden> · </span>
          </>
        ) : null}
        <span className="sale-row-preview__time">{time}</span>
        {extras.length > 0 ? (
          <>
            <span aria-hidden> · </span>
            <span className="sale-row-preview__extras">{extras.join(' · ')}</span>
          </>
        ) : null}
      </span>
    </span>
  )
}
