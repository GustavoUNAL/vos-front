import type { CategoryRef } from './api'

/** Slugs canónicos de `product.type` (API / seed / import). */
export const PRODUCT_TYPE_SLUGS = [
  'cafeteria',
  'bar',
  'cocteles',
  'shots',
  'botellas',
  'comida',
  'combos',
] as const

export type ProductTypeSlug = (typeof PRODUCT_TYPE_SLUGS)[number]

const SLUG_SET = new Set<string>(PRODUCT_TYPE_SLUGS)

/** Etiqueta visible por slug (UI); las categorías PRODUCT siguen mostrando `category.name` del API. */
export const PRODUCT_TYPE_LABELS: Record<ProductTypeSlug, string> = {
  cafeteria: 'Cafetería',
  bar: 'Bar',
  cocteles: 'Cócteles',
  shots: 'Shots',
  botellas: 'Botellas',
  comida: 'Comida',
  combos: 'Combos',
}

/** Valores legacy → slug canónico (tras migrar datos, deberían desaparecer). */
const TYPE_ALIASES: Record<string, ProductTypeSlug> = {
  bebida: 'bar',
  bebidas: 'bar',
  combo: 'combos',
  cocktails: 'cocteles',
  cocktail: 'cocteles',
  coctel: 'cocteles',
  cafetería: 'cafeteria',
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Coincidencia por nombre de categoría (API) → slug de tipo. Orden: más específico primero. */
const NAME_HINTS: { test: (n: string) => boolean; slug: ProductTypeSlug }[] = [
  { test: (n) => /cafeter/i.test(n), slug: 'cafeteria' },
  { test: (n) => /coctel|cocktail/i.test(n), slug: 'cocteles' },
  { test: (n) => /shot/i.test(n), slug: 'shots' },
  { test: (n) => /botella/i.test(n), slug: 'botellas' },
  { test: (n) => /bebida/i.test(n), slug: 'bar' },
  { test: (n) => /^bar$/i.test(n) || /\bbar\b/i.test(n), slug: 'bar' },
  { test: (n) => /combo/i.test(n), slug: 'combos' },
  { test: (n) => /comida/i.test(n), slug: 'comida' },
]

export function isProductTypeSlug(v: string): v is ProductTypeSlug {
  return SLUG_SET.has(v)
}

export function productTypeLabel(slug: string): string {
  if (isProductTypeSlug(slug)) return PRODUCT_TYPE_LABELS[slug]
  return slug
}

/** Normaliza texto libre o legacy a slug si es posible. */
export function normalizeProductType(raw: string): string {
  const t = stripAccents(raw.trim().toLowerCase())
  if (!t) return ''
  if (SLUG_SET.has(t)) return t
  const alias = TYPE_ALIASES[t]
  if (alias) return alias
  return t
}

export function inferProductTypeFromCategory(c: CategoryRef): ProductTypeSlug {
  const slug = c.slug?.trim()
  if (slug && isProductTypeSlug(slug)) return slug

  const n = stripAccents((c.name ?? '').trim().toLowerCase())
  for (const { test, slug: s } of NAME_HINTS) {
    if (test(n)) return s
  }
  return PRODUCT_TYPE_SLUGS[0]
}
