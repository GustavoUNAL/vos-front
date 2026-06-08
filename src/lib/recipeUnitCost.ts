import type { InventoryOption, ProductRecipeFull } from '../api'

const DEFAULT_ADMIN_RATE = 0.3

function parseNum(raw: string | number | null | undefined): number {
  if (raw == null) return NaN
  const v = parseFloat(String(raw).replace(',', '.'))
  return Number.isFinite(v) ? v : NaN
}

function isAdminLineName(name: string): boolean {
  return /administraci/i.test(name.trim())
}

/** Costo unitario estimado a partir de la receta guardada (insumos + gastos + admin / rendimiento). */
export function computeRecipeUnitCostCOP(
  recipe: ProductRecipeFull | null,
  inventory: InventoryOption[] = [],
): number | null {
  if (!recipe) return null

  const yieldNum = parseNum(recipe.recipeYield)
  if (!Number.isFinite(yieldNum) || yieldNum <= 0) return null

  const byId = new Map(inventory.map((i) => [i.id, i]))
  let materials = 0
  for (const ing of recipe.ingredients ?? []) {
    const inv = byId.get(ing.inventoryItemId)
    const unitCost = inv ? parseNum(inv.unitCostCOP) : NaN
    const qty = parseNum(ing.quantity)
    if (Number.isFinite(unitCost) && Number.isFinite(qty)) {
      materials += qty * unitCost
    }
  }

  let services = 0
  for (const c of recipe.costs ?? []) {
    if (isAdminLineName(c.name)) continue
    const total = parseNum(c.lineTotalCOP)
    if (Number.isFinite(total) && total >= 0) services += total
  }

  const base = materials + services
  const adminRate =
    recipe.adminRate != null && Number.isFinite(recipe.adminRate)
      ? recipe.adminRate
      : DEFAULT_ADMIN_RATE
  const admin = Math.round(base * adminRate)
  const total = materials + services + admin
  if (total <= 0) return null
  return Math.round(total / yieldNum)
}
