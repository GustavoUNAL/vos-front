/** Letras legibles (sin I/O para evitar confusión). */
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

const DIGITS = '0123456789'

const CODE_RE = /^[A-Z]{2}\d{4}$/

export function isValidPosOrderCode(code: string | null | undefined): boolean {
  return CODE_RE.test(code?.trim().toUpperCase() ?? '')
}

function randomLetter(): string {
  return LETTERS[Math.floor(Math.random() * LETTERS.length)]
}

function randomDigit(): string {
  return DIGITS[Math.floor(Math.random() * DIGITS.length)]
}

export function generatePosOrderCode(used: Iterable<string>): string {
  const taken = new Set(Array.from(used, (c) => c.trim().toUpperCase()))

  for (let attempt = 0; attempt < 120; attempt++) {
    const code = `${randomLetter()}${randomLetter()}${randomDigit()}${randomDigit()}${randomDigit()}${randomDigit()}`
    if (!taken.has(code)) return code
  }

  const tail = `${Date.now()}`.slice(-4)
  return `${randomLetter()}${randomLetter()}${tail}`
}

export function derivePosOrderCode(id: string): string {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const l1 = LETTERS[Math.abs(h) % LETTERS.length]
  const l2 = LETTERS[Math.abs(h >>> 8) % LETTERS.length]
  const n = String(Math.abs(h >>> 16) % 10000).padStart(4, '0')
  return `${l1}${l2}${n}`
}

export function formatPosOrderCode(order: { code?: string | null; id: string }): string {
  const code = order.code?.trim().toUpperCase()
  if (isValidPosOrderCode(code)) return code!
  return derivePosOrderCode(order.id)
}

export function ensureValidOrderCode(
  order: { code?: string | null; id: string },
  used: Iterable<string>,
): string {
  const current = order.code?.trim().toUpperCase()
  if (isValidPosOrderCode(current)) return current!
  return generatePosOrderCode(used)
}
