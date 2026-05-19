import { useCallback, useMemo } from 'react'
import { computeOrderTotals } from '../lib/money'
import { fetchPosOrder, updatePosOrder } from '../services/posApi'
import { usePosStore } from '../store/posStore'
import type { OrderLine } from '../types'

function newLineId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function usePosOrder(baseUrl: string) {
  const { state, dispatch, setActiveOrder } = usePosStore()
  const order = state.activeOrder

  const totals = useMemo(() => {
    if (!order) return { subtotalCOP: 0, taxCOP: 0, totalCOP: 0 }
    return computeOrderTotals(order.lines, order.taxRate)
  }, [order])

  const persist = useCallback(
    async (next: NonNullable<typeof order>) => {
      const withTotals = {
        ...next,
        ...computeOrderTotals(next.lines, next.taxRate),
      }
      const saved = await updatePosOrder(baseUrl, withTotals)
      setActiveOrder(saved)
      return saved
    },
    [baseUrl, setActiveOrder],
  )

  const addProduct = useCallback(
    async (product: {
      id: string
      name: string
      price: number
    }) => {
      if (!order) return
      const existing = order.lines.find((l) => l.productId === product.id)
      let lines: OrderLine[]
      if (existing) {
        lines = order.lines.map((l) =>
          l.productId === product.id
            ? { ...l, quantity: l.quantity + 1 }
            : l,
        )
      } else {
        lines = [
          ...order.lines,
          {
            id: newLineId(),
            productId: product.id,
            productName: product.name,
            quantity: 1,
            unitPrice: product.price,
            notes: null,
          },
        ]
      }
      await persist({ ...order, lines })
    },
    [order, persist],
  )

  const setQuantity = useCallback(
    async (lineId: string, quantity: number) => {
      if (!order) return
      const q = Math.max(0, quantity)
      const lines =
        q === 0
          ? order.lines.filter((l) => l.id !== lineId)
          : order.lines.map((l) => (l.id === lineId ? { ...l, quantity: q } : l))
      await persist({ ...order, lines })
    },
    [order, persist],
  )

  const setLineNotes = useCallback(
    async (lineId: string, notes: string) => {
      if (!order) return
      const lines = order.lines.map((l) =>
        l.id === lineId ? { ...l, notes: notes.trim() || null } : l,
      )
      await persist({ ...order, lines })
    },
    [order, persist],
  )

  const removeLine = useCallback(
    async (lineId: string) => {
      if (!order) return
      await persist({
        ...order,
        lines: order.lines.filter((l) => l.id !== lineId),
      })
    },
    [order, persist],
  )

  const reload = useCallback(async () => {
    if (!order?.id) return
    dispatch({ type: 'SET_ORDER_LOADING', loading: true })
    try {
      const fresh = await fetchPosOrder(baseUrl, order.id)
      setActiveOrder(fresh)
    } catch (e) {
      dispatch({
        type: 'SET_ORDER_ERROR',
        error: e instanceof Error ? e.message : 'Error al recargar',
      })
    } finally {
      dispatch({ type: 'SET_ORDER_LOADING', loading: false })
    }
  }, [baseUrl, dispatch, order?.id, setActiveOrder])

  return {
    order,
    totals,
    loading: state.orderLoading,
    error: state.orderError,
    addProduct,
    setQuantity,
    setLineNotes,
    removeLine,
    reload,
  }
}
