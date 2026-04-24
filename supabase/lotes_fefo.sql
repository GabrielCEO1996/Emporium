-- ============================================================
-- LOT TRACKING + FEFO + EXPIRATION DATES + STOCK MINIMUMS
-- Run this in the Supabase SQL editor. Safe to re-run.
-- ============================================================
--
-- What this adds:
--   • productos.tiene_vencimiento, stock_minimo, precio_venta_sugerido
--   • inventario.numero_lote, fecha_vencimiento       (one row per lot)
--   • compra_items.numero_lote, fecha_vencimiento     (captured at purchase)
--   • inventario_movimientos.numero_lote, fecha_vencimiento (audit trail)
--   • Replaces UNIQUE(presentacion_id) on inventario with a lot-aware unique
--   • Index on inventario.fecha_vencimiento for fast FEFO ordering
--   • lote_sequences helper for LOT-YYYY-NNNN generation
--
-- Compatibility:
--   • Existing inventario rows keep working with numero_lote = NULL
--     (those are the "no-lot / generic" rows for products without expiry)
-- ============================================================

-- 1. productos: expiration toggle + stock alert + suggested sale price -------

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS tiene_vencimiento boolean DEFAULT false NOT NULL;

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS stock_minimo integer DEFAULT 0 NOT NULL;

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS precio_venta_sugerido numeric(12,2) DEFAULT 0 NOT NULL;

-- 2. inventario: lot + expiration --------------------------------------------

ALTER TABLE public.inventario
  ADD COLUMN IF NOT EXISTS numero_lote text;

ALTER TABLE public.inventario
  ADD COLUMN IF NOT EXISTS fecha_vencimiento date;

-- Drop the old single-row-per-presentacion uniqueness so we can store
-- multiple lots per presentacion. Some installations created the constraint
-- with the auto-generated name "inventario_presentacion_id_key".
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE  conname = 'inventario_presentacion_id_key'
      AND  conrelid = 'public.inventario'::regclass
  ) THEN
    ALTER TABLE public.inventario DROP CONSTRAINT inventario_presentacion_id_key;
  END IF;
END $$;

-- NULL-safe uniqueness: treat missing lot as a sentinel string so NULL == NULL.
-- This way products without expiry still get exactly one row per presentacion,
-- while products with lots get one row per (producto, presentacion, lot).
CREATE UNIQUE INDEX IF NOT EXISTS inventario_lote_unique_idx
  ON public.inventario (
    producto_id,
    presentacion_id,
    COALESCE(numero_lote, '__NOLOT__')
  );

CREATE INDEX IF NOT EXISTS inventario_fecha_venc_idx
  ON public.inventario (fecha_vencimiento ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS inventario_producto_idx
  ON public.inventario (producto_id);

-- 3. compra_items: capture lot + expiration at purchase time ------------------

ALTER TABLE public.compra_items
  ADD COLUMN IF NOT EXISTS numero_lote text;

ALTER TABLE public.compra_items
  ADD COLUMN IF NOT EXISTS fecha_vencimiento date;

-- 4. inventario_movimientos: lot + expiration for full audit trail -----------

ALTER TABLE public.inventario_movimientos
  ADD COLUMN IF NOT EXISTS numero_lote text;

ALTER TABLE public.inventario_movimientos
  ADD COLUMN IF NOT EXISTS fecha_vencimiento date;

-- 5. LOT-YYYY-NNNN generator -------------------------------------------------
-- Tiny helper table + function. Atomic via UPDATE…RETURNING.

CREATE TABLE IF NOT EXISTS public.lote_sequences (
  anio integer PRIMARY KEY,
  ultimo integer NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.next_lote_numero(p_anio integer DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_anio integer := COALESCE(p_anio, EXTRACT(YEAR FROM CURRENT_DATE)::integer);
  v_next integer;
BEGIN
  INSERT INTO public.lote_sequences (anio, ultimo)
  VALUES (v_anio, 1)
  ON CONFLICT (anio) DO UPDATE
    SET ultimo = public.lote_sequences.ultimo + 1
  RETURNING ultimo INTO v_next;

  RETURN 'LOT-' || v_anio::text || '-' || LPAD(v_next::text, 4, '0');
END $$;

-- 6. Sanity checks (uncomment to verify) -------------------------------------
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='productos'
--     AND column_name IN ('tiene_vencimiento','stock_minimo','precio_venta_sugerido');
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='inventario'
--     AND column_name IN ('numero_lote','fecha_vencimiento');
-- SELECT public.next_lote_numero();
