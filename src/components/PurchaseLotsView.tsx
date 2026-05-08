import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  deleteInventoryItem,
  displayPurchaseLotSupplier,
  fetchInventoryItems,
  fetchPurchaseLot,
  fetchPurchaseLots,
  formatPurchaseLotDate,
  patchPurchaseLot,
  purchaseLotDateToInputValue,
  updateInventoryItem,
  type InventoryRow,
  type PurchaseLotRow,
} from '../api'
import {
  isCapitalAssetBehavior,
  resolveLotLineInventoryBehavior,
} from '../inventorySemantics'

type PurchaseLotInvoiceItem = NonNullable<PurchaseLotRow['items']>[number]

const LIMIT = 100

function getPurchaseLotIdFromHash(): string | null {
  const raw = (window.location.hash ?? '').replace(/^#/, '')
  const [path] = raw.split('?')
  const parts = (path ?? '').split('/').filter(Boolean)
  if (parts[0] !== 'purchases') return null
  return parts[1] ?? null
}

function pushRouteToPurchaseLot(id: string): void {
  window.history.pushState({}, '', `#/purchases/${id}`)
}

function replaceRouteToPurchasesList(): void {
  window.history.replaceState({}, '', '#/purchases')
}

function paginationDots(current: number, total: number): number[] {
  if (total <= 1) return []
  const out: number[] = []
  const start = Math.max(1, current - 2)
  const end = Math.min(total, current + 2)
  for (let p = start; p <= end; p++) out.push(p)
  if (!out.includes(1)) out.unshift(1)
  if (!out.includes(total)) out.push(total)
  return out
}

function num(v: string | number | null | undefined): number {
  const n = parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

function formatCOP(value: string | number | null | undefined): string {
  const n = num(value)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n)
}

function qty(v: string | number | null | undefined): number {
  const n = num(v)
  return Number.isFinite(n) ? n : 0
}

/** Métricas del API (p. ej. Decimal como string); si falta o no es finito, usa el valor calculado en cliente. */
function metricNum(
  v: string | number | null | undefined,
  fallback: number,
): number {
  if (v === null || v === undefined) return fallback
  if (typeof v === 'string' && !v.trim()) return fallback
  const n = num(v)
  return Number.isFinite(n) ? n : fallback
}

/** Unidad de inventario: permite porciones, peso, volumen, etc. (se envía al API tal cual). */
function normalizeInventoryUnit(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

function inventoryMatchByProductName(
  lotInv: InventoryRow[],
  productName: string,
): InventoryRow | undefined {
  const n = productName.trim().toLowerCase()
  return lotInv.find((r) => r.name.trim().toLowerCase() === n)
}

/** Cruza ítem del comprobante con inventario por `id` (preferido) o por nombre. */
function inventoryMatchForLotItem(
  lotInv: InventoryRow[],
  item: PurchaseLotInvoiceItem,
): InventoryRow | undefined {
  const id = item.id?.trim()
  if (id) {
    const byId = lotInv.find((r) => r.id === id)
    if (byId) return byId
  }
  return inventoryMatchByProductName(lotInv, item.name)
}

/** Fallback solo para APIs antiguas sin `items[].purchase` ni `purchaseLines`. */
function legacyLinePurchaseCostFallback(
  inv: InventoryRow,
  invoiceLine: PurchaseLotInvoiceItem | undefined,
): number {
  const cStock = num(inv.unitCost)
  const qStock = qty(inv.quantity)

  if (invoiceLine) {
    const qDoc = qty(invoiceLine.quantity)
    const cDoc = num(invoiceLine.unitCost)
    if (Number.isFinite(qDoc) && Number.isFinite(cDoc)) return qDoc * cDoc
    if (Number.isFinite(qDoc) && Number.isFinite(cStock)) return qDoc * cStock
  }

  if (Number.isFinite(qStock) && Number.isFinite(cStock) && qStock > 0) {
    return qStock * cStock
  }

  const receivedRaw = inv.stats?.movements?.received
  const received =
    typeof receivedRaw === 'number' && Number.isFinite(receivedRaw)
      ? receivedRaw
      : NaN
  if (Number.isFinite(received) && received > 0 && Number.isFinite(cStock)) {
    return received * cStock
  }

  return NaN
}

/**
 * Costo histórico de la línea (comprobante). Prioriza `items[].purchase` y `purchaseLines`;
 * no usar solo existencias × unitCost del inventario.
 */
function linePurchaseCostCOP(
  inv: InventoryRow,
  invoiceLine: PurchaseLotInvoiceItem | undefined,
  lotRow: PurchaseLotRow | null,
): number {
  if (invoiceLine?.purchase != null) {
    const n = num(invoiceLine.purchase.linePurchaseTotalCOP)
    if (Number.isFinite(n)) return n
  }
  if (lotRow?.purchaseLines?.length && inv.id) {
    const pl = lotRow.purchaseLines.find(
      (x) =>
        x.inventoryItemId != null &&
        String(x.inventoryItemId) === String(inv.id),
    )
    if (pl != null) {
      const n = num(pl.linePurchaseTotalCOP)
      if (Number.isFinite(n)) return n
    }
  }
  return legacyLinePurchaseCostFallback(inv, invoiceLine)
}

/**
 * Total del lote / pie de factura: `purchaseTotals.linesPurchaseTotalCOP` o
 * `inventoryMetrics.purchasedValueCOP` con comprobante; no el valor remanente en stock.
 */
function lotPurchaseTotalCOP(lotRow: PurchaseLotRow | null): number {
  if (!lotRow) return NaN

  const fromTotals = num(lotRow.purchaseTotals?.linesPurchaseTotalCOP)
  if (Number.isFinite(fromTotals)) return fromTotals

  const hasComprobante =
    Boolean(lotRow.items?.length) || Boolean(lotRow.purchaseLines?.length)
  if (hasComprobante) {
    const fromMetrics = num(lotRow.inventoryMetrics?.purchasedValueCOP)
    if (Number.isFinite(fromMetrics)) return fromMetrics
  }

  let sumFromItems = 0
  let anyPurchaseOnItems = false
  if (lotRow.items?.length) {
    for (const it of lotRow.items) {
      if (it.purchase != null) {
        const n = num(it.purchase.linePurchaseTotalCOP)
        if (Number.isFinite(n)) {
          sumFromItems += n
          anyPurchaseOnItems = true
        }
      }
    }
  }
  if (anyPurchaseOnItems) return sumFromItems

  if (lotRow.purchaseLines?.length) {
    let s = 0
    let any = false
    for (const pl of lotRow.purchaseLines) {
      const n = num(pl.linePurchaseTotalCOP)
      if (Number.isFinite(n)) {
        s += n
        any = true
      }
    }
    if (any) return s
  }

  if (lotRow.totalValue != null && String(lotRow.totalValue).trim() !== '') {
    const tv = num(lotRow.totalValue)
    if (Number.isFinite(tv)) return tv
  }

  if (lotRow.items?.length) {
    let sum = 0
    let legacyOk = false
    for (const it of lotRow.items) {
      const q = qty(it.quantity)
      const c = num(it.unitCost)
      if (Number.isFinite(q) && Number.isFinite(c)) {
        sum += q * c
        legacyOk = true
      }
    }
    if (legacyOk) return sum
  }

  return NaN
}

/** Total COP en listado (misma jerarquía que el detalle cuando el API lo envía). */
function purchaseLotRowTotalCOP(row: PurchaseLotRow): number {
  const fromTotals = num(row.purchaseTotals?.linesPurchaseTotalCOP)
  if (Number.isFinite(fromTotals)) return fromTotals

  const hasLines = Boolean(row.items?.length || row.purchaseLines?.length)
  if (hasLines) {
    const pv = num(row.inventoryMetrics?.purchasedValueCOP)
    if (Number.isFinite(pv)) return pv
  }

  if (row.totalValue != null && String(row.totalValue).trim() !== '') {
    const tv = num(row.totalValue)
    if (Number.isFinite(tv)) return tv
  }

  let s = 0
  let any = false
  if (row.items?.length) {
    for (const it of row.items) {
      if (it.purchase != null) {
        const n = num(it.purchase.linePurchaseTotalCOP)
        if (Number.isFinite(n)) {
          s += n
          any = true
        }
      }
    }
  }
  if (any) return s

  if (row.items?.length) {
    let sum = 0
    for (const it of row.items) {
      const q = qty(it.quantity)
      const c = num(it.unitCost)
      if (Number.isFinite(q) && Number.isFinite(c)) sum += q * c
    }
    return sum
  }
  return NaN
}

function purchaseLotInitialDepleted(row: PurchaseLotRow): boolean {
  const m = row.inventoryMetrics
  return m?.isDepleted === true || m?.consumptionStatus === 'DEPLETED'
}

function lotConsumptionStatusLabel(
  status: string | null | undefined,
  isDepleted?: boolean,
): string {
  if (isDepleted) return 'Consumido'
  const s = String(status ?? '').toUpperCase()
  if (s === 'DEPLETED') return 'Consumido'
  if (s === 'EMPTY') return 'Vacio'
  if (s === 'FRESH') return 'Nuevo'
  if (s === 'PARTIAL') return 'Parcial'
  return '—'
}

function looksLikeUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s.trim(),
  )
}

/** Nombre legible: `name` del API; si no, `code` salvo que parezca UUID (no usarlo como título). */
function purchaseLotDisplayName(row: { code: string; name?: string | null }): string {
  const n = row.name?.trim()
  if (n) return n
  const c = row.code?.trim()
  if (!c) return '—'
  if (looksLikeUuid(c)) return 'Sin nombre de lote'
  return c
}

/** Línea secundaria bajo el nombre: código distinto al título, o código UUID si no hay nombre. */
function purchaseLotSecondaryLine(row: {
  code: string
  name?: string | null
}): string | null {
  const n = row.name?.trim()
  const c = row.code?.trim()
  if (!c) return null
  if (n && n !== c) return c
  if (!n && looksLikeUuid(c)) return `Código: ${c}`
  return null
}

export function PurchaseLotsView({ baseUrl }: { baseUrl: string }) {
  const [list, setList] = useState<PurchaseLotRow[]>([])
  const [meta, setMeta] = useState<{
    page: number
    limit: number
    total: number
    hasNextPage: boolean
  } | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [listSort, setListSort] = useState<
    | 'date_desc'
    | 'date_asc'
    | 'name_asc'
    | 'total_desc'
    | 'total_asc'
    | 'available_desc'
    | 'available_asc'
  >('date_desc')
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** Fila de lista al abrir el panel (nombre/código para el encabezado). */
  const [selectedLotRow, setSelectedLotRow] = useState<PurchaseLotRow | null>(
    null,
  )
  const [lotInventory, setLotInventory] = useState<InventoryRow[]>([])
  const [lotInventoryLoading, setLotInventoryLoading] = useState(false)
  const [lotInventoryError, setLotInventoryError] = useState<string | null>(
    null,
  )
  const [lotItemError, setLotItemError] = useState<string | null>(null)
  const [lotItemSavingId, setLotItemSavingId] = useState<string | null>(null)
  /** Cantidad a restar por fila (consumo / uso) antes de pulsar Restar. */
  const [deductDraft, setDeductDraft] = useState<Record<string, string>>({})
  /** Popup de edición de una línea de inventario del lote. */
  const [lotItemEdit, setLotItemEdit] = useState<{
    invId: string
    invoiceLine?: PurchaseLotInvoiceItem
  } | null>(null)
  /** Popup con ficha del lote (fecha, proveedor, guardar). */
  const [lotMetaEditOpen, setLotMetaEditOpen] = useState(false)
  const [lotItemFilter, setLotItemFilter] = useState<'all' | 'available' | 'consumed'>(
    'all',
  )
  const [lotItemSort, setLotItemSort] = useState<
    'name_asc' | 'qty_desc' | 'qty_asc' | 'cost_desc' | 'subtotal_desc'
  >('name_asc')
  const [draft, setDraft] = useState<{
    purchaseDate: string
    supplier: string
    notes: string
    totalValue: string
    /** Declarado por el usuario: lote cerrado (agotado) o aún con saldo. */
    isDepleted: boolean
  } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search), 320)
    return () => window.clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [searchDebounced, filterDateFrom, filterDateTo])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setListError(null)
    fetchPurchaseLots(baseUrl, {
      page,
      limit: LIMIT,
      search: searchDebounced.trim() || undefined,
      dateFrom: filterDateFrom || undefined,
      dateTo: filterDateTo || undefined,
      signal: controller.signal,
    })
      .then((res) => {
        if (!controller.signal.aborted) {
          setList(res.data)
          setMeta(res.meta)
        }
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setListError(e.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => {
      controller.abort()
    }
  }, [baseUrl, page, searchDebounced, filterDateFrom, filterDateTo])

  const openLot = useCallback(
    async (id: string, row?: PurchaseLotRow, updateHash = false) => {
      if (updateHash) pushRouteToPurchaseLot(id)
      if (row) setSelectedLotRow(row)
      setLotMetaEditOpen(false)
      setLotInventory([])
      setDeductDraft({})
      setLotInventoryError(null)
      setLotItemError(null)
      setSelectedId(id)
      setSaveError(null)
      setDetailLoading(true)
      try {
        const d = await fetchPurchaseLot(baseUrl, id)
        setSelectedLotRow(d)
        setDraft({
          purchaseDate: purchaseLotDateToInputValue(d.purchaseDate),
          supplier: d.supplier ?? '',
          notes: d.notes ?? '',
          totalValue:
            d.totalValue != null ? String(num(d.totalValue)) : '',
          isDepleted: purchaseLotInitialDepleted(d),
        })
      } catch (e) {
        setSaveError((e as Error).message)
        setDraft(null)
        setSelectedId(null)
        setSelectedLotRow(null)
      } finally {
        setDetailLoading(false)
      }
    },
    [baseUrl],
  )

  const closePanelState = useCallback(() => {
    setSelectedId(null)
    setSelectedLotRow(null)
    setLotInventory([])
    setLotInventoryError(null)
    setLotItemError(null)
    setLotItemSavingId(null)
    setDeductDraft({})
      setLotItemEdit(null)
      setLotMetaEditOpen(false)
      setDraft(null)
      setSaveError(null)
    }, [])

  const closePanel = useCallback(() => {
    closePanelState()
    replaceRouteToPurchasesList()
  }, [closePanelState])

  useEffect(() => {
    if (!lotItemEdit && !lotMetaEditOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (lotItemEdit) setLotItemEdit(null)
      else setLotMetaEditOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lotItemEdit, lotMetaEditOpen])

  useEffect(() => {
    const hashId = getPurchaseLotIdFromHash()
    if (hashId) void openLot(hashId)
    const onHash = () => {
      const id = getPurchaseLotIdFromHash()
      if (id) {
        if (id !== selectedId) void openLot(id)
      } else if (selectedId) {
        closePanelState()
      }
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [closePanelState, openLot, selectedId])

  useEffect(() => {
    const code = selectedLotRow?.code?.trim()
    if (!selectedId || !code) {
      setLotInventory([])
      setLotInventoryLoading(false)
      return
    }
    const controller = new AbortController()
    setLotInventoryLoading(true)
    setLotInventoryError(null)
    fetchInventoryItems(baseUrl, {
      page: 1,
      limit: 100,
      lot: code,
      includeStats: true,
      signal: controller.signal,
    })
      .then((res) => {
        if (!controller.signal.aborted) setLotInventory(res.data)
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) {
          setLotInventory([])
          setLotInventoryError(e.message)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLotInventoryLoading(false)
      })
    return () => {
      controller.abort()
    }
  }, [baseUrl, selectedId, selectedLotRow?.code])

  useEffect(() => {
    const t = String(lotPurchaseTotalCOP(selectedLotRow))
    setDraft((prev) => {
      if (!prev) return prev
      if (prev.totalValue === t) return prev
      return { ...prev, totalValue: t }
    })
  }, [selectedLotRow])

  const updateLotItemField = useCallback(
    async (
      inv: InventoryRow,
      patch: { quantity?: string; unitCost?: string; unit?: string },
    ): Promise<boolean> => {
      const payload: {
        quantity?: number
        unitCost?: number
        unit?: string
      } = {}
      if (patch.quantity != null) {
        const q = parseFloat(patch.quantity.replace(',', '.'))
        if (!Number.isFinite(q) || q < 0) {
          setLotItemError('Cantidad inválida.')
          return false
        }
        payload.quantity = q
      }
      if (patch.unitCost != null) {
        const c = parseFloat(patch.unitCost.replace(',', '.'))
        if (!Number.isFinite(c) || c < 0) {
          setLotItemError('Costo unitario inválido.')
          return false
        }
        payload.unitCost = c
      }
      if (patch.unit != null) {
        const u = normalizeInventoryUnit(patch.unit)
        if (!u) {
          setLotItemError('La unidad no puede quedar vacía.')
          return false
        }
        payload.unit = u
      }
      if (
        payload.quantity == null &&
        payload.unitCost == null &&
        payload.unit == null
      )
        return false
      setLotItemSavingId(inv.id)
      setLotItemError(null)
      try {
        const updated = await updateInventoryItem(baseUrl, inv.id, payload)
        setLotInventory((prev) => prev.map((x) => (x.id === inv.id ? updated : x)))
        return true
      } catch (e) {
        setLotItemError((e as Error).message)
        return false
      } finally {
        setLotItemSavingId(null)
      }
    },
    [baseUrl],
  )

  const adjustLotItemExistenciaStep = useCallback(
    async (
      inv: InventoryRow,
      invoiceLine: PurchaseLotInvoiceItem | undefined,
      direction: -1 | 1,
    ) => {
      const row = lotInventory.find((x) => x.id === inv.id) ?? inv
      const current = qty(row.quantity)
      const step = 1
      let next = Math.round((current + direction * step) * 100) / 100
      if (invoiceLine) {
        const cap = qty(invoiceLine.quantity)
        next = Math.max(0, Math.min(cap, next))
      } else {
        next = Math.max(0, next)
      }
      if (next === current) return
      await updateLotItemField(inv, { quantity: String(next) })
    },
    [lotInventory, updateLotItemField],
  )

  const applyDeductQuantity = useCallback(
    async (inv: InventoryRow) => {
      const raw = (deductDraft[inv.id] ?? '').trim()
      const deduct = parseFloat(raw.replace(',', '.'))
      if (!Number.isFinite(deduct) || deduct <= 0) {
        setLotItemError('Indicá cuánto descontar (número mayor que 0).')
        return
      }
      const row = lotInventory.find((x) => x.id === inv.id)
      const cur = qty(row?.quantity ?? inv.quantity)
      const next = Math.max(0, cur - deduct)
      setLotItemError(null)
      const ok = await updateLotItemField(inv, { quantity: String(next) })
      if (ok) {
        setDeductDraft((d) => {
          const nextDraft = { ...d }
          delete nextDraft[inv.id]
          return nextDraft
        })
      }
    },
    [deductDraft, lotInventory, updateLotItemField],
  )

  const agotarLotItemQuantity = useCallback(
    async (inv: InventoryRow) => {
      if (
        !window.confirm(
          `¿Poner cantidad en 0 para "${inv.name}"? (queda agotado en este lote)`,
        )
      )
        return
      setLotItemError(null)
      const ok = await updateLotItemField(inv, { quantity: '0' })
      if (ok) {
        setDeductDraft((d) => {
          const next = { ...d }
          delete next[inv.id]
          return next
        })
      }
    },
    [updateLotItemField],
  )

  const deleteLotItem = useCallback(
    async (inv: InventoryRow) => {
      if (!window.confirm(`¿Eliminar el ítem "${inv.name}" de este lote?`)) return
      setLotItemSavingId(inv.id)
      setLotItemError(null)
      try {
        await deleteInventoryItem(baseUrl, inv.id)
        setLotInventory((prev) => prev.filter((x) => x.id !== inv.id))
        setLotItemEdit((cur) => (cur?.invId === inv.id ? null : cur))
      } catch (e) {
        setLotItemError((e as Error).message)
      } finally {
        setLotItemSavingId(null)
      }
    },
    [baseUrl],
  )

  const save = useCallback(async () => {
    if (!selectedId || !draft) return
    const dateStr = draft.purchaseDate.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      setSaveError('Fecha inválida.')
      return
    }
    const [y, mo, da] = dateStr.split('-').map(Number)
    const check = new Date(y, mo - 1, da)
    if (
      Number.isNaN(check.getTime()) ||
      check.getFullYear() !== y ||
      check.getMonth() !== mo - 1 ||
      check.getDate() !== da
    ) {
      setSaveError('Fecha inválida.')
      return
    }

    for (const inv of lotInventory) {
      const q = num(inv.quantity)
      const c = num(inv.unitCost)
      if (!Number.isFinite(q) || q < 0 || !Number.isFinite(c) || c < 0) {
        setSaveError(
          'Hay ítems con cantidad o costo inválido. Corrige los valores del lote.',
        )
        return
      }
    }

    const totalValue = lotPurchaseTotalCOP(selectedLotRow)

    setSaving(true)
    setSaveError(null)
    try {
      const patchPayload: Parameters<typeof patchPurchaseLot>[2] = {
        purchaseDate: dateStr,
        supplier: draft.supplier.trim() || undefined,
        notes: draft.notes.trim() || undefined,
        totalValue,
      }
      if (draft.isDepleted) patchPayload.consumptionStatus = 'DEPLETED'
      await patchPurchaseLot(baseUrl, selectedId, patchPayload)
      const res = await fetchPurchaseLots(baseUrl, {
        page,
        limit: LIMIT,
        search: searchDebounced.trim() || undefined,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
      })
      setList(res.data)
      setMeta(res.meta)
      closePanel()
    } catch (e) {
      setSaveError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }, [
    baseUrl,
    closePanel,
    draft,
    filterDateFrom,
    filterDateTo,
    page,
    searchDebounced,
    selectedId,
    lotInventory,
    selectedLotRow,
  ])

  const panelLotSecondary = selectedLotRow
    ? purchaseLotSecondaryLine(selectedLotRow)
    : null
  const sortedList = useMemo(() => {
    const arr = [...list]
    arr.sort((a, b) => {
      switch (listSort) {
        case 'date_asc':
          return String(a.purchaseDate).localeCompare(String(b.purchaseDate))
        case 'date_desc':
          return String(b.purchaseDate).localeCompare(String(a.purchaseDate))
        case 'name_asc':
          return purchaseLotDisplayName(a).localeCompare(purchaseLotDisplayName(b), 'es')
        case 'total_asc': {
          const ta = purchaseLotRowTotalCOP(a)
          const tb = purchaseLotRowTotalCOP(b)
          return (
            (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0)
          )
        }
        case 'total_desc': {
          const ta = purchaseLotRowTotalCOP(a)
          const tb = purchaseLotRowTotalCOP(b)
          return (
            (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
          )
        }
        case 'available_asc':
          return qty(a.inventoryMetrics?.availableItemsCount) -
            qty(b.inventoryMetrics?.availableItemsCount)
        case 'available_desc':
          return qty(b.inventoryMetrics?.availableItemsCount) -
            qty(a.inventoryMetrics?.availableItemsCount)
        default:
          return 0
      }
    })
    return arr
  }, [list, listSort])
  const lotItemsStats = useMemo(() => {
    const metrics = selectedLotRow?.inventoryMetrics ?? null
    let available = 0
    let consumed = 0
    let remainingUnits = 0
    let remainingValue = 0
    for (const r of lotInventory) {
      const q = qty(r.quantity)
      const c = qty(r.unitCost)
      const behavior = resolveLotLineInventoryBehavior(r, selectedLotRow)
      const isAsset = behavior === 'CAPITAL_ASSET'
      if (q > 0) {
        available++
        remainingUnits += q
        remainingValue += q * c
      } else if (!isAsset) {
        consumed++
      }
    }

    /** No forzar DEPLETED solo porque todas las existencias en cliente son 0 (el backend ya excluye activos). */
    const computedDepleted =
      metrics?.isDepleted === true ||
      metrics?.consumptionStatus === 'DEPLETED'

    const fullyConsumed =
      draft != null ? draft.isDepleted : Boolean(computedDepleted)

    let consumptionStatus = metrics?.consumptionStatus
    if (draft != null) {
      if (draft.isDepleted) consumptionStatus = 'DEPLETED'
      else if (consumptionStatus === 'DEPLETED') consumptionStatus = 'PARTIAL'
    }

    return {
      totalItems: metricNum(metrics?.productsCount, lotInventory.length),
      availableItems: metricNum(metrics?.availableItemsCount, available),
      consumedItems: metricNum(metrics?.consumedItemsCount, consumed),
      remainingUnits: metricNum(metrics?.remainingUnits, remainingUnits),
      remainingValue: metricNum(metrics?.remainingValue, remainingValue),
      fullyConsumed,
      consumptionStatus,
    }
  }, [lotInventory, selectedLotRow, draft?.isDepleted])
  const visibleLotItems = useMemo(() => {
    const filtered = lotInventory.filter((r) => {
      const behavior = resolveLotLineInventoryBehavior(r, selectedLotRow)
      if (behavior === 'CAPITAL_ASSET') return lotItemFilter === 'all'
      const q = qty(r.quantity)
      if (lotItemFilter === 'available') return q > 0
      if (lotItemFilter === 'consumed') return q <= 0
      return true
    })
    filtered.sort((a, b) => {
      const qa = qty(a.quantity)
      const qb = qty(b.quantity)
      const ca = qty(a.unitCost)
      const cb = qty(b.unitCost)
      if (lotItemSort === 'name_asc') {
        return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'es')
      }
      if (lotItemSort === 'qty_desc') return qb - qa
      if (lotItemSort === 'qty_asc') return qa - qb
      if (lotItemSort === 'cost_desc') return cb - ca
      return qb * cb - qa * ca
    })
    return filtered
  }, [lotInventory, lotItemFilter, lotItemSort, selectedLotRow])

  const orphanLotInventory = useMemo(() => {
    const names = new Set(
      (selectedLotRow?.items ?? []).map((i) => i.name.trim().toLowerCase()),
    )
    return lotInventory.filter(
      (r) => !names.has(r.name.trim().toLowerCase()),
    )
  }, [lotInventory, selectedLotRow?.items])

  const visibleOrphanItems = useMemo(() => {
    const filtered = orphanLotInventory.filter((r) => {
      const behavior = resolveLotLineInventoryBehavior(r, selectedLotRow)
      if (behavior === 'CAPITAL_ASSET') return lotItemFilter === 'all'
      const q = qty(r.quantity)
      if (lotItemFilter === 'available') return q > 0
      if (lotItemFilter === 'consumed') return q <= 0
      return true
    })
    filtered.sort((a, b) => {
      const qa = qty(a.quantity)
      const qb = qty(b.quantity)
      const ca = qty(a.unitCost)
      const cb = qty(b.unitCost)
      if (lotItemSort === 'name_asc') {
        return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'es')
      }
      if (lotItemSort === 'qty_desc') return qb - qa
      if (lotItemSort === 'qty_asc') return qa - qb
      if (lotItemSort === 'cost_desc') return cb - ca
      return qb * cb - qa * ca
    })
    return filtered
  }, [orphanLotInventory, lotItemFilter, lotItemSort, selectedLotRow])

  const hasApiLotItems = Boolean(
    selectedLotRow?.items?.length && selectedLotRow.items.length > 0,
  )
  const lotEditorVisibleRows = hasApiLotItems ? visibleOrphanItems : visibleLotItems
  const lotEditorSourceRows = hasApiLotItems ? orphanLotInventory : lotInventory

  function lotInventorySummaryTail(
    inv: InventoryRow,
    invoiceLine?: PurchaseLotInvoiceItem,
  ) {
    const rowUnit =
      lotInventory.find((x) => x.id === inv.id)?.unit ?? inv.unit
    const qNow = qty(inv.quantity)
    const qComprado = invoiceLine ? qty(invoiceLine.quantity) : null
    const resolvedBehavior =
      invoiceLine?.inventoryBehavior ??
      resolveLotLineInventoryBehavior(inv, selectedLotRow)
    const isAsset = isCapitalAssetBehavior(resolvedBehavior)
    const qConsumido =
      invoiceLine && qComprado != null && !isAsset
        ? Math.max(0, qComprado - qNow)
        : null
    return (
      <>
        <td
          className="num mono"
          title={
            isAsset
              ? 'Bien de uso: no aplica consumido como insumo.'
              : invoiceLine
                ? 'Cantidad ya usada del total comprado (comprado − existencias).'
                : undefined
          }
        >
          {isAsset ? (
            <span className="muted">—</span>
          ) : qConsumido != null ? (
            <>
              {qConsumido.toFixed(2)}{' '}
              <span className="muted small">{invoiceLine?.unit || ''}</span>
            </>
          ) : (
            <span className="muted">—</span>
          )}
        </td>
        <td className="num">
          <div className="purchases-stock-inline">
            <span className="purchases-stock-inline__main mono">
              {qNow.toFixed(2)}{' '}
              <span className="muted small">{rowUnit || '—'}</span>
            </span>
            <span
              className={
                isAsset
                  ? qNow > 0
                    ? 'purchases-stock-badge purchases-stock-badge--asset'
                    : 'purchases-stock-badge purchases-stock-badge--asset-muted'
                  : qNow > 0
                    ? 'purchases-stock-badge purchases-stock-badge--ok'
                    : 'purchases-stock-badge purchases-stock-badge--out'
              }
            >
              {isAsset
                ? qNow > 0
                  ? 'En operación'
                  : 'Adquirido'
                : qNow > 0
                  ? 'Por consumir'
                  : 'Agotado'}
            </span>
          </div>
        </td>
        <td
          className="num mono"
          title="Costo histórico de la línea; no debe perderse al agotar existencias."
        >
          {formatCOP(linePurchaseCostCOP(inv, invoiceLine, selectedLotRow))}
        </td>
        <td className="purchase-lot-td-actions">
          <button
            type="button"
            className="btn-secondary btn-compact purchase-lot-edit-btn"
            onClick={() =>
              setLotItemEdit({
                invId: inv.id,
                invoiceLine,
              })
            }
          >
            Gestionar
          </button>
        </td>
      </>
    )
  }

  function purchaseLotItemEditForm(
    inv: InventoryRow,
    invoiceLine: PurchaseLotInvoiceItem | undefined,
  ): ReactNode {
    const rowUnit =
      lotInventory.find((x) => x.id === inv.id)?.unit ?? inv.unit
    const qNow = qty(inv.quantity)
    const qComprado = invoiceLine ? qty(invoiceLine.quantity) : null
    const resolvedBehavior =
      invoiceLine?.inventoryBehavior ??
      resolveLotLineInventoryBehavior(inv, selectedLotRow)
    const isAsset = isCapitalAssetBehavior(resolvedBehavior)
    const qConsumido =
      qComprado != null && !isAsset ? Math.max(0, qComprado - qNow) : null
    const displayUnit = invoiceLine?.unit || rowUnit || 'un'
    return (
      <div className="purchase-lot-item-edit-form">
        <p className="muted small purchase-lot-item-edit-form__intro">
          {isAsset ? (
            <>
              <strong>Bien de uso (activo):</strong> no sigue el flujo consumido/agotado de
              insumos. Editás solo <strong>existencias</strong> si necesitás corregir el
              registro. El <strong>costo de compra</strong> sigue siendo el del comprobante.
            </>
          ) : (
            <>
              Solo editás <strong>existencias</strong> (cuánto queda y cuánto se consumió). El{' '}
              <strong>costo de compra</strong> es lo que ya pagaste: no debe bajar al descontar.
            </>
          )}
        </p>
        {invoiceLine ? (
          <p className="muted small purchase-lot-item-edit-form__comprobante">
            Comprobante — comprado:{' '}
            <strong className="mono">
              {qty(invoiceLine.quantity).toFixed(2)} {invoiceLine.unit || ''}
            </strong>
          </p>
        ) : null}
        {invoiceLine ? (
          <div className="purchase-lot-item-edit-form__metrics" aria-label="Resumen de existencias">
            <div className="purchase-lot-item-edit-form__metric-card">
              <span className="purchase-lot-item-edit-form__metric-label">Comprado</span>
              <span className="mono purchase-lot-item-edit-form__metric-value">
                {(qComprado ?? 0).toFixed(2)} {displayUnit}
              </span>
            </div>
            <div className="purchase-lot-item-edit-form__metric-card">
              <span className="purchase-lot-item-edit-form__metric-label">Consumido</span>
              <span className="mono purchase-lot-item-edit-form__metric-value">
                {isAsset ? '—' : `${(qConsumido ?? 0).toFixed(2)} ${displayUnit}`}
              </span>
            </div>
            <div className="purchase-lot-item-edit-form__metric-card">
              <span className="purchase-lot-item-edit-form__metric-label">Disponible</span>
              <span className="mono purchase-lot-item-edit-form__metric-value">
                {qNow.toFixed(2)} {displayUnit}
              </span>
            </div>
          </div>
        ) : null}
        {invoiceLine && !isAsset ? (
          <label className="field">
            <span>Unidades consumidas (editar)</span>
            <input
              className="input-cell"
              inputMode="decimal"
              title={`Consumido en ${displayUnit}`}
              aria-label={`Cantidad consumida de ${inv.name}`}
              value={String(
                (() => {
                  const comprado = qty(invoiceLine.quantity)
                  const now = qty(
                    lotInventory.find((x) => x.id === inv.id)?.quantity ?? inv.quantity,
                  )
                  return Math.max(0, comprado - now)
                })(),
              )}
              onChange={(e) => {
                const consumidoRaw = parseFloat(e.target.value.replace(',', '.'))
                if (!Number.isFinite(consumidoRaw)) {
                  setLotInventory((prev) =>
                    prev.map((x) => (x.id === inv.id ? { ...x, quantity: e.target.value } : x)),
                  )
                  return
                }
                const comprado = qty(invoiceLine.quantity)
                const consumido = Math.max(0, Math.min(consumidoRaw, comprado))
                const nextQty = Math.max(0, comprado - consumido)
                setLotInventory((prev) =>
                  prev.map((x) =>
                    x.id === inv.id ? { ...x, quantity: String(nextQty) } : x,
                  ),
                )
              }}
              onBlur={() => {
                const currentQty = String(
                  lotInventory.find((x) => x.id === inv.id)?.quantity ?? inv.quantity,
                )
                void updateLotItemField(inv, { quantity: currentQty })
              }}
              disabled={lotItemSavingId === inv.id}
            />
            <p className="muted small">
              Se recalcula automáticamente la existencia: comprado - consumido.
            </p>
          </label>
        ) : null}
        {!invoiceLine ? (
          <>
            <label className="field">
              <span>Unidades en existencia (editar)</span>
              <div className="purchases-qty-unit-cell purchase-lot-item-edit-form__qty-row">
                <input
                  className="input-cell purchases-qty-unit-cell__qty"
                  inputMode="decimal"
                  title={`Cantidad en ${rowUnit || 'tu unidad'}`}
                  aria-label={`Cantidad en stock de ${inv.name}`}
                  value={String(inv.quantity)}
                  onChange={(e) =>
                    setLotInventory((prev) =>
                      prev.map((x) =>
                        x.id === inv.id ? { ...x, quantity: e.target.value } : x,
                      ),
                    )
                  }
                  onBlur={() => {
                    void updateLotItemField(inv, {
                      quantity: String(
                        lotInventory.find((x) => x.id === inv.id)?.quantity ??
                          inv.quantity,
                      ),
                    })
                  }}
                  disabled={lotItemSavingId === inv.id}
                />
                <input
                  className="input-cell purchases-qty-unit-cell__unit"
                  list="purchase-lot-unit-list"
                  title="Unidad (kg, porciones, un…)"
                  aria-label={`Unidad de ${inv.name}`}
                  value={String(inv.unit)}
                  onChange={(e) =>
                    setLotInventory((prev) =>
                      prev.map((x) =>
                        x.id === inv.id ? { ...x, unit: e.target.value } : x,
                      ),
                    )
                  }
                  onBlur={() => {
                    void updateLotItemField(inv, {
                      unit: String(
                        lotInventory.find((x) => x.id === inv.id)?.unit ?? inv.unit,
                      ),
                    })
                  }}
                  disabled={lotItemSavingId === inv.id}
                />
              </div>
            </label>
            {!isAsset ? (
              <div className="field">
                <span>Descontar (uso, merma, venta desde stock)</span>
                <div className="purchases-deduct-stack purchase-lot-item-edit-form__deduct">
                  <div className="purchases-deduct-stack__row">
                    <input
                      className="input-cell input-cell--deduct"
                      inputMode="decimal"
                      placeholder="Ej. 1"
                      title={`Restar en ${rowUnit || 'la unidad del ítem'}`}
                      aria-label={`Descontar cantidad de ${inv.name}`}
                      value={deductDraft[inv.id] ?? ''}
                      onChange={(e) =>
                        setDeductDraft((d) => ({
                          ...d,
                          [inv.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void applyDeductQuantity(inv)
                        }
                      }}
                      disabled={lotItemSavingId === inv.id}
                    />
                    <button
                      type="button"
                      className="btn-secondary btn-compact"
                      onClick={() => void applyDeductQuantity(inv)}
                      disabled={lotItemSavingId === inv.id}
                    >
                      Restar
                    </button>
                  </div>
                  <button
                    type="button"
                    className="purchases-deduct-agotar"
                    onClick={() => void agotarLotItemQuantity(inv)}
                    disabled={
                      lotItemSavingId === inv.id || qty(inv.quantity) <= 0
                    }
                  >
                    Agotar (0)
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
        <div className="purchase-lot-item-edit-form__stepper-field">
          <span className="purchase-lot-item-edit-form__stepper-label">
            Ajustar cantidad en existencia
          </span>
          <div
            className="purchase-lot-item-edit-form__stepper"
            role="group"
            aria-label="Aumentar o reducir cantidad"
          >
            <button
              type="button"
              className="btn-secondary btn-compact purchase-lot-qty-step"
              aria-label="Reducir cantidad"
              disabled={lotItemSavingId === inv.id || qNow <= 0}
              onClick={() => void adjustLotItemExistenciaStep(inv, invoiceLine, -1)}
            >
              −
            </button>
            <button
              type="button"
              className="btn-secondary btn-compact purchase-lot-qty-step"
              aria-label="Aumentar cantidad"
              disabled={
                lotItemSavingId === inv.id ||
                (invoiceLine != null &&
                  qNow >= qty(invoiceLine.quantity) - 1e-6)
              }
              onClick={() => void adjustLotItemExistenciaStep(inv, invoiceLine, 1)}
            >
              +
            </button>
          </div>
          <p className="muted small purchase-lot-item-edit-form__stepper-hint">
            Cada clic suma o resta 1 {displayUnit.trim() || 'unidad'} y se guarda en el servidor.
            {invoiceLine ? (
              <>
                {' '}
                No puede superar lo comprado ({qty(invoiceLine.quantity).toFixed(2)}{' '}
                {displayUnit}).
              </>
            ) : null}
          </p>
        </div>
        <div className="field">
          <span>Precio de compra por unidad (solo lectura)</span>
          <p
            className="mono purchase-lot-item-edit-form__readonly-cop"
            title="El costo de compra es histórico y no se modifica al ajustar consumo o existencias."
          >
            {formatCOP(
              num(
                invoiceLine?.purchase?.purchaseUnitCostCOP ??
                  invoiceLine?.unitCost ??
                  inv.unitCost,
              ),
            )}
          </p>
        </div>
        <p className="muted small purchase-lot-item-edit-form__subtotal">
          {invoiceLine ? (
            <>
              Costo total de esta línea en la compra (lo pagado, no cambia con el stock):{' '}
              <strong className="mono">
                {formatCOP(linePurchaseCostCOP(inv, invoiceLine, selectedLotRow))}
              </strong>
            </>
          ) : (
            <>
              Costo de esta línea (se conserva aunque las existencias lleguen a 0):{' '}
              <strong className="mono">
                {formatCOP(linePurchaseCostCOP(inv, invoiceLine, selectedLotRow))}
              </strong>
            </>
          )}
        </p>
        {lotItemSavingId === inv.id ? (
          <p className="muted small">Guardando…</p>
        ) : null}
        <div className="purchase-lot-item-edit-form__danger">
          <button
            type="button"
            className="btn-icon-remove"
            onClick={() => void deleteLotItem(inv)}
            disabled={lotItemSavingId === inv.id}
          >
            Eliminar esta línea del inventario
          </button>
        </div>
      </div>
    )
  }

  function purchaseLotMetaDialog(): ReactNode {
    if (!lotMetaEditOpen || !draft || !selectedLotRow) return null
    return (
      <div
        className="modal-backdrop purchase-lot-meta-edit-backdrop"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setLotMetaEditOpen(false)
        }}
      >
        <section
          className="modal purchase-lot-meta-edit-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="purchase-lot-meta-edit-title"
        >
          <header className="modal-head">
            <div className="modal-head-title">
              <h2 id="purchase-lot-meta-edit-title">Datos del lote</h2>
              <p className="muted small modal-subtitle">
                Completá o corregí la ficha. El consumo se ajusta desde las tablas del detalle.
              </p>
            </div>
            <div className="modal-head-actions">
              <button
                type="button"
                className="btn-secondary btn-compact"
                onClick={() => setLotMetaEditOpen(false)}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="btn-ghost icon-close"
                onClick={() => setLotMetaEditOpen(false)}
                aria-label="Cerrar"
              />
            </div>
          </header>
          <div className="modal-body">
            <div className="purchase-lot-aside-card purchase-lot-meta-edit-card">
              <label className="field purchase-lot-aside-field">
                <span>Nombre del lote</span>
                <input
                  className="mono"
                  value={purchaseLotDisplayName(selectedLotRow)}
                  readOnly
                />
              </label>
              <label className="field purchase-lot-aside-field">
                <span>Fecha de compra registrada</span>
                <input
                  className="mono"
                  value={formatPurchaseLotDate(selectedLotRow.purchaseDate, 'long')}
                  readOnly
                />
              </label>
              <label className="field purchase-lot-aside-field">
                <span>¿El lote sigue con saldo?</span>
                <select
                  className="inventory-filter__input"
                  value={draft.isDepleted ? 'depleted' : 'active'}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      isDepleted: e.target.value === 'depleted',
                    })
                  }
                >
                  <option value="active">Aún hay saldo por consumir</option>
                  <option value="depleted">Consumido por completo</option>
                </select>
              </label>
              <p className="muted small purchase-lot-aside-hint">
                Se persiste al pulsar <strong>Guardar cambios</strong> (según lo que permita el
                API).
              </p>
              <label className="field purchase-lot-aside-field">
                <span>Fecha de compra</span>
                <input
                  type="date"
                  value={draft.purchaseDate}
                  onChange={(e) =>
                    setDraft({ ...draft, purchaseDate: e.target.value })
                  }
                />
              </label>
              <label className="field purchase-lot-aside-field">
                <span>Proveedor</span>
                <input
                  value={draft.supplier}
                  onChange={(e) => setDraft({ ...draft, supplier: e.target.value })}
                />
              </label>
              <label className="field purchase-lot-aside-field">
                <span>Notas</span>
                <textarea
                  rows={4}
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </label>
              <label className="field purchase-lot-aside-field">
                <span>Costo total de la compra (COP)</span>
                <input
                  className="purchase-lot-aside-readonly-total mono"
                  value={formatCOP(
                    lotPurchaseTotalCOP(selectedLotRow),
                  )}
                  readOnly
                  title="Suma del comprobante; no baja al descontar stock. Incluye líneas extra de inventario fuera del comprobante."
                />
                <p className="muted small purchase-lot-aside-hint">
                  Monto pagado según comprobante; las existencias no modifican este total.
                </p>
              </label>
              {saveError ? (
                <p className="error" role="alert">
                  {saveError}
                </p>
              ) : null}
              <div className="editor-actions purchase-lot-aside-actions">
                <button
                  type="button"
                  className="btn-primary purchase-lot-save-btn"
                  disabled={saving}
                  onClick={() => void save()}
                >
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    )
  }

  function purchaseLotItemEditDialog(): ReactNode {
    if (!lotItemEdit) return null
    const inv = lotInventory.find((x) => x.id === lotItemEdit.invId)
    if (!inv) return null
    return (
      <div
        className="modal-backdrop purchase-lot-item-edit-backdrop"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setLotItemEdit(null)
        }}
      >
        <section
          className="modal purchase-lot-item-edit-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="purchase-lot-item-edit-title"
        >
          <header className="modal-head">
            <div className="modal-head-title">
              <h2 id="purchase-lot-item-edit-title">Editar ítem del lote</h2>
              <p className="muted small modal-subtitle">{inv.name}</p>
            </div>
            <div className="modal-head-actions">
              <button
                type="button"
                className="btn-secondary btn-compact"
                onClick={() => setLotItemEdit(null)}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="btn-ghost icon-close"
                onClick={() => setLotItemEdit(null)}
                aria-label="Cerrar"
              />
            </div>
          </header>
          <div className="modal-body">
            {purchaseLotItemEditForm(inv, lotItemEdit.invoiceLine)}
          </div>
        </section>
      </div>
    )
  }

  const totalPages =
    meta && meta.limit > 0 ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1
  const pageDots = paginationDots(page, totalPages)

  if (selectedId) {
    return (
      <>
      <div className="products-layout">
        <div className="products-list-pane products-list-pane--purchases purchase-lot-detail-page">
          <header className="purchase-lot-hero">
            <div className="purchase-lot-hero__main">
              <p className="purchase-lot-hero__crumb muted small">
                <a href="#/" className="purchase-lot-hero__crumb-link">
                  Inicio
                </a>{' '}
                /{' '}
                <a href="#/purchases" className="purchase-lot-hero__crumb-link">
                  Compras
                </a>{' '}
                /{' '}
                <span className="purchase-lot-hero__crumb-strong">
                  {selectedLotRow ? purchaseLotDisplayName(selectedLotRow) : selectedId}
                </span>
                {selectedLotRow ? (
                  <span className="purchase-lot-hero__crumb-date mono">
                    {' '}
                    · Fecha: {formatPurchaseLotDate(selectedLotRow.purchaseDate, 'long')}
                  </span>
                ) : null}
              </p>
              <h1 className="purchase-lot-hero__title">
                {selectedLotRow ? purchaseLotDisplayName(selectedLotRow) : 'Lote de compra'}
              </h1>
              {panelLotSecondary ? (
                <p className="purchase-lot-hero__meta mono">{panelLotSecondary}</p>
              ) : null}
              {selectedLotRow ? (
                <p className="purchase-lot-hero__purchase-total muted small">
                  Total de la compra:{' '}
                  <strong className="mono">
                    {formatCOP(
                      lotPurchaseTotalCOP(selectedLotRow),
                    )}
                  </strong>
                </p>
              ) : null}
              <div className="purchase-lot-hero__hash">
                <span className="purchase-lot-hero__hash-label muted small">Ruta en la app</span>
                <input
                  className="purchase-lot-hero__hash-input mono"
                  readOnly
                  aria-label="Ruta en la app"
                  value={
                    window.location.hash ||
                    `#/purchases/${selectedLotRow?.code?.trim() || selectedId}`
                  }
                />
              </div>
            </div>
            <div className="purchase-lot-hero__actions">
              {draft && selectedLotRow ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setSaveError(null)
                    setLotMetaEditOpen(true)
                  }}
                >
                  Datos del lote
                </button>
              ) : null}
              <button
                type="button"
                className="btn-secondary purchase-lot-hero__back"
                onClick={closePanel}
              >
                ← Volver a compras
              </button>
            </div>
          </header>

          {detailLoading && <p className="muted purchase-lot-loading">Cargando…</p>}
          {saveError && !draft && (
            <p className="error" role="alert">
              {saveError}
            </p>
          )}
          {!detailLoading && draft && selectedLotRow && (
            <div className="purchase-lot-detail-main">
                <datalist id="purchase-lot-unit-list">
                  <option value="un" />
                  <option value="unidad" />
                  <option value="porción" />
                  <option value="porciones" />
                  <option value="kg" />
                  <option value="g" />
                  <option value="L" />
                  <option value="ml" />
                  <option value="bolsa" />
                  <option value="caja" />
                  <option value="bandeja" />
                  <option value="paquete" />
                  <option value="docena" />
                </datalist>

                <div className="purchase-lot-panel">
                  <header className="purchase-lot-section-head">
                    <h2 className="purchase-lot-section-head__title">Consumo del lote</h2>
                    <p className="purchase-lot-section-head__lead muted small">
                      Por producto: <strong>existencias</strong>, <strong>consumo</strong> y{' '}
                      <strong>costo ya pagado</strong>. Solo se ajustan cantidades en existencia, no
                      el precio de compra.
                    </p>
                  </header>
                  <div className="purchase-lot-kpi-grid" aria-label="Resumen del lote">
                    <div className="purchase-lot-kpi">
                      <span className="purchase-lot-kpi__label">Estado</span>
                      <span className="purchase-lot-kpi__value">
                        {lotConsumptionStatusLabel(
                          lotItemsStats.consumptionStatus,
                          lotItemsStats.fullyConsumed,
                        )}
                      </span>
                    </div>
                    <div className="purchase-lot-kpi">
                      <span className="purchase-lot-kpi__label">Productos</span>
                      <span className="purchase-lot-kpi__value">{lotItemsStats.totalItems}</span>
                    </div>
                    <div className="purchase-lot-kpi purchase-lot-kpi--accent-warn">
                      <span className="purchase-lot-kpi__label">Por consumir</span>
                      <span className="purchase-lot-kpi__value">
                        {lotItemsStats.availableItems}
                      </span>
                    </div>
                    <div className="purchase-lot-kpi purchase-lot-kpi--accent-muted">
                      <span className="purchase-lot-kpi__label">Ya consumidos</span>
                      <span className="purchase-lot-kpi__value">
                        {lotItemsStats.consumedItems}
                      </span>
                    </div>
                    <div className="purchase-lot-kpi">
                      <span className="purchase-lot-kpi__label">Unid. por consumir</span>
                      <span className="purchase-lot-kpi__value mono">
                        {lotItemsStats.remainingUnits.toFixed(2)}
                      </span>
                    </div>
                    <div className="purchase-lot-kpi">
                      <span className="purchase-lot-kpi__label">Valor por consumir</span>
                      <span className="purchase-lot-kpi__value mono">
                        {formatCOP(lotItemsStats.remainingValue)}
                      </span>
                    </div>
                  </div>
                {hasApiLotItems ? (
                  <>
                    <div className="data-table-wrap data-table-compact purchase-lot-table-wrap">
                    <table className="data-table data-table-striped purchase-lot-line-items-table">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Categoría</th>
                          <th className="num">Cant. comprada</th>
                          <th>Un. compra</th>
                          <th className="num" title="Ya usado del total comprado">
                            Consumido
                          </th>
                          <th className="num" title="Unidades que siguen en existencia (editables)">
                            En existencia
                          </th>
                          <th
                            className="num"
                            title="Lo que pagaste por esta línea; no cambia al ajustar existencias"
                          >
                            Costo compra
                          </th>
                          <th className="purchase-lot-th-actions" aria-label="Acciones" />
                        </tr>
                      </thead>
                      <tbody>
                        {selectedLotRow.items!.map((item, idx) => {
                          const inv = inventoryMatchForLotItem(
                            lotInventory,
                            item,
                          )
                          const rowKey = `${item.name}-${idx}`
                          if (lotInventoryLoading) {
                            return (
                              <tr key={rowKey}>
                                <td>{item.name}</td>
                                <td className="muted small">
                                  {item.category ?? '—'}
                                </td>
                                <td className="num mono">
                                  {qty(item.quantity).toFixed(2)}
                                </td>
                                <td className="small">{item.unit || '—'}</td>
                                <td colSpan={4} className="muted small">
                                  Cargando inventario…
                                </td>
                              </tr>
                            )
                          }
                          if (!inv) {
                            return (
                              <tr key={rowKey}>
                                <td>{item.name}</td>
                                <td className="muted small">
                                  {item.category ?? '—'}
                                </td>
                                <td className="num mono">
                                  {qty(item.quantity).toFixed(2)}
                                </td>
                                <td className="small">{item.unit || '—'}</td>
                                <td colSpan={4} className="muted small">
                                  No hay fila de inventario con este nombre en el lote.
                                  Cuando el ítem exista para este código de lote, podrás editar
                                  las existencias con el botón Editar.
                                </td>
                              </tr>
                            )
                          }
                          return (
                            <tr key={`${inv.id}-${idx}`}>
                              <td>{item.name}</td>
                              <td className="muted small">
                                {item.category ?? inv.category?.name ?? '—'}
                              </td>
                              <td className="num mono">
                                {qty(item.quantity).toFixed(2)}
                              </td>
                              <td className="small">{item.unit || '—'}</td>
                              {lotInventorySummaryTail(inv, item)}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    </div>
                    <div
                      className="purchase-lot-comprobante-footer"
                      aria-label="Total del comprobante"
                    >
                      <span className="purchase-lot-comprobante-footer__label">Total compra</span>
                      <span className="mono purchase-lot-comprobante-footer__value">
                        {formatCOP(lotPurchaseTotalCOP(selectedLotRow))}
                      </span>
                    </div>
                  </>
                ) : null}
                </div>

                <div className="purchase-lot-panel purchase-lot-panel--secondary">
                  <header className="purchase-lot-section-head">
                    <h2 className="purchase-lot-section-head__title">
                      {hasApiLotItems
                        ? 'Más existencias (inventario)'
                        : 'Existencias del inventario'}
                    </h2>
                    <p className="purchase-lot-section-head__lead muted small">
                      {hasApiLotItems ? (
                        <>
                          Líneas que <strong>no</strong> están en el comprobante. El costo de compra
                          del cuadro superior no cambia; usá <strong>Gestionar</strong> para
                          existencias y descuentos.
                        </>
                      ) : (
                        <>
                          Gestioná existencias por ítem. El precio de compra solo si necesitás
                          corregir el registro.
                        </>
                      )}
                    </p>
                  </header>
                <div className="purchase-lot-toolbar">
                  <div className="purchase-lot-toolbar__inner">
                    <label className="inventory-filter">
                      <span className="inventory-filter__label">Ver</span>
                      <select
                        className="inventory-filter__input"
                        value={lotItemFilter}
                        onChange={(e) =>
                          setLotItemFilter(
                            e.target.value as 'all' | 'available' | 'consumed',
                          )
                        }
                      >
                        <option value="all">Todos</option>
                        <option value="available">Con saldo por consumir</option>
                        <option value="consumed">Ya consumidos (agotados)</option>
                      </select>
                    </label>
                    <label className="inventory-filter">
                      <span className="inventory-filter__label">Orden ítems</span>
                      <select
                        className="inventory-filter__input"
                        value={lotItemSort}
                        onChange={(e) =>
                          setLotItemSort(
                            e.target.value as
                              | 'name_asc'
                              | 'qty_desc'
                              | 'qty_asc'
                              | 'cost_desc'
                              | 'subtotal_desc',
                          )
                        }
                      >
                        <option value="name_asc">Nombre (A-Z)</option>
                        <option value="qty_desc">Cantidad (alta-baja)</option>
                        <option value="qty_asc">Cantidad (baja-alta)</option>
                        <option value="cost_desc">Costo u. (alto-bajo)</option>
                        <option value="subtotal_desc">Subtotal (alto-bajo)</option>
                      </select>
                    </label>
                  </div>
                </div>
                {lotInventoryLoading && (
                  <p className="muted small">Cargando ítems…</p>
                )}
                {lotInventoryError && (
                  <p className="error small" role="alert">
                    {lotInventoryError}
                  </p>
                )}
                {lotItemError && (
                  <p className="error small" role="alert">
                    {lotItemError}
                  </p>
                )}
                {!lotInventoryLoading &&
                  !lotInventoryError &&
                  lotInventory.length === 0 && (
                    <p className="purchase-lot-empty-hint muted small">
                      No hay filas de inventario con este código de lote, o el API no
                      filtra por <code className="mono">lot</code>.
                    </p>
                  )}
                {!lotInventoryLoading &&
                  !lotInventoryError &&
                  lotInventory.length > 0 &&
                  lotEditorSourceRows.length > 0 &&
                  lotEditorVisibleRows.length === 0 && (
                    <p className="purchase-lot-empty-hint muted small">
                      No hay ítems para el filtro seleccionado.
                    </p>
                  )}
                {!lotInventoryLoading &&
                  !lotInventoryError &&
                  hasApiLotItems &&
                  lotInventory.length > 0 &&
                  orphanLotInventory.length === 0 && (
                    <p className="purchase-lot-empty-hint purchase-lot-empty-hint--ok muted small">
                      Todas las líneas de inventario coinciden con el comprobante; no hay ítems
                      adicionales fuera del comprobante.
                    </p>
                  )}
                {!lotInventoryLoading &&
                  !lotInventoryError &&
                  lotEditorVisibleRows.length > 0 && (
                    <div className="data-table-wrap data-table-compact purchase-lot-table-wrap">
                      <table className="data-table data-table-striped purchase-lot-line-items-table">
                        <thead>
                          <tr>
                            <th>Ítem</th>
                            <th>Categoría</th>
                            <th className="num" title="Sin comprobante por línea">
                              Consumido
                            </th>
                            <th className="num" title="Unidades en existencia">
                              En existencia
                            </th>
                            <th
                              className="num"
                              title="Costo histórico de la línea; se conserva aunque las existencias estén en 0"
                            >
                              Costo compra
                            </th>
                            <th className="purchase-lot-th-actions" aria-label="Acciones" />
                          </tr>
                        </thead>
                        <tbody>
                          {lotEditorVisibleRows.map((inv) => (
                            <tr key={inv.id}>
                              <td>{inv.name}</td>
                              <td className="muted small">
                                {inv.category?.name ?? '—'}
                              </td>
                              {lotInventorySummaryTail(inv)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
            </div>
          )}
        </div>
      </div>
      {purchaseLotMetaDialog()}
      {purchaseLotItemEditDialog()}
      </>
    )
  }

  return (
    <div className="products-layout">
      <div className="products-list-pane products-list-pane--purchases">
        <div className="page-intro page-intro--tight">
          <h2 className="page-title">Compras</h2>
        </div>

        <div className="inventory-filter-bar app-toolbar-zone">
          <div className="inventory-filter-bar__controls" role="search">
            <label className="inventory-filter">
              <span className="inventory-filter__label">Buscar</span>
              <input
                className="inventory-filter__input"
                type="search"
                placeholder="Lote, proveedor, notas…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar compras"
              />
            </label>
            <label className="inventory-filter">
              <span className="inventory-filter__label">Desde</span>
              <input
                className="inventory-filter__input"
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
              />
            </label>
            <label className="inventory-filter">
              <span className="inventory-filter__label">Hasta</span>
              <input
                className="inventory-filter__input"
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
              />
            </label>
          </div>
          <div className="inventory-filter-bar__actions">
            <button
              type="button"
              className="btn-secondary btn-compact"
              onClick={() => {
                setSearch('')
                setFilterDateFrom('')
                setFilterDateTo('')
                setListSort('date_desc')
              }}
            >
              Limpiar
            </button>
            <label className="inventory-filter">
              <span className="inventory-filter__label">Orden</span>
              <select
                className="inventory-filter__input"
                value={listSort}
                onChange={(e) =>
                  setListSort(
                    e.target.value as
                      | 'date_desc'
                      | 'date_asc'
                      | 'name_asc'
                      | 'total_desc'
                      | 'total_asc'
                      | 'available_desc'
                      | 'available_asc',
                  )
                }
              >
                <option value="date_desc">Fecha (reciente)</option>
                <option value="date_asc">Fecha (antigua)</option>
                <option value="name_asc">Nombre (A-Z)</option>
                <option value="total_desc">Valor total del lote (alto-bajo)</option>
                <option value="total_asc">Valor total del lote (bajo-alto)</option>
                <option value="available_desc">Por consumir — mas pendientes primero</option>
                <option value="available_asc">Por consumir — menos pendientes primero</option>
              </select>
            </label>
          </div>
        </div>

        {listError && (
          <p className="error" role="alert">
            {listError}
          </p>
        )}
        {loading && <p className="muted">Cargando compras…</p>}

        {!loading && list.length > 0 && (
          <div className="data-table-wrap data-table-elevated">
            <table className="data-table data-table-striped">
              <thead>
                <tr>
                  <th>Nombre del lote</th>
                  <th>Fecha de compra</th>
                  <th>Proveedor</th>
                  <th className="num" title="Cantidad de productos distintos en el lote">
                    Productos
                  </th>
                  <th
                    className="num"
                    title="Productos que aún tienen unidades por consumir en el lote"
                  >
                    Por consumir
                  </th>
                  <th
                    className="num"
                    title="Productos del lote que ya se agotaron (sin saldo)"
                  >
                    Consumidos
                  </th>
                  <th>Estado</th>
                  <th
                    className="num"
                    title="Total de la compra (API o suma del comprobante si no hay total guardado)"
                  >
                    Total compra
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedList.map((row) => {
                  const secondary = purchaseLotSecondaryLine(row)
                  return (
                    <tr
                    key={row.id}
                    className={selectedId === row.id ? 'row-active' : ''}
                  >
                    <td>
                      <button
                        type="button"
                        className="table-link purchases-lot-cell"
                        title={row.code ? `Código: ${row.code}` : undefined}
                        onClick={() => void openLot(row.code?.trim() || row.id, row, true)}
                      >
                        <span className="purchases-lot-cell__name">
                          {purchaseLotDisplayName(row)}
                        </span>
                        {secondary ? (
                          <span className="purchases-lot-cell__code muted small mono">
                            {secondary}
                          </span>
                        ) : null}
                      </button>
                    </td>
                    <td className="purchases-date-cell">
                      {formatPurchaseLotDate(row.purchaseDate, 'long')}
                    </td>
                    <td className="muted">
                      {displayPurchaseLotSupplier(row) || '—'}
                    </td>
                    <td className="num">
                      {row.inventoryMetrics?.productsCount ?? row.itemCount}
                    </td>
                    <td className="num purchases-cell-pending">
                      {row.inventoryMetrics == null
                        ? '—'
                        : Math.round(
                            qty(row.inventoryMetrics.availableItemsCount),
                          )}
                    </td>
                    <td className="num purchases-cell-done">
                      {row.inventoryMetrics == null
                        ? '—'
                        : Math.round(
                            qty(row.inventoryMetrics.consumedItemsCount),
                          )}
                    </td>
                    <td>
                      {lotConsumptionStatusLabel(
                        row.inventoryMetrics?.consumptionStatus,
                        row.inventoryMetrics?.isDepleted,
                      )}
                    </td>
                    <td className="num mono">
                      {formatCOP(purchaseLotRowTotalCOP(row))}
                    </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.total > 0 && (
          <div className="pagination-bar">
            <span className="muted">
              {meta.total} registro{meta.total !== 1 ? 's' : ''}
            </span>
            {pageDots.length > 1 && (
              <div className="pager-dots" aria-hidden>
                {pageDots.map((p) => (
                  <span
                    key={p}
                    className={`pager-dot${p === page ? ' is-active' : ''}`}
                  />
                ))}
              </div>
            )}
            <div className="pager">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={!meta.hasNextPage || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}

        {!loading && list.length === 0 && !listError && (
          <p className="empty-hint">
            No hay compras registradas o no coinciden con los filtros.
          </p>
        )}
      </div>

      {selectedId && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closePanel()
          }}
        >
          <section
            className="modal modal--fullscreen"
            role="dialog"
            aria-modal="true"
            aria-label="Detalle de lote de compra"
          >
            <header className="modal-head">
              <div className="modal-head-title">
                <h2>Lote de compra</h2>
                <p className="muted small modal-subtitle">
                  Inicio / Compras /{' '}
                  {selectedLotRow ? purchaseLotDisplayName(selectedLotRow) : selectedId}
                </p>
                {panelLotSecondary ? (
                  <p className="muted small mono" style={{ margin: '0.2rem 0 0' }}>
                    {panelLotSecondary}
                  </p>
                ) : null}
              </div>
              <div className="modal-head-actions">
                <button
                  type="button"
                  className="btn-secondary btn-compact"
                  onClick={closePanel}
                >
                  Volver
                </button>
                <button
                  type="button"
                  className="btn-ghost icon-close"
                  onClick={closePanel}
                  aria-label="Cerrar"
                />
              </div>
            </header>
            <div className="modal-body">
              {detailLoading && <p className="muted">Cargando…</p>}
              {saveError && !draft && (
                <p className="error" role="alert">
                  {saveError}
                </p>
              )}
              {!detailLoading && draft && selectedLotRow && (
                <>
                <div className="purchases-lot-inventory-block">
                  <h3 className="purchases-lot-inventory-block__title">
                    Consumo del lote
                  </h3>
                  <p className="muted small purchases-lot-metrics-hint">
                    Cada fila es un producto del lote: <strong>por consumir</strong> vs{' '}
                    <strong>ya consumidos</strong> (agotados).
                  </p>
                <div className="inventory-filter-bar" style={{ marginBottom: '0.65rem' }}>
                  <div className="inventory-filter-bar__controls">
                    <label className="inventory-filter">
                      <span className="inventory-filter__label">Estado del lote</span>
                      <input
                        className="inventory-filter__input"
                        readOnly
                        value={
                          lotItemsStats.fullyConsumed
                            ? 'Todo consumido'
                            : lotItemsStats.totalItems === 0
                              ? 'Sin productos'
                              : 'Hay productos por consumir'
                        }
                      />
                    </label>
                    <label className="inventory-filter">
                      <span className="inventory-filter__label">Productos por consumir</span>
                      <input
                        className="inventory-filter__input"
                        readOnly
                        value={String(lotItemsStats.availableItems)}
                      />
                    </label>
                    <label className="inventory-filter">
                      <span className="inventory-filter__label">Productos ya consumidos</span>
                      <input
                        className="inventory-filter__input"
                        readOnly
                        value={String(lotItemsStats.consumedItems)}
                      />
                    </label>
                    <label className="inventory-filter">
                      <span className="inventory-filter__label">Unidades por consumir</span>
                      <input
                        className="inventory-filter__input"
                        readOnly
                        value={String(lotItemsStats.remainingUnits)}
                      />
                    </label>
                    <label className="inventory-filter">
                      <span className="inventory-filter__label">Valor por consumir</span>
                      <input
                        className="inventory-filter__input mono"
                        readOnly
                        value={formatCOP(lotItemsStats.remainingValue)}
                      />
                    </label>
                  </div>
                  <div className="inventory-filter-bar__actions">
                    <label className="inventory-filter">
                      <span className="inventory-filter__label">Ver ítems</span>
                      <select
                        className="inventory-filter__input"
                        value={lotItemFilter}
                        onChange={(e) =>
                          setLotItemFilter(e.target.value as 'all' | 'available' | 'consumed')
                        }
                      >
                        <option value="all">Todos</option>
                        <option value="available">Con saldo por consumir</option>
                        <option value="consumed">Ya consumidos (agotados)</option>
                      </select>
                    </label>
                    <label className="inventory-filter">
                      <span className="inventory-filter__label">Orden ítems</span>
                      <select
                        className="inventory-filter__input"
                        value={lotItemSort}
                        onChange={(e) =>
                          setLotItemSort(
                            e.target.value as
                              | 'name_asc'
                              | 'qty_desc'
                              | 'qty_asc'
                              | 'cost_desc'
                              | 'subtotal_desc',
                          )
                        }
                      >
                        <option value="name_asc">Nombre (A-Z)</option>
                        <option value="qty_desc">Cantidad (mayor-menor)</option>
                        <option value="qty_asc">Cantidad (menor-mayor)</option>
                        <option value="cost_desc">Costo (mayor-menor)</option>
                        <option value="subtotal_desc">Subtotal (mayor-menor)</option>
                      </select>
                    </label>
                  </div>
                </div>
                  {lotInventoryLoading && (
                    <p className="muted small">Cargando ítems…</p>
                  )}
                  {lotInventoryError && (
                    <p className="error small" role="alert">
                      {lotInventoryError}
                    </p>
                  )}
                  {!lotInventoryLoading &&
                    !lotInventoryError &&
                    lotInventory.length === 0 && (
                      <p className="muted small">
                        No hay filas de inventario con este código de lote, o
                        el API no filtra por <code className="mono">lot</code>.
                      </p>
                    )}
                {!lotInventoryLoading &&
                  !lotInventoryError &&
                  lotInventory.length > 0 &&
                  lotEditorSourceRows.length > 0 &&
                  lotEditorVisibleRows.length === 0 && (
                    <p className="muted small">
                      No hay ítems para el filtro seleccionado.
                    </p>
                  )}
                {!lotInventoryLoading &&
                  !lotInventoryError &&
                  lotEditorVisibleRows.length > 0 && (
                      <div className="data-table-wrap data-table-compact">
                        <table className="data-table data-table-striped">
                          <thead>
                            <tr>
                              <th>Ítem</th>
                              <th>Categoría</th>
                              <th className="num">Cantidad</th>
                              <th>Unidad</th>
                              <th className="num">Costo u.</th>
                            </tr>
                          </thead>
                          <tbody>
                          {lotEditorVisibleRows.map((inv) => (
                              <tr key={inv.id}>
                                <td>{inv.name}</td>
                                <td className="muted small">
                                  {inv.category?.name ?? '—'}
                                </td>
                                <td className="num mono">{inv.quantity}</td>
                                <td className="small">{inv.unit}</td>
                                <td className="num mono">
                                  {formatCOP(inv.unitCost)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                </div>
                <label className="field">
                  <span>Fecha de compra</span>
                  <input
                    type="date"
                    value={draft.purchaseDate}
                    onChange={(e) =>
                      setDraft({ ...draft, purchaseDate: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Proveedor</span>
                  <input
                    value={draft.supplier}
                    onChange={(e) =>
                      setDraft({ ...draft, supplier: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Notas</span>
                  <textarea
                    rows={4}
                    value={draft.notes}
                    onChange={(e) =>
                      setDraft({ ...draft, notes: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Valor total (COP)</span>
                  <input
                    inputMode="decimal"
                    placeholder="Opcional"
                    value={draft.totalValue}
                    onChange={(e) =>
                      setDraft({ ...draft, totalValue: e.target.value })
                    }
                  />
                </label>
                {saveError && (
                  <p className="error" role="alert">
                    {saveError}
                  </p>
                )}
                <div className="editor-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={saving}
                    onClick={() => void save()}
                  >
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </>
            )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
