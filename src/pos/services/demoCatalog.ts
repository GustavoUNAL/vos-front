import type { CategoryRef, ProductRow } from '../../api'

/** Carta mínima para modo local cuando el API no responde (502 / apagado). */
const DEMO_CATEGORIES: CategoryRef[] = [
  { id: 'demo-cat-cafe', name: 'Café', type: 'PRODUCT' },
  { id: 'demo-cat-pan', name: 'Panadería', type: 'PRODUCT' },
  { id: 'demo-cat-beb', name: 'Bebidas', type: 'PRODUCT' },
]

const DEMO_PRODUCTS: ProductRow[] = [
  {
    id: 'demo-p-espresso',
    name: 'Espresso',
    description: '',
    price: 4500,
    categoryId: 'demo-cat-cafe',
    type: 'PRODUCT',
    active: true,
    category: DEMO_CATEGORIES[0]!,
  },
  {
    id: 'demo-p-americano',
    name: 'Americano',
    description: '',
    price: 5500,
    categoryId: 'demo-cat-cafe',
    type: 'PRODUCT',
    active: true,
    category: DEMO_CATEGORIES[0]!,
  },
  {
    id: 'demo-p-cappuccino',
    name: 'Cappuccino',
    description: '',
    price: 7500,
    categoryId: 'demo-cat-cafe',
    type: 'PRODUCT',
    active: true,
    category: DEMO_CATEGORIES[0]!,
  },
  {
    id: 'demo-p-latte',
    name: 'Latte',
    description: '',
    price: 8000,
    categoryId: 'demo-cat-cafe',
    type: 'PRODUCT',
    active: true,
    category: DEMO_CATEGORIES[0]!,
  },
  {
    id: 'demo-p-croissant',
    name: 'Croissant',
    description: '',
    price: 6000,
    categoryId: 'demo-cat-pan',
    type: 'PRODUCT',
    active: true,
    category: DEMO_CATEGORIES[1]!,
  },
  {
    id: 'demo-p-cookie',
    name: 'Galleta',
    description: '',
    price: 3500,
    categoryId: 'demo-cat-pan',
    type: 'PRODUCT',
    active: true,
    category: DEMO_CATEGORIES[1]!,
  },
  {
    id: 'demo-p-agua',
    name: 'Agua',
    description: '',
    price: 3000,
    categoryId: 'demo-cat-beb',
    type: 'PRODUCT',
    active: true,
    category: DEMO_CATEGORIES[2]!,
  },
  {
    id: 'demo-p-jugo',
    name: 'Jugo natural',
    description: '',
    price: 7000,
    categoryId: 'demo-cat-beb',
    type: 'PRODUCT',
    active: true,
    category: DEMO_CATEGORIES[2]!,
  },
]

export function getDemoCatalog(): {
  products: ProductRow[]
  categories: CategoryRef[]
} {
  return {
    products: DEMO_PRODUCTS,
    categories: DEMO_CATEGORIES,
  }
}
