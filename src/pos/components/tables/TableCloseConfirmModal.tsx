import { useEffect, useState } from 'react'
import { formatCOP } from '../../lib/money'
import type { PosTable } from '../../types'

type Props = {
  open: boolean
  table: PosTable | null
  busy?: boolean
  onClose: () => void
  onCloseWithoutPay: () => void
  onGoToPay: () => void
}

export function TableCloseConfirmModal({
  open,
  table,
  busy,
  onClose,
  onCloseWithoutPay,
  onGoToPay,
}: Props) {
  const [step, setStep] = useState<'choose' | 'confirm-no-pay'>('choose')

  useEffect(() => {
    if (!open) setStep('choose')
  }, [open])

  if (!open || !table) return null

  const hasTotal = table.totalCOP > 0

  return (
    <div className="pos-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="pos-modal pos-modal--close-table"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-close-table-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pos-modal__head">
          <h2 id="pos-close-table-title">
            {step === 'confirm-no-pay' ? '¿Cerrar sin cobrar?' : `Cerrar ${table.name}`}
          </h2>
          <button
            type="button"
            className="pos-btn pos-btn--ghost pos-btn--icon"
            aria-label="Cerrar"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {step === 'choose' ? (
          <>
            <p className="pos-modal__text muted">
              {hasTotal ? (
                <>
                  La cuenta tiene un total de <strong>{formatCOP(table.totalCOP)}</strong>.
                  ¿Qué querés hacer?
                </>
              ) : (
                <>¿Querés liberar la mesa o ir al cobro?</>
              )}
            </p>

            <footer className="pos-modal__actions pos-modal__actions--stack">
              <button
                type="button"
                className="pos-btn pos-btn--primary pos-btn--block"
                disabled={busy}
                onClick={onGoToPay}
              >
                Confirmar cobrando
              </button>
              <button
                type="button"
                className="pos-btn pos-btn--ghost pos-btn--block"
                disabled={busy}
                onClick={() => setStep('confirm-no-pay')}
              >
                Cerrar sin cobrar
              </button>
              <button
                type="button"
                className="pos-btn pos-btn--ghost pos-btn--block pos-btn--subtle"
                disabled={busy}
                onClick={onClose}
              >
                Cancelar
              </button>
            </footer>
          </>
        ) : (
          <>
            <p className="pos-modal__text muted">
              {hasTotal ? (
                <>
                  Vas a liberar <strong>{table.name}</strong> sin registrar el cobro de{' '}
                  <strong>{formatCOP(table.totalCOP)}</strong>. Los ítems de la cuenta se
                  descartarán.
                </>
              ) : (
                <>
                  Vas a liberar <strong>{table.name}</strong> sin cobrar. La cuenta abierta se
                  cancelará.
                </>
              )}
            </p>
            <p className="pos-modal__text pos-modal__text--warn">
              ¿Estás seguro? Esta acción no se puede deshacer.
            </p>

            <footer className="pos-modal__actions pos-modal__actions--stack">
              <button
                type="button"
                className="pos-btn pos-btn--ghost pos-btn--danger-text pos-btn--block"
                disabled={busy}
                onClick={onCloseWithoutPay}
              >
                Sí, cerrar sin cobrar
              </button>
              <button
                type="button"
                className="pos-btn pos-btn--ghost pos-btn--block"
                disabled={busy}
                onClick={() => setStep('choose')}
              >
                Volver
              </button>
              <button
                type="button"
                className="pos-btn pos-btn--ghost pos-btn--block pos-btn--subtle"
                disabled={busy}
                onClick={onClose}
              >
                Cancelar
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
