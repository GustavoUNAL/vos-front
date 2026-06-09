import { useCallback, useEffect } from 'react'
import { fetchPurchaseLots, type PurchaseLotRow } from '../api'
import { useStaleCache } from '../hooks/useStaleCache'
import {
  dayPurchasesCacheKey,
  ENTITY_CACHE_TTL,
} from '../lib/entityCache'
import { DayPurchaseLotsList } from './DayPurchaseLotsList'
import { Button } from './ui/button'

type Props = {
  baseUrl: string
  date: string
  refreshKey?: number
  onCreatePurchase?: () => void
  onEditLot?: (lotId: string, row: PurchaseLotRow) => void
}

export function DayPurchasesListPanel({
  baseUrl,
  date,
  refreshKey = 0,
  onCreatePurchase,
  onEditLot,
}: Props) {
  const fetcher = useCallback(
    () =>
      fetchPurchaseLots(baseUrl, {
        page: 1,
        limit: 200,
        dateFrom: date,
        dateTo: date,
      }).then((res) => res.data),
    [baseUrl, date],
  )

  const { data: lots, loading, refreshing, error, reload } = useStaleCache(
    dayPurchasesCacheKey(date),
    fetcher,
    { ttlMs: ENTITY_CACHE_TTL.dayPurchases },
  )

  useEffect(() => {
    if (refreshKey > 0) void reload()
  }, [refreshKey, reload])

  const list = lots ?? []

  return (
    <section className="day-sales-list-panel" aria-labelledby="day-purchases-list-title">
      <header className="day-sales-list-panel__head">
        <p id="day-purchases-list-title" className="day-sales-list-panel__hint muted small">
          {loading && list.length === 0
            ? 'Cargando…'
            : `${list.length} compra${list.length !== 1 ? 's' : ''}`}
          {refreshing && list.length > 0 ? ' · actualizando' : ''}
        </p>
        {onCreatePurchase ? (
          <Button type="button" variant="secondary" size="sm" onClick={onCreatePurchase}>
            Nueva compra
          </Button>
        ) : null}
      </header>

      {loading && list.length === 0 ? (
        <p className="muted">Cargando compras…</p>
      ) : null}
      {error && list.length === 0 ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading || list.length > 0 ? (
        <DayPurchaseLotsList
          baseUrl={baseUrl}
          lots={list}
          emptyMessage="No hay compras este día."
          onEditLot={onEditLot}
        />
      ) : null}
    </section>
  )
}
