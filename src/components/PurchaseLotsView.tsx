import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  deleteInventoryItem,
  datetimeLocalValueToIsoUtcOrNull,
  displayPurchaseLotSupplier,
  fetchInventoryCategories,
  fetchInventoryItems,
  fetchPurchaseLot,
  fetchPurchaseLots,
  fetchPurchaseLotsCalendar,
  formatPurchaseLotDate,
  formatSystemDateTime,
  isoInstantToDatetimeLocalValue,
  nowDatetimeLocalValue,
  patchPurchaseLot,
  purchaseLotDateToInputValue,
  putPurchaseLotLines,
  updateInventoryItem,
  type CategoryRef,
  type InventoryRow,
  type PurchaseLotRow,
  type PurchaseCalendarResponse,
  type PutPurchaseLotLineItem,
  type PutPurchaseLotLinesPayload,
  type PurchaseLotsListMeta,
  type UpdateInventoryPayload,
} from '../api'
import {
  isCapitalAssetBehavior,
  resolveLotLineInventoryBehavior,
} from '../inventorySemantics'
import { useMatchMedia } from '../hooks/useMatchMedia'
import {
  MobileAwareFilterBar,
  MOBILE_FILTER_BREAKPOINT,
} from './MobileAwareFilterBar'
import { MobileModuleToolbar } from './MobileModuleToolbar'
import { SectionSummaryDeck } from './SectionSummaryDeck'
import { type SectionSummaryItem } from './SectionSummaryBar'
import { MonthCalendar } from './MonthCalendar'
import { MonthCalendarScrollFeed } from './MonthCalendarScrollFeed'
import { consumePendingPurchasesDate } from '../lib/pending-view-filter'
import {
  invalidateDayPurchases,
  peekPurchaseLot,
  storePurchaseLot,
} from '../lib/entityCache'
import { CreateDailyPurchaseModal } from './CreateDailyPurchaseModal'
import { DayPurchasesModal } from './DayPurchasesModal'
import { ViewBootSplash } from './DataLoadingSplash'
import { mobileViewClass } from './mobile/mobileView'

type PurchaseLotInvoiceItem = NonNullable<PurchaseLotRow['items']>[number]

const LIMIT = 100

const INVENTORY_CATEGORY_NAME_PREFIX = 'INVENTORY::'

function inventoryCategoryOptionLabel(name: string | null | undefined): string {
  if (name == null || name === '') return '—'
  if (name.startsWith(INVENTORY_CATEGORY_NAME_PREFIX)) {
    const rest = name.slice(INVENTORY_CATEGORY_NAME_PREFIX.length).trim()
    return rest !== '' ? rest : name
  }
  return name
}

function traceTimestampsEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ta = a?.trim() ? new Date(a).getTime() : NaN
  const tb = b?.trim() ? new Date(b).getTime() : NaN
  if (!Number.isFinite(ta) && !Number.isFinite(tb)) return true
  return Number.isFinite(ta) && Number.isFinite(tb) && ta === tb
}

/** Snapshot al abrir el modal de ítem; se compara al confirmar un solo PATCH. */
type LotItemEditBaseline = {
  id: string
  name: string
  categoryId: string
  quantity: string
  unit: string
  unitCost: string
  supplier: string
  traceModifiedAt: string | null | undefined
  /** Cantidad comprobante al abrir (solo si hay línea de factura). */
  purchasedQty: string | null
  consumedAt: string | null | undefined
}

function getPurchaseLotIdFromHash(): string | null {
  const raw = (window.location.hash ?? '').replace(/^#/, '')
  const [path] = raw.split('?')
  const parts = (path ?? '').split('/').filter(Boolean)
  if (parts[0] !== 'purchases') return null
  const seg = parts[1]
  if (seg == null || seg === '') return null
  try {
    return decodeURIComponent(seg)
  } catch {
    return seg
  }
}

function pushRouteToPurchaseLot(id: string): void {
  window.history.pushState(
    {},
    '',
    `#/purchases/${encodeURIComponent(id)}`,
  )
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

/** Si el API envía `items` en el lote, enlaza invent↔línea aunque no se pase `item` en el click. */
function resolveInvoiceLineFromLot(
  lot: PurchaseLotRow | null | undefined,
  inv: InventoryRow,
): PurchaseLotInvoiceItem | undefined {
  if (!lot?.items?.length) return undefined
  const invId = inv.id?.trim()
  if (invId) {
    const byId = lot.items.find((i) => i.id?.trim() === invId)
    if (byId) return byId
  }
  const name = inv.name.trim().toLowerCase()
  if (name) {
    const byName = lot.items.find(
      (i) => i.name.trim().toLowerCase() === name,
    )
    if (byName) return byName
  }
  return undefined
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

function invCategoryFromRows(
  inventoryRows: InventoryRow[],
  invId: string | null | undefined,
): string | null {
  if (!invId?.trim()) return null
  const r = inventoryRows.find((x) => x.id === invId)
  return r?.categoryId?.trim() || null
}

/** Arma el body `PUT .../purchase-lines` desde el detalle actual del lote (Decimal como string en API). */
function buildPurchaseLinesPutPayload(
  lot: PurchaseLotRow,
  inventoryRows: InventoryRow[],
  patch: { inventoryItemId: string; quantityPurchased: number } | null,
): PutPurchaseLotLinesPayload | null {
  const items = lot.items ?? []
  const pls = lot.purchaseLines ?? []
  const lines: PutPurchaseLotLineItem[] = []
  let sortOrder = 0

  if (pls.length > 0) {
    for (const pl of pls) {
      const invId = pl.inventoryItemId?.trim() || null
      const item =
        (invId ? items.find((it) => it.id === invId) : undefined) ??
        items.find((it) => it.purchaseLineId === pl.id)
      const lineName = (item?.name ?? 'Producto').trim() || 'Producto'
      const unit = (item?.unit ?? '').trim() || 'un'
      let quantityPurchased = num(pl.quantityPurchased ?? item?.quantity ?? 0)
      if (!Number.isFinite(quantityPurchased)) {
        quantityPurchased = qty(item?.quantity ?? 0)
      }
      if (patch && invId && invId === patch.inventoryItemId) {
        quantityPurchased = patch.quantityPurchased
      }
      let unitCost = num(pl.purchaseUnitCostCOP)
      if (!Number.isFinite(unitCost)) {
        unitCost = num(
          item?.purchase?.purchaseUnitCostCOP ?? item?.unitCost ?? 0,
        )
      }
      if (!Number.isFinite(unitCost)) unitCost = 0
      let lineTotal = num(pl.linePurchaseTotalCOP)
      if (!Number.isFinite(lineTotal)) {
        lineTotal = num(item?.purchase?.linePurchaseTotalCOP)
      }
      const row: PutPurchaseLotLineItem = {
        inventoryItemId: invId,
        lineName,
        categoryId: invCategoryFromRows(inventoryRows, invId),
        quantityPurchased,
        unit,
        purchaseUnitCostCOP: unitCost,
        sortOrder: sortOrder++,
        lineComment: null,
      }
      if (Number.isFinite(lineTotal)) row.lineTotalCOP = lineTotal
      lines.push(row)
    }
  } else if (items.length > 0) {
    for (const item of items) {
      const invId = item.id?.trim() || null
      const lineName = (item.name ?? '').trim() || 'Producto'
      const unit = (item.unit ?? '').trim() || 'un'
      let quantityPurchased = qty(item.quantity)
      if (patch && invId && invId === patch.inventoryItemId) {
        quantityPurchased = patch.quantityPurchased
      }
      let unitCost = num(
        item.purchase?.purchaseUnitCostCOP ?? item.unitCost ?? 0,
      )
      if (!Number.isFinite(unitCost)) unitCost = 0
      let lineTotal = num(item.purchase?.linePurchaseTotalCOP)
      const row: PutPurchaseLotLineItem = {
        inventoryItemId: invId,
        lineName,
        categoryId: invCategoryFromRows(inventoryRows, invId),
        quantityPurchased,
        unit,
        purchaseUnitCostCOP: unitCost,
        sortOrder: sortOrder++,
        lineComment: null,
      }
      if (Number.isFinite(lineTotal)) row.lineTotalCOP = lineTotal
      lines.push(row)
    }
  } else {
    return null
  }

  const total = lotPurchaseTotalCOP(lot)
  const body: PutPurchaseLotLinesPayload = { lines }
  if (Number.isFinite(total) && total >= 0) {
    body.expectedTotalValueCOP = Math.round(total)
  }
  return body
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

type LotStatusKey = 'fresh' | 'partial' | 'depleted' | 'empty' | 'unknown'

/** Clave normalizada para acentos de UI según consumo del lote. */
function lotConsumptionStatusKey(
  status: string | null | undefined,
  isDepleted?: boolean,
): LotStatusKey {
  if (isDepleted) return 'depleted'
  const s = String(status ?? '').toUpperCase()
  if (s === 'DEPLETED') return 'depleted'
  if (s === 'EMPTY') return 'empty'
  if (s === 'FRESH') return 'fresh'
  if (s === 'PARTIAL') return 'partial'
  return 'unknown'
}

function looksLikeUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s.trim(),
  )
}

/**
 * Etiqueta corta para listas/cabeceras: prioriza `displayName` del backend; si
 * no, cae al `name` manual y, en último caso, al `code` (omitiendo UUIDs).
 * En pantallas de edición seguí mostrando `name` directo para respetar el título manual.
 */
function purchaseLotDisplayName(row: {
  code: string
  name?: string | null
  displayName?: string | null
}): string {
  const d = row.displayName?.trim()
  if (d) return d
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
  displayName?: string | null
}): string | null {
  const title = purchaseLotDisplayName(row)
  const c = row.code?.trim()
  if (!c) return null
  if (title && title !== c) return c
  if (looksLikeUuid(c)) return `Código: ${c}`
  return null
}

export function PurchaseLotsView({
  baseUrl,
  inaugurationDate = null,
}: {
  baseUrl: string
  inaugurationDate?: string | null
}) {
  const [list, setList] = useState<PurchaseLotRow[]>([])
  const [meta, setMeta] = useState<PurchaseLotsListMeta | null>(null)
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
  const [listRefreshKey, setListRefreshKey] = useState(0)

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar')
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear())
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date().getMonth() + 1,
  )
  const [calendarData, setCalendarData] = useState<PurchaseCalendarResponse | null>(
    null,
  )
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0)
  const [dayModalDate, setDayModalDate] = useState<string | null>(null)
  const [dayPanelRefresh, setDayPanelRefresh] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [createInitialDate, setCreateInitialDate] = useState<string | undefined>()
  const isMobileFilters = useMatchMedia(MOBILE_FILTER_BREAKPOINT)

  useEffect(() => {
    const date = consumePendingPurchasesDate()
    if (!date) return
    setFilterDateFrom(date)
    setFilterDateTo(date)
    setDayModalDate(date)
    setViewMode('calendar')
    setPage(1)
    const [y, m] = date.split('-').map(Number)
    if (y && m) {
      setCalendarYear(y)
      setCalendarMonth(m)
    }
  }, [])

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
  const [lotItemSaveBanner, setLotItemSaveBanner] = useState<string | null>(
    null,
  )
  const lotItemSaveBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const [lotItemSavingId, setLotItemSavingId] = useState<string | null>(null)
  /** Cantidad a restar por fila (consumo / uso) antes de pulsar Restar. */
  const [deductDraft, setDeductDraft] = useState<Record<string, string>>({})
  /** Popup de edición de una línea de inventario del lote. */
  const [lotItemEdit, setLotItemEdit] = useState<{
    invId: string
    invoiceLine?: PurchaseLotInvoiceItem
  } | null>(null)
  /** Modal ítem: costo unitario solo lectura hasta que el usuario active la corrección. */
  const [lotItemEditUnitCostUnlocked, setLotItemEditUnitCostUnlocked] =
    useState(false)
  /** Borrador del costo mientras la opción de edición está activa (evita tocar inventario al tipear). */
  const [lotItemUnitCostDraft, setLotItemUnitCostDraft] = useState('')
  /** Valor `<input type="datetime-local">` para revisión del ítem (modal). */
  const [lotItemTraceDraft, setLotItemTraceDraft] = useState('')
  /** Cantidad comprada (comprobante) mientras el modal está abierto. */
  const [lotItemPurchasedQtyDraft, setLotItemPurchasedQtyDraft] = useState('')
  /** Fecha/hora de consumo registrada (modal). */
  const [lotItemConsumedAtDraft, setLotItemConsumedAtDraft] = useState('')
  /** Estado del inventario al abrir el modal de ítem (para un solo guardado confirmado). */
  const lotItemEditBaselineRef = useRef<LotItemEditBaseline | null>(null)
  /** Categorías de inventario (selector en modal ítem del lote). */
  const [inventoryCategories, setInventoryCategories] = useState<CategoryRef[]>([])
  /** Popup con ficha del lote (fecha, proveedor, guardar). */
  const [lotMetaEditOpen, setLotMetaEditOpen] = useState(false)
  const [lotItemFilter, setLotItemFilter] = useState<'all' | 'available' | 'consumed'>(
    'all',
  )
  const [lotItemSort, setLotItemSort] = useState<
    'name_asc' | 'qty_desc' | 'qty_asc' | 'cost_desc' | 'subtotal_desc'
  >('name_asc')
  /** Popup compacto con los filtros del inventario del lote. */
  const [lotFiltersPopupOpen, setLotFiltersPopupOpen] = useState(false)
  /** Despliega la grilla KPI (“Detalle del lote”). */
  const [lotKpisOpen, setLotKpisOpen] = useState(false)
  /** Conjunto de campos desbloqueados (editables) en el popup del ítem del lote. */
  const [lotItemUnlocked, setLotItemUnlocked] = useState<Set<string>>(
    () => new Set(),
  )
  const [draft, setDraft] = useState<{
    /** Nombre mostrado del lote (campo `name` en el API). */
    lotName: string
    purchaseDate: string
    supplier: string
    notes: string
    totalValue: string
    /** Declarado por el usuario: lote cerrado (agotado) o aún con saldo. */
    isDepleted: boolean
    /** Revisión / trazabilidad (`traceModifiedAt`), input datetime-local. */
    traceModifiedLocal: string
  } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  /** Evita cierre obsoleto en listeners del hash. */
  const selectedIdRef = useRef<string | null>(null)
  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search), 320)
    return () => window.clearTimeout(t)
  }, [search])

  const purchaseListFiltersActive = useMemo(
    () =>
      search.trim() !== '' ||
      filterDateFrom !== '' ||
      filterDateTo !== '' ||
      listSort !== 'date_desc',
    [search, filterDateFrom, filterDateTo, listSort],
  )

  const lotDetailFiltersActive = useMemo(
    () =>
      lotItemFilter !== 'all' || lotItemSort !== 'name_asc',
    [lotItemFilter, lotItemSort],
  )

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
  }, [baseUrl, page, searchDebounced, filterDateFrom, filterDateTo, listRefreshKey])

  useEffect(() => {
    if (viewMode !== 'calendar' || isMobileFilters) return
    let cancelled = false
    setCalendarLoading(true)
    setCalendarError(null)
    fetchPurchaseLotsCalendar(baseUrl, calendarYear, calendarMonth)
      .then((res) => {
        if (!cancelled) setCalendarData(res)
      })
      .catch((e: Error) => {
        if (!cancelled) setCalendarError(e.message)
      })
      .finally(() => {
        if (!cancelled) setCalendarLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [baseUrl, viewMode, calendarYear, calendarMonth, isMobileFilters])

  const openCreatePurchase = useCallback((dateKey?: string) => {
    setCreateInitialDate(dateKey || filterDateFrom || undefined)
    setCreateOpen(true)
  }, [filterDateFrom])

  const draftFromLot = useCallback((d: PurchaseLotRow) => ({
    lotName: d.name?.trim() ?? '',
    purchaseDate: purchaseLotDateToInputValue(d.purchaseDate),
    supplier: d.supplier ?? '',
    notes: d.notes ?? '',
    totalValue: d.totalValue != null ? String(num(d.totalValue)) : '',
    isDepleted: purchaseLotInitialDepleted(d),
    traceModifiedLocal: isoInstantToDatetimeLocalValue(d.traceModifiedAt),
  }), [])

  const openLot = useCallback(
    async (id: string, row?: PurchaseLotRow, updateHash = false) => {
      if (updateHash) pushRouteToPurchaseLot(id)
      const bootstrap = peekPurchaseLot(id) ?? row
      if (bootstrap) {
        setSelectedLotRow(bootstrap)
        setDraft(draftFromLot(bootstrap))
      } else if (row) {
        setSelectedLotRow(row)
      }
      setLotMetaEditOpen(false)
      setLotInventory([])
      setDeductDraft({})
      setLotInventoryError(null)
      setLotItemError(null)
      setSelectedId(id)
      setSaveError(null)
      setDetailLoading(!bootstrap)
      try {
        const d = await fetchPurchaseLot(baseUrl, id)
        storePurchaseLot(id, d)
        setSelectedLotRow(d)
        setDraft(draftFromLot(d))
      } catch (e) {
        if (!bootstrap) {
          setSaveError((e as Error).message)
          setDraft(null)
          setSelectedId(null)
          setSelectedLotRow(null)
        }
      } finally {
        setDetailLoading(false)
      }
    },
    [baseUrl, draftFromLot],
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
    if (lotItemSaveBannerTimerRef.current) {
      clearTimeout(lotItemSaveBannerTimerRef.current)
      lotItemSaveBannerTimerRef.current = null
    }
    setLotItemSaveBanner(null)
  }, [])

  const closePanel = useCallback(() => {
    closePanelState()
    replaceRouteToPurchasesList()
  }, [closePanelState])

  useEffect(() => {
    if (!lotItemEdit && !lotMetaEditOpen && !lotFiltersPopupOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (lotItemEdit) setLotItemEdit(null)
      else if (lotFiltersPopupOpen) setLotFiltersPopupOpen(false)
      else setLotMetaEditOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lotItemEdit, lotMetaEditOpen, lotFiltersPopupOpen])

  useEffect(() => {
    setLotItemEditUnitCostUnlocked(false)
    setLotItemUnitCostDraft('')
    setLotItemUnlocked(new Set())
  }, [lotItemEdit?.invId])

  const toggleLotItemFieldUnlock = useCallback((key: string) => {
    setLotItemUnlocked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  /**
   * Sincroniza panel con `#/purchases/:id`.
   * No incluir `selectedId` en deps: si el GET falla y se limpia el estado, el efecto
   * volvería a disparar el mismo id → tormenta de 400. Usamos ref para comparar.
   */
  useEffect(() => {
    const syncFromHash = () => {
      const id = getPurchaseLotIdFromHash()
      if (id) {
        if (id !== selectedIdRef.current) void openLot(id, undefined, false)
      } else if (selectedIdRef.current) {
        closePanelState()
      }
    }
    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [closePanelState, openLot])

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
    if (!selectedId) {
      setInventoryCategories([])
      return
    }
    const controller = new AbortController()
    fetchInventoryCategories(baseUrl)
      .then((cats) => {
        if (!controller.signal.aborted) setInventoryCategories(cats)
      })
      .catch(() => {
        if (!controller.signal.aborted) setInventoryCategories([])
      })
    return () => {
      controller.abort()
    }
  }, [baseUrl, selectedId])

  useEffect(() => {
    if (!lotItemEdit) {
      setLotItemTraceDraft('')
      lotItemEditBaselineRef.current = null
      setLotItemPurchasedQtyDraft('')
      setLotItemConsumedAtDraft('')
    }
  }, [lotItemEdit])

  useEffect(() => {
    const t = String(lotPurchaseTotalCOP(selectedLotRow))
    setDraft((prev) => {
      if (!prev) return prev
      if (prev.totalValue === t) return prev
      return { ...prev, totalValue: t }
    })
  }, [selectedLotRow])

  const commitLotItemModalChanges = useCallback(
    async (
      inv: InventoryRow,
      invoiceLine: PurchaseLotInvoiceItem | undefined,
    ): Promise<void> => {
      const base = lotItemEditBaselineRef.current
      if (!base || base.id !== inv.id) {
        setLotItemError('Cerrá y volvé a abrir «Gestionar» para guardar.')
        return
      }
      const row = lotInventory.find((x) => x.id === inv.id) ?? inv
      const payload: UpdateInventoryPayload = {}

      const nameTrim = row.name.trim()
      if (!nameTrim) {
        setLotItemError('El nombre del producto no puede quedar vacío.')
        return
      }
      if (nameTrim !== base.name.trim()) payload.name = nameTrim

      if (row.categoryId.trim() !== base.categoryId.trim()) {
        payload.categoryId = row.categoryId.trim()
      }

      const q = parseFloat(String(row.quantity).replace(',', '.'))
      if (!Number.isFinite(q) || q < 0) {
        setLotItemError('Cantidad inválida.')
        return
      }

      const purchasedCapParsed =
        invoiceLine != null
          ? parseFloat(lotItemPurchasedQtyDraft.replace(',', '.'))
          : NaN
      if (invoiceLine != null) {
        if (!Number.isFinite(purchasedCapParsed) || purchasedCapParsed <= 0) {
          setLotItemError('Indicá una cantidad comprada válida (mayor que 0).')
          return
        }
        if (q > purchasedCapParsed + 1e-6) {
          setLotItemError(
            `La existencia (${q.toFixed(2)}) no puede superar lo comprado (${purchasedCapParsed.toFixed(2)}).`,
          )
          return
        }
      }

      const bq = parseFloat(String(base.quantity).replace(',', '.'))
      if (!Number.isFinite(bq) || Math.abs(q - bq) > 1e-6) payload.quantity = q

      const unitNorm = normalizeInventoryUnit(String(row.unit))
      if (!unitNorm) {
        setLotItemError('La unidad no puede quedar vacía.')
        return
      }
      const baseUnit = normalizeInventoryUnit(base.unit)
      if (unitNorm !== baseUnit) payload.unit = unitNorm

      const costRaw = lotItemEditUnitCostUnlocked
        ? lotItemUnitCostDraft.trim()
        : String(row.unitCost).trim()
      const uc = parseFloat(costRaw.replace(',', '.'))
      if (!Number.isFinite(uc) || uc < 0) {
        setLotItemError('Costo unitario inválido.')
        return
      }
      const buc = parseFloat(String(base.unitCost).replace(',', '.'))
      if (!Number.isFinite(buc) || Math.abs(uc - buc) > 1e-6) payload.unitCost = uc

      const sup = row.supplier?.trim() ?? ''
      if (sup !== (base.supplier?.trim() ?? '')) {
        payload.supplier = sup || undefined
      }

      const nextTraceIso = datetimeLocalValueToIsoUtcOrNull(lotItemTraceDraft)
      if (
        !traceTimestampsEqual(
          nextTraceIso ?? undefined,
          base.traceModifiedAt ?? undefined,
        )
      ) {
        payload.traceModifiedAt = nextTraceIso
      }

      const nextConsumedIso = datetimeLocalValueToIsoUtcOrNull(
        lotItemConsumedAtDraft,
      )
      if (
        !traceTimestampsEqual(
          nextConsumedIso ?? undefined,
          base.consumedAt ?? undefined,
        )
      ) {
        payload.consumedAt = nextConsumedIso
      }

      const basePurch =
        base.purchasedQty != null
          ? parseFloat(String(base.purchasedQty).replace(',', '.'))
          : NaN
      const purchChanged =
        invoiceLine != null &&
        Number.isFinite(purchasedCapParsed) &&
        Number.isFinite(basePurch) &&
        Math.abs(purchasedCapParsed - basePurch) > 1e-6

      let putLinesBody: PutPurchaseLotLinesPayload | null = null
      if (purchChanged) {
        if (!selectedId || !selectedLotRow) {
          setLotItemError('No se puede guardar: recargá el detalle del lote.')
          return
        }
        putLinesBody = buildPurchaseLinesPutPayload(
          selectedLotRow,
          lotInventory,
          { inventoryItemId: inv.id, quantityPurchased: purchasedCapParsed },
        )
        if (!putLinesBody?.lines.length) {
          setLotItemError(
            'No hay líneas de comprobante para guardar: el detalle del lote debe incluir items o purchaseLines.',
          )
          return
        }
      }

      if (Object.keys(payload).length === 0 && !purchChanged) {
        setLotItemError('No hay cambios para guardar.')
        window.setTimeout(() => setLotItemError(null), 2800)
        return
      }

      setLotItemSavingId(inv.id)
      setLotItemError(null)
      try {
        if (putLinesBody && selectedId) {
          await putPurchaseLotLines(baseUrl, selectedId, putLinesBody)
        }

        let updated: InventoryRow = row
        if (Object.keys(payload).length > 0) {
          updated = await updateInventoryItem(baseUrl, inv.id, payload)
          setLotInventory((prev) =>
            prev.map((x) => (x.id === inv.id ? updated : x)),
          )
        }

        if (selectedId) {
          const freshLot = await fetchPurchaseLot(baseUrl, selectedId)
          storePurchaseLot(selectedId, freshLot)
          const dayKey = freshLot.purchaseDate?.slice(0, 10)
          if (dayKey) invalidateDayPurchases(dayKey)
          setSelectedLotRow(freshLot)
          const lotCode = freshLot.code?.trim()
          if (lotCode) {
            const invRes = await fetchInventoryItems(baseUrl, {
              page: 1,
              limit: 100,
              lot: lotCode,
              includeStats: true,
            })
            setLotInventory(invRes.data)
            const invFresh = invRes.data.find((x) => x.id === inv.id) ?? updated
            const itemMeta = freshLot.items?.find((it) => it.id === inv.id)
            const purchasedStr =
              itemMeta != null
                ? String(qty(itemMeta.quantity))
                : base.purchasedQty
            lotItemEditBaselineRef.current = {
              id: invFresh.id,
              name: invFresh.name,
              categoryId: invFresh.categoryId,
              quantity: String(invFresh.quantity),
              unit: invFresh.unit,
              unitCost: String(invFresh.unitCost),
              supplier: invFresh.supplier?.trim() ?? '',
              traceModifiedAt: invFresh.traceModifiedAt ?? null,
              purchasedQty:
                invoiceLine != null && purchasedStr != null ? purchasedStr : null,
              consumedAt: invFresh.consumedAt ?? null,
            }
            if (invoiceLine != null && purchasedStr != null) {
              setLotItemPurchasedQtyDraft(purchasedStr)
            }
            setLotItemConsumedAtDraft(
              invFresh.consumedAt
                ? isoInstantToDatetimeLocalValue(invFresh.consumedAt)
                : '',
            )
            updated = invFresh
          }
        }

        if (lotItemSaveBannerTimerRef.current) {
          clearTimeout(lotItemSaveBannerTimerRef.current)
        }
        setLotItemSaveBanner(
          `Cambios guardados: “${updated.name.trim() || 'Producto'}” quedó actualizado en este lote.`,
        )
        lotItemSaveBannerTimerRef.current = window.setTimeout(() => {
          setLotItemSaveBanner(null)
          lotItemSaveBannerTimerRef.current = null
        }, 8000)
        setLotItemTraceDraft(
          isoInstantToDatetimeLocalValue(updated.traceModifiedAt),
        )
        setLotItemUnitCostDraft(String(updated.unitCost ?? ''))
        setLotItemEditUnitCostUnlocked(false)
      } catch (e) {
        setLotItemError((e as Error).message)
      } finally {
        setLotItemSavingId(null)
      }
    },
    [
      baseUrl,
      lotInventory,
      lotItemTraceDraft,
      lotItemConsumedAtDraft,
      lotItemPurchasedQtyDraft,
      lotItemUnitCostDraft,
      lotItemEditUnitCostUnlocked,
      selectedId,
      selectedLotRow,
    ],
  )

  const adjustLotItemExistenciaStep = useCallback(
    (
      inv: InventoryRow,
      invoiceLine: PurchaseLotInvoiceItem | undefined,
      direction: -1 | 1,
      purchasedCap?: number,
    ) => {
      setLotInventory((prev) => {
        const row = prev.find((x) => x.id === inv.id)
        if (!row) return prev
        const current = qty(row.quantity)
        const step = 1
        let next = Math.round((current + direction * step) * 100) / 100
        if (invoiceLine) {
          const cap =
            purchasedCap != null && Number.isFinite(purchasedCap)
              ? purchasedCap
              : qty(invoiceLine.quantity)
          next = Math.max(0, Math.min(cap, next))
        } else {
          next = Math.max(0, next)
        }
        if (next === current) return prev
        return prev.map((x) =>
          x.id === inv.id ? { ...x, quantity: String(next) } : x,
        )
      })
    },
    [],
  )

  const applyDeductQuantity = useCallback((inv: InventoryRow) => {
    const raw = (deductDraft[inv.id] ?? '').trim()
    const deduct = parseFloat(raw.replace(',', '.'))
    if (!Number.isFinite(deduct) || deduct <= 0) {
      setLotItemError('Indicá cuánto descontar (número mayor que 0).')
      return
    }
    setLotItemError(null)
    setLotInventory((prev) => {
      const row = prev.find((x) => x.id === inv.id)
      if (!row) return prev
      const cur = qty(row.quantity)
      const next = Math.max(0, cur - deduct)
      return prev.map((x) =>
        x.id === inv.id ? { ...x, quantity: String(next) } : x,
      )
    })
    setDeductDraft((d) => {
      const nextDraft = { ...d }
      delete nextDraft[inv.id]
      return nextDraft
    })
  }, [deductDraft])

  const agotarLotItemQuantity = useCallback((inv: InventoryRow) => {
    if (
      !window.confirm(
        `¿Poner cantidad en 0 para "${inv.name}"? (local hasta que pulses Confirmar cambios.)`,
      )
    )
      return
    setLotItemError(null)
    setLotInventory((prev) =>
      prev.map((x) => (x.id === inv.id ? { ...x, quantity: '0' } : x)),
    )
    setDeductDraft((d) => {
      const next = { ...d }
      delete next[inv.id]
      return next
    })
  }, [])

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
      const notesTrim = draft.notes.trim()
      const patchPayload: Parameters<typeof patchPurchaseLot>[2] = {
        name: draft.lotName.trim() || null,
        purchaseDate: dateStr,
        supplier: draft.supplier.trim() || undefined,
        notes: notesTrim || undefined,
        comment: notesTrim || undefined,
        totalValue,
        traceModifiedAt: datetimeLocalValueToIsoUtcOrNull(draft.traceModifiedLocal),
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

  const purchasesSummaryItems = useMemo((): SectionSummaryItem[] => {
    let pageTotal = 0
    for (const row of list) {
      const t = purchaseLotRowTotalCOP(row)
      if (Number.isFinite(t)) pageTotal += t
    }
    const items: SectionSummaryItem[] = []
    if (meta != null) {
      items.push({
        label: 'Lotes',
        value: meta.total,
        title: 'Total de lotes registrados',
      })
    }
    items.push(
      {
        label: 'En página',
        value: list.length,
        title: 'Filas en esta página',
      },
      {
        label: 'Total página',
        value: formatCOP(pageTotal),
        title: 'Suma de totales visibles en la página',
      },
    )
    return items
  }, [list, meta])

  /** Índice global de fila en el listado paginado (para columna #). */
  const purchaseLotsListRowOffset = useMemo(
    () =>
      Math.max(0, ((meta?.page ?? page) - 1) * (meta?.limit ?? LIMIT)),
    [meta?.page, meta?.limit, page],
  )
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
    const resolvedBehavior =
      invoiceLine?.inventoryBehavior ??
      resolveLotLineInventoryBehavior(inv, selectedLotRow)
    const isAsset = isCapitalAssetBehavior(resolvedBehavior)
    const unitTxt = invoiceLine?.unit || rowUnit || ''
    const totalComprado = invoiceLine ? qty(invoiceLine.quantity) : null
    const lineCost = linePurchaseCostCOP(inv, invoiceLine, selectedLotRow)
    const statusBadgeClass =
      isAsset
        ? qNow > 0
          ? 'purchases-stock-badge purchases-stock-badge--asset'
          : 'purchases-stock-badge purchases-stock-badge--asset-muted'
        : qNow > 0
          ? 'purchases-stock-badge purchases-stock-badge--ok'
          : 'purchases-stock-badge purchases-stock-badge--out'
    const statusLabel = isAsset
      ? qNow > 0
        ? 'En operación'
        : 'Adquirido'
      : qNow > 0
        ? 'Por consumir'
        : 'Agotado'
    return (
      <>
        <td
          className="purchase-lot-summary-cell"
          title="Estado del ítem y cantidades del lote"
        >
          <div className="purchase-lot-summary-stack">
            <span className={statusBadgeClass}>{statusLabel}</span>
            <div
              className="purchase-lot-qty-stack"
              data-has-total={totalComprado != null ? 'true' : 'false'}
            >
              <span
                className="purchase-lot-qty-stack__total mono"
                title="Cantidad total comprada (comprobante)"
              >
                {totalComprado != null ? (
                  <>
                    {totalComprado.toFixed(2)}
                    <span className="muted small">
                      {' '}
                      {unitTxt || rowUnit || ''}
                    </span>
                  </>
                ) : (
                  <span className="muted">—</span>
                )}
              </span>
              <span
                className="purchase-lot-qty-stack__remain mono"
                title="Cantidad que aún queda (existencias)"
              >
                {qNow.toFixed(2)}
                <span className="muted small"> {rowUnit || '—'}</span>
              </span>
            </div>
          </div>
        </td>
        <td
          className="num mono purchase-lot-cost-cell purchase-lot-cost-cell--line-only"
          title="Costo total de compra de esta línea"
        >
          {formatCOP(lineCost)}
        </td>
      </>
    )
  }

  const openLotItemEdit = useCallback(
    (inv: InventoryRow, invoiceLine?: PurchaseLotInvoiceItem) => {
      setLotItemError(null)
      const live = lotInventory.find((x) => x.id === inv.id) ?? inv
      const line =
        invoiceLine ?? resolveInvoiceLineFromLot(selectedLotRow, live)
      lotItemEditBaselineRef.current = {
        id: live.id,
        name: live.name,
        categoryId: live.categoryId,
        quantity: String(live.quantity),
        unit: live.unit,
        unitCost: String(live.unitCost),
        supplier: live.supplier?.trim() ?? '',
        traceModifiedAt: live.traceModifiedAt ?? null,
        purchasedQty: line ? String(qty(line.quantity)) : null,
        consumedAt: live.consumedAt ?? null,
      }
      setLotItemTraceDraft(
        isoInstantToDatetimeLocalValue(live.traceModifiedAt),
      )
      setLotItemPurchasedQtyDraft(
        line ? String(qty(line.quantity)) : '',
      )
      setLotItemConsumedAtDraft(
        live.consumedAt
          ? isoInstantToDatetimeLocalValue(live.consumedAt)
          : nowDatetimeLocalValue(),
      )
      setLotItemUnitCostDraft(String(live.unitCost ?? ''))
      setLotItemEditUnitCostUnlocked(false)
      setLotItemEdit({ invId: inv.id, invoiceLine: line })
    },
    [lotInventory, selectedLotRow],
  )

  function renderLotItemEditableField(args: {
    fieldKey: string
    label: string
    value: ReactNode
    children: ReactNode
    disabled?: boolean
    onToggle?: () => void
  }): ReactNode {
    const { fieldKey, label, value, children, disabled, onToggle } = args
    const unlocked = lotItemUnlocked.has(fieldKey)
    const handleToggle =
      onToggle ?? (() => toggleLotItemFieldUnlock(fieldKey))
    return (
      <div className="lot-edit-field" data-unlocked={unlocked ? 'true' : 'false'}>
        <div className="lot-edit-field__head">
          <span className="lot-edit-field__label">{label}</span>
          <button
            type="button"
            className="lot-edit-field__toggle"
            onClick={handleToggle}
            disabled={disabled}
            aria-label={unlocked ? `Cerrar ${label}` : `Editar ${label}`}
            title={unlocked ? 'Listo' : `Editar ${label}`}
          >
            {unlocked ? (
              <span aria-hidden style={{ fontSize: '1.05rem', lineHeight: 1 }}>
                ×
              </span>
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.2 3.3a1.8 1.8 0 0 1 2.5 2.5L7.5 15 4 16l1-3.5 9.2-9.2Z" />
                <path d="M12.5 5l2.5 2.5" />
              </svg>
            )}
          </button>
        </div>
        {unlocked ? (
          <div className="lot-edit-field__input">{children}</div>
        ) : (
          <div className="lot-edit-field__value">
            {value !== '' && value != null ? (
              value
            ) : (
              <span className="muted">—</span>
            )}
          </div>
        )}
      </div>
    )
  }

  function purchaseLotItemEditForm(
    inv: InventoryRow,
    invoiceLine: PurchaseLotInvoiceItem | undefined,
  ): ReactNode {
    const rowUnit =
      lotInventory.find((x) => x.id === inv.id)?.unit ?? inv.unit
    const liveRow = lotInventory.find((x) => x.id === inv.id) ?? inv
    const qPurchDraft = parseFloat(
      lotItemPurchasedQtyDraft.replace(',', '.'),
    )
    const qComprado =
      invoiceLine && Number.isFinite(qPurchDraft)
        ? qPurchDraft
        : invoiceLine
          ? qty(invoiceLine.quantity)
          : null
    const qNow = qty(liveRow.quantity)
    const resolvedBehavior =
      invoiceLine?.inventoryBehavior ??
      resolveLotLineInventoryBehavior(inv, selectedLotRow)
    const isAsset = isCapitalAssetBehavior(resolvedBehavior)
    const qConsumido =
      qComprado != null && !isAsset ? Math.max(0, qComprado - qNow) : null
    const displayUnit = invoiceLine?.unit || rowUnit || 'un'
    const isSaving = lotItemSavingId === inv.id
    const traceLabel = lotItemTraceDraft
      ? (() => {
          const d = new Date(lotItemTraceDraft)
          return Number.isFinite(d.getTime())
            ? d.toLocaleString('es-CO', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })
            : lotItemTraceDraft
        })()
      : ''
    return (
      <div className="purchase-lot-item-edit-form">
        {invoiceLine && isAsset ? (
          <div
            className="purchase-lot-item-edit-form__metrics"
            aria-label="Resumen de existencias"
          >
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

        {renderLotItemEditableField({
          fieldKey: 'name',
          label: 'Nombre',
          value: liveRow.name,
          disabled: isSaving,
          children: (
            <input
              className="input-cell"
              autoFocus
              value={String(liveRow.name ?? '')}
              onChange={(e) =>
                setLotInventory((prev) =>
                  prev.map((x) =>
                    x.id === inv.id ? { ...x, name: e.target.value } : x,
                  ),
                )
              }
              disabled={isSaving}
            />
          ),
        })}

        {renderLotItemEditableField({
          fieldKey: 'supplier',
          label: 'Proveedor',
          value: liveRow.supplier?.trim() || '',
          disabled: isSaving,
          children: (
            <input
              className="input-cell"
              autoFocus
              placeholder="Opcional"
              value={String(liveRow.supplier ?? '')}
              onChange={(e) =>
                setLotInventory((prev) =>
                  prev.map((x) =>
                    x.id === inv.id ? { ...x, supplier: e.target.value } : x,
                  ),
                )
              }
              disabled={isSaving}
            />
          ),
        })}

        {renderLotItemEditableField({
          fieldKey: 'category',
          label: 'Categoría',
          value: inventoryCategoryOptionLabel(liveRow.category?.name),
          disabled: isSaving || inventoryCategories.length === 0,
          children: (
            <select
              className="inventory-filter__input"
              autoFocus
              value={String(liveRow.categoryId ?? inv.categoryId)}
              onChange={(e) => {
                const nextId = e.target.value
                const cat = inventoryCategories.find((c) => c.id === nextId)
                setLotInventory((prev) =>
                  prev.map((x) =>
                    x.id === inv.id
                      ? {
                          ...x,
                          categoryId: nextId,
                          category: {
                            id: nextId,
                            name: cat?.name ?? x.category.name,
                            type: cat?.type ?? x.category.type,
                          },
                        }
                      : x,
                  ),
                )
              }}
              disabled={isSaving || inventoryCategories.length === 0}
            >
              {inventoryCategories.length === 0 ? (
                <option value={inv.categoryId}>
                  {inventoryCategoryOptionLabel(inv.category?.name)}
                </option>
              ) : (
                inventoryCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {inventoryCategoryOptionLabel(c.name)}
                  </option>
                ))
              )}
            </select>
          ),
        })}

        {!invoiceLine
          ? renderLotItemEditableField({
              fieldKey: 'qty',
              label: 'Cantidad / unidad',
              value: `${qNow.toFixed(2)} ${liveRow.unit || 'un'}`,
              disabled: isSaving,
              children: (
                <div className="purchases-qty-unit-cell purchase-lot-item-edit-form__qty-row">
                  <input
                    className="input-cell purchases-qty-unit-cell__qty"
                    inputMode="decimal"
                    autoFocus
                    value={String(inv.quantity)}
                    onChange={(e) =>
                      setLotInventory((prev) =>
                        prev.map((x) =>
                          x.id === inv.id
                            ? { ...x, quantity: e.target.value }
                            : x,
                        ),
                      )
                    }
                    disabled={isSaving}
                  />
                  <input
                    className="input-cell purchases-qty-unit-cell__unit"
                    list="purchase-lot-unit-list"
                    value={String(inv.unit)}
                    onChange={(e) =>
                      setLotInventory((prev) =>
                        prev.map((x) =>
                          x.id === inv.id
                            ? { ...x, unit: e.target.value }
                            : x,
                        ),
                      )
                    }
                    disabled={isSaving}
                  />
                </div>
              ),
            })
          : null}

        {invoiceLine && !isAsset ? (
          <div
            className="purchase-lot-qty-dual-card"
            aria-labelledby="purchase-lot-qty-dual-title"
          >
            <h3
              id="purchase-lot-qty-dual-title"
              className="purchase-lot-qty-dual-card__title"
            >
              Cantidades
            </h3>
            <p className="muted small purchase-lot-qty-dual-card__lead">
              <strong>Comprado</strong> debe coincidir con el comprobante.{' '}
              <strong>Restante</strong> es lo que queda en inventario (no puede ser mayor
              que lo comprado).
            </p>
            <div className="purchase-lot-qty-dual-card__grid">
              <label className="purchase-lot-qty-dual-field">
                <span className="purchase-lot-qty-dual-field__label">
                  Cantidad comprada
                </span>
                <input
                  className="input-cell mono purchase-lot-qty-dual-field__input"
                  inputMode="decimal"
                  autoComplete="off"
                  value={lotItemPurchasedQtyDraft}
                  onChange={(e) =>
                    setLotItemPurchasedQtyDraft(e.target.value)
                  }
                  disabled={isSaving}
                />
                <span className="muted small purchase-lot-qty-dual-field__unit">
                  {displayUnit}
                </span>
              </label>
              <label className="purchase-lot-qty-dual-field">
                <span className="purchase-lot-qty-dual-field__label">
                  Cantidad restante
                </span>
                <input
                  className="input-cell mono purchase-lot-qty-dual-field__input"
                  inputMode="decimal"
                  autoComplete="off"
                  value={String(liveRow.quantity)}
                  onChange={(e) =>
                    setLotInventory((prev) =>
                      prev.map((x) =>
                        x.id === inv.id
                          ? { ...x, quantity: e.target.value }
                          : x,
                      ),
                    )
                  }
                  disabled={isSaving}
                />
                <span className="muted small purchase-lot-qty-dual-field__unit">
                  {displayUnit}
                </span>
              </label>
            </div>
            <p className="muted small purchase-lot-qty-dual-card__derived">
              Consumido (calculado):{' '}
              <span className="mono">
                {(qConsumido ?? 0).toFixed(2)} {displayUnit}
              </span>
            </p>
          </div>
        ) : null}

        <div className="lot-edit-field lot-edit-field--quick">
          <div className="lot-edit-field__head">
            <span className="lot-edit-field__label">Ajuste rápido (restante)</span>
            <span className="mono lot-edit-field__quick-value">
              {qNow.toFixed(2)} {displayUnit}
            </span>
          </div>
          <div
            className="purchase-lot-item-edit-form__stepper"
            role="group"
            aria-label="Aumentar o reducir cantidad restante"
          >
            <button
              type="button"
              className="btn-secondary btn-compact purchase-lot-qty-step"
              aria-label="Reducir"
              disabled={isSaving || qNow <= 0}
              onClick={() =>
                void adjustLotItemExistenciaStep(
                  inv,
                  invoiceLine,
                  -1,
                  invoiceLine != null && Number.isFinite(qPurchDraft)
                    ? qPurchDraft
                    : invoiceLine != null
                      ? qty(invoiceLine.quantity)
                      : undefined,
                )
              }
            >
              −
            </button>
            <button
              type="button"
              className="btn-secondary btn-compact purchase-lot-qty-step"
              aria-label="Aumentar"
              disabled={
                isSaving ||
                (invoiceLine != null &&
                  qComprado != null &&
                  qNow >= qComprado - 1e-6)
              }
              onClick={() =>
                void adjustLotItemExistenciaStep(
                  inv,
                  invoiceLine,
                  1,
                  invoiceLine != null && Number.isFinite(qPurchDraft)
                    ? qPurchDraft
                    : invoiceLine != null
                      ? qty(invoiceLine.quantity)
                      : undefined,
                )
              }
            >
              +
            </button>
          </div>
        </div>

        {!invoiceLine && !isAsset ? (
          <div className="lot-edit-field lot-edit-field--quick">
            <div className="lot-edit-field__head">
              <span className="lot-edit-field__label">Descontar uso</span>
            </div>
            <div className="purchases-deduct-stack purchase-lot-item-edit-form__deduct">
              <div className="purchases-deduct-stack__row">
                <input
                  className="input-cell input-cell--deduct"
                  inputMode="decimal"
                  placeholder="Ej. 1"
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
                  disabled={isSaving}
                />
                <button
                  type="button"
                  className="btn-secondary btn-compact"
                  onClick={() => void applyDeductQuantity(inv)}
                  disabled={isSaving}
                >
                  Restar
                </button>
              </div>
              <button
                type="button"
                className="purchases-deduct-agotar"
                onClick={() => void agotarLotItemQuantity(inv)}
                disabled={isSaving || qty(inv.quantity) <= 0}
              >
                Agotar (0)
              </button>
            </div>
          </div>
        ) : null}

        {renderLotItemEditableField({
          fieldKey: 'unitCost',
          label: 'Costo unitario (COP)',
          value: (
            <span className="mono">
              {formatCOP(num(liveRow.unitCost ?? inv.unitCost))}
            </span>
          ),
          disabled: isSaving,
          onToggle: () => {
            const wasUnlocked = lotItemUnlocked.has('unitCost')
            toggleLotItemFieldUnlock('unitCost')
            if (!wasUnlocked) {
              setLotItemUnitCostDraft(String(liveRow.unitCost ?? ''))
              setLotItemEditUnitCostUnlocked(true)
            } else {
              setLotItemUnitCostDraft('')
              setLotItemEditUnitCostUnlocked(false)
            }
          },
          children: (
            <input
              className="input-cell mono"
              inputMode="decimal"
              autoFocus
              value={lotItemUnitCostDraft}
              onChange={(e) => setLotItemUnitCostDraft(e.target.value)}
              disabled={isSaving}
            />
          ),
        })}

        <div className="lot-edit-field" data-unlocked="true">
          <div className="lot-edit-field__head">
            <span className="lot-edit-field__label">Fecha de consumo</span>
          </div>
          <div className="lot-edit-field__input purchase-lot-consumed-at-block">
            <div className="purchase-lot-item-edit-form__trace-row">
              <input
                type="datetime-local"
                className="input-cell"
                value={lotItemConsumedAtDraft}
                onChange={(e) => setLotItemConsumedAtDraft(e.target.value)}
                disabled={isSaving}
              />
              <button
                type="button"
                className="btn-secondary btn-compact"
                onClick={() =>
                  setLotItemConsumedAtDraft(nowDatetimeLocalValue())
                }
                disabled={isSaving}
              >
                Ahora
              </button>
              <button
                type="button"
                className="btn-ghost btn-compact"
                onClick={() => setLotItemConsumedAtDraft('')}
                disabled={isSaving}
              >
                Sin fecha
              </button>
            </div>
            <p className="muted small purchase-lot-consumed-at-block__hint">
              Cuándo se dio por consumido o agotado. Si no había valor guardado, se
              sugiere la fecha y hora actuales al abrir; podés dejarlo vacío con «Sin
              fecha».
            </p>
          </div>
        </div>

        {renderLotItemEditableField({
          fieldKey: 'trace',
          label: 'Revisión / trazabilidad',
          value: traceLabel,
          disabled: isSaving,
          children: (
            <div className="purchase-lot-item-edit-form__trace-row">
              <input
                type="datetime-local"
                className="input-cell"
                autoFocus
                value={lotItemTraceDraft}
                onChange={(e) => setLotItemTraceDraft(e.target.value)}
                disabled={isSaving}
              />
              {lotItemTraceDraft ? (
                <button
                  type="button"
                  className="btn-ghost btn-compact"
                  onClick={() => setLotItemTraceDraft('')}
                  disabled={isSaving}
                >
                  Limpiar
                </button>
              ) : null}
            </div>
          ),
        })}

        {(() => {
          const row = liveRow
          const cInv = num(row.unitCost)
          const qRow = qty(row.quantity)
          const valStock =
            Number.isFinite(cInv) && Number.isFinite(qRow) && qRow > 0
              ? qRow * cInv
              : NaN
          const lineCost = linePurchaseCostCOP(inv, invoiceLine, selectedLotRow)
          if (!Number.isFinite(valStock) && !Number.isFinite(lineCost)) {
            return null
          }
          return (
            <div className="purchase-lot-item-edit-form__summary">
              {Number.isFinite(lineCost) ? (
                <p className="muted small purchase-lot-item-edit-form__subtotal">
                  Costo de la línea:{' '}
                  <strong className="mono">{formatCOP(lineCost)}</strong>
                </p>
              ) : null}
              {Number.isFinite(valStock) ? (
                <p className="muted small purchase-lot-item-edit-form__subtotal">
                  Valor en existencias:{' '}
                  <strong className="mono">{formatCOP(valStock)}</strong>
                </p>
              ) : null}
            </div>
          )
        })()}
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
                  value={draft.lotName}
                  onChange={(e) => setDraft({ ...draft, lotName: e.target.value })}
                  placeholder={purchaseLotDisplayName(selectedLotRow)}
                  title="Título en listados y cabecera. Si lo dejás vacío y guardás, el API puede dejar el nombre en blanco (se verá el código u otra etiqueta)."
                  aria-label="Nombre del lote"
                />
                <p className="muted small purchase-lot-aside-hint">
                  Código interno del lote:{' '}
                  <span className="mono">{selectedLotRow.code}</span> (no cambia desde aquí).
                </p>
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
              <div className="field purchase-lot-aside-field">
                <span>Último cambio en sistema (solo lectura)</span>
                <input
                  className="mono"
                  readOnly
                  value={formatSystemDateTime(selectedLotRow.updatedAt)}
                  title="Marcado automático por el servidor; no se edita desde este formulario."
                />
              </div>
              <label className="field purchase-lot-aside-field">
                <span>Revisión / trazabilidad</span>
                <input
                  type="datetime-local"
                  value={draft.traceModifiedLocal}
                  onChange={(e) =>
                    setDraft({ ...draft, traceModifiedLocal: e.target.value })
                  }
                  title="Fecha y hora de revisión manual. Se guarda en UTC al pulsar Guardar cambios."
                />
                <p className="muted small purchase-lot-aside-hint">
                  Vacío = sin marca. Se envía como <span className="mono">traceModifiedAt</span> en
                  ISO (UTC) o <span className="mono">null</span> si lo dejás en blanco.
                </p>
              </label>
              <div className="field">
                <button
                  type="button"
                  className="btn-secondary btn-compact"
                  disabled={saving}
                  onClick={() => {
                    void (async () => {
                      if (!selectedId) return
                      setSaving(true)
                      setSaveError(null)
                      try {
                        await patchPurchaseLot(baseUrl, selectedId, {
                          traceModifiedAt: null,
                        })
                        const d = await fetchPurchaseLot(baseUrl, selectedId)
                        setSelectedLotRow(d)
                        setDraft((prev) =>
                          prev ? { ...prev, traceModifiedLocal: '' } : prev,
                        )
                      } catch (e) {
                        setSaveError((e as Error).message)
                      } finally {
                        setSaving(false)
                      }
                    })()
                  }}
                >
                  Quitar marca de revisión
                </button>
              </div>
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
              <h2 id="purchase-lot-item-edit-title">Editar ítem</h2>
              <p className="muted small modal-subtitle">{inv.name}</p>
            </div>
            <div className="modal-head-actions">
              <button
                type="button"
                className="btn-ghost icon-close"
                onClick={() => setLotItemEdit(null)}
                aria-label="Cerrar"
              />
            </div>
          </header>
          <div className="modal-body purchase-lot-item-edit-modal__body">
            {purchaseLotItemEditForm(inv, lotItemEdit.invoiceLine)}
          </div>
          <footer className="purchase-lot-item-edit-modal__footer">
            <button
              type="button"
              className="btn-primary purchase-lot-item-edit-footer__confirm"
              disabled={lotItemSavingId === inv.id}
              onClick={() =>
                void commitLotItemModalChanges(inv, lotItemEdit.invoiceLine)
              }
            >
              {lotItemSavingId === inv.id
                ? 'Guardando…'
                : 'Confirmar cambios'}
            </button>
            <button
              type="button"
              className="btn-icon-remove purchase-lot-item-edit-footer__delete"
              onClick={() => void deleteLotItem(inv)}
              disabled={lotItemSavingId === inv.id}
              aria-label="Eliminar ítem"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 6h12" />
                <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6" />
                <path d="M5.5 6 6 16a1.5 1.5 0 0 0 1.5 1.4h5A1.5 1.5 0 0 0 14 16l.5-10" />
                <path d="M9 9v5" />
                <path d="M11 9v5" />
              </svg>
              <span>Eliminar ítem</span>
            </button>
          </footer>
        </section>
      </div>
    )
  }

  function purchaseLotFiltersDialog(): ReactNode {
    if (!lotFiltersPopupOpen) return null
    return (
      <div
        className="modal-backdrop purchase-lot-filters-backdrop"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setLotFiltersPopupOpen(false)
        }}
      >
        <section
          className="modal purchase-lot-filters-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="purchase-lot-filters-title"
        >
          <header className="modal-head">
            <div className="modal-head-title">
              <h2 id="purchase-lot-filters-title">Filtros</h2>
              <p className="muted small modal-subtitle">
                Visibilidad y orden de los ítems del lote.
              </p>
            </div>
            <button
              type="button"
              className="btn-ghost icon-close"
              onClick={() => setLotFiltersPopupOpen(false)}
              aria-label="Cerrar"
            />
          </header>
          <div className="modal-body">
            <div className="purchase-lot-filters-grid">
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
            <div className="purchase-lot-filters-actions">
              <button
                type="button"
                className="btn-ghost btn-compact"
                onClick={() => {
                  setLotItemFilter('all')
                  setLotItemSort('name_asc')
                }}
                disabled={!lotDetailFiltersActive}
              >
                Restablecer
              </button>
              <button
                type="button"
                className="btn-primary btn-compact"
                onClick={() => setLotFiltersPopupOpen(false)}
              >
                Aplicar
              </button>
            </div>
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
      <div className="purchase-lots-view purchase-lots-view--detail">
        <div className="products-layout">
          <div className="products-list-pane products-list-pane--purchases purchase-lot-detail-page">
          <header className="purchase-lot-hero">
            <div className="purchase-lot-hero__nav">
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
              </p>
              <div className="purchase-lot-hero__nav-actions">
                {draft && selectedLotRow ? (
                  <button
                    type="button"
                    className="btn-ghost purchase-lot-hero__edit"
                    onClick={() => {
                      setSaveError(null)
                      setDraft((prev) => {
                        if (!prev || !selectedLotRow) return prev
                        return {
                          ...prev,
                          lotName: selectedLotRow.name?.trim() ?? '',
                          purchaseDate: purchaseLotDateToInputValue(
                            selectedLotRow.purchaseDate,
                          ),
                          supplier: selectedLotRow.supplier ?? '',
                          notes: selectedLotRow.notes ?? '',
                          totalValue:
                            selectedLotRow.totalValue != null
                              ? String(num(selectedLotRow.totalValue))
                              : '',
                          isDepleted: purchaseLotInitialDepleted(selectedLotRow),
                          traceModifiedLocal: isoInstantToDatetimeLocalValue(
                            selectedLotRow.traceModifiedAt,
                          ),
                        }
                      })
                      setLotMetaEditOpen(true)
                    }}
                    aria-label="Editar datos del lote"
                    title="Editar datos del lote"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14.2 3.3a1.8 1.8 0 0 1 2.5 2.5L7.5 15 4 16l1-3.5 9.2-9.2Z" />
                      <path d="M12.5 5l2.5 2.5" />
                    </svg>
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn-ghost purchase-lot-hero__close"
                  onClick={closePanel}
                  aria-label="Cerrar detalle del lote"
                  title="Volver a compras"
                >
                  <span aria-hidden>×</span>
                </button>
              </div>
            </div>

            <div className="purchase-lot-hero__heading">
              <h1 className="purchase-lot-hero__title">
                {selectedLotRow ? purchaseLotDisplayName(selectedLotRow) : 'Lote de compra'}
              </h1>
              {selectedLotRow ? (
                <span
                  className={`purchase-lot-status-pill purchase-lot-status-pill--${lotConsumptionStatusKey(
                    lotItemsStats.consumptionStatus,
                    lotItemsStats.fullyConsumed,
                  )}`}
                  aria-label="Estado del lote"
                >
                  <span className="purchase-lot-status-pill__dot" aria-hidden />
                  {lotConsumptionStatusLabel(
                    lotItemsStats.consumptionStatus,
                    lotItemsStats.fullyConsumed,
                  )}
                </span>
              ) : null}
            </div>

            {selectedLotRow ? (
              <div
                className="purchase-lot-meta-chips"
                aria-label="Datos resumidos del lote"
              >
                {panelLotSecondary ? (
                  <span className="purchase-lot-meta-chip">
                    <span className="purchase-lot-meta-chip__label">Código</span>
                    <span className="mono purchase-lot-meta-chip__value">
                      {panelLotSecondary.replace(/^Código:\s*/i, '')}
                    </span>
                  </span>
                ) : null}
                <span className="purchase-lot-meta-chip">
                  <span className="purchase-lot-meta-chip__label">Fecha</span>
                  <span className="purchase-lot-meta-chip__value">
                    {formatPurchaseLotDate(selectedLotRow.purchaseDate, 'long')}
                  </span>
                </span>
                {(() => {
                  const sup = displayPurchaseLotSupplier(selectedLotRow).trim()
                  return sup ? (
                    <span className="purchase-lot-meta-chip">
                      <span className="purchase-lot-meta-chip__label">Proveedor</span>
                      <span className="purchase-lot-meta-chip__value">{sup}</span>
                    </span>
                  ) : null
                })()}
                {selectedLotRow.notes?.trim() ? (
                  <span
                    className="purchase-lot-meta-chip purchase-lot-meta-chip--notes"
                    title={selectedLotRow.notes ?? ''}
                  >
                    <span className="purchase-lot-meta-chip__label">Notas</span>
                    <span className="purchase-lot-meta-chip__value">
                      {selectedLotRow.notes!.trim()}
                    </span>
                  </span>
                ) : null}
              </div>
            ) : null}

            {selectedLotRow ? (
              <div className="purchase-lot-hero__total" aria-label="Total de la compra">
                <span className="purchase-lot-hero__total-label muted">
                  Total de la compra
                </span>
                <span className="mono purchase-lot-hero__total-value">
                  {formatCOP(lotPurchaseTotalCOP(selectedLotRow))}
                </span>
              </div>
            ) : null}
          </header>

          {detailLoading && <p className="muted purchase-lot-loading">Cargando…</p>}
          {saveError && !draft && (
            <p className="error" role="alert">
              {saveError}
            </p>
          )}
          {!detailLoading && draft && selectedLotRow && (
            <div className="purchase-lot-detail-main">
                {lotItemSaveBanner ? (
                  <div
                    className="purchase-lot-item-save-banner"
                    role="status"
                    aria-live="polite"
                  >
                    {lotItemSaveBanner}
                  </div>
                ) : null}
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
                    <h2 className="purchase-lot-section-head__title">Detalle de lote</h2>
                    <p className="purchase-lot-section-head__lead muted small">
                      Existencias, consumo y costo pagado por producto. Solo se ajustan
                      cantidades en existencia.
                    </p>
                  </header>
                  <div className="purchase-lot-panel-actions">
                    <button
                      type="button"
                      className={`btn-secondary btn-compact purchase-lot-panel-actions__btn${
                        lotKpisOpen
                          ? ' purchase-lot-panel-actions__btn--open'
                          : ''
                      }`}
                      onClick={() => setLotKpisOpen((v) => !v)}
                      aria-expanded={lotKpisOpen}
                      aria-controls="purchase-lot-kpi-grid"
                    >
                      <span>Dashboard</span>
                      <span
                        className="purchase-lot-panel-actions__chevron"
                        aria-hidden
                      >
                        ▾
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`btn-secondary btn-compact purchase-lot-panel-actions__btn${
                        lotDetailFiltersActive
                          ? ' purchase-lot-panel-actions__btn--active'
                          : ''
                      }`}
                      onClick={() => setLotFiltersPopupOpen(true)}
                      aria-haspopup="dialog"
                      aria-expanded={lotFiltersPopupOpen}
                    >
                      <span aria-hidden>⚙</span>
                      <span>Filtros</span>
                      {lotDetailFiltersActive ? (
                        <span
                          className="purchase-lot-panel-actions__dot"
                          aria-label="filtros activos"
                        />
                      ) : null}
                    </button>
                  </div>
                  {lotKpisOpen ? (
                    <div
                      id="purchase-lot-kpi-grid"
                      className="purchase-lot-kpi-grid"
                      aria-label="Resumen del lote"
                    >
                      <div
                        className={`purchase-lot-kpi purchase-lot-kpi--state purchase-lot-kpi--state-${lotConsumptionStatusKey(
                          lotItemsStats.consumptionStatus,
                          lotItemsStats.fullyConsumed,
                        )}`}
                      >
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
                        <span className="purchase-lot-kpi__value">
                          {lotItemsStats.totalItems}
                        </span>
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
                        <span className="purchase-lot-kpi__label">
                          Unid. por consumir
                        </span>
                        <span className="purchase-lot-kpi__value mono">
                          {lotItemsStats.remainingUnits.toFixed(2)}
                        </span>
                      </div>
                      <div className="purchase-lot-kpi">
                        <span className="purchase-lot-kpi__label">
                          Valor por consumir
                        </span>
                        <span className="purchase-lot-kpi__value mono">
                          {formatCOP(lotItemsStats.remainingValue)}
                        </span>
                      </div>
                    </div>
                  ) : null}
                {hasApiLotItems ? (
                  <>
                    <div className="data-table-wrap data-table-compact purchase-lot-table-wrap purchase-lot-line-items-wrap">
                    <table className="data-table data-table-striped purchase-lot-line-items-table purchase-lot-line-items-table--comprobante purchase-lot-line-items-table--cols3">
                      <thead>
                        <tr>
                          <th scope="col">
                            <span className="purchase-lot-th__full">Producto</span>
                            <span className="purchase-lot-th__mobile">
                              Producto / categoría
                            </span>
                          </th>
                          <th
                            scope="col"
                            className="purchase-lot-th-summary"
                            title="Estado del ítem y cantidades (total comprado y lo que queda)"
                          >
                            <span className="purchase-lot-th__full">
                              Estado · cantidades
                            </span>
                            <span className="purchase-lot-th__mobile">
                              Estado / cant.
                            </span>
                          </th>
                          <th
                            className="num purchase-lot-cost-th"
                            scope="col"
                            title="Costo total de compra de la línea"
                          >
                            Costo compra
                          </th>
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
                                <td className="purchase-lot-item-cell">
                                  <span className="purchase-lot-item-cell__name">
                                    {item.name}
                                  </span>
                                  <span className="purchase-lot-item-cell__sub muted small">
                                    {item.category ?? '—'}
                                  </span>
                                </td>
                                <td
                                  colSpan={2}
                                  className="muted small purchase-lot-loading-cell"
                                >
                                  Cargando inventario…
                                </td>
                              </tr>
                            )
                          }
                          if (!inv) {
                            return (
                              <tr key={rowKey}>
                                <td className="purchase-lot-item-cell">
                                  <span className="purchase-lot-item-cell__name">
                                    {item.name}
                                  </span>
                                  <span className="purchase-lot-item-cell__sub muted small">
                                    {item.category ?? '—'}
                                  </span>
                                </td>
                                <td
                                  colSpan={2}
                                  className="muted small purchase-lot-loading-cell"
                                >
                                  Sin línea de inventario con este nombre.
                                </td>
                              </tr>
                            )
                          }
                          return (
                            <tr
                              key={`${inv.id}-${idx}`}
                              className="purchase-lot-row purchase-lot-row--clickable"
                              role="button"
                              tabIndex={0}
                              title="Tocá para editar"
                              onClick={() => openLotItemEdit(inv, item)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  openLotItemEdit(inv, item)
                                }
                              }}
                            >
                              <td className="purchase-lot-item-cell">
                                <span className="purchase-lot-item-cell__name">
                                  {item.name}
                                </span>
                                <span className="purchase-lot-item-cell__sub muted small">
                                  {item.category ??
                                    inv.category?.name ??
                                    '—'}
                                </span>
                              </td>
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
                    <div className="data-table-wrap data-table-compact purchase-lot-table-wrap purchase-lot-line-items-wrap">
                      <table className="data-table data-table-striped purchase-lot-line-items-table purchase-lot-line-items-table--orphan purchase-lot-line-items-table--cols3">
                        <thead>
                          <tr>
                            <th scope="col">
                              <span className="purchase-lot-th__full">Ítem</span>
                              <span className="purchase-lot-th__mobile">
                                Ítem / categoría
                              </span>
                            </th>
                            <th
                              scope="col"
                              className="purchase-lot-th-summary"
                              title="Estado del ítem y cantidades"
                            >
                              <span className="purchase-lot-th__full">
                                Estado · cantidades
                              </span>
                              <span className="purchase-lot-th__mobile">
                                Estado / cant.
                              </span>
                            </th>
                            <th
                              className="num purchase-lot-cost-th"
                              scope="col"
                              title="Costo total de compra de la línea"
                            >
                              Costo compra
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {lotEditorVisibleRows.map((inv) => (
                              <tr
                                key={inv.id}
                                className="purchase-lot-row purchase-lot-row--clickable"
                                role="button"
                                tabIndex={0}
                                title="Tocá para editar"
                                onClick={() => openLotItemEdit(inv)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    openLotItemEdit(inv)
                                  }
                                }}
                              >
                                <td className="purchase-lot-item-cell">
                                  <span className="purchase-lot-item-cell__name">
                                    {inv.name}
                                  </span>
                                  <span className="purchase-lot-item-cell__sub muted small">
                                    {inv.category?.name ?? '—'}
                                  </span>
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
      {purchaseLotFiltersDialog()}
      </div>
    )
  }

  return (
    <div className={mobileViewClass('purchases', 'purchase-lots-view')}>
    <div className="products-layout">
      <div className="products-list-pane products-list-pane--purchases page-pane--floating-gear-dock">
        <div className="page-intro page-intro--tight purchases-intro">
          <div className="purchases-intro__head">
            {!isMobileFilters ? (
              <div>
                <h2 className="page-title">Compras</h2>
                <p className="muted small purchases-intro__description">
                  Registro diario de compras por lote. Calendario para ver el detalle
                  de cada día.
                </p>
              </div>
            ) : null}
            {!isMobileFilters ? (
              <div
                className="view-toggle module-view-toggle"
                role="tablist"
                aria-label="Vista de compras"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'calendar'}
                  className={viewMode === 'calendar' ? 'active' : ''}
                  onClick={() => setViewMode('calendar')}
                >
                  Calendario
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'list'}
                  className={viewMode === 'list' ? 'active' : ''}
                  onClick={() => setViewMode('list')}
                >
                  Lista
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {meta?.purchaseLotLinesMigrationPending ? (
          <div className="purchase-lots-migration-banner" role="status">
            <span className="purchase-lots-migration-banner__title">
              Migración de comprobantes pendiente
            </span>
            <span className="purchase-lots-migration-banner__text">
              {meta.purchaseLotLinesMigrationHint?.trim() ||
                'El servidor indica que la base debe migrarse para líneas de comprobante. Revisá la consola del API o ejecutá la migración indicada.'}
            </span>
          </div>
        ) : null}

        <MobileAwareFilterBar
          hasActiveFilters={purchaseListFiltersActive}
          trailing={
            isMobileFilters ? (
              <MobileModuleToolbar
                onAdd={() => openCreatePurchase()}
                addTitle="Nueva compra"
                addAriaLabel="Nueva compra"
                summary={
                  <SectionSummaryDeck
                    section="purchases"
                    items={purchasesSummaryItems}
                    loading={loading}
                    suspendDetailWhileLoading
                  />
                }
                viewMode={viewMode}
                onViewModeChange={(mode) => {
                  if (mode === 'calendar' || mode === 'list') setViewMode(mode)
                }}
                primaryViewLabel="Calendario"
                secondaryViewLabel="Lista"
                primaryViewValue="calendar"
                secondaryViewValue="list"
                viewToggleAriaLabel="Vista de compras"
              />
            ) : undefined
          }
        >
        <div className="inventory-filter-bar inventory-filter-bar--purchases-catalog">
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
            <button
              type="button"
              className="btn-primary"
              data-mobile-filter-primary="inside"
              onClick={() => openCreatePurchase()}
            >
              Nueva compra
            </button>
          </div>
        </div>
        </MobileAwareFilterBar>

        {viewMode === 'calendar' ? (
          <>
          {isMobileFilters ? (
            <MonthCalendarScrollFeed
              baseUrl={baseUrl}
              cacheNamespace="purchases"
              countLabel="compra"
              selectedDate={dayModalDate}
              refreshKey={calendarRefreshKey}
              inaugurationDate={inaugurationDate}
              ariaLabel="Calendario de compras por mes"
              fetchMonth={fetchPurchaseLotsCalendar}
              onDayClick={(date) => {
                setFilterDateFrom(date)
                setFilterDateTo(date)
                setDayModalDate(date)
                setPage(1)
                const [y, m] = date.split('-').map(Number)
                if (y && m) {
                  setCalendarYear(y)
                  setCalendarMonth(m)
                }
              }}
              onGoToToday={(date) => {
                setFilterDateFrom(date)
                setFilterDateTo(date)
                setDayModalDate(date)
                setPage(1)
                const [y, m] = date.split('-').map(Number)
                if (y && m) {
                  setCalendarYear(y)
                  setCalendarMonth(m)
                }
              }}
            />
          ) : (
            <MonthCalendar
              year={calendarYear}
              month={calendarMonth}
              days={calendarData?.days ?? []}
              loading={calendarLoading}
              error={calendarError}
              countLabel="compra"
              inaugurationDate={inaugurationDate}
              selectedDate={dayModalDate}
              onPrevMonth={() => {
                const prev = new Date(calendarYear, calendarMonth - 2, 1)
                setCalendarYear(prev.getFullYear())
                setCalendarMonth(prev.getMonth() + 1)
              }}
              onNextMonth={() => {
                const next = new Date(calendarYear, calendarMonth, 1)
                setCalendarYear(next.getFullYear())
                setCalendarMonth(next.getMonth() + 1)
              }}
              onToday={() => {
                const now = new Date()
                setCalendarYear(now.getFullYear())
                setCalendarMonth(now.getMonth() + 1)
              }}
              onDayClick={(date) => {
                setFilterDateFrom(date)
                setFilterDateTo(date)
                setDayModalDate(date)
                setPage(1)
                const [y, m] = date.split('-').map(Number)
                if (y && m) {
                  setCalendarYear(y)
                  setCalendarMonth(m)
                }
              }}
            />
          )}
          {!isMobileFilters ? (
            <p className="muted small month-calendar-hint">
              Hacé clic en un día del calendario para abrir un popup con todas las
              compras del día.
            </p>
          ) : null}
          </>
        ) : (
          <>
        {listError && (
          <p className="error" role="alert">
            {listError}
          </p>
        )}
        {saveError && !selectedId && (
          <p className="error purchase-lot-open-error" role="alert">
            {saveError}
          </p>
        )}
        {loading && <p className="muted">Cargando compras…</p>}

        {!loading && list.length > 0 && (
          <div className="data-table-wrap data-table-elevated purchases-list-table-wrap">
            <table className="data-table data-table-striped purchases-list-table">
              <thead>
                <tr>
                  <th
                    className="num table-col-index purchases-col-mobile-hide"
                    scope="col"
                    title="Número de lote en esta página"
                  >
                    #
                  </th>
                  <th>Lote</th>
                  <th className="purchases-col-mobile-hide">Fecha de compra</th>
                  <th className="purchases-col-mobile-hide">Proveedor</th>
                  <th
                    className="num purchases-col-mobile-hide"
                    title="Cantidad de productos distintos en el lote"
                  >
                    Productos
                  </th>
                  <th
                    className="num purchases-col-mobile-hide"
                    title="Productos que aún tienen unidades por consumir en el lote"
                  >
                    Por consumir
                  </th>
                  <th
                    className="num purchases-col-mobile-hide"
                    title="Productos del lote que ya se agotaron (sin saldo)"
                  >
                    Consumidos
                  </th>
                  <th className="purchases-th-status purchases-col-desktop-only">
                    Estado
                  </th>
                  <th
                    className="num purchases-th-total"
                    title="Total de la compra (API o suma del comprobante si no hay total guardado)"
                  >
                    <span className="purchases-th-total__full">Total</span>
                    <span className="purchases-th-total__mobile">Estado / Total</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedList.map((row, rowIdx) => {
                  const secondary = purchaseLotSecondaryLine(row)
                  const lotNum = purchaseLotsListRowOffset + rowIdx + 1
                  return (
                    <tr
                    key={row.id}
                    className={selectedId === row.id ? 'row-active' : ''}
                  >
                    <td className="num mono muted table-col-index purchases-col-mobile-hide">
                      {lotNum}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="table-link purchases-lot-cell"
                        title={`${purchaseLotDisplayName(row)}${
                          secondary ? ` · ${secondary}` : ''
                        }`}
                        onClick={() =>
                          void openLot(row.id, row, true)
                        }
                      >
                        <span className="purchases-lot-cell__num" aria-hidden>
                          #{lotNum}
                        </span>
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
                    <td className="purchases-date-cell purchases-col-mobile-hide">
                      {formatPurchaseLotDate(row.purchaseDate, 'long')}
                    </td>
                    <td className="muted purchases-col-mobile-hide">
                      {displayPurchaseLotSupplier(row) || '—'}
                    </td>
                    <td className="num purchases-col-mobile-hide">
                      {row.inventoryMetrics?.productsCount ?? row.itemCount}
                    </td>
                    <td className="num purchases-cell-pending purchases-col-mobile-hide">
                      {row.inventoryMetrics == null
                        ? '—'
                        : Math.round(
                            qty(row.inventoryMetrics.availableItemsCount),
                          )}
                    </td>
                    <td className="num purchases-cell-done purchases-col-mobile-hide">
                      {row.inventoryMetrics == null
                        ? '—'
                        : Math.round(
                            qty(row.inventoryMetrics.consumedItemsCount),
                          )}
                    </td>
                    {(() => {
                      const statusKey = lotConsumptionStatusKey(
                        row.inventoryMetrics?.consumptionStatus,
                        row.inventoryMetrics?.isDepleted,
                      )
                      const label = lotConsumptionStatusLabel(
                        row.inventoryMetrics?.consumptionStatus,
                        row.inventoryMetrics?.isDepleted,
                      )
                      const totalRaw = purchaseLotRowTotalCOP(row)
                      const totalFull = formatCOP(totalRaw)
                      const renderPill = () => (
                        <span
                          className={`purchases-status-pill purchases-status-pill--${statusKey}`}
                          title={label}
                          aria-label={label}
                        >
                          <span
                            className="purchases-status-pill__dot"
                            aria-hidden
                          />
                          <span className="purchases-status-pill__full">
                            {label}
                          </span>
                        </span>
                      )
                      return (
                        <>
                          <td className="purchases-status-cell purchases-col-desktop-only">
                            {renderPill()}
                          </td>
                          <td
                            className="num mono purchases-total-cell"
                            title={`${label} · ${totalFull}`}
                          >
                            <span className="purchases-total-cell__status">
                              {renderPill()}
                            </span>
                            <span className="purchases-total-cell__amount">
                              {totalFull}
                            </span>
                          </td>
                        </>
                      )
                    })()}
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
          </>
        )}
      </div>
    </div>
    {createOpen ? (
      <CreateDailyPurchaseModal
        baseUrl={baseUrl}
        initialDate={createInitialDate}
        onClose={() => setCreateOpen(false)}
        onCreated={(lotId) => {
          setListRefreshKey((k) => k + 1)
          setCalendarRefreshKey((k) => k + 1)
          if (dayModalDate) setDayPanelRefresh((k) => k + 1)
          void openLot(lotId, undefined, true)
        }}
      />
    ) : null}

      {dayModalDate ? (
        <DayPurchasesModal
          baseUrl={baseUrl}
          date={dayModalDate}
          refreshKey={dayPanelRefresh}
          onClose={() => setDayModalDate(null)}
          onEditLot={(id, row) => {
            setDayModalDate(null)
            void openLot(id, row, true)
          }}
          onCreatePurchase={() => {
            const dateKey = dayModalDate
            setDayModalDate(null)
            openCreatePurchase(dateKey)
          }}
        />
      ) : null}

      <ViewBootSplash
        ready={!loading && (viewMode !== 'calendar' || isMobileFilters || !calendarLoading)}
        label="Cargando compras…"
      />
    </div>
  )
}
