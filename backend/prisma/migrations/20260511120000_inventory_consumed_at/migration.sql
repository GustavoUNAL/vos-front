-- Fecha en que se registró consumo / agotamiento del ítem (marca manual).
ALTER TABLE "inventory_items" ADD COLUMN "consumed_at" TIMESTAMP(3);
