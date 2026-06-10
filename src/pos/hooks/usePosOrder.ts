import { useCallback, useMemo } from 'react'
import { computeOrderTotals } from '../lib/money'
import {
  mergeOrderMeta,
  pickOrderMeta,
  writeCachedOrderMeta,
} from '../lib/orderMetaCache'
import { DEFAULT_POS_STAFF } from '../constants'
import { fetchPosOrder, isPosDemoMode, updatePosOrder } from '../services/posApi'
import { localPosApi } from '../services/offlineStorage'
import { usePosStore } from '../store/posStore'
import type { OrderLine, PaymentMethod, PosOrder, PosStaffMember } from '../types'

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
      writeCachedOrderMeta(withTotals.id, pickOrderMeta(withTotals))
      const saved = await updatePosOrder(baseUrl, withTotals)
      const merged = mergeOrderMeta({ ...saved, ...pickOrderMeta(withTotals) })
      setActiveOrder(merged)
      return merged
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

  const updateMeta = useCallback(
    (patch: {
      mesa?: string
      customerPhone?: string
      paymentMethod?: PaymentMethod | null
      transferReference?: string | null
      transferReceiptDataUrl?: string | null
      notes?: string
      attendedBy?: PosStaffMember | null
      cashTenderedCOP?: number | null
    }) => {
      if (!order) return
      const next: PosOrder = {
        ...order,
        mesa: patch.mesa !== undefined ? patch.mesa : order.mesa,
        customerPhone:
          patch.customerPhone !== undefined
            ? patch.customerPhone
            : order.customerPhone,
        paymentMethod:
          patch.paymentMethod !== undefined
            ? patch.paymentMethod
            : order.paymentMethod,
        transferReference:
          patch.transferReference !== undefined
            ? patch.transferReference
            : patch.paymentMethod === 'cash'
              ? null
              : order.transferReference,
        transferReceiptDataUrl:
          patch.transferReceiptDataUrl !== undefined
            ? patch.transferReceiptDataUrl
            : patch.paymentMethod === 'cash'
              ? null
              : order.transferReceiptDataUrl,
        notes: patch.notes !== undefined ? patch.notes : order.notes,
        attendedBy:
          patch.attendedBy !== undefined ? patch.attendedBy : order.attendedBy,
        cashTenderedCOP:
          patch.cashTenderedCOP !== undefined
            ? patch.cashTenderedCOP
            : patch.paymentMethod === 'transfer'
              ? null
              : order.cashTenderedCOP,
      }
      writeCachedOrderMeta(next.id, pickOrderMeta(next))
      setActiveOrder(next)
      if (isPosDemoMode()) {
        localPosApi.updateOrder({
          ...next,
          ...computeOrderTotals(next.lines, next.taxRate),
        })
      }
    },
    [order, setActiveOrder],
  )

  const meta = useMemo(
    () =>
      order
        ? {
            mesa: order.mesa ?? order.tableName ?? '',
            customerPhone: order.customerPhone ?? '',
            paymentMethod: order.paymentMethod ?? null,
            transferReference: order.transferReference ?? '',
            transferReceiptDataUrl: order.transferReceiptDataUrl ?? null,
            notes: order.notes ?? '',
            attendedBy: order.attendedBy ?? DEFAULT_POS_STAFF,
            cashTenderedCOP: order.cashTenderedCOP ?? 0,
          }
        : null,
    [order],
  )

  const reload = useCallback(async () => {
    if (!order?.id) return
    dispatch({ type: 'SET_ORDER_LOADING', loading: true })
    try {
      const fresh = mergeOrderMeta(await fetchPosOrder(baseUrl, order.id))
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
    meta,
    loading: state.orderLoading,
    error: state.orderError,
    addProduct,
    setQuantity,
    setLineNotes,
    removeLine,
    updateMeta,
    reload,
  }
}
