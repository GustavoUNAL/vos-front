# Backend — compras (`purchase_lot_lines`) **referencia**

Paquete de referencia dentro del monorepo: **modelo Prisma**, **migraciones SQL**, **matemática compartida** y **tests**. La API Nest vive fuera (`arandano-api`); esta carpeta sirve para **mantener definidos** modelo y contrato contra el front.

Contrato único (auditoría BD ↔ REST ↔ SPA): [`docs/DATABASE-API-CONTRACT.md`](docs/DATABASE-API-CONTRACT.md).

## Contenido

| Ruta | Descripción |
|------|-------------|
| `docs/DATABASE-API-CONTRACT.md` | Matriz tabla/columna ↔ JSON, endpoints, `:id` CUID vs UUID, brechas |
| `prisma/schema.prisma` | `PurchaseLot`, `PurchaseLotLine`, inventario/categorías mínimos |
| `prisma/migrations/20260420120000_add_purchase_lot_lines/migration.sql` | Crea `purchase_lot_lines` y FKs condicionales si existen las tablas padre. |
| `prisma/migrations/20260508120000_trace_modified_at/migration.sql` | Añade `trace_modified_at` en `purchase_lots` e `inventory_items` (revisión manual vs `updated_at`). |
| `prisma/migrations/20260511120000_inventory_consumed_at/migration.sql` | Añade `consumed_at` en `inventory_items` (marca de consumo / agotado). |
| `prisma/migrations/20260511183000_lot_name_line_comment/migration.sql` | `purchase_lots.name`, `purchase_lot_lines.line_comment` (cabecera y notas por línea como en el PUT del front). |
| `src/common/purchase-lot-line-math.ts` | Suma de líneas, consumido, validación PATCH `totalValue` vs Σ líneas (tolerancia 1 COP). |
| `src/common/*.spec.ts` | Vitest. |
| `scripts/backfill-purchase-lot-lines.ts` | Stub: reemplazar por `deriveBackfillQuantityPurchased` + movimientos. |

## Contrato API (resumen para Nest)

- **GET `/products/:id/history`**: trazabilidad del **producto a la venta**: lotes de compra relacionados (p. ej. a través de receta → líneas con `inventoryItemId` → ítems de inventario con `lot` / líneas de comprobante), conteo, historial de **precio de venta** si existe auditoría, y eventos libres. Contrato consumido por el front en `src/api.ts` (`fetchProductHistory`, tipos `ProductHistoryResponse`). Si el endpoint no existe todavía, el servidor puede responder **404** y la UI lo trata como “no implementado”.
- **GET `/purchase-lots/:id`**: debe aceptar el **PK real del lote** (p. ej. **CUID**; no usar solo `ParseUUIDPipe` sobre `:id`). Cuadro esperado por el SPA: `purchaseLines[]`, `purchaseTotals`, `inventoryWithoutPurchaseLine`, `inventoryMetrics` ampliado (`purchasedValueCOP`, `purchaseLinesAuthoritative`, etc.).
- **PATCH `/purchase-lots/:id`**: si hay líneas y `totalValue` no cuadra con Σ `line_total_cop` → **400** (usá `assertPatchTotalValueCoherentWithLines`). Opcional: `traceModifiedAt` (ISO UTC o `null` explícito para limpiar).
- **PATCH `/purchase-lots/:id/purchase-lines/:lineId`**: actualizar una línea concreta del comprobante (p. ej. `{ "quantityPurchased": number }`). Recalcular `line_total_cop` con el costo unitario de esa línea, **`purchase_lots.total_value`** = suma de líneas (misma tolerancia que arriba) y reflejar la nueva cantidad en el GET detalle (`purchaseLines[]`, vínculo con inventario).
- **PATCH `/inventory/:id`**: opcional `traceModifiedAt` (ISO UTC o `null`); opcional **`consumedAt`** (ISO UTC o `null` para borrar la marca de consumo); `categoryId` para corregir categoría del ítem.
- **GET `/inventory` y GET/PATCH `/inventory/:id`**: incluir **`consumedAt`** cuando exista la columna, para que el front muestre y persista la fecha de consumo.
- **GET `/purchase-lots/:id`**: cada elemento de **`purchaseLines`** debe incluir un **`id`** estable (PK de `purchase_lot_lines`) y, si aplica, **`inventoryItemId`**; conviene también **`items[].purchaseLineId`** en el DTO del detalle para enlazar ítem ↔ línea sin heurísticas.
- **PUT `/purchase-lots/:id/purchase-lines`**: reemplazo atómico de líneas; opcional `expectedTotalValueCOP`; al final `totalValue = sum(lines)`.

## Prompt para backend (total de compra = suma de líneas)

Copiar y pegar en ticket o chat al equipo de API / Nest:

---

**Objetivo:** El total de una compra (lote) debe ser **siempre** la suma interna de cada línea del comprobante. El front **no** recalcula ese total; confía en lo que devuelve y persiste el servidor.

**Qué debe hacer el backend**

1. **Fuente de verdad:** Para cada lote con líneas de compra (`purchase_lot_lines` / `purchaseLines`), calcular  
   `linesPurchaseTotalCOP = sumLineTotalsCOP([...line_total_cop])`  
   usando la misma convención que en este repo: `backend/src/common/purchase-lot-line-math.ts` (`roundMoneyCOP`, `lineTotalFromPurchaseParts`, `sumLineTotalsCOP`). Cada línea: costo de compra en COP (enteros); tolerancia de coherencia **1 COP** entre total de lote y suma de líneas.

2. **Persistir:** Al crear/actualizar/reemplazar líneas, actualizar **`purchase_lots.totalValue`** (o el campo equivalente) para que sea **exactamente** esa suma, sin depender de un valor manual desalineado.

3. **Responder en API:** En GET listado y detalle de `/purchase-lots`, exponer el **mismo número** en:
   - `purchaseTotals.linesPurchaseTotalCOP` (si lo usan), y
   - `inventoryMetrics.purchasedValueCOP` cuando aplique a “valor histórico comprado del lote”,
   de modo que coincida con `totalValue` dentro de la tolerancia.

4. **Validación:** En PATCH del lote, si hay líneas, rechazar `totalValue` que no cuadre con la suma (ver `assertPatchTotalValueCoherentWithLines` en el mismo archivo math).

5. **Datos viejos:** Job o migración de **backfill** que recalcule `totalValue` desde las líneas para lotes donde hoy no coincida.

---

## Prompt para backend (historial de producto / lotes)

**Objetivo:** Exponer **GET `/products/:id/history`** (autenticado igual que el resto del API) para que, al editar un producto, el front muestre lotes de compra vinculados, métricas y, si existe, historial de precio de venta.

**Respuesta JSON sugerida** (campos alineados con `ProductHistoryResponse` en el front):

1. **`productId`**: string (mismo `:id` de la ruta).
2. **`productName`**: opcional.
3. **`lots`**: array de objetos con al menos **`code`** (código de lote / `purchase_lots.code`). Recomendado: **`id`** del lote (UUID/CUID) para que el front enlace a `#/purchases/{id}`; **`purchaseDate`**, **`supplier`**, **`lineTotalCOP`** (string decimal o número, valor atribuible a esa relación producto–lote si aplica), **`notes`** opcional.
4. **`lotsCount`**: opcional; si falta, el cliente usa `lots.length`. Puede ser útil si el backend pagina o resume.
5. **`salePriceHistory`**: opcional; lista de `{ effectiveAt: ISO 8601, price, kind?: string, note?: string }` si guardan auditoría de cambios de **`products.price`**.
6. **`events`**: opcional; lista de `{ at, label, detail? }` para hitos (creación producto, cambios de categoría/receta, etc.).
7. **`summary`**: opcional; texto corto para la UI.

**Lógica sugerida:** Partir de la **receta** del producto (`inventoryItemId` por línea), resolver ítems de inventario y sus vínculos con **`purchase_lot_lines` / `purchase_lots`** (mismo modelo que en `schema.prisma` de este repo). Desduplicar lotes por `code` o `id`. Si no hay receta o no hay compras enlazadas, devolver `lots: []`.

**Errores:** 404 si el producto no existe; **404** también está permitido si el endpoint aún no está implementado (el front lo muestra como aviso).

---

## Pasos en tu entorno

```bash
cd backend
npm install
cp .env.example .env   # y definí DATABASE_URL
npm run db:generate
npm run db:migrate:dev # o db:migrate en CI
npm run db:backfill-purchase-lot-lines   # si ya hay datos
npm test
```

## Nota sobre la migración

Si tus tablas padre no se llaman `purchase_lots` / `inventory_items` / `categories`, adaptá el bloque `DO $$` del SQL o generá la migración con `prisma migrate diff` contra tu base real.
