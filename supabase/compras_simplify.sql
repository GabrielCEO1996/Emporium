-- Simplifica el flujo de compras:
--   * Elimina el estado intermedio 'confirmada' (flujo: borrador → recibida)
--   * Añade estado 'cancelada' como alternativa de salida desde 'borrador'
--   * Denormaliza producto_id en compra_items (para joins directos y consultas más simples)
--
-- Idempotente: seguro de correr varias veces.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Añadir producto_id a compra_items (permite join directo con productos)
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE compra_items
  ADD COLUMN IF NOT EXISTS producto_id uuid REFERENCES productos(id) ON DELETE SET NULL;

-- Backfill desde la presentación asociada
UPDATE compra_items ci
SET producto_id = p.producto_id
FROM presentaciones p
WHERE ci.presentacion_id = p.id
  AND ci.producto_id IS NULL;

CREATE INDEX IF NOT EXISTS compra_items_producto_idx
  ON compra_items(producto_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Migrar compras en estado 'confirmada' → 'borrador'
--    (después de esto, 'confirmada' ya no es un valor válido)
-- ──────────────────────────────────────────────────────────────────────────
UPDATE compras SET estado = 'borrador' WHERE estado = 'confirmada';

-- ──────────────────────────────────────────────────────────────────────────
-- 3. CHECK constraint: estados válidos = borrador | recibida | cancelada
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE compras DROP CONSTRAINT IF EXISTS compras_estado_check;
ALTER TABLE compras
  ADD CONSTRAINT compras_estado_check
  CHECK (estado IN ('borrador', 'recibida', 'cancelada'));
