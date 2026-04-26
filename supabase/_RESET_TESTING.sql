-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║                                                                       ║
-- ║   ⚠⚠⚠   PELIGRO   ⚠⚠⚠                                                  ║
-- ║                                                                       ║
-- ║   Este script BORRA todos los datos transaccionales de Emporium:      ║
-- ║   facturas, pedidos, ordenes, pagos, notas de crédito, activity logs. ║
-- ║                                                                       ║
-- ║   NO TOCA: clientes, productos, presentaciones, inventario (lots),    ║
-- ║            empresa_config, profiles, conductores, proveedores.        ║
-- ║                                                                       ║
-- ║   Uso previsto:                                                       ║
-- ║     • Última pasada antes de la entrega final a producción.           ║
-- ║     • Reset entre rondas de testing del flow completo.                ║
-- ║                                                                       ║
-- ║   NUNCA correr en producción real con datos de clientes vivos.        ║
-- ║                                                                       ║
-- ║   Antes de correr:                                                    ║
-- ║     1. Confirmá que NEXT_PUBLIC_IS_PRODUCTION=false en Vercel.        ║
-- ║     2. Tomá snapshot de Supabase (Project → Database → Backups)       ║
-- ║        por si querés volver atrás.                                    ║
-- ║     3. Ejecutá este script bloque por bloque, no todo de una.         ║
-- ║        Si algo da error, parás antes de borrar más.                   ║
-- ║                                                                       ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

-- ─── 1. Truncar tablas transaccionales ───────────────────────────────────
-- Orden importa por las FKs:
--   factura_items → facturas
--   pedido_items  → pedidos
--   orden_items   → ordenes
--   pagos         → facturas (en algunos schemas) y pedidos
--   notas_credito → facturas
-- TRUNCATE ... CASCADE limpia todo en una sola pasada y resetea identity
-- columns donde aplica.

BEGIN;

-- Hijas primero (por las FK) — pero CASCADE en la padre las cubre, así
-- que solo necesitamos las padres principales:
TRUNCATE TABLE
  public.notas_credito,
  public.factura_items,
  public.facturas,
  public.pagos,
  public.pedido_items,
  public.pedidos,
  public.orden_items,
  public.ordenes,
  public.activity_logs,
  public.transacciones
RESTART IDENTITY CASCADE;

-- ─── 2. Reset secuencias ─────────────────────────────────────────────────
-- get_next_sequence() lee de esta tabla. Volvemos los consecutivos a 0
-- así la próxima orden/pedido/factura nace en NNNN=0001.
UPDATE public.secuencias
SET valor = 0
WHERE nombre IN (
  'ordenes',
  'pedidos',
  'facturas',
  'notas_credito',
  'transacciones_maestras'
);

-- ─── 3. Reset stock_reservado en presentaciones ──────────────────────────
-- Los reserves transitorios viven en presentaciones.stock_reservado. Si
-- borramos las ordenes/pedidos pero no liberamos el reservado, el stock
-- disponible visible en la tienda queda mal hasta el próximo movimiento.
UPDATE public.presentaciones
SET stock_reservado = 0
WHERE COALESCE(stock_reservado, 0) <> 0;

-- ─── 4. Reset stock_reservado en inventario (lots FEFO) ──────────────────
-- Mismo razonamiento, pero a nivel de lot. Si la tabla inventario tiene
-- la columna (sistema FEFO instalado), la limpiamos.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventario'
      AND column_name = 'stock_reservado'
  ) THEN
    UPDATE public.inventario
    SET stock_reservado = 0
    WHERE COALESCE(stock_reservado, 0) <> 0;
  END IF;
END $$;

COMMIT;


-- ─── 5. Verify (manual) ──────────────────────────────────────────────────
-- Después del reset, todos los counts deben dar 0 y las secuencias a 0:
--
--   SELECT 'ordenes',  count(*) FROM ordenes
--   UNION ALL SELECT 'pedidos',       count(*) FROM pedidos
--   UNION ALL SELECT 'facturas',      count(*) FROM facturas
--   UNION ALL SELECT 'pagos',         count(*) FROM pagos
--   UNION ALL SELECT 'notas_credito', count(*) FROM notas_credito
--   UNION ALL SELECT 'activity_logs', count(*) FROM activity_logs;
--
--   SELECT nombre, valor FROM secuencias
--   WHERE nombre IN ('ordenes','pedidos','facturas','notas_credito','transacciones_maestras');
--
--   SELECT count(*) FROM presentaciones WHERE COALESCE(stock_reservado,0) <> 0;
--
-- Si todo da 0 / valor=0, el reset fue exitoso y la tienda arranca en
-- estado virgen para el demo.
