-- ============================================================
-- EMPORIUM - Schema completo de base de datos
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PERFILES DE USUARIO (ligado a auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin', 'vendedor', 'conductor')),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS productos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT,
  activo BOOLEAN DEFAULT true,
  imagen_url TEXT,
  tiene_vencimiento BOOLEAN DEFAULT false NOT NULL,
  stock_minimo INTEGER DEFAULT 0 NOT NULL,
  precio_venta_sugerido NUMERIC(12,2) DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PRESENTACIONES (tallas/tamaños de cada producto)
CREATE TABLE IF NOT EXISTS presentaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,           -- ej: "500ml", "1L", "Caja x12"
  precio NUMERIC(12,2) NOT NULL,
  costo NUMERIC(12,2) DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  stock_minimo INTEGER DEFAULT 5,
  unidad TEXT DEFAULT 'unidad',   -- unidad, caja, litro, kg
  codigo_barras TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CLIENTES
-- ============================================================
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  rif TEXT,
  email TEXT,
  telefono TEXT,
  direccion TEXT,
  ciudad TEXT,
  zona TEXT,
  limite_credito NUMERIC(12,2) DEFAULT 0,
  dias_credito INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONDUCTORES / RUTAS
-- ============================================================
CREATE TABLE IF NOT EXISTS conductores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  telefono TEXT,
  placa_vehiculo TEXT,
  zona TEXT,
  activo BOOLEAN DEFAULT true,
  profile_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PEDIDOS / VENTAS
-- ============================================================
CREATE TABLE IF NOT EXISTS pedidos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero TEXT NOT NULL UNIQUE,    -- ej: PED-2024-001
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  vendedor_id UUID REFERENCES profiles(id),
  conductor_id UUID REFERENCES conductores(id),
  estado TEXT NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador','confirmado','en_ruta','entregado','cancelado','facturado')),
  fecha_pedido TIMESTAMPTZ DEFAULT NOW(),
  fecha_entrega_estimada DATE,
  fecha_entrega_real TIMESTAMPTZ,
  subtotal NUMERIC(12,2) DEFAULT 0,
  descuento NUMERIC(12,2) DEFAULT 0,
  impuesto NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  notas TEXT,
  direccion_entrega TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LÍNEAS DE PEDIDO
CREATE TABLE IF NOT EXISTS pedido_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  presentacion_id UUID NOT NULL REFERENCES presentaciones(id),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(12,2) NOT NULL,
  descuento NUMERIC(12,2) DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FACTURAS
-- ============================================================
CREATE TABLE IF NOT EXISTS facturas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero TEXT NOT NULL UNIQUE,    -- ej: FAC-2024-001
  pedido_id UUID REFERENCES pedidos(id),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  vendedor_id UUID REFERENCES profiles(id),
  estado TEXT NOT NULL DEFAULT 'emitida'
    CHECK (estado IN ('emitida','pagada','anulada','con_nota_credito')),
  fecha_emision TIMESTAMPTZ DEFAULT NOW(),
  fecha_vencimiento DATE,
  subtotal NUMERIC(12,2) DEFAULT 0,
  descuento NUMERIC(12,2) DEFAULT 0,
  base_imponible NUMERIC(12,2) DEFAULT 0,
  tasa_impuesto NUMERIC(5,2) DEFAULT 16,
  impuesto NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  monto_pagado NUMERIC(12,2) DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LÍNEAS DE FACTURA
CREATE TABLE IF NOT EXISTS factura_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  factura_id UUID NOT NULL REFERENCES facturas(id) ON DELETE CASCADE,
  presentacion_id UUID NOT NULL REFERENCES presentaciones(id),
  descripcion TEXT NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(12,2) NOT NULL,
  descuento NUMERIC(12,2) DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTAS DE CRÉDITO
-- ============================================================
CREATE TABLE IF NOT EXISTS notas_credito (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero TEXT NOT NULL UNIQUE,    -- ej: NC-2024-001
  factura_id UUID NOT NULL REFERENCES facturas(id),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  motivo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'devolucion'
    CHECK (tipo IN ('devolucion','descuento','ajuste')),
  estado TEXT NOT NULL DEFAULT 'emitida'
    CHECK (estado IN ('emitida','aplicada','anulada')),
  subtotal NUMERIC(12,2) DEFAULT 0,
  impuesto NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LÍNEAS DE NOTA DE CRÉDITO
CREATE TABLE IF NOT EXISTS nota_credito_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nota_credito_id UUID NOT NULL REFERENCES notas_credito(id) ON DELETE CASCADE,
  presentacion_id UUID REFERENCES presentaciones(id),
  descripcion TEXT NOT NULL,
  cantidad INTEGER DEFAULT 0,
  precio_unitario NUMERIC(12,2) DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MOVIMIENTOS DE STOCK (trazabilidad)
-- ============================================================
CREATE TABLE IF NOT EXISTS movimientos_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  presentacion_id UUID NOT NULL REFERENCES presentaciones(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','salida','ajuste','devolucion')),
  cantidad INTEGER NOT NULL,
  stock_antes INTEGER NOT NULL,
  stock_despues INTEGER NOT NULL,
  referencia_tipo TEXT,   -- 'pedido','factura','nota_credito','ajuste'
  referencia_id UUID,
  notas TEXT,
  usuario_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECUENCIAS para numeración automática
-- ============================================================
CREATE TABLE IF NOT EXISTS secuencias (
  nombre TEXT PRIMARY KEY,
  valor INTEGER DEFAULT 0,
  prefijo TEXT DEFAULT '',
  anio INTEGER DEFAULT EXTRACT(YEAR FROM NOW())
);

INSERT INTO secuencias (nombre, prefijo, valor) VALUES
  ('pedidos', 'PED', 0),
  ('facturas', 'FAC', 0),
  ('notas_credito', 'NC', 0)
ON CONFLICT (nombre) DO NOTHING;

-- ============================================================
-- FUNCIÓN para obtener siguiente número de secuencia
-- ============================================================
CREATE OR REPLACE FUNCTION get_next_sequence(seq_name TEXT)
RETURNS TEXT AS $$
DECLARE
  v_valor INTEGER;
  v_prefijo TEXT;
  v_anio INTEGER;
BEGIN
  UPDATE secuencias
  SET valor = valor + 1
  WHERE nombre = seq_name
  RETURNING valor, prefijo, EXTRACT(YEAR FROM NOW())::INTEGER
  INTO v_valor, v_prefijo, v_anio;

  RETURN v_prefijo || '-' || v_anio || '-' || LPAD(v_valor::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCIÓN para descontar stock al confirmar pedido
-- ============================================================
CREATE OR REPLACE FUNCTION descontar_stock_pedido(p_pedido_id UUID)
RETURNS VOID AS $$
DECLARE
  item RECORD;
BEGIN
  FOR item IN
    SELECT pi.presentacion_id, pi.cantidad
    FROM pedido_items pi
    WHERE pi.pedido_id = p_pedido_id
  LOOP
    -- Registrar movimiento
    INSERT INTO movimientos_stock (
      presentacion_id, tipo, cantidad, stock_antes, stock_despues,
      referencia_tipo, referencia_id
    )
    SELECT
      item.presentacion_id, 'salida', item.cantidad,
      stock, stock - item.cantidad, 'pedido', p_pedido_id
    FROM presentaciones WHERE id = item.presentacion_id;

    -- Actualizar stock
    UPDATE presentaciones
    SET stock = stock - item.cantidad,
        updated_at = NOW()
    WHERE id = item.presentacion_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGER: actualizar updated_at automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_productos_updated_at BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_presentaciones_updated_at BEFORE UPDATE ON presentaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_clientes_updated_at BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_pedidos_updated_at BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_facturas_updated_at BEFORE UPDATE ON facturas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_notas_credito_updated_at BEFORE UPDATE ON notas_credito
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE presentaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE factura_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas_credito ENABLE ROW LEVEL SECURITY;
ALTER TABLE nota_credito_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE conductores ENABLE ROW LEVEL SECURITY;
ALTER TABLE secuencias ENABLE ROW LEVEL SECURITY;

-- Política: usuarios autenticados pueden ver y operar todo
CREATE POLICY "authenticated_all" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON productos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON presentaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON pedidos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON pedido_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON facturas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON factura_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON notas_credito FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON nota_credito_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON movimientos_stock FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON conductores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON secuencias FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- DATOS DE EJEMPLO
-- ============================================================

-- Categorías de ejemplo para productos
INSERT INTO productos (nombre, descripcion, categoria) VALUES
('Agua Mineral', 'Agua mineral natural purificada', 'Bebidas'),
('Refresco Cola', 'Bebida gaseosa sabor cola', 'Bebidas'),
('Jugo de Naranja', 'Jugo natural de naranja sin azúcar añadida', 'Jugos'),
('Aceite Vegetal', 'Aceite vegetal refinado para cocina', 'Alimentos')
ON CONFLICT DO NOTHING;
