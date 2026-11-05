/** SKU interno del ítem de carta cuyo precio y nombre se definen al vender. */
export const POS_OPEN_PRODUCT_SKU = 'POS-OPEN'

export const POS_OPEN_PRODUCT_NAME = 'Producto genérico'

export function isPosOpenProduct(product: {
  sku?: string | null
  name?: string
}): boolean {
  if (product.sku?.trim() === POS_OPEN_PRODUCT_SKU) return true
  return product.name?.trim() === POS_OPEN_PRODUCT_NAME
}

export function openProductPriceLabel(): string {
  return 'Definir'
}
