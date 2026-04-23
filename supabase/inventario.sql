-- ============================================================
-- Inventory management tables for Emporium
-- Run this script in the Supabase SQL editor
-- ============================================================

-- Main inventory table (one row per presentacion)
CREATE TABLE IF NOT EXISTS inventario (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_id uuid REFERENCES productos(id) ON DELETE CASCADE NOT NULL,
  presentacion_id uuid REFERENCES presentaciones(id) ON DELETE CASCADE NOT NULL,
  stock_total integer DEFAULT 0 NOT NULL CHECK (stock_total >= 0),
  stock_reservado integer DEFAULT 0 NOT NULL CHECK (stock_reservado >= 0),
  stock_disponible integer GENERATED ALWAYS AS (stock_total - stock_reservado) STORED,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(presentacion_id)
);

-- Movement log (audit trail for all stock changes)
CREATE TABLE IF NOT EXISTS inventario_movimientos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_id uuid REFERENCES productos(id),
  presentacion_id uuid REFERENCES presentaciones(id),
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'salida', 'reserva', 'liberacion', 'ajuste')),
  cantidad integer NOT NULL,
  stock_anterior integer,
  stock_nuevo integer,
  referencia_tipo text, -- 'compra', 'pedido_confirmado', 'pedido_entregado', 'pedido_cancelado', 'ajuste_manual'
  referencia_id uuid,
  usuario_id uuid REFERENCES auth.users(id),
  notas text,
  created_at timestamptz DEFAULT now()
);

-- Seed inventario from current presentaciones.stock
INSERT INTO inventario (producto_id, presentacion_id, stock_total, stock_reservado)
SELECT producto_id, id, COALESCE(stock, 0), 0
FROM presentaciones
ON CONFLICT (presentacion_id) DO NOTHING;

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_movimientos ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read; writes go through API (authenticated)
CREATE POLICY "inventario_select" ON inventario
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "inventario_all" ON inventario
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "movimientos_select" ON inventario_movimientos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "movimientos_insert" ON inventario_movimientos
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── Helper function: update inventario.updated_at automatically ──
CREATE OR REPLACE FUNCTION update_inventario_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventario_updated_at
  BEFORE UPDATE ON inventario
  FOR EACH ROW EXECUTE FUNCTION update_inventario_timestamp();
