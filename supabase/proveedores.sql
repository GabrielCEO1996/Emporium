-- Tabla de proveedores
CREATE TABLE IF NOT EXISTS proveedores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL,
  empresa text,
  telefono text,
  email text,
  whatsapp text,
  categoria text,
  tiempo_entrega_dias integer DEFAULT 1,
  condiciones_pago text DEFAULT 'contado',
  calificacion integer DEFAULT 5 CHECK (calificacion BETWEEN 1 AND 5),
  notas text,
  ultima_compra_fecha date,
  ultima_compra_monto decimal(10,2),
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Vincular productos a proveedor
ALTER TABLE productos ADD COLUMN IF NOT EXISTS proveedor_id uuid REFERENCES proveedores(id) ON DELETE SET NULL;

-- Índices
CREATE INDEX IF NOT EXISTS proveedores_activo_idx ON proveedores(activo);
CREATE INDEX IF NOT EXISTS productos_proveedor_idx ON productos(proveedor_id);

-- RLS (habilitar según tu configuración)
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage proveedores"
  ON proveedores FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Agregar rol pendiente al check si tienes uno
-- ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_rol_check;
-- ALTER TABLE profiles ADD CONSTRAINT profiles_rol_check
--   CHECK (rol IN ('admin', 'vendedor', 'conductor', 'pendiente'));
