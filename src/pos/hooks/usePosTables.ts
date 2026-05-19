import { useCallback, useEffect } from 'react'
import {
  closeTableAccount,
  createPosTable,
  fetchPosOrder,
  fetchPosTables,
  isPosDemoMode,
  openTableAccount,
  probePosApi,
  reserveTable,
  unreserveTable,
  updatePosTable,
} from '../services/posApi'
import type { CreateTablePayload, UpdateTablePayload } from '../types'
import { usePosStore } from '../store/posStore'
import type { PosTable } from '../types'

export function usePosTables(baseUrl: string) {
  const { state, dispatch, setTables, navigate, setActiveOrder } = usePosStore()

  const refresh = useCallback(async () => {
    dispatch({ type: 'SET_TABLES_LOADING', loading: true })
    dispatch({ type: 'SET_TABLES_ERROR', error: null })
    try {
      await probePosApi(baseUrl)
      dispatch({ type: 'SET_DEMO_MODE', demo: isPosDemoMode() })
      const tables = await fetchPosTables(baseUrl)
      setTables(tables)
    } catch (e) {
      if (!isPosDemoMode()) {
        dispatch({
          type: 'SET_TABLES_ERROR',
          error: e instanceof Error ? e.message : 'Error al cargar mesas',
        })
      }
    } finally {
      dispatch({ type: 'SET_TABLES_LOADING', loading: false })
    }
  }, [baseUrl, dispatch, setTables])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const openAccount = useCallback(
    async (table: PosTable) => {
      dispatch({ type: 'SET_ORDER_LOADING', loading: true })
      try {
        const order = await openTableAccount(baseUrl, table.id)
        setActiveOrder(order)
        navigate('order', table.id)
        await refresh()
      } catch (e) {
        dispatch({
          type: 'SET_ORDER_ERROR',
          error: e instanceof Error ? e.message : 'No se pudo abrir la cuenta',
        })
      } finally {
        dispatch({ type: 'SET_ORDER_LOADING', loading: false })
      }
    },
    [baseUrl, dispatch, navigate, refresh, setActiveOrder],
  )

  const enterAccount = useCallback(
    async (table: PosTable) => {
      if (!table.orderId) return openAccount(table)
      dispatch({ type: 'SET_ORDER_LOADING', loading: true })
      try {
        const order = await fetchPosOrder(baseUrl, table.orderId)
        setActiveOrder(order)
        navigate('order', table.id)
      } catch (e) {
        dispatch({
          type: 'SET_ORDER_ERROR',
          error: e instanceof Error ? e.message : 'No se pudo cargar la cuenta',
        })
      } finally {
        dispatch({ type: 'SET_ORDER_LOADING', loading: false })
      }
    },
    [baseUrl, dispatch, navigate, openAccount, setActiveOrder],
  )

  const closeTable = useCallback(
    async (table: PosTable) => {
      if (table.orderId) {
        navigate('payment', table.id)
        return
      }
      try {
        await closeTableAccount(baseUrl, table.id)
        await refresh()
      } catch (e) {
        dispatch({
          type: 'SET_TABLES_ERROR',
          error: e instanceof Error ? e.message : 'No se pudo cerrar la mesa',
        })
      }
    },
    [baseUrl, dispatch, navigate, refresh],
  )

  const toggleReserve = useCallback(
    async (table: PosTable) => {
      try {
        if (table.status === 'reserved') {
          await unreserveTable(baseUrl, table.id)
        } else if (table.status === 'free') {
          await reserveTable(baseUrl, table.id)
        }
        await refresh()
      } catch (e) {
        dispatch({
          type: 'SET_TABLES_ERROR',
          error: e instanceof Error ? e.message : 'No se pudo actualizar la mesa',
        })
      }
    },
    [baseUrl, dispatch, refresh],
  )

  const saveTable = useCallback(
    async (tableId: string, payload: UpdateTablePayload) => {
      dispatch({ type: 'SET_TABLES_ERROR', error: null })
      try {
        await updatePosTable(baseUrl, tableId, payload)
        await refresh()
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'No se pudo guardar la mesa'
        dispatch({ type: 'SET_TABLES_ERROR', error: msg })
        throw e
      }
    },
    [baseUrl, dispatch, refresh],
  )

  const addTable = useCallback(
    async (payload: CreateTablePayload) => {
      dispatch({ type: 'SET_TABLES_ERROR', error: null })
      try {
        await createPosTable(baseUrl, payload)
        await refresh()
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'No se pudo crear la mesa'
        dispatch({ type: 'SET_TABLES_ERROR', error: msg })
        throw e
      }
    },
    [baseUrl, dispatch, refresh],
  )

  return {
    tables: state.tables,
    loading: state.tablesLoading,
    error: state.tablesError,
    demoMode: state.demoMode,
    offline: state.offline,
    wsStatus: state.wsStatus,
    refresh,
    openAccount,
    enterAccount,
    closeTable,
    toggleReserve,
    saveTable,
    addTable,
  }
}
