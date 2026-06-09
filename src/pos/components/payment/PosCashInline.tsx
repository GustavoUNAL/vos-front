import { CASH_BILL_PRESETS_COP } from '../../constants'
import { formatCOP } from '../../lib/money'

type Props = {
  amountDueCOP: number
  tenderedCOP: number
  onTenderedChange: (value: number) => void
}

function formatBillLabel(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toLocaleString('es-CO')} mil`
  }
  return formatCOP(amount)
}

/** Efectivo compacto en comanda: billetes + tarjeta de cambio. */
export function PosCashInline({ amountDueCOP, tenderedCOP, onTenderedChange }: Props) {
  const change = tenderedCOP - amountDueCOP
  const canCover = tenderedCOP >= amountDueCOP

  return (
    <div className="pos-cash-inline">
      <div className="pos-cash-inline__bills" aria-label="Billetes rápidos">
        <button
          type="button"
          className="pos-cash-inline__bill"
          onClick={() => onTenderedChange(amountDueCOP)}
        >
          Exacto
        </button>
        {CASH_BILL_PRESETS_COP.map((bill) => (
          <button
            key={bill}
            type="button"
            className="pos-cash-inline__bill"
            onClick={() => onTenderedChange(tenderedCOP + bill)}
          >
            {formatBillLabel(bill)}
          </button>
        ))}
      </div>

      <label className="pos-cash-inline__field">
        <span className="sr-only">Con cuánto paga</span>
        <input
          type="number"
          className="pos-input pos-input--compact"
          min={0}
          step={500}
          inputMode="numeric"
          value={tenderedCOP || ''}
          onChange={(e) => onTenderedChange(Number(e.target.value) || 0)}
          placeholder={`Recibido · ${formatCOP(amountDueCOP)}`}
        />
      </label>

      <div
        className={`pos-cash-inline__change${canCover ? ' pos-cash-inline__change--ok' : tenderedCOP > 0 ? ' pos-cash-inline__change--low' : ' pos-cash-inline__change--idle'}`}
        role="status"
      >
        {tenderedCOP <= 0 ? (
          <span className="muted small">Ingresá el efectivo para ver el cambio</span>
        ) : canCover ? (
          <>
            <span>Cambio</span>
            <strong className="mono">{formatCOP(change)}</strong>
          </>
        ) : (
          <span className="small">
            Faltan <strong className="mono">{formatCOP(amountDueCOP - tenderedCOP)}</strong>
          </span>
        )}
      </div>
    </div>
  )
}
