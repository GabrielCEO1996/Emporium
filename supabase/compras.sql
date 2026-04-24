-- Tabla de compras a proveedores
CREATE TABLE IF NOT EXISTS compras (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  proveedor_id uuid REFERENCES proveedores(id) ON DELETE SET NULL,
  fecha date DEFAULT CURRENT_DATE,
  total decimal(10,2) DEFAULT 0,
  estado text DEFAULT 'recibida',
  notas text,
  created_at timestamptz DEFAULT now()
);

-- Items de cada compra.
-- presentacion_id: necesario para actualizar stock en la presentación correcta
-- producto_id: denormalizado desde presentaciones para joins directos con productos
CREATE TABLE IF NOT EXISTS compra_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  compra_id uuid REFERENCES compras(id) ON DELETE CASCADE,
  presentacion_id uuid REFERENCES presentaciones(id) ON DELETE SET NULL,
  producto_id uuid REFERENCES productos(id) ON DELETE SET NULL,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  precio_costo decimal(10,2) NOT NULL CHECK (precio_costo >= 0),
  subtotal decimal(10,2) GENERATED ALWAYS AS (cantidad * precio_costo) STORED,
  numero_lote text,
  fecha_vencimiento date
);

-- Índices
CREATE INDEX IF NOT EXISTS compras_proveedor_idx ON compras(proveedor_id);
CREATE INDEX IF NOT EXISTS compras_fecha_idx ON compras(fecha);
CREATE INDEX IF NOT EXISTS compra_items_compra_idx ON compra_items(compra_id);

-- RLS
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE compra_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage compras"
  ON compras FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage compra_items"
  ON compra_items FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
