import { parseMoney } from './money'

/** Costo declarado (`unit_cost`); vacío / inválido → null. */
export function unitCostToNumber(
  uc: string | number | null | undefined,
): number | null {
  if (uc == null || uc === '') return null
  const n = parseMoney(uc)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

export function profitFromPriceAndCost(
  priceCOP: number,
  unitCost: number | null,
): number | null {
  if (unitCost == null) return null
  return Math.round(priceCOP - unitCost)
}

/** Margen sobre precio de venta, % con un decimal (como cartilla). */
export function marginPercentOnPrice(
  priceCOP: number,
  unitCost: number | null,
): number | null {
  if (unitCost == null || priceCOP <= 0) return null
  const m = ((priceCOP - unitCost) / priceCOP) * 100
  if (!Number.isFinite(m)) return null
  return Math.round(m * 10) / 10
}
