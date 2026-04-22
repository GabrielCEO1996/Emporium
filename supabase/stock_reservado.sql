-- ============================================================
-- EMPORIUM — stock_reservado para la tienda digital
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- ── 1. Agregar stock_reservado a presentaciones
--       (el stock vive en presentaciones, no en productos)
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE presentaciones
  ADD COLUMN IF NOT EXISTS stock_reservado INTEGER DEFAULT 0;

-- Ensure it never goes negative
ALTER TABLE presentaciones
  ADD CONSTRAINT stock_reservado_non_negative
  CHECK (stock_reservado >= 0)
  NOT VALID;  -- NOT VALID skips checking existing rows


-- ── 2. RPC: reservar stock al crear un pedido desde la tienda
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reserve_stock(p_id UUID, p_amount INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE presentaciones
  SET stock_reservado = COALESCE(stock_reservado, 0) + p_amount
  WHERE id = p_id;
END;
$$;


-- ── 3. RPC: liberar reserva cuando se cancela un pedido
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.release_stock(p_id UUID, p_amount INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE presentaciones
  SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - p_amount)
  WHERE id = p_id;
END;
$$;


-- ── 4. RPC: confirmar reserva (cuando admin confirma pedido)
--       El stock_reservado baja porque ya se descontó del stock real
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.confirm_stock_reservation(p_id UUID, p_amount INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE presentaciones
  SET
    stock          = GREATEST(0, stock - p_amount),
    stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - p_amount)
  WHERE id = p_id;
END;
$$;


-- ── 5. Stock disponible visible en la tienda
--       stock_disponible = stock - stock_reservado
-- ──────────────────────────────────────────────────────────────────────────────
-- The tienda API reads `stock` and `stock_reservado` separately.
-- Display stock = GREATEST(0, stock - stock_reservado).
-- This is calculated in the application layer.

-- ── 6. Supabase Realtime para mis-pedidos
--       Enable realtime on pedidos table so the tracker updates live.
-- ──────────────────────────────────────────────────────────────────────────────

-- Run this in Supabase → Database → Replication → enable pedidos table
-- Or via SQL:
ALTER TABLE pedidos REPLICA IDENTITY FULL;
-- Then add pedidos to your Supabase publication:
-- ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
