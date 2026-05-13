# Auditoría: base de datos, Prisma de referencia y contrato REST (compras / inventario)

Este directorio **`backend/`** es un **paquete de referencia**: esquema Prisma, migraciones SQL y utilidades (`purchase-lot-line-math`). La API HTTP vive típicamente en **arandano-api** (NestJS). Esta guía define qué debe coincidir entre **PostgreSQL**, **DTOs Nest** y el **front** (`src/api.ts`, vistas de compras).

---

## 1. Identificadores (`:id` en rutas)

| Regla | Detalle |
|--------|---------|
| Tipo real | **`cuid()`** en `schema.prisma` → ids como `cmoz4rkvb000pnbjfs2kfqbr2`. |
| Error típico | Nest con **`ParseUUIDPipe`** en `GET /purchase-lots/:id` → **400** para CUID legítimos. |
| Solución API | Validar como **string opaco** o pipe que acepte CUID + UUID, o usar `ValidateIf` sobre formato. |

El front navega con `#/purchases/<id>` (id de fila lista = PK del lote).

---

## 2. Tablas y columnas (referencia ↔ JSON)

### `purchase_lots`

| Columna DB (convención) | Prisma `schema.prisma` | JSON típico (front) |
|-------------------------|-------------------------|---------------------|
| `id` | `PurchaseLot.id` | `id` |
| `code` | `code` | `code` |
| `name` | `name` (opcional, migración `20260511183000`) | `name`, `displayName` |
| `purchase_date` | `purchaseDate` | `purchaseDate` (ISO) |
| `supplier` | `supplier` | `supplier`, `supplierResolved` (derivado) |
| `notes` | `notes` | `notes` |
| `total_value_cop` | `totalValueCOP` | `totalValue`, `purchaseTotals.linesPurchaseTotalCOP`, `inventoryMetrics.purchasedValueCOP` (coherentes ±1 COP) |
| `trace_modified_at` | `traceModifiedAt` | `traceModifiedAt` |
| `created_at` / `updated_at` | `createdAt`, `updatedAt` | opcional |

**Contrato PATCH** `PATCH /purchase-lots/:id` — cuerpo alineado con `PatchPurchaseLotPayload` en `src/api.ts`:

- `name`, `purchaseDate`, `supplier`, `notes`, `comment` (misma semántica que notas si el DTO Nest unifica).
- `totalValue` (número): debe ser coherente con **suma de `purchase_lot_lines.line_total_cop`** cuando hay líneas (`assertPatchTotalValueCoherentWithLines` en `src/common/purchase-lot-line-math.ts`).
- `traceModifiedAt`: ISO UTC o `null` explícito.
- `consumptionStatus` / `isDepleted`: si el modelo de negocio los persiste en DB, exponer columnas correspondientes **o** delegar todo a métricas calculadas — documentado en código Nest.

---

### `purchase_lot_lines`

| Columna DB | Prisma | JSON / PUT body |
|------------|--------|------------------|
| `id` | `id` | `purchaseLines[].id`, `lines` en PUT no envían id (replace); ítems pueden llevar `purchaseLineId` |
| `purchase_lot_code` | `purchaseLotCode` | Derivado por join con lote (`code`) |
| `inventory_item_id` | `inventoryItemId` | `purchaseLines[].inventoryItemId`; si está set, cantidad puede **recalcularse** en servidor |
| `line_name` | `lineName` | `lines[].lineName` |
| `category_id` | `categoryId` | `lines[].categoryId` |
| `quantity_purchased` | `quantityPurchased` | número en JSON PUT; Decimal/string en GET |
| `unit` | `unit` | `lines[].unit` |
| `purchase_unit_cost_cop` | `purchaseUnitCostCOP` | número |
| `line_total_cop` | `lineTotalCOP` | número / string decimal |
| `sort_order` | `sortOrder` | `lines[].sortOrder` |
| `line_comment` | `lineComment` (migración `20260511183000`) | `lines[].lineComment` |

**PUT** `/purchase-lots/:id/purchase-lines` — reemplazo atómico; método **PUT**, no PATCH en la colección. Ver tipos `PutPurchaseLotLinesPayload` / `PutPurchaseLotLineItem` en `src/api.ts`.

**PATCH** opcional legacy por sub-recurso: `PATCH /purchase-lots/:id/purchase-lines/:lineId` (p. ej. solo `quantityPurchased`).

---

### `inventory_items` (minimal en repo de referencia)

El front espera **`supplier`**, **`minStock`**, **`traceModifiedAt`**, **`consumedAt`** en `InventoryRow` cuando el API los envía. Si tu tabla aún no los tiene, añadir migraciones en **arandano-api** (no están duplicadas en el esquema mínimo de este repo si no existen aquí).

Vínculo con compras:

- **`lot`** (texto) = `purchase_lots.code`.
- Una fila opcional **`purchase_lot_lines.inventory_item_id`** 1–1 cuando la línea está enlazada a inventario.

---

### `categories`

- `PurchaseLotLine.categoryId` debe apuntar a categoría válida (**type** que incluya inventario donde aplique).
- Ítems de inventario: `inventory_items.category_id` → mismas categorías.

---

## 3. Lista de endpoints (checklist Nest ↔ front)

| Método | Ruta | Uso front |
|--------|------|-----------|
| GET | `/purchase-lots` | Lista + `meta.purchaseLotLinesMigrationPending`, `purchaseLotLinesMigrationHint` |
| GET | `/purchase-lots/:id` | Detalle; **no forzar UUID** si el PK es CUID |
| PATCH | `/purchase-lots/:id` | Guardar cabecera / totales coherentes |
| PUT | `/purchase-lots/:id/purchase-lines` | Reemplazar comprobante |
| PATCH | `/purchase-lots/:id/purchase-lines/:lineId` | Opcional, línea suelta |
| GET/PATCH | `/inventory`, `/inventory/:id` | Lote por `lot=code`; `traceModifiedAt`, `consumedAt` |
| GET | `/purchase-lots/meta/suppliers` | Si existe meta; rutas estáticas **antes** de `:id` en Nest |

Sin prefijo global `/api` en la base que usa el SPA: `getApiBase()` en el front debe ser origen Nest sin duplicar `/api` accidentalmente.

---

## 4. Decimales y JSON

PostgreSQL **`DECIMAL`** vía serialización Nest/Prisma suele salir como **string** en JSON. El front ya usa **`Number(...)` / `parseFloat`** en formularios. El servidor debe aceptar **número** en cuerpos POST/PUT/PATCH.

---

## 5. Brechas cerradas en este repo (referencia)

- Columnas **`purchase_lots.name`** y **`purchase_lot_lines.line_comment`** (+ migración en este paquete).
- Documentación central de contrato (**este archivo**).

Pendientes **en tu API real** si aún fallan checks:

1. Quitar **`ParseUUIDPipe`** estricto en `:id` de lotes cuando el PK es **CUID**.
2. Persistir **`name`** si el PATCH del front envía `name`.
3. Implementar **`PUT .../purchase-lines`** con el shape de `PutPurchaseLotLineItem`.

---

## 6. Cómo aplicar migraciones (referencia local)

```bash
cd backend
cp .env.example .env   # DATABASE_URL válida
npm install
npm run db:migrate:dev   # o db:migrate en CI
npm test
```

Si tu esquema en producción difiere (`total_value` vs `total_value_cop`, nombres de tablas), ajustá **`@map`** en Prisma o el SQL con `ALTER` previo antes de correlacionar con este paquete.
