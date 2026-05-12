-- Trazabilidad / revisión manual (separado de updated_at del sistema).
ALTER TABLE "purchase_lots" ADD COLUMN "trace_modified_at" TIMESTAMP(3);

ALTER TABLE "inventory_items" ADD COLUMN "trace_modified_at" TIMESTAMP(3);
