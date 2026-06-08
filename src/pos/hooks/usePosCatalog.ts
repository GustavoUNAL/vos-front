import { useCallback, useEffect, useState } from 'react'
import {
  fetchProductCategories,
  fetchProducts,
  type CategoryRef,
  type ProductRow,
} from '../../api'
import { isBackendDown } from '../../backendHealth'
import { getDemoCatalog } from '../services/demoCatalog'

function isApiUnreachableError(e: unknown): boolean {
  if (e instanceof TypeError) return true
  if (e instanceof Error) {
    return /failed to fetch|502|503|504|bad gateway/i.test(e.message)
  }
  return false
}

export function usePosCatalog(baseUrl: string) {
  const [products, setProducts] = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<CategoryRef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usingDemoCatalog, setUsingDemoCatalog] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setUsingDemoCatalog(false)
    if (isBackendDown()) {
      const demo = getDemoCatalog()
      setCategories(demo.categories)
      setProducts(demo.products)
      setUsingDemoCatalog(true)
      setError(null)
      setLoading(false)
      return
    }
    try {
      const cats = await fetchProductCategories(baseUrl)
      const all: ProductRow[] = []
      let page = 1
      while (page <= 50) {
        const res = await fetchProducts(baseUrl, {
          page,
          limit: 100,
          active: true,
        })
        all.push(...res.data)
        if (!res.meta.hasNextPage) break
        page++
      }
      setCategories(cats)
      setProducts(all)
      if (all.length === 0) {
        setError(
          'No hay productos activos en la carta. Activá productos en «Productos a la venta».',
        )
      }
    } catch (e) {
      if (isApiUnreachableError(e) || isBackendDown()) {
        const demo = getDemoCatalog()
        setCategories(demo.categories)
        setProducts(demo.products)
        setUsingDemoCatalog(true)
        setError(null)
        return
      }
      setProducts([])
      setCategories([])
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo cargar el catálogo. Revisá la conexión con el API.',
      )
    } finally {
      setLoading(false)
    }
  }, [baseUrl])

  useEffect(() => {
    void load()
  }, [load])

  return { products, categories, loading, error, usingDemoCatalog, reload: load }
}
