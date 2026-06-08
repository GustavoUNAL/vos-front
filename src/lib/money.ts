/** Parse montos típicos de API (`4000`, `4000.5`) y texto COP (`4.000`, `$ 4.000`). */
export function parseMoney(v: string | number | null | undefined): number {
  if (v == null || v === '') return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  let s = String(v)
    .trim()
    .replace(/\$/g, '')
    .replace(/\s/g, '')
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
  }).format(Math.round(value))
}
