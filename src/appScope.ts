/**
 * Alcance de la app en el front.
 * Modo venta: solo productos a la venta (carta/config) y módulo de ventas.
 * Para volver al menú completo: VITE_SALES_FLOOR_ONLY=false en .env.local
 */
const envFlag = import.meta.env.VITE_SALES_FLOOR_ONLY as string | undefined
const platformFlag = import.meta.env.VITE_PLATFORM_MODE as string | undefined

/** vos.ai multi-tenant: catálogo, ventas y compras por empresa. */
export const PLATFORM_MODE =
  platformFlag !== '0' && platformFlag !== 'false' && platformFlag !== 'off'

export const PLATFORM_NAV_GROUPS = ['catalog', 'stock', 'sales', 'purchases', 'staff', 'finance'] as const

export const PLATFORM_VIEWS = ['home', 'products', 'inventory', 'sales', 'pos', 'purchases', 'staff', 'analytics'] as const
export type PlatformView = (typeof PLATFORM_VIEWS)[number]

export function isPlatformView(v: string | null | undefined): v is PlatformView {
  return (
    v === 'home' ||
    v === 'products' ||
    v === 'inventory' ||
    v === 'sales' ||
    v === 'pos' ||
    v === 'purchases' ||
    v === 'staff' ||
    v === 'analytics'
  )
}

/** Normaliza hash/ruta a una vista permitida en modo plataforma. */
export function resolvePlatformView(
  fromHash: string | null | undefined,
): PlatformView {
  if (isPlatformView(fromHash)) return fromHash
  return 'home'
}

export const SALES_FLOOR_ONLY =
  !PLATFORM_MODE &&
  envFlag !== '0' &&
  envFlag !== 'false' &&
  envFlag !== 'off'

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
