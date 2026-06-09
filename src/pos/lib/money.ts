export const DEFAULT_TAX_RATE = 0

export function parseMoney(v: string | number | null | undefined): number {
  if (v == null || v === '') return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  let s = String(v).trim()
  if (/^\d+,\d{1,6}$/.test(s) && !s.includes('.')) {
    s = s.replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    s = s.replace(/,/g, '')
  }
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export function formatCOP(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

export function computeOrderTotals(
  lines: { quantity: number; unitPrice: number }[],
  taxRate = DEFAULT_TAX_RATE,
): { subtotalCOP: number; taxCOP: number; totalCOP: number } {
  const subtotalCOP = lines.reduce(
    (sum, l) => sum + l.quantity * l.unitPrice,
    0,
  )
  const taxCOP = Math.round(subtotalCOP * taxRate)
  const totalCOP = subtotalCOP + taxCOP
  return { subtotalCOP, taxCOP, totalCOP }
}
