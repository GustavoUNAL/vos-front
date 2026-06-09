import { Camera, ImagePlus, Trash2 } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { processTransferReceiptFile } from '../../lib/transferReceipt'
import { PosTransferQr } from './PosTransferQr'

type Props = {
  amountCOP: number
  orderCode: string
  receiptDataUrl: string | null
  onReceiptChange: (dataUrl: string | null) => void
  compact?: boolean
  showQr?: boolean
}

export function PosTransferReceiptCapture({
  amountCOP,
  orderCode,
  receiptDataUrl,
  onReceiptChange,
  compact = false,
  showQr = true,
}: Props) {
  const cameraInputId = useId()
  const galleryInputId = useId()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const dataUrl = await processTransferReceiptFile(file)
      onReceiptChange(dataUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la imagen')
    } finally {
      setBusy(false)
      if (cameraRef.current) cameraRef.current.value = ''
      if (galleryRef.current) galleryRef.current.value = ''
    }
  }

  return (
    <div
      className={`pos-transfer-receipt${compact ? ' pos-transfer-receipt--compact' : ''}`}
    >
      {showQr ? (
        <PosTransferQr amountCOP={amountCOP} orderCode={orderCode} compact />
      ) : null}

      <div className="pos-transfer-receipt__body">
        <p className="pos-transfer-receipt__title">
          Comprobante de transferencia
        </p>
        <p className="pos-transfer-receipt__hint muted small">
          Tomá una foto o subí el comprobante del pago para continuar.
        </p>

        {receiptDataUrl ? (
          <div className="pos-transfer-receipt__preview-wrap">
            <img
              src={receiptDataUrl}
              alt="Comprobante de transferencia"
              className="pos-transfer-receipt__preview"
            />
            <button
              type="button"
              className="pos-transfer-receipt__remove"
              onClick={() => onReceiptChange(null)}
            >
              <Trash2 aria-hidden strokeWidth={2} />
              Quitar
            </button>
          </div>
        ) : (
          <div className="pos-transfer-receipt__actions">
            <button
              type="button"
              className="pos-transfer-receipt__action"
              disabled={busy}
              onClick={() => cameraRef.current?.click()}
            >
              <Camera aria-hidden strokeWidth={2} />
              Tomar foto
            </button>
            <button
              type="button"
              className="pos-transfer-receipt__action"
              disabled={busy}
              onClick={() => galleryRef.current?.click()}
            >
              <ImagePlus aria-hidden strokeWidth={2} />
              Subir imagen
            </button>
          </div>
        )}

        <input
          id={cameraInputId}
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <input
          id={galleryInputId}
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />

        {busy ? (
          <p className="pos-transfer-receipt__status muted small" role="status">
            Procesando imagen…
          </p>
        ) : null}
        {error ? (
          <p className="pos-transfer-receipt__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
