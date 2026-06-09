import { invalidateApiCache, readApiCache, writeApiCache } from './apiCache'
import type { DailyCashClose, PurchaseLotRow, SaleDetail } from '../api'

export const ENTITY_CACHE_TTL = {
  daySales: 15 * 60 * 1000,
  dayPurchases: 15 * 60 * 1000,
  saleDetail: 20 * 60 * 1000,
  purchaseLot: 20 * 60 * 1000,
} as const

export function daySalesCacheKey(date: string): string {
  return `day-sales:${date}`
}

export function dayPurchasesCacheKey(date: string): string {
  return `day-purchases:${date}`
}

export function saleDetailCacheKey(id: string): string {
  return `sale-detail:${id}`
}

export function purchaseLotCacheKey(id: string): string {
  return `purchase-lot:${id}`
}

export function peekDaySales(date: string): DailyCashClose['sales'] | null {
  return readApiCache<DailyCashClose>(daySalesCacheKey(date))?.data.sales ?? null
}

export function peekPurchaseLot(id: string): PurchaseLotRow | null {
  return readApiCache<PurchaseLotRow>(purchaseLotCacheKey(id))?.data ?? null
}

export function peekSaleDetail(id: string): SaleDetail | null {
  return readApiCache<SaleDetail>(saleDetailCacheKey(id))?.data ?? null
}

export function storeDaySales(date: string, data: DailyCashClose): void {
  writeApiCache(daySalesCacheKey(date), data, ENTITY_CACHE_TTL.daySales)
}

export function storeDayPurchases(date: string, lots: PurchaseLotRow[]): void {
  writeApiCache(dayPurchasesCacheKey(date), lots, ENTITY_CACHE_TTL.dayPurchases)
}

export function storeSaleDetail(id: string, detail: SaleDetail): void {
  writeApiCache(saleDetailCacheKey(id), detail, ENTITY_CACHE_TTL.saleDetail)
}

export function storePurchaseLot(id: string, lot: PurchaseLotRow): void {
  writeApiCache(purchaseLotCacheKey(id), lot, ENTITY_CACHE_TTL.purchaseLot)
}

export function invalidateDaySales(date: string): void {
  invalidateApiCache(daySalesCacheKey(date))
}

export function invalidateDayPurchases(date: string): void {
  invalidateApiCache(dayPurchasesCacheKey(date))
}

export function invalidateSaleDetail(id: string): void {
  invalidateApiCache(saleDetailCacheKey(id))
}

export function invalidatePurchaseLot(id: string): void {
  invalidateApiCache(purchaseLotCacheKey(id))
}

/** Precarga detalle en segundo plano (hover / tap). */
export function prefetchPurchaseLot(
  baseUrl: string,
  id: string,
  fetcher: (base: string, lotId: string) => Promise<PurchaseLotRow>,
): void {
  const cached = readApiCache<PurchaseLotRow>(purchaseLotCacheKey(id))
  if (cached && !cached.stale) return
  void fetcher(baseUrl, id)
    .then((lot) => storePurchaseLot(id, lot))
    .catch(() => {
      /* silencioso */
    })
}
