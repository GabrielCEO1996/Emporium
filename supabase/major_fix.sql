-- ═══════════════════════════════════════════════════════════════════════════
-- MAJOR FIX — Schema additions required by the ERP improvements batch.
--
--   1. clientes.deuda_total          — running unpaid-invoice balance
--   2. inventario_movimientos.tipo   — accept 'devolucion'
--   3. transacciones.monto           — allow negatives (credit-note refunds)
--   4. transacciones.referencia_tipo — accept 'nota_credito' and 'venta_directa'
--   5. activity_logs.estado_anterior / estado_nuevo — structured state deltas
--
-- All statements are idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. clientes.deuda_total ───────────────────────────────────────────────
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS deuda_total NUMERIC(14, 2) NOT NULL DEFAULT 0;

-- Backfill from existing unpaid facturas (re-runnable — always recomputes)
UPDATE clientes c
SET deuda_total = COALESCE(sub.deuda, 0)
FROM (
  SELECT cliente_id,
         SUM(COALESCE(total, 0) - COALESCE(monto_pagado, 0)) AS deuda
    FROM facturas
   WHERE estado IN ('emitida', 'enviada')
   GROUP BY cliente_id
) sub
WHERE c.id = sub.cliente_id;


-- ── 2. inventario_movimientos.tipo — add 'devolucion' ─────────────────────
ALTER TABLE inventario_movimientos
  DROP CONSTRAINT IF EXISTS inventario_movimientos_tipo_check;

ALTER TABLE inventario_movimientos
  ADD CONSTRAINT inventario_movimientos_tipo_check
  CHECK (tipo IN ('entrada', 'salida', 'reserva', 'liberacion', 'ajuste', 'devolucion'));


-- ── 3. transacciones.monto — allow negatives for credit-note refunds ──────
ALTER TABLE transacciones
  DROP CONSTRAINT IF EXISTS transacciones_monto_check;
-- No replacement CHECK: negative 'ingreso' represents a refund.


-- ── 4. transacciones.referencia_tipo — add 'nota_credito', 'venta_directa' ─
ALTER TABLE transacciones
  DROP CONSTRAINT IF EXISTS transacciones_referencia_tipo_check;

ALTER TABLE transacciones
  ADD CONSTRAINT transacciones_referencia_tipo_check
  CHECK (referencia_tipo IS NULL OR referencia_tipo IN (
    'factura', 'compra', 'pago', 'ajuste_manual', 'nota_credito', 'venta_directa'
  ));


-- ── 5. activity_logs — structured estado deltas ───────────────────────────
ALTER TABLE activity_logs
  ADD COLUMN IF NOT EXISTS estado_anterior TEXT;
ALTER TABLE activity_logs
  ADD COLUMN IF NOT EXISTS estado_nuevo    TEXT;

CREATE INDEX IF NOT EXISTS activity_logs_estado_nuevo_idx
  ON activity_logs (estado_nuevo);
