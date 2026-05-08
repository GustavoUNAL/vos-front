import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchRecipeCostControls,
  type InventoryOption,
  parseProductRecipeFull,
  type ProductRecipeCostLine,
  type ProductRecipeFull,
  type ProductRecipeIngredientLine,
  type RecipeCostControlsResponse,
  updateRecipeAdminRate,
  upsertProductRecipe,
} from '../api'
import {
  recipeIngredientIsCapitalAsset,
  recipeIngredientStockOkForProduction,
} from '../inventorySemantics'

function newRowKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

type EditableLine = {
  key: string
  inventoryItemId: string
  quantity: string
  unit: string
  stockStatus?: string
  inventoryBehavior?: 'CONSUMABLE' | 'CAPITAL_ASSET'
  categoryName?: string | null
}

function linesFromRecipe(lines: ProductRecipeIngredientLine[]): EditableLine[] {
  return lines.map((l) => ({
    key: newRowKey(),
    inventoryItemId: l.inventoryItemId,
    quantity: l.quantity,
    unit: l.unit,
    stockStatus: l.stockStatus ?? undefined,
    inventoryBehavior: l.inventoryBehavior,
    categoryName: l.categoryName,
  }))
}

function formatCOP(n: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n)
}

function lineSubtotal(
  qtyStr: string,
  unitCost: string,
): { value: number; label: string } {
  const q = parseFloat(qtyStr.replace(',', '.'))
  const c = parseFloat(String(unitCost).replace(',', '.'))
  if (!Number.isFinite(q) || !Number.isFinite(c)) {
    return { value: 0, label: '—' }
  }
  const v = q * c
  return { value: v, label: formatCOP(v) }
}

type RecipeEditorProps = {
  baseUrl: string
  productId: string
  recipe: ProductRecipeFull | null
  inventory: InventoryOption[]
  onRecipeUpdated?: (recipe: ProductRecipeFull | null) => void
  /** Oculta el bloque de título (p. ej. cuando el panel ya tiene cabecera). */
  compact?: boolean
}

type EditableCostLine = {
  key: string
  kind: 'FIJO' | 'VARIABLE'
  name: string
  quantity: string
  unit: string
  lineTotalCOP: string
}

const DEFAULT_ADMIN_RATE = 0.3
const ADMIN_LABEL = 'Administración'

function isAdminLineName(name: string): boolean {
  return name.trim().toLowerCase().startsWith('administración')
}

function costsFromRecipe(costs: ProductRecipeCostLine[]): EditableCostLine[] {
  return costs
    .filter((c) => !isAdminLineName(c.name))
    .map((c) => ({
    key: newRowKey(),
    kind: c.kind,
    name: c.name,
    quantity: c.quantity ? String(c.quantity) : '',
    unit: c.unit ?? '',
    lineTotalCOP: String(c.lineTotalCOP ?? ''),
  }))
}

function n(v: string): number {
  const x = parseFloat(v.replace(',', '.'))
  return Number.isFinite(x) ? x : NaN
}

function inventoryOptionMenuLabel(o: InventoryOption): string {
  const lot = o.lotLabel?.trim()
  return lot
    ? `${o.name} · lote ${lot} · stock ${o.quantity} ${o.unit}`
    : `${o.name} · stock ${o.quantity} ${o.unit}`
}

export function RecipeEditor({
  baseUrl,
  productId,
  recipe,
  inventory,
  onRecipeUpdated,
  compact = false,
}: RecipeEditorProps) {
  const [yieldStr, setYieldStr] = useState('1')
  const [rows, setRows] = useState<EditableLine[]>([])
  const [costRows, setCostRows] = useState<EditableCostLine[]>([])
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [adminRateStr, setAdminRateStr] = useState(String(DEFAULT_ADMIN_RATE))
  const [costControls, setCostControls] = useState<RecipeCostControlsResponse | null>(
    null,
  )

  const reloadCostControls = useCallback(async () => {
    try {
      const ctrl = await fetchRecipeCostControls(baseUrl, productId)
      setCostControls(ctrl)
      setAdminRateStr(String(ctrl.adminRate))
    } catch {
      setCostControls(null)
    }
  }, [baseUrl, productId])

  useEffect(() => {
    void reloadCostControls()
  }, [reloadCostControls])

  useEffect(() => {
    if (!recipe) {
      setYieldStr('1')
      setRows([])
      setCostRows([])
      setFilters({})
      setAdminRateStr(String(DEFAULT_ADMIN_RATE))
      return
    }
    setYieldStr(recipe.recipeYield)
    setRows(linesFromRecipe(recipe.ingredients))
    setCostRows(costsFromRecipe(recipe.costs ?? []))
    setFilters({})
    if (recipe.adminRate != null && Number.isFinite(recipe.adminRate)) {
      setAdminRateStr(String(recipe.adminRate))
    }
  }, [recipe, productId])

  const byId = useMemo(() => {
    const m = new Map<string, InventoryOption>()
    for (const i of inventory) m.set(i.id, i)
    return m
  }, [inventory])

  const addRow = useCallback(() => {
    const first = inventory[0]
    setRows((prev) => [
      ...prev,
      {
        key: newRowKey(),
        inventoryItemId: first?.id ?? '',
        quantity: '1',
        unit: first?.unit ?? '',
      },
    ])
  }, [inventory])

  const removeRow = useCallback((key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key))
  }, [])

  const addCostRow = useCallback(() => {
    setCostRows((prev) => [
      ...prev,
      {
        key: newRowKey(),
        kind: 'FIJO',
        name: '',
        quantity: '',
        unit: 'porción',
        lineTotalCOP: '',
      },
    ])
  }, [])

  const removeCostRow = useCallback((key: string) => {
    setCostRows((prev) => prev.filter((r) => r.key !== key))
  }, [])

  const updateCostRow = useCallback(
    (key: string, patch: Partial<EditableCostLine>) => {
      setCostRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
    },
    [],
  )

  const updateRow = useCallback(
    (key: string, patch: Partial<EditableLine>) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.key !== key) return r
          const next = { ...r, ...patch }
          if (patch.inventoryItemId !== undefined) {
            const inv = byId.get(patch.inventoryItemId)
            if (inv) next.unit = inv.unit
          }
          return next
        }),
      )
    },
    [byId],
  )

  const filteredOptions = useCallback(
    (rowKey: string) => {
      const q = (filters[rowKey] ?? '').trim().toLowerCase()
      const list = !q
        ? inventory
        : inventory.filter((i) => i.name.toLowerCase().includes(q))
      return list.slice(0, 120)
    },
    [filters, inventory],
  )

  const save = useCallback(async () => {
    const y = n(yieldStr)
    if (!Number.isFinite(y) || y <= 0) {
      setError('El rendimiento debe ser un número mayor que cero.')
      return
    }

    if (rows.length === 0) {
      if (
        !window.confirm(
          '¿Borrar la receta? No quedarán líneas de insumos para este producto.',
        )
      ) {
        return
      }
    }

    const ingredients: {
      inventoryItemId: string
      quantity: number
      unit: string
    }[] = []

    for (const r of rows) {
      if (!r.inventoryItemId) {
        setError('Cada fila debe tener un insumo seleccionado.')
        return
      }
      const q = n(r.quantity)
      if (!Number.isFinite(q) || q <= 0) {
        setError('Las cantidades deben ser números válidos mayores que cero.')
        return
      }
      if (!r.unit.trim()) {
        setError('Indica la unidad en cada fila.')
        return
      }
      ingredients.push({
        inventoryItemId: r.inventoryItemId,
        quantity: q,
        unit: r.unit.trim(),
      })
    }

    const costsBase: {
      kind: 'FIJO' | 'VARIABLE'
      name: string
      quantity?: number
      unit: string
      lineTotalCOP: number
    }[] = []

    for (const c of costRows) {
      const name = c.name.trim()
      const unit = c.unit.trim()
      const total = n(c.lineTotalCOP)
      if (!name && !c.lineTotalCOP.trim() && !unit && !c.quantity.trim()) continue
      if (isAdminLineName(name)) {
        setError(
          `"${ADMIN_LABEL}" la calcula el servidor según la tasa. Quita esa línea del listado.`,
        )
        return
      }
      if (!name) {
        setError('Cada línea de costo debe tener un concepto (nombre).')
        return
      }
      if (!unit) {
        setError('Cada línea de costo debe tener una unidad (ej. porción).')
        return
      }
      if (!Number.isFinite(total) || total < 0) {
        setError('Los totales de costos deben ser números válidos (>= 0).')
        return
      }
      const qty = c.quantity.trim() ? n(c.quantity) : NaN
      costsBase.push({
        kind: c.kind,
        name,
        unit,
        lineTotalCOP: total,
        quantity: Number.isFinite(qty) ? qty : undefined,
      })
    }

    const adminRate = parseFloat(adminRateStr.replace(',', '.'))
    if (!Number.isFinite(adminRate) || adminRate < 0 || adminRate > 1) {
      setError('La tasa de administración debe ser un número entre 0 y 1 (ej. 0.30).')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const updated = await upsertProductRecipe(baseUrl, productId, {
        recipeYield: y,
        ingredients,
        costs: costsBase,
      })
      await updateRecipeAdminRate(baseUrl, productId, { adminRate })
      const next = parseProductRecipeFull(updated.recipe)
      onRecipeUpdated?.(next)
      await reloadCostControls()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }, [
    adminRateStr,
    baseUrl,
    costRows,
    onRecipeUpdated,
    productId,
    reloadCostControls,
    rows,
    yieldStr,
  ])

  const yieldNum = n(yieldStr)
  const totalRecipeCOP = useMemo(() => {
    let t = 0
    for (const r of rows) {
      const inv = byId.get(r.inventoryItemId)
      if (!inv) continue
      const { value } = lineSubtotal(r.quantity, inv.unitCostCOP)
      t += value
    }
    return t
  }, [byId, rows])

  const totalServiceCostsCOP = useMemo(() => {
    let t = 0
    for (const c of costRows) {
      const v = n(c.lineTotalCOP)
      if (Number.isFinite(v)) t += v
    }
    return t
  }, [costRows])

  const adminRateNum = useMemo(() => {
    const r = parseFloat(adminRateStr.replace(',', '.'))
    return Number.isFinite(r) ? r : DEFAULT_ADMIN_RATE
  }, [adminRateStr])

  const baseCOP = totalRecipeCOP + totalServiceCostsCOP

  const adminCOP = useMemo(() => {
    const v = Math.round(baseCOP * adminRateNum)
    return Number.isFinite(v) && v > 0 ? v : 0
  }, [baseCOP, adminRateNum])

  const totalCostsCOP = totalServiceCostsCOP + adminCOP
  const totalAllCOP = totalRecipeCOP + totalCostsCOP

  // (la UI usa el totalAllCOP / yieldNum directamente)

  return (
    <div className="recipe-editor">
      {!compact && (
        <div className="recipe-editor-intro">
          <h3>Receta</h3>
          <p className="muted small">
            Define cuánto rinde y qué insumos consume. Los costos salen del
            inventario.
          </p>
        </div>
      )}

      <div className="recipe-yield-row">
        <label className="field field-inline">
          <span>Rendimiento</span>
          <input
            inputMode="decimal"
            className="input-narrow"
            value={yieldStr}
            onChange={(e) => setYieldStr(e.target.value)}
            title="Unidades de producto que salen de esta receta"
          />
        </label>
        <div className="recipe-cost-summary">
          <span className="muted small">Insumos</span>
          <strong>{formatCOP(totalRecipeCOP)}</strong>
          <span className="muted small">· Gastos</span>
          <strong>{formatCOP(totalServiceCostsCOP)}</strong>
          <span className="muted small">· Administración</span>
          <strong>{formatCOP(adminCOP)}</strong>
          <span className="muted small">
            · Total {formatCOP(totalAllCOP)} · por unidad ~{' '}
            {formatCOP(
              Number.isFinite(yieldNum) && yieldNum > 0 ? totalAllCOP / yieldNum : 0,
            )}
          </span>
        </div>
      </div>

      <h3 className="muted small" style={{ margin: '0.75rem 0 0.35rem' }}>
        Costos por producto
      </h3>
      <div className="recipe-table-wrap">
        <table className="recipe-table">
          <thead>
            <tr>
              <th className="col-filter">Buscar</th>
              <th>Insumo</th>
              <th className="col-qty">Cantidad</th>
              <th className="col-unit">Unidad</th>
              <th className="col-cost">Subtotal</th>
              <th className="col-actions" aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="recipe-table-empty">
                  Sin líneas. Añade insumos con el botón de abajo.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const inv = byId.get(row.inventoryItemId)
              const sub = inv
                ? lineSubtotal(row.quantity, inv.unitCostCOP)
                : { value: 0, label: '—' }
              const opts = filteredOptions(row.key)
              const showSelected =
                inv && !opts.some((o) => o.id === row.inventoryItemId)
              const onHand = inv ? n(inv.quantity) : NaN
              const mergedForStock = {
                inventoryBehavior: row.inventoryBehavior ?? inv?.inventoryBehavior,
                categoryName: row.categoryName ?? inv?.categoryName,
                stockStatus: row.stockStatus,
              }
              const stockOk = recipeIngredientStockOkForProduction(
                mergedForStock,
                Number.isFinite(onHand) ? onHand : 0,
              )
              const showStockWarn =
                Boolean(inv) &&
                !recipeIngredientIsCapitalAsset(mergedForStock) &&
                !stockOk

              return (
                <tr key={row.key}>
                  <td className="col-filter">
                    <input
                      type="search"
                      className="recipe-filter-input"
                      placeholder="Filtrar…"
                      value={filters[row.key] ?? ''}
                      onChange={(e) =>
                        setFilters((f) => ({
                          ...f,
                          [row.key]: e.target.value,
                        }))
                      }
                    />
                  </td>
                  <td>
                    <select
                      className="recipe-select"
                      value={row.inventoryItemId}
                      onChange={(e) =>
                        updateRow(row.key, {
                          inventoryItemId: e.target.value,
                        })
                      }
                    >
                      {showSelected && inv && (
                        <option value={inv.id}>{inv.name}</option>
                      )}
                      {opts.map((o) => (
                        <option key={o.id} value={o.id}>
                          {inventoryOptionMenuLabel(o)}
                        </option>
                      ))}
                    </select>
                    {showStockWarn ? (
                      <span className="recipe-ingredient-stock-hint recipe-stock-warn">
                        Stock insuficiente en inventario para este insumo.
                      </span>
                    ) : null}
                  </td>
                  <td className="col-qty">
                    <input
                      inputMode="decimal"
                      className="input-cell"
                      value={row.quantity}
                      onChange={(e) =>
                        updateRow(row.key, { quantity: e.target.value })
                      }
                    />
                  </td>
                  <td className="col-unit">
                    <input
                      className="input-cell"
                      value={row.unit}
                      onChange={(e) =>
                        updateRow(row.key, { unit: e.target.value })
                      }
                    />
                  </td>
                  <td className="col-cost mono">{sub.label}</td>
                  <td className="col-actions">
                    <button
                      type="button"
                      className="btn-icon-remove"
                      title="Quitar fila"
                      onClick={() => removeRow(row.key)}
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

      <div className="recipe-editor-footer">
        <button
          type="button"
          className="btn-secondary"
          onClick={addRow}
          disabled={inventory.length === 0}
        >
          + Añadir insumo
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => void save()}
          disabled={saving || inventory.length === 0}
        >
          {saving ? 'Guardando receta…' : 'Guardar receta'}
        </button>
      </div>

      <div className="recipe-embed">
        <h3 className="muted small" style={{ margin: 0 }}>
          Gastos
        </h3>
        <p className="muted small" style={{ margin: '0.25rem 0 0' }}>
          Servicios e indirectos (líneas en <code>costos</code> de la receta).
        </p>
        <div className="recipe-table-wrap" style={{ marginTop: '0.5rem' }}>
          <table className="recipe-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Concepto</th>
                <th className="col-qty">Cant.</th>
                <th className="col-unit">Unidad</th>
                <th className="col-cost">Total (COP)</th>
                <th className="col-actions" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {costRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="recipe-table-empty">
                    Sin líneas. Añade agua/energía/servicios aquí.
                  </td>
                </tr>
              )}
              {costRows.map((c) => (
                <tr key={c.key}>
                  <td>
                    <select
                      className="recipe-select"
                      value={c.kind}
                      onChange={(e) =>
                        updateCostRow(c.key, { kind: e.target.value as 'FIJO' | 'VARIABLE' })
                      }
                    >
                      <option value="FIJO">FIJO</option>
                      <option value="VARIABLE">VARIABLE</option>
                    </select>
                  </td>
                  <td>
                    <input
                      className="input-cell"
                      value={c.name}
                      onChange={(e) => updateCostRow(c.key, { name: e.target.value })}
                      placeholder="Agua (Indirecto), Energía (Indirecto)…"
                      style={{ fontFamily: 'var(--sans)' }}
                    />
                  </td>
                  <td className="col-qty">
                    <input
                      inputMode="decimal"
                      className="input-cell"
                      value={c.quantity}
                      onChange={(e) => updateCostRow(c.key, { quantity: e.target.value })}
                      placeholder="—"
                    />
                  </td>
                  <td className="col-unit">
                    <input
                      className="input-cell"
                      value={c.unit}
                      onChange={(e) => updateCostRow(c.key, { unit: e.target.value })}
                    />
                  </td>
                  <td className="col-cost">
                    <input
                      inputMode="decimal"
                      className="input-cell"
                      value={c.lineTotalCOP}
                      onChange={(e) => updateCostRow(c.key, { lineTotalCOP: e.target.value })}
                      placeholder="0"
                      style={{ textAlign: 'right' }}
                    />
                  </td>
                  <td className="col-actions">
                    <button
                      type="button"
                      className="btn-icon-remove"
                      title="Quitar línea"
                      onClick={() => removeCostRow(c.key)}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="recipe-yield-row" style={{ marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <label className="field field-inline">
            <span>Tasa {ADMIN_LABEL.toLowerCase()}</span>
            <input
              inputMode="decimal"
              className="input-narrow"
              value={adminRateStr}
              onChange={(e) => setAdminRateStr(e.target.value)}
              title="Entre 0 y 1 (ej. 0.30 = 30%). Se guarda con «Guardar receta»."
              aria-label="Tasa de administración entre cero y uno"
            />
          </label>
          <span className="muted small">{ADMIN_LABEL}</span>
          <strong>{formatCOP(adminCOP)}</strong>
          <span className="muted small">
            · {Math.round(adminRateNum * 100)}% de (insumos + gastos)
          </span>
          {costControls && (
            <span className="muted small">
              · base API {formatCOP(costControls.baseCOP)}
            </span>
          )}
        </div>

        <div className="recipe-editor-footer" style={{ marginTop: '0.75rem' }}>
          <button type="button" className="btn-secondary" onClick={addCostRow}>
            + Añadir servicio
          </button>
        </div>
      </div>

      {inventory.length === 0 && (
        <p className="banner-warn">
          No hay insumos en inventario para elegir. Revisa la API o la tabla{' '}
          <code>inventory</code>.
        </p>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
