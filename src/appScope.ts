/**
 * Alcance de la app en el front.
 * Modo venta: solo productos a la venta (carta/config) y módulo de ventas.
 * Para volver al menú completo: VITE_SALES_FLOOR_ONLY=false en .env.local
 */
const envFlag = import.meta.env.VITE_SALES_FLOOR_ONLY as string | undefined

export const SALES_FLOOR_ONLY =
  envFlag !== '0' && envFlag !== 'false' && envFlag !== 'off'

export const SALES_FLOOR_VIEWS = ['products', 'sales'] as const
export type SalesFloorView = (typeof SALES_FLOOR_VIEWS)[number]

export const SALES_FLOOR_DEFAULT_VIEW: SalesFloorView = 'products'

export const SALES_FLOOR_NAV_GROUPS = ['catalog', 'sales'] as const

export function isSalesFloorView(v: string | null | undefined): v is SalesFloorView {
  return v === 'products' || v === 'sales'
}

/** Normaliza hash/ruta a una vista permitida en modo venta. */
export function resolveSalesFloorView(
  fromHash: string | null | undefined,
): SalesFloorView {
  if (isSalesFloorView(fromHash)) return fromHash
  return SALES_FLOOR_DEFAULT_VIEW
}
