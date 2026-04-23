-- ─────────────────────────────────────────────────────────────────────────────
-- RESTRUCTURE: productos = catalog only, inventario = stock + pricing
--
-- Run this in Supabase SQL editor. Safe to re-run (all statements are idempotent).
--
-- What changes:
--   • productos.codigo (SKU) added, backfilled with PRD-0001, PRD-0002, …
--   • inventario.precio_venta, precio_costo added (money lives here now)
--   • Existing precio/costo/stock are migrated from presentaciones → inventario
--     so the UI can stop reading from presentaciones.
--
-- What does NOT change:
--   • presentaciones.precio / .costo / .stock stay for backward compat.
--     New code reads from inventario; old code keeps working.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. productos.codigo (SKU) ---------------------------------------------------

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS codigo text;

-- Backfill PRD-0001, PRD-0002, … for rows without a codigo.
WITH numbered AS (
  SELECT id,
         'PRD-' || LPAD(
           (ROW_NUMBER() OVER (ORDER BY created_at, id))::text,
           4, '0'
         ) AS new_codigo
  FROM public.productos
  WHERE codigo IS NULL
)
UPDATE public.productos p
SET codigo = n.new_codigo
FROM numbered n
WHERE p.id = n.id;

-- Unique constraint (PG has no `ADD CONSTRAINT IF NOT EXISTS`, so guard with a DO block).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE  conname = 'productos_codigo_unique'
      AND  conrelid = 'public.productos'::regclass
  ) THEN
    ALTER TABLE public.productos
      ADD CONSTRAINT productos_codigo_unique UNIQUE (codigo);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS productos_codigo_idx ON public.productos (codigo);

-- 2. inventario.precio_venta + precio_costo -----------------------------------

ALTER TABLE public.inventario
  ADD COLUMN IF NOT EXISTS precio_venta numeric(12,2) DEFAULT 0;

ALTER TABLE public.inventario
  ADD COLUMN IF NOT EXISTS precio_costo numeric(12,2) DEFAULT 0;

-- 3. Seed inventario rows from existing presentaciones ------------------------
-- Schema note: pricing currently lives on presentaciones, not productos.
-- For every active presentacion, ensure there's an inventario row with that
-- presentacion's precio/costo/stock copied over.

INSERT INTO public.inventario (
  producto_id, presentacion_id, stock_total, stock_reservado, precio_venta, precio_costo
)
SELECT
  p.producto_id,
  p.id                                  AS presentacion_id,
  COALESCE(p.stock, 0)                  AS stock_total,
  0                                     AS stock_reservado,
  COALESCE(p.precio, 0)                 AS precio_venta,
  COALESCE(p.costo, 0)                  AS precio_costo
FROM public.presentaciones p
ON CONFLICT (presentacion_id) DO UPDATE
  SET precio_venta = COALESCE(NULLIF(EXCLUDED.precio_venta, 0), public.inventario.precio_venta),
      precio_costo = COALESCE(NULLIF(EXCLUDED.precio_costo, 0), public.inventario.precio_costo);

-- 4. compras.fecha_compra -----------------------------------------------------
-- We need two separate dates:
--   • fecha_compra : day the purchase was physically made (user-entered, editable)
--   • created_at   : day the record was entered in the system (automatic)
-- The legacy `fecha` column is kept as an alias of fecha_compra for back-compat.

ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS fecha_compra date DEFAULT CURRENT_DATE;

-- Backfill from legacy `fecha` so existing records have the same value in both columns.
UPDATE public.compras
SET    fecha_compra = fecha
WHERE  fecha_compra IS NULL
  AND  fecha IS NOT NULL;

CREATE INDEX IF NOT EXISTS compras_fecha_compra_idx ON public.compras (fecha_compra DESC);

-- 5. Sanity check -------------------------------------------------------------
-- Uncomment to verify:
-- SELECT COUNT(*) productos_total, COUNT(codigo) con_codigo FROM public.productos;
-- SELECT COUNT(*) inventario_rows, COUNT(*) FILTER (WHERE precio_venta > 0) con_precio FROM public.inventario;
-- SELECT COUNT(*) compras_total, COUNT(fecha_compra) con_fecha FROM public.compras;
