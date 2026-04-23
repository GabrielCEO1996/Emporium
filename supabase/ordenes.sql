-- ─────────────────────────────────────────────────────────────────────────────
-- ORDENES — Client-submitted requests from /tienda awaiting admin approval.
-- Distinct from `pedidos`, which are created directly by vendedor/admin and
-- are implicitly authorized. An `orden` becomes a `pedido` once approved.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ordenes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  numero text UNIQUE,
  cliente_id uuid REFERENCES clientes(id),
  user_id uuid REFERENCES auth.users(id),
  estado text DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  notas text,
  direccion_entrega text,
  total decimal(10,2) DEFAULT 0,
  motivo_rechazo text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orden_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  orden_id uuid REFERENCES ordenes(id) ON DELETE CASCADE,
  presentacion_id uuid REFERENCES presentaciones(id),
  cantidad integer NOT NULL,
  precio_unitario decimal(10,2) NOT NULL,
  subtotal decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Link column on pedidos so we can trace a pedido back to its source orden
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS orden_id uuid REFERENCES ordenes(id);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_ordenes_estado     ON ordenes(estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_cliente    ON ordenes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_user       ON ordenes(user_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_created_at ON ordenes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orden_items_orden  ON orden_items(orden_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_orden_id   ON pedidos(orden_id);

-- Seed sequence used by get_next_sequence('ordenes')
INSERT INTO secuencias (nombre, prefijo, valor) VALUES
  ('ordenes', 'ORD', 0)
ON CONFLICT (nombre) DO NOTHING;

-- RLS disabled per spec (controlled at API layer)
ALTER TABLE ordenes     DISABLE ROW LEVEL SECURITY;
ALTER TABLE orden_items DISABLE ROW LEVEL SECURITY;
