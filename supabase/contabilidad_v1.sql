-- ═══════════════════════════════════════════════════════════════════════════
-- CONTABILIDAD v1 — split COSTOS (COGS / inventory purchases) from GASTOS
-- (operational expenses)
--
--   Historically `transacciones.tipo` was just ('ingreso', 'gasto'), with
--   every compra recording a 'gasto'. That collapses COGS with opex on the
--   income statement, so we can never see gross margin.
--
--   This migration:
--     1. Adds 'costo' to transacciones.tipo
--     2. Allows 'gasto_operativo' in referencia_tipo
--     3. Adds transacciones.categoria_gasto for opex roll-ups
--     4. Backfills compra-sourced rows to tipo='costo'
--     5. Creates gastos_operativos table + RLS + updated_at trigger
--
--   Idempotent — safe to re-run. Uses DROP CONSTRAINT IF EXISTS so the
--   ALTERs survive partial deploys.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) transacciones.tipo now includes 'costo'
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE transacciones
  DROP CONSTRAINT IF EXISTS transacciones_tipo_check;

ALTER TABLE transacciones
  ADD CONSTRAINT transacciones_tipo_check
  CHECK (tipo IN ('ingreso', 'gasto', 'costo'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) transacciones.referencia_tipo now accepts 'gasto_operativo'
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE transacciones
  DROP CONSTRAINT IF EXISTS transacciones_referencia_tipo_check;

ALTER TABLE transacciones
  ADD CONSTRAINT transacciones_referencia_tipo_check
  CHECK (
    referencia_tipo IS NULL OR
    referencia_tipo IN ('factura', 'compra', 'pago', 'ajuste_manual', 'gasto_operativo')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) New column: categoria_gasto (only meaningful when tipo='gasto')
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE transacciones
  ADD COLUMN IF NOT EXISTS categoria_gasto TEXT;

ALTER TABLE transacciones
  DROP CONSTRAINT IF EXISTS transacciones_categoria_gasto_check;

ALTER TABLE transacciones
  ADD CONSTRAINT transacciones_categoria_gasto_check
  CHECK (
    categoria_gasto IS NULL OR
    categoria_gasto IN ('operacion', 'personal', 'marketing', 'servicios', 'otro')
  );

CREATE INDEX IF NOT EXISTS idx_transacciones_categoria_gasto
  ON transacciones (categoria_gasto)
  WHERE categoria_gasto IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Backfill — every compra-sourced row becomes a 'costo'
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE transacciones
   SET tipo = 'costo'
 WHERE referencia_tipo = 'compra'
   AND tipo = 'gasto';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) gastos_operativos — the canonical source of opex entries.
--    API flow: insert here, then insert a matching transaccion with
--    tipo='gasto', referencia_tipo='gasto_operativo', referencia_id=<row>.id
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gastos_operativos (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha           DATE           NOT NULL DEFAULT CURRENT_DATE,
  categoria       TEXT           NOT NULL
                                 CHECK (categoria IN ('operacion', 'personal', 'marketing', 'servicios', 'otro')),
  concepto        TEXT           NOT NULL,
  monto           NUMERIC(14,2)  NOT NULL CHECK (monto >= 0),
  metodo_pago     TEXT,
  notas           TEXT,
  comprobante_url TEXT,
  creado_por      UUID           REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gastos_operativos_fecha
  ON gastos_operativos (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_gastos_operativos_categoria
  ON gastos_operativos (categoria);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) updated_at auto-touch
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_gastos_operativos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gastos_operativos_updated_at ON gastos_operativos;
CREATE TRIGGER gastos_operativos_updated_at
  BEFORE UPDATE ON gastos_operativos
  FOR EACH ROW
  EXECUTE FUNCTION set_gastos_operativos_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) RLS — admin-only read/write (mirrors transacciones)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE gastos_operativos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_gastos_operativos" ON gastos_operativos;
CREATE POLICY "admin_read_gastos_operativos" ON gastos_operativos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.rol = 'admin'
    )
  );

DROP POLICY IF EXISTS "admin_write_gastos_operativos" ON gastos_operativos;
CREATE POLICY "admin_write_gastos_operativos" ON gastos_operativos
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.rol = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.rol = 'admin'
    )
  );
