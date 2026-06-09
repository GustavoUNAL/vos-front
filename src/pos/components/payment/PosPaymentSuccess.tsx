import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'

const AUTO_RETURN_MS = 2600

type Props = {
  saleId: string
  dailyCount: number
  onDone: () => void
}

function dailySalesLabel(count: number): string {
  if (count === 1) return '1 venta registrada en el día'
  return `${count} ventas registradas en el día`
}

export function PosPaymentSuccess({ saleId, dailyCount, onDone }: Props) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter')

  useEffect(() => {
    const holdTimer = window.setTimeout(() => setPhase('hold'), 520)
    const exitTimer = window.setTimeout(() => setPhase('exit'), AUTO_RETURN_MS - 280)
    const doneTimer = window.setTimeout(() => onDone(), AUTO_RETURN_MS)
    return () => {
      window.clearTimeout(holdTimer)
      window.clearTimeout(exitTimer)
      window.clearTimeout(doneTimer)
    }
  }, [onDone])

  return (
    <div
      className={`pos-payment-success pos-payment-success--overlay pos-payment-success--${phase}`}
      role="status"
      aria-live="polite"
      aria-label={`Listo. ${dailySalesLabel(dailyCount)}. ID ${saleId}`}
    >
      <div className="pos-payment-success__burst" aria-hidden />
      <div className="pos-payment-success__card">
        <div className="pos-payment-success__icon-wrap" aria-hidden>
          <span className="pos-payment-success__ring" />
          <Check className="pos-payment-success__icon" strokeWidth={2.75} />
        </div>
        <p className="pos-payment-success__title">¡Listo!</p>
        <p className="pos-payment-success__daily">{dailySalesLabel(dailyCount)}</p>
        <p className="pos-payment-success__sale-id mono">{saleId}</p>
      </div>
    </div>
  )
}
