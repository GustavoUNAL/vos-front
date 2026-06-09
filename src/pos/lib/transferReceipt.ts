const MAX_INPUT_BYTES = 10 * 1024 * 1024
const MAX_SIDE_PX = 1280
const JPEG_QUALITY = 0.82

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('No se pudo leer la imagen'))
    }
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.readAsDataURL(file)
  })
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Imagen inválida'))
    img.src = dataUrl
  })
}

async function compressDataUrl(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl)
  const scale = Math.min(1, MAX_SIDE_PX / Math.max(img.width, img.height))
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

export async function processTransferReceiptFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Elegí una imagen (JPG, PNG, etc.).')
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('La imagen es muy pesada. Probá otra más liviana.')
  }
  const raw = await readFileAsDataUrl(file)
  return compressDataUrl(raw)
}

export function hasTransferReceipt(dataUrl?: string | null): boolean {
  return Boolean(dataUrl?.trim().startsWith('data:image/'))
}
