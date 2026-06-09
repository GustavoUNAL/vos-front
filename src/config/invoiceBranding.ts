/** Datos de factura / tirilla (mantener sync con vos-api invoice-branding.ts). */
export const INVOICE_BRANDING = {
  name: 'Arándano Café Bar',
  email: 'arandanocafebar@gmail.com',
  phone: '3332356632',
  address: 'Carrera 35 #17-86',
} as const

export type InvoiceContact = {
  name: string
  email: string
  phone: string
  address: string
}

function formatInvoicePhone(phone: string): string {
  const trimmed = phone.trim()
  if (trimmed.startsWith('57') && trimmed.length > 10) {
    return trimmed.slice(2)
  }
  return trimmed
}

export function resolveInvoiceContact(companyName?: string | null): InvoiceContact {
  return {
    name: companyName?.trim() || INVOICE_BRANDING.name,
    email: INVOICE_BRANDING.email,
    phone: formatInvoicePhone(INVOICE_BRANDING.phone),
    address: INVOICE_BRANDING.address,
  }
}
