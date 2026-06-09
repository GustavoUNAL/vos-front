import { useCallback, useEffect } from 'react'
import { fetchDailyCashClose } from '../api'
import { useStaleCache } from '../hooks/useStaleCache'
import {
  daySalesCacheKey,
  ENTITY_CACHE_TTL,
} from '../lib/entityCache'
import { DayComandasList } from './DayComandasList'
import { Button } from './ui/button'

type Props = {
  baseUrl: string
  date: string
  refreshKey?: number
  onCreateSale?: () => void
  onEditSale?: (saleId: string) => void
  companyName?: string | null
}

/** Solo comandas del día (módulo Ventas). */
export function DaySalesListPanel({
  baseUrl,
  date,
  refreshKey = 0,
  onCreateSale,
  onEditSale,
  companyName,
}: Props) {
  const fetcher = useCallback(
    () => fetchDailyCashClose(baseUrl, date),
    [baseUrl, date],
  )

  const { data, loading, refreshing, error, reload } = useStaleCache(
    daySalesCacheKey(date),
    fetcher,
    { ttlMs: ENTITY_CACHE_TTL.daySales },
  )

  useEffect(() => {
    if (refreshKey > 0) void reload()
  }, [refreshKey, reload])

  const list = data?.sales ?? []

  return (
    <section className="day-sales-list-panel" aria-labelledby="day-sales-list-title">
      <header className="day-sales-list-panel__head">
        <p id="day-sales-list-title" className="day-sales-list-panel__hint muted small">
          {loading && list.length === 0
            ? 'Cargando…'
            : `${list.length} comanda${list.length !== 1 ? 's' : ''}`}
          {refreshing && list.length > 0 ? ' · actualizando' : ''}
        </p>
        {onCreateSale ? (
          <Button type="button" variant="secondary" size="sm" onClick={onCreateSale}>
            Nueva venta
          </Button>
        ) : null}
      </header>

      {loading && list.length === 0 ? (
        <p className="muted">Cargando comandas…</p>
      ) : null}
      {error && list.length === 0 ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading || list.length > 0 ? (
        <DayComandasList
          baseUrl={baseUrl}
          sales={list}
          emptyMessage="No hay comandas este día."
          onEditSale={onEditSale}
          companyName={companyName}
        />
      ) : null}
    </section>
  )
}
