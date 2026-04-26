-- ============================================================
-- EMPORIUM — Fix reserve_stock / release_stock / confirm_stock_reservation
--
-- Problema detectado en producción (2026-04-26):
--   El cliente B2B genera orden → "No se pudo reservar inventario".
--   Causa: las funciones reserve_stock / release_stock estaban definidas
--   sin SECURITY DEFINER, por lo que ejecutaban con los permisos del
--   caller. La RLS de `presentaciones` (rls_policies.sql:99) solo permite
--   UPDATE a is_admin() — los UPDATE dentro del RPC fallaban (silenciosa
--   o ruidosamente) para roles cliente/comprador.
--
-- Esta migration:
--   1. Recrea los 3 RPCs con SECURITY DEFINER + search_path fijo
--      (las dos cosas son requeridas para que sea seguro saltarse RLS).
--   2. Agrega validación de stock disponible en reserve_stock — si el
--      cliente intenta reservar más de lo disponible, raises exception
--      con mensaje claro en vez de afectar 0 filas en silencio.
--   3. GRANT EXECUTE a authenticated explícitamente para evitar ambigüedad.
--   4. NOTIFY pgrst para forzar el refresh del schema cache de PostgREST.
--
-- Idempotente: CREATE OR REPLACE FUNCTION + GRANTs son seguros de re-correr.
-- ============================================================

-- ── 1. reserve_stock: con check de disponibilidad ─────────────────────
CREATE OR REPLACE FUNCTION public.reserve_stock(p_id UUID, p_amount INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock          INTEGER;
  v_reservado      INTEGER;
  v_disponible     INTEGER;
  v_nombre         TEXT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'reserve_stock: cantidad debe ser positiva (recibió %)', p_amount
      USING ERRCODE = '22023';  -- invalid_parameter_value
  END IF;

  -- Lock the row + read current values
  SELECT
    COALESCE(stock, 0),
    COALESCE(stock_reservado, 0),
    nombre
  INTO v_stock, v_reservado, v_nombre
  FROM public.presentaciones
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reserve_stock: presentación % no existe', p_id
      USING ERRCODE = 'P0002';  -- no_data_found
  END IF;

  v_disponible := v_stock - v_reservado;

  IF v_disponible < p_amount THEN
    RAISE EXCEPTION
      'reserve_stock: stock insuficiente para "%" — disponible %, solicitado %',
      v_nombre, v_disponible, p_amount
      USING ERRCODE = 'P0001';  -- raise_exception (genérico)
  END IF;

  UPDATE public.presentaciones
  SET stock_reservado = v_reservado + p_amount
  WHERE id = p_id;
END;
$$;

-- ── 2. release_stock: clamp a 0 ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.release_stock(p_id UUID, p_amount INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN;  -- no-op para release con cantidad 0/negativa
  END IF;

  UPDATE public.presentaciones
  SET stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - p_amount)
  WHERE id = p_id;
END;
$$;

-- ── 3. confirm_stock_reservation: descuenta del stock real ───────────
CREATE OR REPLACE FUNCTION public.confirm_stock_reservation(p_id UUID, p_amount INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN;
  END IF;

  UPDATE public.presentaciones
  SET
    stock           = GREATEST(0, COALESCE(stock, 0) - p_amount),
    stock_reservado = GREATEST(0, COALESCE(stock_reservado, 0) - p_amount)
  WHERE id = p_id;
END;
$$;

-- ── 4. Grants explícitos ─────────────────────────────────────────────
-- En Supabase, el rol 'authenticated' es el que tienen los usuarios
-- logueados. 'anon' nunca debería invocar estos RPCs.
REVOKE ALL ON FUNCTION public.reserve_stock(UUID, INTEGER)              FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_stock(UUID, INTEGER)              FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_stock_reservation(UUID, INTEGER)  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.reserve_stock(UUID, INTEGER)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_stock(UUID, INTEGER)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_stock_reservation(UUID, INTEGER) TO authenticated;

-- ── 5. Refresh PostgREST schema cache ────────────────────────────────
-- Sin esto, PostgREST puede seguir devolviendo "function not found" hasta
-- el próximo restart o el siguiente schema reload (típicamente cada 10min).
NOTIFY pgrst, 'reload schema';
