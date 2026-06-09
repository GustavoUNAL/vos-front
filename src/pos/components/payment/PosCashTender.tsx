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

export function PosCashTender({
  amountDueCOP,
  tenderedCOP,
  onTenderedChange,
}: Props) {
  const change = tenderedCOP - amountDueCOP
  const canCover = tenderedCOP >= amountDueCOP

  return (
    <div className="pos-cash-tender">
      <div className="pos-cash-tender__head">
        <span className="pos-cash-tender__title">Efectivo recibido</span>
        <button
          type="button"
          className="pos-cash-tender__exact"
          onClick={() => onTenderedChange(amountDueCOP)}
        >
          Monto exacto
        </button>
      </div>

      <div className="pos-cash-tender__bills" aria-label="Billetes rápidos">
        {CASH_BILL_PRESETS_COP.map((bill) => (
          <button
            key={bill}
            type="button"
            className="pos-cash-tender__bill"
            onClick={() => onTenderedChange(tenderedCOP + bill)}
          >
            {formatBillLabel(bill)}
          </button>
        ))}
      </div>

      <label className="pos-field pos-field--inline">
        <span>Con cuánto paga</span>
        <input
          type="number"
          className="pos-input"
          min={0}
          step={500}
          inputMode="numeric"
          value={tenderedCOP || ''}
          onChange={(e) => onTenderedChange(Number(e.target.value) || 0)}
          placeholder={String(amountDueCOP)}
        />
      </label>

      {tenderedCOP > 0 ? (
        <div
          className={`pos-cash-tender__change${canCover ? ' pos-cash-tender__change--ok' : ' pos-cash-tender__change--low'}`}
          role="status"
        >
          {canCover ? (
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
      ) : null}
    </div>
  )
}
