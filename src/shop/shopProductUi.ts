import type { ShopProduct } from './shopApi'

export function productInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase()
}

export function categoryEmoji(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('café') || n.includes('cafe')) {
    if (n.includes('frí') || n.includes('fri') || n.includes('frío')) return '🧊'
    return '☕'
  }
  if (n.includes('comida') || n.includes('rápida') || n.includes('rapida')) return '🍴'
  if (n.includes('cerveza')) return '🍺'
  if (n.includes('cóctel') || n.includes('coctel')) return '🍸'
  if (n.includes('shot')) return '🥃'
  if (n.includes('aguardiente')) return '🍶'
  if (n.includes('ginebra') || n.includes('vodka') || n.includes('tequila')) return '🍸'
  if (n.includes('whisky') || n.includes('ron') || n.includes('brandy')) return '🥃'
  if (n.includes('bebida')) return '🍹'
  return '🍽️'
}

export function initialsHue(name: string): number {
  const n = name.toLowerCase()
  if (
    n.includes('café') ||
    n.includes('cafe') ||
    n.includes('espresso') ||
    n.includes('aromática') ||
    n.includes('aromatica') ||
    n.includes('leche') ||
    n.includes('frappé') ||
    n.includes('frappe')
  ) {
    return 28 + (name.length % 12)
  }
  let h = 0
  for (let i = 0; i < name.length; i += 1) {
    h = (h + name.charCodeAt(i) * (i + 1)) % 360
  }
  return h
}

export function productThumbEmoji(name: string): string | null {
  const n = name.toLowerCase()
  if (n.includes('café') || n.includes('cafe') || n.includes('espresso')) return '☕'
  if (n.includes('cerveza')) return '🍺'
  if (n.includes('cóctel') || n.includes('coctel') || n.includes('mojito')) return '🍸'
  if (n.includes('jugo') || n.includes('limonada')) return '🧃'
  if (n.includes('hot dog') || n.includes('sándwich') || n.includes('sandwich')) return '🌭'
  return null
}

export type ProductGroup = {
  categoryId: string
  categoryName: string
  emoji: string
  products: ShopProduct[]
}

export function groupProductsByCategory(
  products: ShopProduct[],
  categories: { id: string; name: string }[],
): ProductGroup[] {
  const byId = new Map<string, ShopProduct[]>()
  for (const p of products) {
    const list = byId.get(p.categoryId) ?? []
    list.push(p)
    byId.set(p.categoryId, list)
  }
  const order = new Map(categories.map((c, i) => [c.id, i]))
  return [...byId.entries()]
    .map(([categoryId, items]) => {
      const categoryName =
        categories.find((c) => c.id === categoryId)?.name ?? items[0]?.category.name ?? 'Carta'
      return {
        categoryId,
        categoryName,
        emoji: categoryEmoji(categoryName),
        products: items,
      }
    })
    .sort(
      (a, b) =>
        (order.get(a.categoryId) ?? 999) - (order.get(b.categoryId) ?? 999),
    )
}
