import { useEffect, useRef } from 'react'
import { writeApiCache } from '../../lib/apiCache'
import { fetchPosTables, isPosDemoMode } from '../services/posApi'
import {
  subscribePosLocalEvents,
} from '../services/posLocalEvents'
import { posWsClient } from '../services/websocket'
import type { PosWsEvent } from '../types'
import { usePosStore } from '../store/posStore'

export function usePosRealtime(baseUrl: string) {
  const { state, dispatch, setTables, setActiveOrder } = usePosStore()
  const activeOrderIdRef = useRef(state.activeOrder?.id)
  activeOrderIdRef.current = state.activeOrder?.id

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
    const handleEvent = (ev: PosWsEvent) => {
      if (ev.type === 'tables.updated') {
        setTables(ev.tables)
        writeApiCache('pos:tables', ev.tables, 90_000)
      }
      if (ev.type === 'order.updated') {
        if (activeOrderIdRef.current === ev.order.id) {
          setActiveOrder(ev.order)
        }
      }
      if (ev.type === 'order.closed') {
        void fetchPosTables(baseUrl).then(setTables).catch(() => {})
      }
    }

    const unsubLocal = subscribePosLocalEvents(handleEvent)

    if (isPosDemoMode()) {
      dispatch({ type: 'SET_WS_STATUS', status: 'closed' })
      return () => {
        unsubLocal()
      }
    }

    posWsClient.reset()
    posWsClient.connect(baseUrl)
    const unsubStatus = posWsClient.onStatus((s) => {
      dispatch({ type: 'SET_WS_STATUS', status: s === 'disabled' ? 'closed' : s })
    })
    const unsubEv = posWsClient.subscribe(handleEvent)
    const poll = window.setInterval(() => {
      if (!navigator.onLine || isPosDemoMode()) return
      void fetchPosTables(baseUrl).then(setTables).catch(() => {})
    }, 60_000)
    return () => {
      unsubLocal()
      unsubStatus()
      unsubEv()
      clearInterval(poll)
      posWsClient.dispose()
    }
  }, [baseUrl, dispatch, setActiveOrder, setTables])
}
