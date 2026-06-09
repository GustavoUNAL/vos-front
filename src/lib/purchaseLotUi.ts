import {
  displayPurchaseLotSupplier,
  formatPurchaseLotDate,
  type PurchaseLotRow,
} from '../api'

function num(v: string | number | null | undefined): number {
  const n = parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

function qty(v: string | number | null | undefined): number {
  const n = num(v)
  return Number.isFinite(n) ? n : 0
}

export function formatPurchaseCOP(value: string | number | null | undefined): string {
  const n = num(value)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n)
}

export function purchaseLotRowTotalCOP(row: PurchaseLotRow): number {
  const fromTotals = num(row.purchaseTotals?.linesPurchaseTotalCOP)
  if (Number.isFinite(fromTotals)) return fromTotals

  const hasLines = Boolean(row.items?.length || row.purchaseLines?.length)
  if (hasLines) {
    const pv = num(row.inventoryMetrics?.purchasedValueCOP)
    if (Number.isFinite(pv)) return pv
  }

  if (row.totalValue != null && String(row.totalValue).trim() !== '') {
    const tv = num(row.totalValue)
    if (Number.isFinite(tv)) return tv
  }

  let s = 0
  let any = false
  if (row.items?.length) {
    for (const it of row.items) {
      if (it.purchase != null) {
        const n = num(it.purchase.linePurchaseTotalCOP)
        if (Number.isFinite(n)) {
          s += n
          any = true
        }
      }
    }
  }
  if (any) return s

  if (row.items?.length) {
    let sum = 0
    for (const it of row.items) {
      const q = qty(it.quantity)
      const c = num(it.unitCost)
      if (Number.isFinite(q) && Number.isFinite(c)) sum += q * c
    }
    return sum
  }
  return NaN
}

function looksLikeUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s.trim(),
  )
}

export function purchaseLotDisplayName(row: {
  code: string
  name?: string | null
  displayName?: string | null
}): string {
  const d = row.displayName?.trim()
  if (d) return d
  const n = row.name?.trim()
  if (n) return n
  const c = row.code?.trim()
  if (!c) return '—'
  if (looksLikeUuid(c)) return 'Sin nombre de lote'
  return c
}

export function purchaseLotCompactRef(row: PurchaseLotRow): string {
  const c = row.code?.trim()
  if (c && !looksLikeUuid(c)) return c
  return row.id.slice(-6).toUpperCase()
}

export function lotConsumptionStatusLabel(
  status: string | null | undefined,
  isDepleted?: boolean,
): string {
  if (isDepleted) return 'Consumido'
  const s = String(status ?? '').toUpperCase()
  if (s === 'DEPLETED') return 'Consumido'
  if (s === 'EMPTY') return 'Vacío'
  if (s === 'FRESH') return 'Nuevo'
  if (s === 'PARTIAL') return 'Parcial'
  return '—'
}

export function formatPurchaseLotSupplierLabel(row: PurchaseLotRow): string {
  return displayPurchaseLotSupplier(row) || 'Sin proveedor'
}

export function formatPurchaseLotDateLabel(
  iso: string,
  style: 'short' | 'long' = 'short',
): string {
  return formatPurchaseLotDate(iso, style)
}
