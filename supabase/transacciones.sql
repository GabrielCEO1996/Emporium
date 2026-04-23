-- ═══════════════════════════════════════════════════════════════════════════
-- TRANSACCIONES — financial ledger of income (ingreso) and expenses (gasto)
--
--   Ingresos:
--     • Factura pagada → monto = factura.monto_pagado ?? total
--   Gastos:
--     • Compra recibida → monto = compra.total
--
--   This table feeds /finanzas monthly totals and utilidad neta.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS transacciones (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo            TEXT        NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
  monto           NUMERIC(14, 2) NOT NULL CHECK (monto >= 0),
  fecha           DATE        NOT NULL DEFAULT CURRENT_DATE,
  concepto        TEXT,
  referencia_tipo TEXT        CHECK (referencia_tipo IN ('factura', 'compra', 'pago', 'ajuste_manual', NULL)),
  referencia_id   UUID,
  usuario_id      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transacciones_fecha ON transacciones (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_transacciones_tipo ON transacciones (tipo);
CREATE INDEX IF NOT EXISTS idx_transacciones_ref ON transacciones (referencia_tipo, referencia_id);

-- RLS: admin-only read/write
ALTER TABLE transacciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_transacciones" ON transacciones;
CREATE POLICY "admin_read_transacciones" ON transacciones
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.rol = 'admin'
    )
  );

DROP POLICY IF EXISTS "admin_write_transacciones" ON transacciones;
CREATE POLICY "admin_write_transacciones" ON transacciones
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
