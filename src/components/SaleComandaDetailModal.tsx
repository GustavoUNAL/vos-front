import { useEffect, useState } from 'react'
import {
  downloadSaleInvoicePdf,
  sendSaleReceiptWhatsApp,
  type DailyCashClose,
} from '../api'
import { resolveInvoiceContact } from '../config/invoiceBranding'
import { downloadSaleReceiptImage } from '../lib/saleReceiptImage'
import { Button } from './ui/button'

type Sale = DailyCashClose['sales'][number]

function formatCOP(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatSaleTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

function saleCompactRef(s: Sale): string {
  if (s.code?.trim()) return s.code.trim()
  return s.id.slice(-6).toUpperCase()
}

function formatCustomerMesa(sale: Sale): string {
  const customer = sale.customer?.trim() || 'Sin nombre'
  const mesa = sale.mesa?.trim() || 'Sin nombre'
  return `${customer} · Mesa ${mesa}`
}

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
  sale: Sale
  companyName?: string | null
  onClose: () => void
  onEditSale?: (saleId: string) => void
}

export function SaleComandaDetailModal({
  baseUrl,
  sale,
  companyName,
  onClose,
  onEditSale,
}: Props) {
  const branding = resolveInvoiceContact(companyName)
  const [customerPhone, setCustomerPhone] = useState(sale.customerPhone?.trim() ?? '')
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)
  const [whatsAppNotice, setWhatsAppNotice] = useState<string | null>(null)
  const [whatsAppError, setWhatsAppError] = useState<string | null>(null)

  useEffect(() => {
    setCustomerPhone(sale.customerPhone?.trim() ?? '')
    setWhatsAppNotice(null)
    setWhatsAppError(null)
  }, [sale.id, sale.customerPhone])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleEdit = () => {
    if (!onEditSale) return
    onEditSale(sale.id)
    onClose()
  }

  const handleSendWhatsApp = async () => {
    const phone = customerPhone.trim()
    if (!phone) {
      setWhatsAppError('Ingresá el WhatsApp del cliente.')
      setWhatsAppNotice(null)
      return
    }
    setSendingWhatsApp(true)
    setWhatsAppError(null)
    setWhatsAppNotice(null)
    try {
      const result = await sendSaleReceiptWhatsApp(baseUrl, sale.id, phone)
      if (result.whatsappSent && result.internalNotified) {
        setWhatsAppNotice('Comprobante enviado al cliente y copia a Arándano.')
      } else if (result.whatsappSent) {
        setWhatsAppNotice('Comprobante enviado por WhatsApp al cliente.')
      } else if (result.internalNotified) {
        setWhatsAppNotice('Copia enviada al WhatsApp interno de Arándano.')
      } else if (result.whatsappConfigured === false) {
        setWhatsAppError(
          'WhatsApp no está configurado en el servidor (Twilio o Meta).',
        )
      } else {
        setWhatsAppError('No se pudo enviar. Verificá el número e intentá de nuevo.')
      }
    } catch (e) {
      setWhatsAppError(
        e instanceof Error ? e.message : 'No se pudo enviar el comprobante.',
      )
    } finally {
      setSendingWhatsApp(false)
    }
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
        aria-label={`Detalle venta ${saleCompactRef(sale)}`}
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
          {onEditSale ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleEdit}
              aria-label="Editar venta"
              title="Editar venta"
            >
              <GearPinionIcon />
            </Button>
          ) : null}
        </div>

        <div className="sale-comanda-detail-modal__body">
          <dl className="sale-comanda-detail-modal__top-meta">
            <div>
              <dt>Referencia</dt>
              <dd className="mono">{saleCompactRef(sale)}</dd>
            </div>
            <div>
              <dt>Hora</dt>
              <dd>{formatSaleTime(sale.saleDate)}</dd>
            </div>
            <div className="sale-comanda-detail-modal__top-meta-span">
              <dt>Cliente / mesa</dt>
              <dd>{formatCustomerMesa(sale)}</dd>
            </div>
          </dl>

          {sale.lines.length > 0 ? (
            <div className="cash-close-sale-item__lines">
              <table className="cash-close-lines-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="num">Cant.</th>
                    <th className="num">Precio</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.lines.map((ln) => (
                    <tr key={ln.id}>
                      <td>{ln.productName}</td>
                      <td className="num mono">
                        {ln.quantity}
                        {ln.lineUnit ? ` ${ln.lineUnit}` : ''}
                      </td>
                      <td className="num mono">{formatCOP(ln.unitPrice)}</td>
                      <td className="num mono">{formatCOP(ln.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted small cash-close-sale-item__no-lines">
              Sin líneas de detalle.
            </p>
          )}

          <div className="sale-comanda-detail-modal__summary">
            <div className="sale-comanda-detail-modal__total-row">
              <span className="sale-comanda-detail-modal__total-label">Total</span>
              <span className="sale-comanda-detail-modal__total-value mono">
                {formatCOP(sale.total)}
              </span>
            </div>
            <dl className="sale-comanda-detail-modal__bottom-meta">
              <div>
                <dt>Pago</dt>
                <dd>{sale.paymentMethod?.trim() || '—'}</dd>
              </div>
            </dl>
          </div>
        </div>

        <footer className="sale-comanda-detail-modal__foot">
          <div className="sale-comanda-detail-modal__whatsapp">
            <label className="sale-comanda-detail-modal__whatsapp-label">
              <span>WhatsApp del cliente</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className="sale-comanda-detail-modal__whatsapp-input"
                placeholder="300 123 4567"
                value={customerPhone}
                onChange={(e) => {
                  setCustomerPhone(e.target.value)
                  setWhatsAppError(null)
                  setWhatsAppNotice(null)
                }}
              />
            </label>
            <p className="muted small sale-comanda-detail-modal__whatsapp-hint">
              Se envía el comprobante desde {branding.name} al número del cliente.
            </p>
            {whatsAppError ? (
              <p className="error small sale-comanda-detail-modal__whatsapp-status" role="alert">
                {whatsAppError}
              </p>
            ) : null}
            {whatsAppNotice ? (
              <p
                className="small sale-comanda-detail-modal__whatsapp-status sale-comanda-detail-modal__whatsapp-status--ok"
                role="status"
              >
                {whatsAppNotice}
              </p>
            ) : null}
            <Button
              type="button"
              variant="accent"
              size="md"
              block
              disabled={sendingWhatsApp || !customerPhone.trim()}
              onClick={() => void handleSendWhatsApp()}
            >
              {sendingWhatsApp ? 'Enviando…' : 'Enviar comprobante por WhatsApp'}
            </Button>
          </div>
          <Button
            type="button"
            variant="primary"
            size="md"
            block
            onClick={() => downloadSaleReceiptImage(sale, branding, companyName)}
          >
            Descargar tirilla
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            block
            onClick={() => void downloadSaleInvoicePdf(baseUrl, sale.id, sale.code)}
          >
            Descargar PDF
          </Button>
        </footer>
      </div>
    </div>
  )
}
