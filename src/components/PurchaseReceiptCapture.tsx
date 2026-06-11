import { Camera, ImagePlus, Trash2 } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { processTransferReceiptFile } from '../pos/lib/transferReceipt'

type Props = {
  receiptDataUrl: string | null
  onReceiptChange: (dataUrl: string | null) => void
}

export function PurchaseReceiptCapture({ receiptDataUrl, onReceiptChange }: Props) {
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
    <div className="purchase-receipt-capture">
      <span className="inventory-filter__label">Foto del comprobante</span>
      {receiptDataUrl ? (
        <div className="purchase-receipt-capture__preview-wrap">
          <img
            src={receiptDataUrl}
            alt="Comprobante de compra"
            className="purchase-receipt-capture__preview"
          />
          <button
            type="button"
            className="btn-secondary btn-compact"
            onClick={() => onReceiptChange(null)}
          >
            <Trash2 aria-hidden strokeWidth={2} size={16} />
            Quitar foto
          </button>
        </div>
      ) : (
        <div className="purchase-receipt-capture__actions">
          <button
            type="button"
            className="btn-secondary btn-compact"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
          >
            <Camera aria-hidden strokeWidth={2} size={16} />
            Tomar foto
          </button>
          <button
            type="button"
            className="btn-secondary btn-compact"
            disabled={busy}
            onClick={() => galleryRef.current?.click()}
          >
            <ImagePlus aria-hidden strokeWidth={2} size={16} />
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
        <p className="muted small" role="status">
          Procesando…
        </p>
      ) : null}
      {error ? (
        <p className="error small" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
