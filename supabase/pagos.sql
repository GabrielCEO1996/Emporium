-- ============================================================
-- Payments table for Emporium
-- Run this script in the Supabase SQL editor
-- ============================================================

CREATE TABLE IF NOT EXISTS pagos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  factura_id uuid REFERENCES facturas(id) ON DELETE CASCADE NOT NULL,
  monto decimal(10,2) NOT NULL CHECK (monto > 0),
  metodo text NOT NULL CHECK (metodo IN ('efectivo', 'transferencia', 'credito', 'stripe')),
  referencia text,   -- bank transfer reference, Stripe payment intent, etc.
  notas text,
  usuario_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups by factura
CREATE INDEX IF NOT EXISTS pagos_factura_idx ON pagos(factura_id);

-- RLS
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pagos_select" ON pagos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pagos_insert" ON pagos
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── Compras: add 'confirmada' state between borrador and recibida ─────────────
-- If your compras table has a CHECK constraint on estado, update it:
-- ALTER TABLE compras DROP CONSTRAINT IF EXISTS compras_estado_check;
-- ALTER TABLE compras ADD CONSTRAINT compras_estado_check
--   CHECK (estado IN ('borrador', 'confirmada', 'recibida'));
