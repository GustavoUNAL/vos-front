-- Nombre visible del lote (UI / PATCH name) y comentario opcional por línea de comprobante (PUT purchase-lines.lineComment).
ALTER TABLE "purchase_lots" ADD COLUMN IF NOT EXISTS "name" TEXT;

ALTER TABLE "purchase_lot_lines" ADD COLUMN IF NOT EXISTS "line_comment" TEXT;
