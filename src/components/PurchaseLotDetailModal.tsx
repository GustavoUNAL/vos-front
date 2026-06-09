import { useEffect, useState } from 'react'
import { fetchPurchaseLot, type PurchaseLotRow } from '../api'
import {
  peekPurchaseLot,
  purchaseLotCacheKey,
  storePurchaseLot,
} from '../lib/entityCache'
import { readApiCache } from '../lib/apiCache'
import {
  formatPurchaseCOP,
  formatPurchaseLotDateLabel,
  formatPurchaseLotSupplierLabel,
  lotConsumptionStatusLabel,
  purchaseLotCompactRef,
  purchaseLotDisplayName,
  purchaseLotRowTotalCOP,
} from '../lib/purchaseLotUi'
import { Button } from './ui/button'

function GearPinionIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden>
      <path
        fill="currentColor"
        d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
      />
    </svg>
  )
}

type Props = {
  baseUrl: string
  lot: PurchaseLotRow
  onClose: () => void
  onEditLot?: (lotId: string, row: PurchaseLotRow) => void
}

function hasLineItems(row: PurchaseLotRow): boolean {
  return (row.items?.length ?? 0) > 0
}

export function PurchaseLotDetailModal({ baseUrl, lot, onClose, onEditLot }: Props) {
  const [detail, setDetail] = useState<PurchaseLotRow | null>(
    () => peekPurchaseLot(lot.id) ?? (hasLineItems(lot) ? lot : null),
  )
  const [loadingLines, setLoadingLines] = useState(
    () => !hasLineItems(lot) && !peekPurchaseLot(lot.id),
  )
  const [refreshing, setRefreshing] = useState(false)

  const shown = detail ?? lot
  const title = purchaseLotDisplayName(shown)
  const status = lotConsumptionStatusLabel(
    shown.inventoryMetrics?.consumptionStatus,
    shown.inventoryMetrics?.isDepleted,
  )
  const total = purchaseLotRowTotalCOP(shown)
  const items = shown.items ?? []

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    const cached = readApiCache<PurchaseLotRow>(purchaseLotCacheKey(lot.id))
    if (cached) {
      setDetail(cached.data)
      setLoadingLines(false)
      setRefreshing(!cached.stale ? false : true)
    } else if (hasLineItems(lot)) {
      setDetail(lot)
      setLoadingLines(false)
      setRefreshing(true)
    } else {
      setLoadingLines(true)
    }

    void fetchPurchaseLot(baseUrl, lot.id)
      .then((d) => {
        if (!cancelled) {
          storePurchaseLot(lot.id, d)
          setDetail(d)
        }
      })
      .catch(() => {
        if (!cancelled && !hasLineItems(lot) && !peekPurchaseLot(lot.id)) {
          setDetail(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingLines(false)
          setRefreshing(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [baseUrl, lot.id])

  const handleEdit = () => {
    if (!onEditLot) return
    onEditLot(lot.id, shown)
    onClose()
  }

  return (
    <div
      className="modal-backdrop sale-comanda-detail-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal sale-comanda-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle compra ${purchaseLotCompactRef(shown)}`}
      >
        <div className="sale-comanda-detail-modal__chrome">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Cerrar detalle"
          >
            ×
          </Button>
          {onEditLot ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleEdit}
              aria-label="Editar compra"
              title="Editar compra"
            >
              <GearPinionIcon />
            </Button>
          ) : null}
        </div>

        <div className="sale-comanda-detail-modal__body">
          {refreshing ? (
            <p className="muted small sale-comanda-detail-modal__sync">Actualizando…</p>
          ) : null}
          <dl className="sale-comanda-detail-modal__top-meta">
            <div>
              <dt>Referencia</dt>
              <dd className="mono">{purchaseLotCompactRef(shown)}</dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd>{formatPurchaseLotDateLabel(shown.purchaseDate, 'short')}</dd>
            </div>
            <div className="sale-comanda-detail-modal__top-meta-span">
              <dt>Lote</dt>
              <dd>{title}</dd>
            </div>
            <div className="sale-comanda-detail-modal__top-meta-span">
              <dt>Proveedor</dt>
              <dd>{formatPurchaseLotSupplierLabel(shown)}</dd>
            </div>
          </dl>

          {loadingLines ? (
            <p className="muted small">Cargando productos…</p>
          ) : items.length > 0 ? (
            <div className="cash-close-sale-item__lines">
              <table className="cash-close-lines-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="num">Cant.</th>
                    <th className="num">Costo</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((ln) => {
                    const q = Number(ln.quantity)
                    const unit = Number(ln.unitCost)
                    const lineTotal =
                      ln.purchase?.linePurchaseTotalCOP != null
                        ? Number(ln.purchase.linePurchaseTotalCOP)
                        : q * unit
                    return (
                      <tr key={ln.id ?? ln.name}>
                        <td>{ln.name}</td>
                        <td className="num mono">
                          {ln.quantity}
                          {ln.unit ? ` ${ln.unit}` : ''}
                        </td>
                        <td className="num mono">{formatPurchaseCOP(unit)}</td>
                        <td className="num mono">{formatPurchaseCOP(lineTotal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted small cash-close-sale-item__no-lines">
              {shown.itemCount > 0
                ? `${shown.itemCount} producto${shown.itemCount !== 1 ? 's' : ''} en el lote.`
                : 'Sin productos en el comprobante.'}
            </p>
          )}

          <div className="sale-comanda-detail-modal__summary">
            <div className="sale-comanda-detail-modal__total-row">
              <span className="sale-comanda-detail-modal__total-label">Total</span>
              <span className="sale-comanda-detail-modal__total-value mono">
                {formatPurchaseCOP(total)}
              </span>
            </div>
            <dl className="sale-comanda-detail-modal__bottom-meta">
              <div>
                <dt>Estado</dt>
                <dd>{status}</dd>
              </div>
              <div>
                <dt>Productos</dt>
                <dd>
                  {shown.inventoryMetrics?.productsCount ?? shown.itemCount}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
