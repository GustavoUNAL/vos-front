import { PosCashTender } from './PosCashTender'

type Props = {
  open: boolean
  amountCOP: number
  tenderedCOP: number
  onTenderedChange: (value: number) => void
  onClose: () => void
  requireCover?: boolean
}

export function PosCashSheet({
  open,
  amountCOP,
  tenderedCOP,
  onTenderedChange,
  onClose,
  requireCover = false,
}: Props) {
  if (!open) return null

  const canContinue = !requireCover || tenderedCOP >= amountCOP

  return (
    <div className="pos-transfer-sheet" role="presentation">
      <div
        className="pos-transfer-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-cash-sheet-title"
      >
        <header className="pos-transfer-sheet__head">
          <h2 id="pos-cash-sheet-title">Efectivo</h2>
          <button
            type="button"
            className="pos-transfer-sheet__close"
            aria-label="Cerrar"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="pos-transfer-sheet__scroll">
          <PosCashTender
            amountDueCOP={amountCOP}
            tenderedCOP={tenderedCOP}
            onTenderedChange={onTenderedChange}
          />
        </div>

        <footer className="pos-transfer-sheet__footer">
          <button
            type="button"
            className="pos-btn pos-btn--primary pos-btn--block pos-modal--payment__btn"
            disabled={!canContinue}
            onClick={onClose}
          >
            Listo
          </button>
        </footer>
      </div>
    </div>
  )
}
