import { useCallback, useState } from 'react'
import { incrementDailySalesCount } from '../lib/dailySalesCount'
import { formatPosOrderCode } from '../lib/orderCode'
import { hasTransferReceipt } from '../lib/transferReceipt'
import { fetchPosTables, payPosOrder } from '../services/posApi'
import { registerPlatformSaleFromPosOrder } from '../services/platformPosPay'
import { usePosStore } from '../store/posStore'
import type { PaymentMethod, PaymentSplit, PosOrder, PosStaffMember } from '../types'

type ConfirmInput = {
  order: PosOrder
  totalCOP: number
  paymentMethod: PaymentMethod
  attendedBy: PosStaffMember | null
  cashTenderedCOP: number
  transferReceiptDataUrl: string | null
  notes?: string
}

type ConfirmResult =
  | { ok: true; saleId: string }
  | { ok: false; reason: 'staff' | 'cash' | 'transfer' | 'error'; message: string }

export function usePosCheckout(baseUrl: string) {
  const { setActiveOrder, setCheckoutSuccess, setTables, navigate } = usePosStore()
  const [busy, setBusy] = useState(false)

  const validate = useCallback((input: ConfirmInput): ConfirmResult | { ok: true; ready: true } => {
    const { paymentMethod, attendedBy, cashTenderedCOP, transferReceiptDataUrl, totalCOP } =
      input

    if (!attendedBy) {
      return { ok: false, reason: 'staff', message: 'Elegí quién atendió.' }
    }
    if (paymentMethod === 'transfer' && !hasTransferReceipt(transferReceiptDataUrl)) {
      return {
        ok: false,
        reason: 'transfer',
        message: 'Adjuntá el comprobante de transferencia.',
      }
    }
    if (paymentMethod === 'cash' && cashTenderedCOP < totalCOP) {
      return {
        ok: false,
        reason: 'cash',
        message: 'Ingresá el efectivo recibido.',
      }
    }
    return { ok: true, ready: true }
  }, [])

  const confirmSale = useCallback(
    async (input: ConfirmInput): Promise<ConfirmResult> => {
      const check = validate(input)
      if (!('ready' in check)) return check

      const {
        order,
        totalCOP,
        paymentMethod,
        attendedBy,
        cashTenderedCOP,
        transferReceiptDataUrl,
        notes,
      } = input

      setBusy(true)
      try {
        const splits: PaymentSplit[] = [{ method: paymentMethod, amountCOP: totalCOP }]
        const payload = {
          splits,
          tipCOP: 0,
          printReceipt: true,
          saleComment: notes?.trim() || undefined,
          attendedBy: attendedBy!,
          cashTenderedCOP: paymentMethod === 'cash' ? cashTenderedCOP : undefined,
          transferReceiptDataUrl: transferReceiptDataUrl ?? undefined,
        }
        const sale = await registerPlatformSaleFromPosOrder(baseUrl, order, payload)
        await payPosOrder(baseUrl, order.id, {
          splits: payload.splits,
          tipCOP: payload.tipCOP,
          printReceipt: payload.printReceipt,
          attendedBy: payload.attendedBy,
          cashTenderedCOP: payload.cashTenderedCOP,
          transferReceiptDataUrl: payload.transferReceiptDataUrl,
        })

        const saleId =
          sale?.code?.trim() || sale?.id || formatPosOrderCode(order)

        const dailyCount = incrementDailySalesCount()
        setActiveOrder(null)
        setCheckoutSuccess({ saleId, dailyCount })
        navigate('tables')
        try {
          const tables = await fetchPosTables(baseUrl)
          setTables(tables)
        } catch {
          /* el overlay refresca al cerrar */
        }
        return { ok: true, saleId }
      } catch (e) {
        return {
          ok: false,
          reason: 'error',
          message: e instanceof Error ? e.message : 'Error al confirmar la venta',
        }
      } finally {
        setBusy(false)
      }
    },
    [baseUrl, navigate, setActiveOrder, setCheckoutSuccess, setTables, validate],
  )

  return { busy, validate, confirmSale }
}
