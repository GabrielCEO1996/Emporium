-- ─────────────────────────────────────────────────────────────────────────────
-- precios_inteligentes.sql
-- B2B smart pricing — global per-client discount + per-client/product price
-- memory so Mache can see "last sold to this client at $X" when quoting.
--
-- Idempotent: safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Global discount per client (applied automatically to every line).
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS descuento_porcentaje NUMERIC(5,2)
  DEFAULT 0
  CHECK (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100);

COMMENT ON COLUMN clientes.descuento_porcentaje IS
  'Descuento global del cliente (0-100%). Se aplica automaticamente al precio_venta de cada producto al crear pedidos/facturas.';

-- 2) Historial de precios por cliente/producto — price memory.
--    Fed from factura_items at factura creation time.
CREATE TABLE IF NOT EXISTS historial_precios_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  presentacion_id UUID REFERENCES presentaciones(id) ON DELETE SET NULL,
  precio_vendido NUMERIC(12,2) NOT NULL CHECK (precio_vendido >= 0),
  cantidad NUMERIC(10,2) NOT NULL CHECK (cantidad > 0),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  factura_id UUID REFERENCES facturas(id) ON DELETE SET NULL,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE historial_precios_cliente IS
  'Memoria de precios — una fila por linea vendida. Permite a Mache ver la ultima venta a cada cliente para cada producto y decidir si honrar el precio negociado previo.';

-- 3) Indexes optimized for the "last sold to this client/product" lookup.
CREATE INDEX IF NOT EXISTS idx_historial_cliente_producto
  ON historial_precios_cliente(cliente_id, producto_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_historial_cliente_presentacion
  ON historial_precios_cliente(cliente_id, presentacion_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_historial_factura
  ON historial_precios_cliente(factura_id);

-- 4) RLS — admin/vendedor only (writes from API; reads from admin views).
ALTER TABLE historial_precios_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_historial_precios" ON historial_precios_cliente;
CREATE POLICY "staff_read_historial_precios"
  ON historial_precios_cliente FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.rol IN ('admin', 'vendedor')
    )
  );

DROP POLICY IF EXISTS "staff_write_historial_precios" ON historial_precios_cliente;
CREATE POLICY "staff_write_historial_precios"
  ON historial_precios_cliente FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.rol IN ('admin', 'vendedor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.rol IN ('admin', 'vendedor')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification queries (run manually after migration)
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'clientes' AND column_name = 'descuento_porcentaje';
--
-- SELECT COUNT(*) FROM historial_precios_cliente;
-- ─────────────────────────────────────────────────────────────────────────────
