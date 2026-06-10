import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createSale,
  deleteSale,
  downloadSaleInvoicePdf,
  downloadSaleReceiptTxt,
  fetchProducts,
  fetchSale,
  fetchSales,
  fetchSalesCalendar,
  formatPurchaseLotDate,
  patchSale,
  replaceSaleLines,
  sendSaleReceiptWhatsApp,
  type AuthUser,
  type ProductRow,
  type SalesCalendarResponse,
  saleListRowLineCount,
  saleRowTotalNumeric,
  type SaleDetail,
  type SaleLineDetail,
  type SaleListRow,
} from '../api'
import { canDeleteSales } from '../lib/permissions'
import { useMatchMedia } from '../hooks/useMatchMedia'
import {
  MobileAwareFilterBar,
  MOBILE_FILTER_BREAKPOINT,
} from './MobileAwareFilterBar'
import { FloatingGearFab, FloatingGearFabDockAdd } from './FloatingGearFab'
import { MobileModuleToolbar } from './MobileModuleToolbar'
import { SectionSummaryDeck } from './SectionSummaryDeck'
import { type SectionSummaryItem } from './SectionSummaryBar'
import { MonthCalendar } from './MonthCalendar'
import { MonthCalendarScrollFeed } from './MonthCalendarScrollFeed'
import { ViewBootSplash } from './DataLoadingSplash'
import { mobileViewClass } from './mobile/mobileView'
import { DaySalesModal } from './DaySalesModal'
import { Button } from './ui/button'
import { consumePendingSalesDate } from '../lib/pending-view-filter'
import {
  saleDisplayAttended,
  saleDisplayClient,
  saleDisplayCode,
  saleDisplayExtras,
  saleDisplayTime,
  saleRowFromListRow,
} from '../lib/saleListDisplay'
import {
  readDefaultSaleParty,
  writeDefaultSaleParty,
} from '../lib/salesDefaults'
import {
  invalidateDaySales,
  peekSaleDetail,
  storeSaleDetail,
} from '../lib/entityCache'

const LIMIT = 15
const SALE_SOURCES = ['MANUAL', 'CART', 'AI'] as const

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

function newLineKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function num(v: string | number): number {
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

function formatCOP(value: string | number): string {
  const n = num(value)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n)
}

function formatSaleDateLong(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(d)
}

function formatSaleDateList(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: iso, time: '' }
  return {
    date: new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(d),
    time: new Intl.DateTimeFormat('es-CO', { timeStyle: 'short' }).format(d),
  }
}

function timeOnlyFromSaleDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('es-CO', { timeStyle: 'short' }).format(d)
}

/** Fecha de columna: `saleDateOnly` (sin desfase TZ) + hora desde `saleDate`. */
function saleListRowDateParts(row: SaleListRow): { date: string; time: string } {
  if (row.saleDateOnly?.trim()) {
    return {
      date: formatPurchaseLotDate(row.saleDateOnly, 'medium'),
      time: timeOnlyFromSaleDate(row.saleDate),
    }
  }
  return formatSaleDateList(row.saleDate)
}

function shortSaleId(id: string): string {
  if (id.length <= 10) return id
  return `${id.slice(0, 8)}…`
}

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type LineDraft = {
  key: string
  /** Id de línea en el servidor (para costo/margen de solo lectura). */
  lineId?: string
  productId: string
  productName: string
  quantity: string
  unitPrice: string
  lineUnit: string
  lineSize: string
}

function linesFromDetail(lines: SaleLineDetail[]): LineDraft[] {
  return lines.map((l) => ({
    key: newLineKey(),
    lineId: l.id,
    productId: l.productId ?? '',
    productName: l.productName,
    quantity: String(l.quantity),
    unitPrice: String(l.unitPrice ?? l.unit_price ?? ''),
    lineUnit: l.lineUnit ?? l.product?.saleUnit ?? 'und',
    lineSize: l.lineSize ?? l.product?.size ?? '',
  }))
}

function emptyLine(): LineDraft {
  return {
    key: newLineKey(),
    productId: '',
    productName: '',
    quantity: '1',
    unitPrice: '0',
    lineUnit: 'und',
    lineSize: '',
  }
}

function catalogDefaultsFromProduct(prod: ProductRow): Pick<
  LineDraft,
  'lineUnit' | 'lineSize' | 'productName' | 'unitPrice'
> {
  return {
    productName: prod.name,
    unitPrice: String(prod.price),
    lineUnit: prod.saleUnit?.trim() || 'und',
    lineSize: prod.size?.trim() ?? '',
  }
}

/** Resumen de unidad/tamaño en las líneas actuales de la venta. */
function saleLinesDefaultsSummary(rows: LineDraft[]): string {
  if (rows.length === 0) return 'Sin líneas'
  const units = [...new Set(rows.map((r) => r.lineUnit.trim() || 'und'))]
  const sizes = [
    ...new Set(rows.map((r) => r.lineSize.trim()).filter(Boolean)),
  ]
  const unitPart =
    units.length === 1
      ? `unidad ${units[0]}`
      : `${units.length} unidades distintas`
  const sizePart =
    sizes.length === 0
      ? 'sin tamaño'
      : sizes.length === 1
        ? `tamaño ${sizes[0]}`
        : `${sizes.length} tamaños`
  return `${unitPart} · ${sizePart}`
}

type HeaderDraft = {
  saleDateLocal: string
  paymentMethod: string
  mesa: string
  customerPhone: string
  notes: string
  source: string
}

function isValidColombiaMobile(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10 && digits.startsWith('3')) return true
  if (digits.length === 12 && digits.startsWith('57') && digits[2] === '3') {
    return true
  }
  return false
}

function headerFromSale(s: SaleDetail): HeaderDraft {
  return {
    saleDateLocal: toDatetimeLocalValue(s.saleDate),
    paymentMethod: s.paymentMethod ?? '',
    mesa: s.mesa ?? '',
    customerPhone: s.customerPhone ?? '',
    notes: s.notes ?? '',
    source: s.source,
  }
}

function headerSnapshot(h: HeaderDraft): string {
  return JSON.stringify({
    saleDateLocal: h.saleDateLocal,
    paymentMethod: h.paymentMethod.trim(),
    mesa: h.mesa.trim(),
    customerPhone: h.customerPhone.trim(),
    notes: h.notes.trim(),
    source: h.source,
  })
}

function linesSnapshot(rows: LineDraft[]): string {
  return JSON.stringify(
    rows.map((r) => ({
      productId: r.productId.trim(),
      productName: r.productName.trim(),
      quantity: r.quantity.trim(),
      unitPrice: r.unitPrice.trim(),
      lineUnit: r.lineUnit.trim(),
      lineSize: r.lineSize.trim(),
    })),
  )
}

function saleEditorSubtitle(
  creating: boolean,
  detail: SaleDetail | null,
): string {
  if (creating) return 'Agregá productos al ticket'
  if (detail?.id) return `Ref. ${shortSaleId(detail.id)}`
  return 'Productos del ticket'
}

/** Vista previa en el acordeón «Detalle de venta». */
function saleDetailPreview(header: HeaderDraft): string {
  const parts: string[] = []
  if (header.saleDateLocal) {
    const d = new Date(header.saleDateLocal)
    if (!Number.isNaN(d.getTime())) {
      parts.push(
        new Intl.DateTimeFormat('es-CO', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(d),
      )
    }
  }
  if (header.paymentMethod.trim()) parts.push(header.paymentMethod.trim())
  if (header.mesa.trim()) parts.push(header.mesa.trim())
  if (header.source) parts.push(header.source)
  if (header.notes.trim()) parts.push('con notas')
  return parts.length ? parts.join(' · ') : 'Fecha, pago y mesa'
}

function invoiceTicketDate(local: string): string {
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(d)
}

function invoiceLineMeta(r: LineDraft): string | null {
  const unit = r.lineUnit.trim() || 'und'
  const size = r.lineSize.trim()
  if (size) return `${unit} · ${size}`
  if (unit !== 'und') return unit
  return null
}

export function SalesManager({
  baseUrl,
  user = null,
  inaugurationDate = null,
  companyName = null,
}: {
  baseUrl: string
  user?: AuthUser | null
  inaugurationDate?: string | null
  companyName?: string | null
}) {
  const allowDeleteSales = canDeleteSales(user)
  const isMobileFilters = useMatchMedia(MOBILE_FILTER_BREAKPOINT)
  const salesSearchInputRef = useRef<HTMLInputElement>(null)
  const [list, setList] = useState<SaleListRow[]>([])
  const [meta, setMeta] = useState<{
    page: number
    limit: number
    total: number
    hasNextPage: boolean
  } | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar')
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear())
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date().getMonth() + 1,
  )
  const [calendarData, setCalendarData] = useState<SalesCalendarResponse | null>(
    null,
  )
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0)
  const [dayModalDate, setDayModalDate] = useState<string | null>(null)
  const [dayPanelRefresh, setDayPanelRefresh] = useState(0)

  useEffect(() => {
    const date = consumePendingSalesDate()
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
  const [creating, setCreating] = useState(false)
  const [detail, setDetail] = useState<SaleDetail | null>(null)
  const [header, setHeader] = useState<HeaderDraft | null>(null)
  const [lineRows, setLineRows] = useState<LineDraft[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailRefreshing, setDetailRefreshing] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saleNotice, setSaleNotice] = useState<string | null>(null)
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)
  const [saveBannerVisible, setSaveBannerVisible] = useState(false)
  const saveBannerTimerRef = useRef<number | null>(null)
  const [headerBaseline, setHeaderBaseline] = useState<string | null>(null)
  const [linesBaseline, setLinesBaseline] = useState<string | null>(null)

  const [productSearch, setProductSearch] = useState('')
  const [productHits, setProductHits] = useState<ProductRow[]>([])
  const [saleDetailOpen, setSaleDetailOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [advancedMode, setAdvancedMode] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search), 320)
    return () => window.clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [searchDebounced, filterSource, filterDateFrom, filterDateTo])

  useEffect(() => {
    return () => {
      if (saveBannerTimerRef.current) {
        clearTimeout(saveBannerTimerRef.current)
      }
    }
  }, [])

  const panelOpen = creating || selectedId !== null

  useEffect(() => {
    if (!panelOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [panelOpen])

  const showSavedBanner = useCallback(() => {
    setSaveBannerVisible(true)
    if (saveBannerTimerRef.current) clearTimeout(saveBannerTimerRef.current)
    saveBannerTimerRef.current = window.setTimeout(() => {
      setSaveBannerVisible(false)
      saveBannerTimerRef.current = null
    }, 2400)
  }, [])

  const salesListQuery = useMemo(
    () => ({
      search: searchDebounced.trim() || undefined,
      source: filterSource || undefined,
      dateFrom: filterDateFrom || undefined,
      dateTo: filterDateTo || undefined,
    }),
    [searchDebounced, filterSource, filterDateFrom, filterDateTo],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setListError(null)
    fetchSales(baseUrl, { page, limit: LIMIT, ...salesListQuery })
      .then((res) => {
        if (!cancelled) {
          setList(res.data)
          setMeta(res.meta)
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setListError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [baseUrl, page, salesListQuery])

  useEffect(() => {
    if (viewMode !== 'calendar' || isMobileFilters) return
    let cancelled = false
    setCalendarLoading(true)
    setCalendarError(null)
    fetchSalesCalendar(baseUrl, calendarYear, calendarMonth)
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

  useEffect(() => {
    if (!selectedId && !creating) return
    let cancelled = false
    const t = window.setTimeout(() => {
      fetchProducts(baseUrl, {
        page: 1,
        limit: 80,
        search: productSearch,
      })
        .then((r) => {
          if (!cancelled) setProductHits(r.data)
        })
        .catch(() => {
          if (!cancelled) setProductHits([])
        })
    }, 280)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [baseUrl, selectedId, creating, productSearch])

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailError(null)
      setSaveError(null)
      const cached = peekSaleDetail(id)
      if (cached) {
        const h = headerFromSale(cached)
        const rows = linesFromDetail(cached.lines ?? [])
        setDetail(cached)
        setHeader(h)
        setLineRows(rows)
        setHeaderBaseline(headerSnapshot(h))
        setLinesBaseline(linesSnapshot(rows))
        setSaleDetailOpen(false)
        setAuditOpen(false)
        setAdvancedMode(false)
        setDetailLoading(false)
        setDetailRefreshing(true)
      } else {
        setDetailLoading(true)
      }
      try {
        const s = await fetchSale(baseUrl, id)
        storeSaleDetail(id, s)
        const h = headerFromSale(s)
        const rows = linesFromDetail(s.lines ?? [])
        setDetail(s)
        setHeader(h)
        setLineRows(rows)
        setHeaderBaseline(headerSnapshot(h))
        setLinesBaseline(linesSnapshot(rows))
        setSaleDetailOpen(false)
        setAuditOpen(false)
        setAdvancedMode(false)
      } catch (e) {
        if (!cached) {
          setDetailError((e as Error).message)
          setDetail(null)
          setHeader(null)
          setLineRows([])
        }
      } finally {
        setDetailLoading(false)
        setDetailRefreshing(false)
      }
    },
    [baseUrl],
  )

  const openSale = useCallback(
    (id: string) => {
      setCreating(false)
      setSelectedId(id)
      setProductSearch('')
      setSaveError(null)
      if (!peekSaleDetail(id)) {
        setDetail(null)
        setHeader(null)
        setLineRows([])
      }
      void loadDetail(id)
    },
    [loadDetail],
  )

  const openCreateForDay = useCallback((dateKey: string) => {
    setCreating(true)
    setSelectedId(null)
    setDetail(null)
    setDetailError(null)
    setSaveError(null)
    setHeaderBaseline(null)
    setLinesBaseline(null)
    setSaleDetailOpen(true)
    setAuditOpen(false)
    setAdvancedMode(false)
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const local = `${dateKey}T${pad(now.getHours())}:${pad(now.getMinutes())}`
    setHeader({
      saleDateLocal: local,
      paymentMethod: '',
      mesa: readDefaultSaleParty(),
      customerPhone: '',
      notes: '',
      source: 'MANUAL',
    })
    setLineRows([emptyLine()])
    setProductSearch('')
  }, [])

  const refreshDayAndCalendar = useCallback(() => {
    if (dayModalDate) setDayPanelRefresh((k) => k + 1)
    if (viewMode === 'calendar') {
      setCalendarRefreshKey((k) => k + 1)
      if (!isMobileFilters) {
        void fetchSalesCalendar(baseUrl, calendarYear, calendarMonth)
          .then(setCalendarData)
          .catch(() => {})
      }
    }
  }, [
    baseUrl,
    calendarMonth,
    calendarYear,
    dayModalDate,
    isMobileFilters,
    viewMode,
  ])

  const openCreate = useCallback(() => {
    setCreating(true)
    setSelectedId(null)
    setDetail(null)
    setDetailError(null)
    setSaveError(null)
    setHeaderBaseline(null)
    setLinesBaseline(null)
    setSaleDetailOpen(true)
    setAuditOpen(false)
    setAdvancedMode(false)
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
    setHeader({
      saleDateLocal: local,
      paymentMethod: '',
      mesa: readDefaultSaleParty(),
      customerPhone: '',
      notes: '',
      source: 'MANUAL',
    })
    setLineRows([emptyLine()])
    setProductSearch('')
  }, [])

  const isHeaderDirty = useMemo(() => {
    if (creating || !header || !headerBaseline) return false
    return headerSnapshot(header) !== headerBaseline
  }, [creating, header, headerBaseline])

  const isLinesDirty = useMemo(() => {
    if (creating || !linesBaseline) return false
    return linesSnapshot(lineRows) !== linesBaseline
  }, [creating, lineRows, linesBaseline])

  const isSaleDirty = creating || isHeaderDirty || isLinesDirty

  const closePanel = useCallback(() => {
    if (
      isSaleDirty &&
      !window.confirm('Hay cambios sin guardar. ¿Cerrar de todos modos?')
    ) {
      return
    }
    setSelectedId(null)
    setCreating(false)
    setDetail(null)
    setHeader(null)
    setLineRows([])
    setDetailError(null)
    setSaveError(null)
    setSaleNotice(null)
    setHeaderBaseline(null)
    setLinesBaseline(null)
    setAdvancedMode(false)
  }, [isSaleDirty])

  const handleDeleteSale = useCallback(async () => {
    if (!detail?.id || creating || !allowDeleteSales) return
    const label = detail.code?.trim() || detail.id.slice(0, 8)
    if (
      !window.confirm(
        `¿Eliminar la venta ${label}? Esta acción no se puede deshacer.`,
      )
    ) {
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await deleteSale(baseUrl, detail.id)
      setSelectedId(null)
      setCreating(false)
      setDetail(null)
      setHeader(null)
      setLineRows([])
      setHeaderBaseline(null)
      setLinesBaseline(null)
      setAdvancedMode(false)
      setDayPanelRefresh((n) => n + 1)
      const res = await fetchSales(baseUrl, {
        page,
        limit: LIMIT,
        ...salesListQuery,
      })
      setList(res.data)
      setMeta(res.meta)
      refreshDayAndCalendar()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'No se pudo eliminar la venta')
    } finally {
      setSaving(false)
    }
  }, [
    allowDeleteSales,
    baseUrl,
    creating,
    detail,
    page,
    refreshDayAndCalendar,
    salesListQuery,
  ])

  const saveNewSale = useCallback(async () => {
    if (!header) return
    const d = new Date(header.saleDateLocal)
    if (Number.isNaN(d.getTime())) {
      setSaveError('Fecha u hora inválida.')
      return
    }
    const payloadLines = []
    for (const r of lineRows) {
      if (!r.productName.trim()) {
        setSaveError('Cada línea necesita nombre de producto.')
        return
      }
      const q = num(r.quantity)
      const p = num(r.unitPrice)
      if (!Number.isFinite(q) || q <= 0) {
        setSaveError('Cantidades inválidas.')
        return
      }
      if (!Number.isFinite(p) || p < 0) {
        setSaveError('Precios inválidos.')
        return
      }
      payloadLines.push({
        productId: r.productId.trim() || undefined,
        productName: r.productName.trim(),
        quantity: q,
        unitPrice: p,
        lineUnit: r.lineUnit.trim() || undefined,
        lineSize: r.lineSize.trim() || undefined,
      })
    }
    if (!payloadLines.length) {
      setSaveError('Añade al menos una línea.')
      return
    }
    const phone = header.customerPhone.trim()
    if (!phone) {
      setSaveError('Ingresá el celular del cliente para enviar el comprobante por WhatsApp.')
      return
    }
    if (!isValidColombiaMobile(phone)) {
      setSaveError('Celular inválido. Usá 10 dígitos (ej. 300 123 4567).')
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      const created = await createSale(baseUrl, {
        saleDate: d.toISOString(),
        paymentMethod: header.paymentMethod.trim() || undefined,
        source: header.source,
        mesa: header.mesa.trim() || undefined,
        customerPhone: phone,
        notes: header.notes.trim() || undefined,
        lines: payloadLines,
      })
      setPage(1)
      const res = await fetchSales(baseUrl, {
        page: 1,
        limit: LIMIT,
        ...salesListQuery,
      })
      setList(res.data)
      setMeta(res.meta)
      if (header.mesa.trim()) writeDefaultSaleParty(header.mesa)
      openSale(created.id)
      refreshDayAndCalendar()
      showSavedBanner()
      if (created.whatsappSent && created.internalNotified) {
        setSaleNotice('Venta registrada. WhatsApp enviado al cliente y a ti.')
      } else if (created.whatsappSent) {
        setSaleNotice('Comprobante enviado por WhatsApp al cliente.')
      } else if (created.internalNotified) {
        setSaleNotice('Venta registrada. Copia enviada a tu WhatsApp.')
      } else if (phone && created.whatsappConfigured === false) {
        setSaleNotice(
          'Venta guardada. Configure TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN (o WHATSAPP_ACCESS_TOKEN) en el servidor para enviar WhatsApp.',
        )
      } else if (phone) {
        setSaleNotice(
          'Venta guardada. No se pudo enviar WhatsApp; verifique el número o la API.',
        )
      } else {
        setSaleNotice(null)
      }
    } catch (e) {
      setSaveError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }, [baseUrl, header, lineRows, openSale, refreshDayAndCalendar, salesListQuery, showSavedBanner])

  const buildLinePayload = useCallback(() => {
    const payloadLines = []
    for (const r of lineRows) {
      if (!r.productName.trim()) {
        throw new Error('Cada línea necesita nombre de producto.')
      }
      const q = num(r.quantity)
      const p = num(r.unitPrice)
      if (!Number.isFinite(q) || q <= 0) {
        throw new Error('Cantidades inválidas.')
      }
      if (!Number.isFinite(p) || p < 0) {
        throw new Error('Precios inválidos.')
      }
      payloadLines.push({
        productId: r.productId.trim() || undefined,
        productName: r.productName.trim(),
        quantity: q,
        unitPrice: p,
        lineUnit: r.lineUnit.trim() || undefined,
        lineSize: r.lineSize.trim() || undefined,
      })
    }
    if (!payloadLines.length) {
      throw new Error('Debe haber al menos una línea.')
    }
    return payloadLines
  }, [lineRows])

  const saveSale = useCallback(async () => {
    if (creating) {
      await saveNewSale()
      return
    }
    if (!selectedId || !header) return
    if (!isSaleDirty) return

    const d = new Date(header.saleDateLocal)
    if (Number.isNaN(d.getTime())) {
      setSaveError('Fecha u hora inválida.')
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      let updated: SaleDetail | null = detail
      if (isHeaderDirty) {
        updated = await patchSale(baseUrl, selectedId, {
          saleDate: d.toISOString(),
          paymentMethod: header.paymentMethod.trim() || undefined,
          source: header.source,
          mesa: header.mesa.trim() || undefined,
          customerPhone: header.customerPhone.trim() || undefined,
          notes: header.notes.trim() || undefined,
        })
      }
      if (isLinesDirty) {
        const payloadLines = buildLinePayload()
        updated = await replaceSaleLines(baseUrl, selectedId, payloadLines)
      }
      if (updated) {
        storeSaleDetail(selectedId, updated)
        const dayKey = updated.saleDate?.slice(0, 10)
        if (dayKey) invalidateDaySales(dayKey)
        const h = headerFromSale(updated)
        const rows = linesFromDetail(updated.lines ?? [])
        setDetail(updated)
        setHeader(h)
        setLineRows(rows)
        setHeaderBaseline(headerSnapshot(h))
        setLinesBaseline(linesSnapshot(rows))
        if (h.mesa.trim()) writeDefaultSaleParty(h.mesa)
      }
      const res = await fetchSales(baseUrl, {
        page,
        limit: LIMIT,
        ...salesListQuery,
      })
      setList(res.data)
      setMeta(res.meta)
      refreshDayAndCalendar()
      showSavedBanner()
    } catch (e) {
      setSaveError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }, [
    baseUrl,
    buildLinePayload,
    creating,
    detail,
    header,
    isHeaderDirty,
    isLinesDirty,
    isSaleDirty,
    page,
    refreshDayAndCalendar,
    salesListQuery,
    saveNewSale,
    selectedId,
    showSavedBanner,
  ])

  const sendWhatsAppReceipt = useCallback(async () => {
    if (!selectedId || creating) return
    const phone = header?.customerPhone.trim() ?? ''
    if (!phone) {
      setSaleNotice('Agregá el celular del cliente y guardá antes de enviar WhatsApp.')
      return
    }
    if (isHeaderDirty || isLinesDirty) {
      setSaleNotice('Guardá los cambios antes de enviar el comprobante por WhatsApp.')
      return
    }
    setSendingWhatsApp(true)
    setSaleNotice(null)
    try {
      const result = await sendSaleReceiptWhatsApp(
        baseUrl,
        selectedId,
        phone,
      )
      if (result.whatsappSent && result.internalNotified) {
        setSaleNotice('Comprobante enviado por WhatsApp al cliente y a ti.')
      } else if (result.whatsappSent) {
        setSaleNotice('Comprobante enviado por WhatsApp al cliente.')
      } else if (result.internalNotified) {
        setSaleNotice('Copia del comprobante enviada a tu WhatsApp.')
      } else if (result.whatsappConfigured === false) {
        setSaleNotice(
          'WhatsApp no configurado en el servidor (TWILIO_* o WHATSAPP_ACCESS_TOKEN).',
        )
      } else {
        setSaleNotice('No se pudo enviar WhatsApp. Verificá el número del cliente.')
      }
    } catch (e) {
      setSaveError((e as Error).message)
    } finally {
      setSendingWhatsApp(false)
    }
  }, [
    baseUrl,
    creating,
    header?.customerPhone,
    isHeaderDirty,
    isLinesDirty,
    selectedId,
  ])

  const updateLine = useCallback(
    (key: string, patch: Partial<LineDraft>) => {
      setLineRows((rows) =>
        rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
      )
    },
    [],
  )

  const addLine = useCallback(() => {
    setLineRows((rows) => [...rows, emptyLine()])
  }, [])

  const removeLine = useCallback((key: string) => {
    setLineRows((rows) => rows.filter((r) => r.key !== key))
  }, [])

  const addLineFromCatalog = useCallback((prod: ProductRow) => {
    setLineRows((rows) => [
      ...rows,
      {
        ...emptyLine(),
        key: newLineKey(),
        productId: prod.id,
        ...catalogDefaultsFromProduct(prod),
      },
    ])
    setProductSearch('')
  }, [])

  const linesSubtotal = lineRows.reduce((s, r) => {
    const q = num(r.quantity)
    const p = num(r.unitPrice)
    if (!Number.isFinite(q) || !Number.isFinite(p)) return s
    return s + q * p
  }, 0)

  const salesSummaryItems = useMemo((): SectionSummaryItem[] => {
    let pageTotal = 0
    let lineRowsCount = 0
    for (const row of list) {
      const t = saleRowTotalNumeric(row)
      if (t != null) pageTotal += t
      lineRowsCount += saleListRowLineCount(row)
    }
    const items: SectionSummaryItem[] = []
    if (meta != null) {
      items.push({
        label: 'Ventas',
        value: meta.total,
        title: 'Total de registros',
      })
    }
    items.push(
      {
        label: 'En página',
        value: list.length,
        title: 'Filas en esta página',
      },
      {
        label: 'Total pág.',
        value: formatCOP(pageTotal),
        title: 'Suma de totales de ventas en esta página',
      },
      {
        label: 'Líneas pág.',
        value: lineRowsCount,
        title: 'Suma de líneas de ticket en esta página',
      },
    )
    return items
  }, [list, meta])
  const totalPages =
    meta && meta.limit > 0 ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1
  const pageDots = paginationDots(page, totalPages)

  const salesFiltersActive = useMemo(
    () =>
      search.trim() !== '' ||
      filterSource !== '' ||
      filterDateFrom !== '' ||
      filterDateTo !== '',
    [search, filterSource, filterDateFrom, filterDateTo],
  )

  return (
    <div className={mobileViewClass('sales', 'products-layout')}>
      <div className="products-list-pane page-pane--floating-gear-dock">
        <div className="page-intro page-intro--tight sales-page-intro">
          <div className="sales-page-intro__head">
            {!isMobileFilters ? (
              <div>
                <h2 className="page-title">Ventas</h2>
                <p className="muted small">
                  Calendario mensual: elegí un día para ver todas las comandas, su
                  detalle y editarlas.
                </p>
              </div>
            ) : null}
            {!isMobileFilters ? (
              <div
                className="view-toggle module-view-toggle"
                role="tablist"
                aria-label="Vista de ventas"
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

        <MobileAwareFilterBar
          hasActiveFilters={salesFiltersActive}
          trailing={
            isMobileFilters ? (
              <MobileModuleToolbar
                onAdd={openCreate}
                addTitle="Nueva venta"
                addAriaLabel="Nueva venta"
                summary={
                  <SectionSummaryDeck
                    section="sales"
                    items={salesSummaryItems}
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
                viewToggleAriaLabel="Vista de ventas"
              />
            ) : undefined
          }
        >
        <div className="inventory-filter-bar app-toolbar-zone">
          <div className="inventory-filter-bar__controls" role="search">
            <label className="inventory-filter">
              <span className="inventory-filter__label">Buscar</span>
              <input
                ref={salesSearchInputRef}
                className="inventory-filter__input"
                type="search"
                placeholder="Producto, mesa, pago, notas…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar ventas"
              />
            </label>
            <label className="inventory-filter">
              <span className="inventory-filter__label">Origen</span>
              <select
                className="inventory-filter__input"
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
              >
                <option value="">Todos</option>
                {SALE_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
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
                setFilterSource('')
                setFilterDateFrom('')
                setFilterDateTo('')
              }}
            >
              Limpiar
            </button>
            <button
              type="button"
              className="btn-primary"
              data-mobile-filter-primary="inside"
              onClick={openCreate}
            >
              Nueva venta
            </button>
          </div>
        </div>
        </MobileAwareFilterBar>

        {!isMobileFilters && (
          <FloatingGearFab
            navAriaLabel="Ventas"
            menuToggleTitleClosed="Configuración del listado"
            menuToggleTitleOpen="Cerrar menú"
            ariaLabelMenuClosed="Abrir menú: buscar y ver resumen"
            ariaLabelMenuOpen="Cerrar menú de ventas"
            filterToggle={
              <button
                type="button"
                className="btn-catalog-dock-tool btn-catalog-dock-tool--search"
                onClick={() => salesSearchInputRef.current?.focus()}
                aria-label="Buscar ventas"
                title="Buscar ventas"
              >
                <span className="icon-mobile-search" aria-hidden />
              </button>
            }
          >
            <FloatingGearFabDockAdd
              title="Nueva venta"
              ariaLabel="Nueva venta"
              onClick={openCreate}
            />
            <SectionSummaryDeck
              section="sales"
              items={salesSummaryItems}
              loading={loading}
              suspendDetailWhileLoading
            />
          </FloatingGearFab>
        )}

        {listError && (
          <p className="error" role="alert">
            {listError}
          </p>
        )}

        {viewMode === 'calendar' ? (
          <>
          {isMobileFilters ? (
            <MonthCalendarScrollFeed
              baseUrl={baseUrl}
              cacheNamespace="sales"
              countLabel="venta"
              selectedDate={dayModalDate}
              refreshKey={calendarRefreshKey}
              inaugurationDate={inaugurationDate}
              ariaLabel="Calendario de ventas por mes"
              fetchMonth={fetchSalesCalendar}
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
              countLabel="venta"
              selectedDate={dayModalDate}
              inaugurationDate={inaugurationDate}
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
              }}
            />
          )}

          {!isMobileFilters ? (
            <p className="muted small month-calendar-hint">
              Hacé clic en un día del calendario para abrir un popup con todas las
              ventas, editarlas o crear una nueva.
            </p>
          ) : null}
          </>
        ) : null}

        {viewMode === 'list' ? (
          <>
        {loading && <p className="muted">Cargando ventas…</p>}

        {!loading && list.length > 0 && (
          <div className="data-table-wrap data-table-elevated sales-table-wrap">
            <table className="data-table data-table-striped data-table--sales-list">
              <thead>
                <tr>
                  <th className="sales-table-col sales-table-col--id">ID</th>
                  <th className="sales-table-col sales-table-col--client">Cliente</th>
                  <th className="sales-table-col sales-table-col--time">Hora</th>
                  <th className="sales-table-col sales-table-col--detail">
                    Detalle
                  </th>
                  <th className="sales-table-col sales-table-col--total num">
                    Total
                  </th>
                  <th className="sales-table-col sales-table-col--action col-actions">
                    <span className="sr-only">Acción</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => {
                  const { date } = saleListRowDateParts(row)
                  const display = saleRowFromListRow(row)
                  const extras = saleDisplayExtras({
                    ...display,
                    lineCount: saleListRowLineCount(row),
                  })
                  const attended = saleDisplayAttended(display)
                  const active = selectedId === row.id
                  return (
                    <tr
                      key={row.id}
                      className={
                        active
                          ? 'row-active sales-table-row--active'
                          : undefined
                      }
                      onDoubleClick={() => openSale(row.id)}
                    >
                      <td className="sales-table-cell sales-table-cell--id">
                        <button
                          type="button"
                          className="sales-table-link sales-table-link--id"
                          onClick={() => openSale(row.id)}
                          title={row.id}
                        >
                          <span className="sales-table-link__code mono">
                            {saleDisplayCode(display)}
                          </span>
                          <span className="sales-table-link__date muted small">
                            {date}
                          </span>
                        </button>
                      </td>
                      <td className="sales-table-cell sales-table-cell--client">
                        <button
                          type="button"
                          className="sales-table-link"
                          onClick={() => openSale(row.id)}
                        >
                          <span className="sales-table-link__client">
                            {saleDisplayClient(display)}
                          </span>
                        </button>
                      </td>
                      <td className="sales-table-cell sales-table-cell--time mono">
                        {saleDisplayTime(row.saleDate)}
                      </td>
                      <td
                        className="sales-table-cell sales-table-cell--detail muted"
                        title={extras.join(' · ') || undefined}
                      >
                        {extras.length > 0 ? (
                          <span className="sales-table-detail">
                            {row.paymentMethod?.trim() ? (
                              <span className="sales-table-detail__line">
                                {row.paymentMethod.trim()}
                              </span>
                            ) : null}
                            {attended && attended !== '—' ? (
                              <span className="sales-table-detail__line">
                                Atendió {attended}
                              </span>
                            ) : null}
                            <span className="sales-table-detail__line">
                              {saleListRowLineCount(row)}{' '}
                              {saleListRowLineCount(row) === 1 ? 'línea' : 'líneas'}
                              {row.source ? (
                                <>
                                  {' '}
                                  ·{' '}
                                  <span
                                    className={`sales-source-pill sales-source-pill--${row.source.toLowerCase()}`}
                                  >
                                    {row.source}
                                  </span>
                                </>
                              ) : null}
                            </span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="num mono sales-table-cell sales-table-cell--total">
                        {formatCOP(saleRowTotalNumeric(row) ?? Number.NaN)}
                      </td>
                      <td className="col-actions sales-table-cell sales-table-cell--action">
                        <button
                          type="button"
                          className="sales-table-action"
                          onClick={() => openSale(row.id)}
                        >
                          Ver
                        </button>
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
              {meta.total} venta{meta.total !== 1 ? 's' : ''}
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
          <p className="empty-hint">No hay ventas en esta página.</p>
        )}
          </>
        ) : null}
      </div>

      {panelOpen && (creating || selectedId) && (
        <div
          className="modal-backdrop modal-backdrop--sales-editor modal-backdrop--config"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closePanel()
          }}
        >
          <section
            className="modal modal--config modal--config-full modal--sales-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sales-editor-title"
          >
            <header className="modal-head modal-head--config modal-head--sales-editor">
              <div className="modal-head-title product-editor-head__title">
                <p className="product-editor-head__eyebrow">Ventas</p>
                <h2 id="sales-editor-title">
                  {creating ? 'Nueva venta' : 'Editar venta'}
                </h2>
                <p className="modal-subtitle product-editor-head__subtitle">
                  {header
                    ? saleEditorSubtitle(creating, detail)
                    : detailLoading
                      ? 'Cargando ticket…'
                      : 'Ticket de venta'}
                  {detailRefreshing ? (
                    <span className="muted small"> · actualizando</span>
                  ) : null}
                </p>
              </div>
              <div className="modal-head-actions product-editor-head__actions">
                <button
                  type="button"
                  className="product-editor-close"
                  onClick={closePanel}
                  aria-label="Cerrar editor"
                >
                  <span aria-hidden>×</span>
                </button>
              </div>
            </header>

            <div className="modal-body modal-body--config modal-body--sales-editor">
            {detailLoading && !header && (
              <p className="muted">Cargando detalle…</p>
            )}
            {detailError && (
              <p className="error" role="alert">
                {detailError}
              </p>
            )}

            {saleNotice ? (
              <p className="banner-warn" role="status">
                {saleNotice}
              </p>
            ) : null}

            {saveBannerVisible ? (
              <div
                className="product-editor-save-ribbon"
                role="status"
                aria-live="polite"
              >
                <span className="product-editor-save-ribbon__check" aria-hidden />
                <span className="product-editor-save-ribbon__text">
                  Venta guardada
                </span>
              </div>
            ) : null}

            {header && (!detailLoading || creating) && (
              <>
                {advancedMode ? (
                  <div
                    className="sales-editor-total-bar"
                    aria-label="Total del ticket"
                  >
                    <div className="sales-editor-total-bar__main">
                      <span className="sales-editor-total-bar__label">Total</span>
                      <strong className="sales-editor-total-bar__amount mono">
                        {formatCOP(linesSubtotal)}
                      </strong>
                      <span className="sales-editor-total-bar__meta muted small">
                        {lineRows.length} producto
                        {lineRows.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {!creating && detail ? (
                      <span className="sales-editor-total-bar__saved muted small">
                        Guardado:{' '}
                        <span className="mono">
                          {formatCOP(saleRowTotalNumeric(detail) ?? Number.NaN)}
                        </span>
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {!advancedMode ? (
                  <div
                    className="sales-invoice-sheet"
                    aria-labelledby="sales-editor-products-heading"
                  >
                    <div className="sales-invoice-sheet__top">
                      <h3
                        id="sales-editor-products-heading"
                        className="sales-invoice-sheet__heading"
                      >
                        Resumen de venta
                      </h3>
                      <div className="sales-invoice-sheet__top-actions">
                      {!creating && selectedId ? (
                        <>
                          <Button
                            type="button"
                            variant="accent"
                            size="sm"
                            disabled={
                              sendingWhatsApp || !header.customerPhone.trim()
                            }
                            onClick={() => void sendWhatsAppReceipt()}
                          >
                            {sendingWhatsApp ? 'Enviando…' : 'Enviar WhatsApp'}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              void downloadSaleReceiptTxt(
                                baseUrl,
                                selectedId,
                                detail?.code ?? undefined,
                              )
                            }
                          >
                            Descargar TXT
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              void downloadSaleInvoicePdf(
                                baseUrl,
                                selectedId,
                                detail?.code ?? undefined,
                              )
                            }
                          >
                            Descargar PDF
                          </Button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        className="sales-advanced-toggle sales-advanced-toggle--compact"
                        aria-pressed={false}
                        aria-label="Configurar venta"
                        onClick={() => {
                          setAdvancedMode(true)
                          setSaleDetailOpen(true)
                        }}
                      >
                        <span
                          className="sales-advanced-toggle__icon-wrap"
                          aria-hidden
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </span>
                        <span className="sales-advanced-toggle__title">
                          Configurar
                        </span>
                      </button>
                      </div>
                    </div>

                    <article className="sales-invoice" aria-label="Factura de venta">
                      <header className="sales-invoice__header">
                        <div className="sales-invoice__brand">
                          <span className="sales-invoice__eyebrow">Ticket de venta</span>
                          <strong className="sales-invoice__title">
                            {formatCOP(linesSubtotal)}
                          </strong>
                          <span className="sales-invoice__count muted small">
                            {lineRows.length} ítem
                            {lineRows.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <ul className="sales-invoice__chips" aria-label="Datos del ticket">
                          <li className="sales-invoice__chip">
                            <span className="sales-invoice__chip-label">Fecha</span>
                            <span>{invoiceTicketDate(header.saleDateLocal)}</span>
                          </li>
                          {header.mesa.trim() ? (
                            <li className="sales-invoice__chip">
                              <span className="sales-invoice__chip-label">Mesa</span>
                              <span>{header.mesa.trim()}</span>
                            </li>
                          ) : null}
                          {header.paymentMethod.trim() ? (
                            <li className="sales-invoice__chip">
                              <span className="sales-invoice__chip-label">Pago</span>
                              <span>{header.paymentMethod.trim()}</span>
                            </li>
                          ) : null}
                          <li className="sales-invoice__chip">
                            <span className="sales-invoice__chip-label">Origen</span>
                            <span>{header.source}</span>
                          </li>
                          {detail?.code ? (
                            <li className="sales-invoice__chip">
                              <span className="sales-invoice__chip-label">Nº venta</span>
                              <span>{detail.code}</span>
                            </li>
                          ) : null}
                        </ul>
                      </header>

                      {header ? (
                        <>
                          <label className="field sales-invoice-party">
                            <span>Cliente o mesa</span>
                            <input
                              value={header.mesa}
                              onChange={(e) =>
                                setHeader({ ...header, mesa: e.target.value })
                              }
                              placeholder="Ej. Juan, Mesa 3, mostrador…"
                            />
                            <span className="muted small">
                              Se guarda como valor por defecto para la próxima venta.
                            </span>
                          </label>
                          <label className="field sales-invoice-phone">
                            <span>
                              Celular cliente (WhatsApp)
                              {creating ? ' *' : ''}
                            </span>
                            <input
                              type="tel"
                              inputMode="tel"
                              autoComplete="tel"
                              value={header.customerPhone}
                              onChange={(e) =>
                                setHeader({
                                  ...header,
                                  customerPhone: e.target.value,
                                })
                              }
                              placeholder="300 123 4567"
                            />
                            <span className="muted small">
                              {creating
                                ? 'Al guardar se envía el comprobante por WhatsApp.'
                                : 'Guardá la venta y usá «Enviar WhatsApp» para reenviar el comprobante.'}
                            </span>
                          </label>
                          <label className="field sales-invoice-comment">
                            <span>Comentario</span>
                            <textarea
                              rows={2}
                              value={header.notes}
                              onChange={(e) =>
                                setHeader({ ...header, notes: e.target.value })
                              }
                              placeholder="Ej. mesa, preferencias, observaciones del pedido…"
                            />
                          </label>
                        </>
                      ) : null}

                      <div className="sales-invoice__add">
                        <input
                          type="search"
                          className="sales-invoice__search"
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          placeholder="Buscar producto para añadir…"
                          aria-label="Buscar producto"
                        />
                        {productSearch.trim() && productHits.length > 0 ? (
                          <ul
                            className="sales-invoice-quick-add"
                            role="listbox"
                            aria-label="Añadir del catálogo"
                          >
                            {productHits.slice(0, 8).map((prod) => (
                              <li key={prod.id}>
                                <button
                                  type="button"
                                  role="option"
                                  className="sales-invoice-quick-add__btn"
                                  onClick={() => addLineFromCatalog(prod)}
                                >
                                  <span className="sales-invoice-quick-add__name">
                                    {prod.name}
                                  </span>
                                  <span className="sales-invoice-quick-add__price mono">
                                    {formatCOP(prod.price)}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>

                      <div className="sales-invoice__body">
                      <table className="sales-invoice__table">
                        <thead>
                          <tr>
                            <th className="sales-invoice__col-desc">
                              Producto
                            </th>
                            <th className="sales-invoice__col-qty num">Cant.</th>
                            <th className="sales-invoice__col-price num">
                              P. unit.
                            </th>
                            <th className="sales-invoice__col-total num">
                              Importe
                            </th>
                            <th className="sales-invoice__col-act" />
                          </tr>
                        </thead>
                        <tbody>
                          {lineRows.map((r) => {
                            const q = num(r.quantity)
                            const p = num(r.unitPrice)
                            const sub =
                              Number.isFinite(q) && Number.isFinite(p)
                                ? formatCOP(q * p)
                                : '—'
                            const meta = invoiceLineMeta(r)
                            return (
                              <tr key={r.key}>
                                <td className="sales-invoice__col-desc">
                                  <input
                                    className="sales-invoice__input sales-invoice__input--name"
                                    value={r.productName}
                                    onChange={(e) =>
                                      updateLine(r.key, {
                                        productName: e.target.value,
                                      })
                                    }
                                    placeholder="Nombre del producto"
                                  />
                                  {meta ? (
                                    <span className="sales-invoice__line-meta muted small">
                                      {meta}
                                    </span>
                                  ) : null}
                                </td>
                                <td className="sales-invoice__col-qty num">
                                  <input
                                    className="sales-invoice__input sales-invoice__input--qty"
                                    inputMode="decimal"
                                    value={r.quantity}
                                    onChange={(e) =>
                                      updateLine(r.key, {
                                        quantity: e.target.value,
                                      })
                                    }
                                  />
                                </td>
                                <td className="sales-invoice__col-price num">
                                  <input
                                    className="sales-invoice__input sales-invoice__input--price mono"
                                    inputMode="decimal"
                                    value={r.unitPrice}
                                    onChange={(e) =>
                                      updateLine(r.key, {
                                        unitPrice: e.target.value,
                                      })
                                    }
                                  />
                                </td>
                                <td className="sales-invoice__col-total num mono">
                                  {sub}
                                </td>
                                <td className="sales-invoice__col-act">
                                  <button
                                    type="button"
                                    className="sales-invoice__remove"
                                    onClick={() => removeLine(r.key)}
                                    disabled={lineRows.length <= 1}
                                    aria-label="Quitar línea"
                                  >
                                    ×
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      </div>

                      <footer className="sales-invoice__footer">
                        {header.notes.trim() ? (
                          <p className="sales-invoice__notes">
                            <span className="sales-invoice__notes-label">Comentario</span>
                            {header.notes.trim()}
                          </p>
                        ) : null}
                        <div className="sales-invoice__totals">
                          {!creating && detail ? (
                            <div className="sales-invoice__total-row sales-invoice__total-row--muted">
                              <span>Guardado en sistema</span>
                              <span className="mono">
                                {formatCOP(
                                  saleRowTotalNumeric(detail) ?? Number.NaN,
                                )}
                              </span>
                            </div>
                          ) : null}
                          <div className="sales-invoice__total-row sales-invoice__total-row--grand">
                            <span>Total a pagar</span>
                            <strong className="mono">
                              {formatCOP(linesSubtotal)}
                            </strong>
                          </div>
                        </div>
                      </footer>
                    </article>

                    <button
                      type="button"
                      className="sales-invoice-sheet__add-line"
                      onClick={addLine}
                    >
                      + Agregar producto
                    </button>
                  </div>
                ) : (
                  <section
                    className="sales-editor-section sales-editor-section--config"
                    aria-labelledby="sales-editor-config-heading"
                  >
                    <header className="sales-editor-section__head sales-editor-section__head--row">
                      <div>
                        <h3
                          id="sales-editor-config-heading"
                          className="sales-editor-section__title sales-editor-section__title--primary"
                        >
                          Configurar venta
                        </h3>
                        <p className="muted small sales-editor-section__hint">
                          Catálogo, unidades, costos y datos del ticket.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="sales-advanced-toggle sales-advanced-toggle--compact sales-advanced-toggle--on"
                        aria-pressed
                        aria-label="Volver a resumen de venta"
                        onClick={() => setAdvancedMode(false)}
                      >
                        <span
                          className="sales-advanced-toggle__icon-wrap"
                          aria-hidden
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          >
                            <path d="M5 12h14M12 5v14" />
                          </svg>
                        </span>
                        <span className="sales-advanced-toggle__title">
                          Ver factura
                        </span>
                      </button>
                    </header>
                    <>
                  <label className="field sales-lines-toolbar__search sales-editor-product-search">
                    <span>Buscar en catálogo</span>
                    <input
                      type="search"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Nombre del producto…"
                    />
                  </label>

                  <div className="recipe-table-wrap sales-lines-table-wrap sales-lines-table-wrap--advanced">
                    <table className="recipe-table sales-lines-table sales-lines-table--advanced">
                      <thead>
                        <tr>
                          <th>Catálogo</th>
                          <th>Producto</th>
                          <th className="col-unit">Unidad</th>
                          <th className="col-size">Tamaño</th>
                          <th className="col-qty">Cant.</th>
                          <th className="col-cost">Precio</th>
                          <th className="col-cost">Subtotal</th>
                          <th className="col-cost">Total línea</th>
                          <th className="col-cost">Costo</th>
                          <th className="col-cost">Margen</th>
                          <th className="col-actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {lineRows.map((r) => {
                          const q = num(r.quantity)
                          const p = num(r.unitPrice)
                          const sub =
                            Number.isFinite(q) && Number.isFinite(p)
                              ? formatCOP(q * p)
                              : '—'
                          const lineDetail =
                            !creating &&
                            r.lineId &&
                            detail
                              ? (detail.lines ?? []).find(
                                  (x) => x.id === r.lineId,
                                )
                              : undefined
                          const costCell =
                            lineDetail?.costAtSale != null &&
                            lineDetail.costAtSale !== ''
                              ? formatCOP(lineDetail.costAtSale)
                              : '—'
                          const profitCell =
                            lineDetail?.profit != null &&
                            lineDetail.profit !== ''
                              ? formatCOP(lineDetail.profit)
                              : '—'
                          const lineTotalApi =
                            lineDetail?.lineTotal != null &&
                            lineDetail.lineTotal !== ''
                              ? formatCOP(lineDetail.lineTotal)
                              : lineDetail?.lineTotalCOP != null &&
                                  String(lineDetail.lineTotalCOP).trim() !== ''
                                ? formatCOP(lineDetail.lineTotalCOP)
                                : '—'
                          return (
                            <tr key={r.key}>
                              <td>
                                <select
                                  className="recipe-select"
                                  value={r.productId}
                                  onChange={(e) => {
                                    const id = e.target.value
                                    const hit = productHits.find(
                                      (x) => x.id === id,
                                    )
                                    updateLine(r.key, {
                                      productId: id,
                                      ...(hit
                                        ? catalogDefaultsFromProduct(hit)
                                        : { productName: r.productName }),
                                    })
                                  }}
                                >
                                  <option value="">— Elegir —</option>
                                  {productHits.map((prod) => (
                                    <option key={prod.id} value={prod.id}>
                                      {prod.name}
                                      {prod.size?.trim()
                                        ? ` · ${prod.size}`
                                        : ''}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  className="input-cell"
                                  value={r.productName}
                                  onChange={(e) =>
                                    updateLine(r.key, {
                                      productName: e.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td className="col-unit">
                                <input
                                  className="input-cell"
                                  value={r.lineUnit}
                                  onChange={(e) =>
                                    updateLine(r.key, {
                                      lineUnit: e.target.value,
                                    })
                                  }
                                  placeholder="und"
                                  list="sale-line-unit-suggestions"
                                />
                              </td>
                              <td className="col-size">
                                <input
                                  className="input-cell"
                                  value={r.lineSize}
                                  onChange={(e) =>
                                    updateLine(r.key, {
                                      lineSize: e.target.value,
                                    })
                                  }
                                  placeholder="6 oz"
                                />
                              </td>
                              <td className="col-qty">
                                <input
                                  className="input-cell"
                                  inputMode="decimal"
                                  value={r.quantity}
                                  onChange={(e) =>
                                    updateLine(r.key, {
                                      quantity: e.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td className="col-cost">
                                <input
                                  className="input-cell"
                                  inputMode="decimal"
                                  value={r.unitPrice}
                                  onChange={(e) =>
                                    updateLine(r.key, {
                                      unitPrice: e.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td className="col-cost mono sales-line-subtotal">{sub}</td>
                              <td className="col-cost mono muted">{lineTotalApi}</td>
                              <td className="col-cost mono muted">{costCell}</td>
                              <td className="col-cost mono muted">{profitCell}</td>
                              <td className="col-actions">
                                <button
                                  type="button"
                                  className="btn-icon-remove"
                                  onClick={() => removeLine(r.key)}
                                  disabled={lineRows.length <= 1}
                                >
                                  Quitar
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <datalist id="sale-line-unit-suggestions">
                    <option value="und" />
                    <option value="porción" />
                    <option value="oz" />
                    <option value="ml" />
                    <option value="litro" />
                  </datalist>

                  <div className="sales-editor-lines-actions">
                    <button
                      type="button"
                      className="sales-editor-btn sales-editor-btn--add"
                      onClick={addLine}
                    >
                      <svg
                        className="sales-editor-btn__icon"
                        aria-hidden
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.25"
                        strokeLinecap="round"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      Agregar producto
                    </button>
                    <p className="sales-editor-lines-actions__hint muted small">
                      {saleLinesDefaultsSummary(lineRows)}
                    </p>
                  </div>
                    </>
                  </section>
                )}

                {creating || advancedMode ? (
                  <>
                <details
                  className="product-editor-details sales-editor-details-block"
                  open={creating || saleDetailOpen}
                  onToggle={(e) =>
                    setSaleDetailOpen(
                      (e.currentTarget as HTMLDetailsElement).open,
                    )
                  }
                >
                  <summary className="product-editor-details__summary">
                    <span className="product-editor-details__summary-title">
                      Detalle de venta
                    </span>
                    <span className="product-editor-details__summary-preview muted small">
                      {saleDetailPreview(header)}
                    </span>
                  </summary>
                  <div className="product-editor-details__body">
                    <label className="field">
                      <span>Fecha y hora</span>
                      <input
                        type="datetime-local"
                        value={header.saleDateLocal}
                        onChange={(e) =>
                          setHeader({
                            ...header,
                            saleDateLocal: e.target.value,
                          })
                        }
                      />
                    </label>
                    <div className="field-row-2">
                      <label className="field">
                        <span>Origen</span>
                        <select
                          value={header.source}
                          onChange={(e) =>
                            setHeader({ ...header, source: e.target.value })
                          }
                        >
                          {SALE_SOURCES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Medio de pago</span>
                        <input
                          value={header.paymentMethod}
                          onChange={(e) =>
                            setHeader({
                              ...header,
                              paymentMethod: e.target.value,
                            })
                          }
                          placeholder="Efectivo, Nequi…"
                        />
                      </label>
                    </div>
                    <label className="field">
                      <span>Mesa / referencia</span>
                      <input
                        value={header.mesa}
                        onChange={(e) =>
                          setHeader({ ...header, mesa: e.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>
                        Celular cliente (WhatsApp)
                        {creating ? ' *' : ''}
                      </span>
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={header.customerPhone}
                        onChange={(e) =>
                          setHeader({
                            ...header,
                            customerPhone: e.target.value,
                          })
                        }
                        placeholder="300 123 4567"
                      />
                      {creating ? (
                        <span className="muted small">
                          Se envía el comprobante de venta por WhatsApp al
                          registrar.
                        </span>
                      ) : null}
                    </label>
                    <label className="field">
                      <span>Comentario</span>
                      <textarea
                        rows={2}
                        value={header.notes}
                        onChange={(e) =>
                          setHeader({ ...header, notes: e.target.value })
                        }
                        placeholder="Observaciones de la venta…"
                      />
                    </label>
                  </div>
                </details>

                {!creating && detail ? (
                  <details
                    className="product-editor-details product-editor-details--nested sales-editor-audit"
                    open={auditOpen}
                    onToggle={(e) =>
                      setAuditOpen((e.currentTarget as HTMLDetailsElement).open)
                    }
                  >
                    <summary className="product-editor-details__summary">
                      <span className="product-editor-details__summary-title">
                        Información del sistema
                      </span>
                      <span className="product-editor-details__summary-preview muted small">
                        {detail.displayPerson?.trim() ||
                          shortSaleId(detail.id)}
                      </span>
                    </summary>
                    <div className="product-editor-details__body">
                      <div className="sale-detail-readonly-grid">
                        <div>
                          <strong>ID</strong>
                          <div className="mono wrap-break">{detail.id}</div>
                        </div>
                        <div>
                          <strong>Persona</strong>
                          <div>{detail.displayPerson?.trim() || '—'}</div>
                        </div>
                        {(detail.recordedByName?.trim() ||
                          detail.recordedByUserId?.trim()) && (
                          <div>
                            <strong>Registró</strong>
                            <div>
                              {detail.recordedByName?.trim() || '—'}
                              {detail.recordedByUserId?.trim() && (
                                <span className="mono muted">
                                  {' '}
                                  · {detail.recordedByUserId}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {detail.createdAt && (
                          <div>
                            <strong>Creada</strong>
                            <div>{formatSaleDateLong(detail.createdAt)}</div>
                          </div>
                        )}
                        {detail.updatedAt &&
                          detail.updatedAt !== detail.createdAt && (
                            <div>
                              <strong>Actualizada</strong>
                              <div>{formatSaleDateLong(detail.updatedAt)}</div>
                            </div>
                          )}
                      </div>
                    </div>
                  </details>
                ) : null}
                  </>
                ) : null}

                {saveError ? (
                  <p className="error" role="alert">
                    {saveError}
                  </p>
                ) : null}
              </>
            )}
            </div>

            {header && (!detailLoading || creating) ? (
              <footer
                className="product-editor-footer modal-footer--config sales-editor-footer"
                role="toolbar"
                aria-label="Acciones de venta"
              >
                <div className="product-editor-footer__actions sales-editor-footer__actions">
                  {!creating && detail && allowDeleteSales ? (
                    <button
                      type="button"
                      className="product-editor-btn product-editor-btn--danger"
                      disabled={saving}
                      onClick={() => void handleDeleteSale()}
                    >
                      Eliminar venta
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="product-editor-btn product-editor-btn--secondary"
                    disabled={saving}
                    onClick={closePanel}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="product-editor-btn product-editor-btn--primary"
                    disabled={saving || (!creating && !isSaleDirty)}
                    onClick={() => void saveSale()}
                  >
                    {saving
                      ? 'Guardando…'
                      : creating
                        ? 'Crear venta'
                        : 'Guardar'}
                  </button>
                </div>
              </footer>
            ) : null}
          </section>
        </div>
      )}

      <ViewBootSplash
        ready={
          !loading && (viewMode !== 'calendar' || !calendarLoading)
        }
        label="Cargando ventas…"
      />

      {dayModalDate ? (
        <DaySalesModal
          baseUrl={baseUrl}
          date={dayModalDate}
          refreshKey={dayPanelRefresh}
          companyName={companyName}
          onClose={() => setDayModalDate(null)}
          onEditSale={(id) => {
            setDayModalDate(null)
            openSale(id)
          }}
          onCreateSale={() => {
            const dateKey = dayModalDate
            setDayModalDate(null)
            openCreateForDay(dateKey)
          }}
        />
      ) : null}
    </div>
  )
}
