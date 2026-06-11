import { useCallback, useMemo, useState } from 'react'
import {
  createPurchaseLot,
  type CreatePurchaseLotPayload,
} from '../api'
import { invalidateCalendarNamespace } from '../lib/calendarCache'
import { PurchaseReceiptCapture } from './PurchaseReceiptCapture'

type LineDraft = {
  key: string
  lineName: string
  quantity: string
  unit: string
  unitCost: string
}

function newLineKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function emptyLine(): LineDraft {
  return {
    key: newLineKey(),
    lineName: '',
    quantity: '1',
    unit: 'und',
    unitCost: '0',
  }
}

function todayInputValue(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function parseNum(v: string): number {
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

type Props = {
  baseUrl: string
  initialDate?: string
  onClose: () => void
  onCreated: (lotId: string) => void
}

export function CreateDailyPurchaseModal({
  baseUrl,
  initialDate,
  onClose,
  onCreated,
}: Props) {
  const [purchaseDate, setPurchaseDate] = useState(
    initialDate?.trim() || todayInputValue(),
  )
  const [supplier, setSupplier] = useState('')
  const [notes, setNotes] = useState('')
  const [receiptImageDataUrl, setReceiptImageDataUrl] = useState<string | null>(null)
  const [lines, setLines] = useState<LineDraft[]>(() => [emptyLine()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lineTotal = useMemo(() => {
    return lines.reduce((acc, row) => {
      const q = parseNum(row.quantity)
      const c = parseNum(row.unitCost)
      if (!Number.isFinite(q) || !Number.isFinite(c) || q <= 0) return acc
      return acc + Math.round(q * c)
    }, 0)
  }, [lines])

  const submit = useCallback(async () => {
    setError(null)
    const validLines: NonNullable<CreatePurchaseLotPayload['lines']> = []
    for (const row of lines) {
      const lineName = row.lineName.trim()
      const quantityPurchased = parseNum(row.quantity)
      const purchaseUnitCostCOP = Math.round(parseNum(row.unitCost))
      const unit = row.unit.trim() || 'und'
      if (!lineName) continue
      if (!Number.isFinite(quantityPurchased) || quantityPurchased <= 0) continue
      if (!Number.isFinite(purchaseUnitCostCOP) || purchaseUnitCostCOP < 0) continue
      validLines.push({
        lineName,
        quantityPurchased,
        unit,
        purchaseUnitCostCOP,
      })
    }

    if (validLines.length === 0) {
      setError('Agregá al menos una línea con nombre, cantidad y costo.')
      return
    }

    setSaving(true)
    try {
      const lot = await createPurchaseLot(baseUrl, {
        purchaseDate,
        supplier: supplier.trim() || undefined,
        notes: notes.trim() || undefined,
        lines: validLines,
        totalValue: lineTotal > 0 ? lineTotal : undefined,
        receiptImageDataUrl: receiptImageDataUrl?.trim() || undefined,
      })
      invalidateCalendarNamespace('purchases')
      onCreated(lot.id)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }, [baseUrl, lineTotal, lines, notes, onClose, onCreated, purchaseDate, receiptImageDataUrl, supplier])

  return (
    <div
      className="modal-backdrop modal-backdrop--product-submodal modal-backdrop--config"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section
        className="modal modal--config modal--config-xl modal--product-submodal modal--daily-purchase"
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-purchase-title"
      >
        <header className="modal-head modal-head--config modal-head--product-submodal">
          <div className="modal-head-title product-submodal-head__copy">
            <h2 id="daily-purchase-title">Registrar compra del día</h2>
            <p className="product-submodal-head__product muted small">
              Comprobante con proveedor, fecha y líneas de producto.
            </p>
          </div>
          <button
            type="button"
            className="product-editor-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <span aria-hidden>×</span>
          </button>
        </header>

        <div className="modal-body modal-body--config modal-body--product-submodal">
          <div className="daily-purchase-form">
            <div className="product-editor-grid-2">
              <label className="inventory-filter">
                <span className="inventory-filter__label">Fecha de compra</span>
                <input
                  className="inventory-filter__input"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </label>
              <label className="inventory-filter">
                <span className="inventory-filter__label">Proveedor</span>
                <input
                  className="inventory-filter__input"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Opcional"
                />
              </label>
            </div>
            <label className="inventory-filter">
              <span className="inventory-filter__label">Notas</span>
              <textarea
                className="input-cell product-editor-description-input"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Referencia de factura, observaciones…"
              />
            </label>

            <PurchaseReceiptCapture
              receiptDataUrl={receiptImageDataUrl}
              onReceiptChange={setReceiptImageDataUrl}
            />

            <div className="daily-purchase-lines">
              <div className="daily-purchase-lines__head">
                <h3 className="daily-purchase-lines__title">Líneas</h3>
                <button
                  type="button"
                  className="btn-secondary btn-compact"
                  onClick={() => setLines((prev) => [...prev, emptyLine()])}
                >
                  + Línea
                </button>
              </div>
              {lines.map((row) => (
                <div key={row.key} className="daily-purchase-line">
                  <input
                    className="input-cell"
                    value={row.lineName}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((r) =>
                          r.key === row.key
                            ? { ...r, lineName: e.target.value }
                            : r,
                        ),
                      )
                    }
                    placeholder="Producto / concepto"
                    aria-label="Nombre de línea"
                  />
                  <input
                    className="input-cell mono"
                    inputMode="decimal"
                    value={row.quantity}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((r) =>
                          r.key === row.key
                            ? { ...r, quantity: e.target.value }
                            : r,
                        ),
                      )
                    }
                    placeholder="Cant."
                    aria-label="Cantidad"
                  />
                  <input
                    className="input-cell"
                    value={row.unit}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((r) =>
                          r.key === row.key ? { ...r, unit: e.target.value } : r,
                        ),
                      )
                    }
                    placeholder="und"
                    aria-label="Unidad"
                  />
                  <input
                    className="input-cell mono"
                    inputMode="decimal"
                    value={row.unitCost}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((r) =>
                          r.key === row.key
                            ? { ...r, unitCost: e.target.value }
                            : r,
                        ),
                      )
                    }
                    placeholder="Costo u."
                    aria-label="Costo unitario COP"
                  />
                  {lines.length > 1 ? (
                    <button
                      type="button"
                      className="btn-secondary btn-compact daily-purchase-line__remove"
                      onClick={() =>
                        setLines((prev) => prev.filter((r) => r.key !== row.key))
                      }
                      aria-label="Quitar línea"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <p className="daily-purchase-total muted small">
              Total estimado:{' '}
              <strong className="mono">
                {new Intl.NumberFormat('es-CO', {
                  style: 'currency',
                  currency: 'COP',
                  maximumFractionDigits: 0,
                }).format(lineTotal)}
              </strong>
            </p>

            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>

        <footer className="product-editor-footer modal-footer--config product-submodal-footer product-submodal-footer--advanced">
          <button
            type="button"
            className="product-editor-btn product-editor-btn--secondary"
            disabled={saving}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="product-editor-btn product-editor-btn--primary"
            disabled={saving}
            onClick={() => void submit()}
          >
            {saving ? 'Guardando…' : 'Registrar compra'}
          </button>
        </footer>
      </section>
    </div>
  )
}
