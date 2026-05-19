import { useEffect } from 'react'
import { fetchPosTables, isPosDemoMode } from '../services/posApi'
import { posWsClient } from '../services/websocket'
import { usePosStore } from '../store/posStore'

export function usePosRealtime(baseUrl: string) {
  const { dispatch, setTables, setActiveOrder } = usePosStore()

  useEffect(() => {
    const onOnline = () => dispatch({ type: 'SET_OFFLINE', offline: false })
    const onOffline = () => dispatch({ type: 'SET_OFFLINE', offline: true })
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    dispatch({ type: 'SET_OFFLINE', offline: !navigator.onLine })
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [dispatch])

  useEffect(() => {
    if (isPosDemoMode()) {
      dispatch({ type: 'SET_WS_STATUS', status: 'closed' })
      return
    }

    posWsClient.reset()
    posWsClient.connect(baseUrl)
    const unsubStatus = posWsClient.onStatus((s) => {
      dispatch({ type: 'SET_WS_STATUS', status: s === 'disabled' ? 'closed' : s })
    })
    const unsubEv = posWsClient.subscribe((ev) => {
      if (ev.type === 'tables.updated') {
        setTables(ev.tables)
      }
      if (ev.type === 'order.updated') {
        setActiveOrder(ev.order)
      }
      if (ev.type === 'order.closed') {
        void fetchPosTables(baseUrl).then(setTables).catch(() => {})
      }
    })
    const poll = window.setInterval(() => {
      if (!navigator.onLine || isPosDemoMode()) return
      void fetchPosTables(baseUrl).then(setTables).catch(() => {})
    }, 60_000)
    return () => {
      unsubStatus()
      unsubEv()
      clearInterval(poll)
      posWsClient.dispose()
    }
  }, [baseUrl, dispatch, setActiveOrder, setTables])
}
