import type { SaleListRow } from '../api'

export type SaleRowDisplayInput = {
  id: string
  code?: string | null
  saleDate: string
  saleDateOnly?: string | null
  mesa?: string | null
  clientName?: string | null
  customer?: string | null
  displayPerson?: string | null
  paymentMethod?: string | null
  notes?: string | null
  source?: string | null
  lineCount?: number
  customerPhone?: string | null
}

export function parseAttendedFromNotes(notes?: string | null): string | null {
  const raw = notes?.trim()
  if (!raw) return null
  const m = raw.match(/Atendió:\s*([^·]+)/i)
  return m?.[1]?.trim() ?? null
}

export function saleDisplayCode(row: SaleRowDisplayInput): string {
  const code = row.code?.trim()
  if (code) return code
  return row.id.length > 10 ? row.id.slice(0, 8).toUpperCase() : row.id.toUpperCase()
}

export function saleDisplayClient(row: SaleRowDisplayInput): string {
  return (
    row.mesa?.trim() ||
    row.clientName?.trim() ||
    row.customer?.trim() ||
    'Sin nombre'
  )
}

export function saleDisplayTime(saleDate: string): string {
  const d = new Date(saleDate)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function saleDisplayAttended(row: SaleRowDisplayInput): string | null {
  return parseAttendedFromNotes(row.notes) ?? row.displayPerson?.trim() ?? null
}

export function saleDisplayExtras(row: SaleRowDisplayInput): string[] {
  const parts: string[] = []
  const payment = row.paymentMethod?.trim()
  if (payment) parts.push(payment)
  const attended = saleDisplayAttended(row)
  if (attended && attended !== '—') parts.push(`Atendió ${attended}`)
  if (typeof row.lineCount === 'number' && row.lineCount > 0) {
    parts.push(`${row.lineCount} ${row.lineCount === 1 ? 'línea' : 'líneas'}`)
  }
  const source = row.source?.trim()
  if (source && source !== 'MANUAL') parts.push(source)
  const phone = row.customerPhone?.trim()
  if (phone) parts.push(phone)
  return parts
}

export function saleRowFromListRow(row: SaleListRow): SaleRowDisplayInput {
  return {
    id: row.id,
    code: row.code,
    saleDate: row.saleDate,
    saleDateOnly: row.saleDateOnly,
    mesa: row.mesa,
    clientName: row.clientName,
    displayPerson: row.displayPerson,
    paymentMethod: row.paymentMethod,
    notes: row.notes,
    source: row.source,
    lineCount: row.lineCount,
    customerPhone: row.customerPhone,
  }
}
