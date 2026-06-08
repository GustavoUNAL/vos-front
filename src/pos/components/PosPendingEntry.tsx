import { useEffect } from 'react'
import { consumePendingPosTableId } from '../../lib/pending-pos-navigation'
import { loadLocalState } from '../services/offlineStorage'
import { usePosStore } from '../store/posStore'

/** Abre la mesa indicada desde Inicio u otra vista externa al POS. */
export function PosPendingEntry() {
  const { navigate, setActiveOrder } = usePosStore()

  useEffect(() => {
    const tableId = consumePendingPosTableId()
    if (!tableId) return

    const state = loadLocalState()
    const table = state.tables.find((t) => t.id === tableId)
    if (!table?.orderId) {
      navigate('tables', tableId)
      return
    }

    const order = state.orders[table.orderId]
    if (!order) {
      navigate('tables', tableId)
      return
    }

    setActiveOrder(order)
    navigate('order', tableId)
  }, [navigate, setActiveOrder])

  return null
}
