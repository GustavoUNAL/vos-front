/** Celular móvil Colombia: 10 dígitos (3…) o 57 + 10 dígitos. */
export function isValidColombiaMobile(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10 && digits.startsWith('3')) return true
  if (digits.length === 12 && digits.startsWith('57') && digits[2] === '3') {
    return true
  }
  return false
}
