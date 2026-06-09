import type { DailyCashClose } from '../api'
import type { InvoiceContact } from '../config/invoiceBranding'

type Sale = DailyCashClose['sales'][number]

const WIDTH = 384
const PAD_X = 18
const PAD_Y = 20
const LINE = 15
const FONT = '11px "Courier New", Courier, monospace'
const FONT_SM = '10px "Courier New", Courier, monospace'
const FONT_BOLD = 'bold 12px "Courier New", Courier, monospace'
const FONT_TITLE = 'bold 15px "Courier New", Courier, monospace'

function formatCOP(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d)
}

function saleRef(sale: Sale): string {
  return sale.code?.trim() || sale.id.slice(-6).toUpperCase()
}

function customerMesa(sale: Sale): string {
  const customer = sale.customer?.trim() || 'Sin nombre'
  const mesa = sale.mesa?.trim() || 'Sin nombre'
  return `${customer} · Mesa ${mesa}`
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

function estimateHeight(sale: Sale): number {
  const ctx = document.createElement('canvas').getContext('2d')!
  ctx.font = FONT
  let h = PAD_Y
  h += LINE * 5 // header block
  h += LINE * 3 // meta
  h += LINE // separator
  h += LINE // table header
  h += sale.lines.length * LINE
  h += LINE * 2
  h += LINE * 5 // footer contact
  h += PAD_Y
  return h
}

function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
) {
  ctx.save()
  ctx.setLineDash([4, 3])
  ctx.strokeStyle = '#bbb'
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + w, y)
  ctx.stroke()
  ctx.restore()
}

function drawLineItem(
  ctx: CanvasRenderingContext2D,
  left: string,
  right: string,
  y: number,
  width: number,
) {
  ctx.font = FONT
  ctx.textAlign = 'left'
  ctx.fillText(left, PAD_X, y)
  ctx.textAlign = 'right'
  ctx.fillText(right, width - PAD_X, y)
}

export function downloadSaleReceiptImage(
  sale: Sale,
  branding: InvoiceContact,
  companyName?: string | null,
): void {
  const contact = {
    ...branding,
    name: companyName?.trim() || branding.name,
  }
  const contentWidth = WIDTH - PAD_X * 2
  const height = estimateHeight(sale)
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, WIDTH, height)
  ctx.fillStyle = '#141414'

  let y = PAD_Y + 4

  ctx.textAlign = 'center'
  ctx.font = FONT_TITLE
  ctx.fillText(contact.name, WIDTH / 2, y)
  y += LINE + 2

  ctx.font = FONT_SM
  ctx.fillText(contact.address, WIDTH / 2, y)
  y += LINE
  ctx.fillText(contact.email, WIDTH / 2, y)
  y += LINE
  ctx.fillText(contact.phone, WIDTH / 2, y)
  y += LINE + 4

  drawDashedLine(ctx, PAD_X, y, contentWidth)
  y += LINE

  ctx.font = FONT_BOLD
  ctx.fillText(`Nº ${saleRef(sale)}`, WIDTH / 2, y)
  y += LINE

  ctx.font = FONT
  ctx.fillText(formatDateTime(sale.saleDate), WIDTH / 2, y)
  y += LINE + 2

  ctx.textAlign = 'left'
  ctx.font = FONT_SM
  ctx.fillText(`Cliente: ${customerMesa(sale)}`, PAD_X, y)
  y += LINE
  if (sale.paymentMethod?.trim()) {
    ctx.fillText(`Pago: ${sale.paymentMethod.trim()}`, PAD_X, y)
    y += LINE
  }

  drawDashedLine(ctx, PAD_X, y, contentWidth)
  y += LINE

  ctx.font = FONT_BOLD
  ctx.textAlign = 'left'
  ctx.fillText('Producto', PAD_X, y)
  ctx.textAlign = 'right'
  ctx.fillText('Total', WIDTH - PAD_X, y)
  y += LINE - 2
  drawDashedLine(ctx, PAD_X, y, contentWidth)
  y += LINE

  ctx.font = FONT
  for (const ln of sale.lines) {
    const qty =
      ln.lineUnit?.trim() ? `${ln.quantity} ${ln.lineUnit}` : String(ln.quantity)
    const left = `${ln.productName} x${qty}`
    const right = formatCOP(ln.lineTotal)
    const wrapped = wrapText(ctx, left, contentWidth - ctx.measureText(right).width - 12)
    for (let i = 0; i < wrapped.length; i++) {
      ctx.textAlign = 'left'
      ctx.fillText(wrapped[i], PAD_X, y)
      if (i === wrapped.length - 1) {
        ctx.textAlign = 'right'
        ctx.fillText(right, WIDTH - PAD_X, y)
      }
      y += LINE
    }
  }

  drawDashedLine(ctx, PAD_X, y, contentWidth)
  y += LINE + 2

  ctx.font = FONT_BOLD
  drawLineItem(ctx, 'TOTAL', formatCOP(sale.total), y, WIDTH)
  y += LINE + 4

  drawDashedLine(ctx, PAD_X, y, contentWidth)
  y += LINE

  ctx.textAlign = 'center'
  ctx.font = FONT_SM
  ctx.fillText('Gracias por su visita', WIDTH / 2, y)
  y += LINE
  ctx.fillText(contact.name, WIDTH / 2, y)
  y += LINE
  ctx.fillText(contact.phone, WIDTH / 2, y)

  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tirilla-${saleRef(sale)}.png`
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}
