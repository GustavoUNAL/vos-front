import type { InventoryRow, PurchaseLotRow } from './api'

/** Categorías reconocidas como «activo» (bienes de uso); coordinar con backend si se amplían. */
export const ACTIVO_CATEGORY_NAMES = new Set([
  'activos',
  'activo',
  'activo fijo',
])

export type InventoryBehaviorKind = 'CONSUMABLE' | 'CAPITAL_ASSET'

export function stripInventoryCategoryPrefix(raw: string | null | undefined): string {
  return String(raw ?? '')
    .replace(/^INVENTORY::/i, '')
    .trim()
}

export function normalizeInventoryCategoryName(
  raw: string | null | undefined,
): string {
  return stripInventoryCategoryPrefix(raw).toLowerCase()
}

export function categoryNameImpliesCapitalAsset(
  categoryName: string | null | undefined,
): boolean {
  const n = normalizeInventoryCategoryName(categoryName)
  return n !== '' && ACTIVO_CATEGORY_NAMES.has(n)
}

export function isCapitalAssetBehavior(
  behavior: string | null | undefined,
): behavior is 'CAPITAL_ASSET' {
  return behavior === 'CAPITAL_ASSET'
}

/** Ingredientes de receta enriquecidos por GET producto/receta. */
export function recipeIngredientIsCapitalAsset(line: {
  inventoryBehavior?: InventoryBehaviorKind | string | null
  categoryName?: string | null
}): boolean {
  if (line.inventoryBehavior === 'CAPITAL_ASSET') return true
  return categoryNameImpliesCapitalAsset(line.categoryName ?? undefined)
}

/**
 * Para recetas: no considerar «sin stock» solo por quantity 0 si es activo o el API marca AVAILABLE.
 */
export function recipeIngredientStockOkForProduction(line: {
  inventoryBehavior?: InventoryBehaviorKind | string | null
  categoryName?: string | null
  stockStatus?: string | null
}, inventoryQty: number): boolean {
  if (recipeIngredientIsCapitalAsset(line)) return true
  const st = String(line.stockStatus ?? '').toUpperCase()
  if (st === 'AVAILABLE') return true
  return inventoryQty > 0
}

export function resolveLotLineInventoryBehavior(
  inv: InventoryRow,
  lotRow: PurchaseLotRow | null,
): InventoryBehaviorKind | undefined {
  if (!lotRow) return undefined

  const fromItem = lotRow.items?.find(
    (it) => it.id != null && String(it.id) === String(inv.id),
  )
  if (fromItem?.inventoryBehavior) return fromItem.inventoryBehavior
  if (
    fromItem &&
    categoryNameImpliesCapitalAsset(
      fromItem.categoryName ?? fromItem.category ?? undefined,
    )
  ) {
    return 'CAPITAL_ASSET'
  }

  const fromOrphan = lotRow.inventoryWithoutPurchaseLine?.find(
    (it) => it.id != null && String(it.id) === String(inv.id),
  )
  if (fromOrphan?.inventoryBehavior) return fromOrphan.inventoryBehavior

  const fromPL = lotRow.purchaseLines?.find(
    (pl) =>
      pl.inventoryItemId != null &&
      String(pl.inventoryItemId) === String(inv.id),
  )
  if (fromPL?.inventoryBehavior) return fromPL.inventoryBehavior

  if (categoryNameImpliesCapitalAsset(inv.category?.name)) {
    return 'CAPITAL_ASSET'
  }

  return undefined
}
