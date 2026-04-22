-- ============================================================
-- EMPORIUM — Row Level Security Policies
-- Run this in Supabase SQL Editor (Database → SQL Editor)
-- ============================================================
-- IMPORTANT: Running this enables RLS on all tables. The app
-- uses the service-role key server-side (via createClient()),
-- so server routes bypass RLS. Client-side anon key calls will
-- be restricted by these policies.
-- ============================================================

-- ── Helper: is the caller an admin? ──────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND rol = 'admin'
  );
$$;

-- ── Helper: is the caller staff (admin or vendedor)? ─────────
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND rol IN ('admin', 'vendedor', 'conductor')
  );
$$;

-- ============================================================
-- profiles
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (
    auth.uid() = id          -- each user sees their own
    OR public.is_admin()     -- admin sees everyone
  );

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL
  USING (public.is_admin());

-- ============================================================
-- clientes
-- ============================================================
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clientes_select" ON public.clientes;
CREATE POLICY "clientes_select" ON public.clientes FOR SELECT
  USING (
    user_id = auth.uid()   -- cliente sees only their own record
    OR public.is_staff()   -- staff sees all
  );

DROP POLICY IF EXISTS "clientes_staff_write" ON public.clientes;
CREATE POLICY "clientes_staff_write" ON public.clientes FOR ALL
  USING (public.is_staff());

-- ============================================================
-- productos
-- ============================================================
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "productos_select_authenticated" ON public.productos;
CREATE POLICY "productos_select_authenticated" ON public.productos FOR SELECT
  TO authenticated
  USING (true);   -- all authenticated users can read products

DROP POLICY IF EXISTS "productos_admin_write" ON public.productos;
CREATE POLICY "productos_admin_write" ON public.productos FOR ALL
  USING (public.is_admin());

-- ============================================================
-- presentaciones
-- ============================================================
ALTER TABLE public.presentaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presentaciones_select_authenticated" ON public.presentaciones;
CREATE POLICY "presentaciones_select_authenticated" ON public.presentaciones FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "presentaciones_admin_write" ON public.presentaciones;
CREATE POLICY "presentaciones_admin_write" ON public.presentaciones FOR ALL
  USING (public.is_admin());

-- ============================================================
-- pedidos
-- ============================================================
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pedidos_select" ON public.pedidos;
CREATE POLICY "pedidos_select" ON public.pedidos FOR SELECT
  USING (
    -- cliente: only their own orders
    cliente_id IN (SELECT id FROM clientes WHERE user_id = auth.uid())
    -- staff: all orders
    OR public.is_staff()
  );

DROP POLICY IF EXISTS "pedidos_cliente_insert" ON public.pedidos;
CREATE POLICY "pedidos_cliente_insert" ON public.pedidos FOR INSERT
  WITH CHECK (
    cliente_id IN (SELECT id FROM clientes WHERE user_id = auth.uid())
    OR public.is_staff()
  );

DROP POLICY IF EXISTS "pedidos_staff_update" ON public.pedidos;
CREATE POLICY "pedidos_staff_update" ON public.pedidos FOR UPDATE
  USING (public.is_staff());

DROP POLICY IF EXISTS "pedidos_admin_delete" ON public.pedidos;
CREATE POLICY "pedidos_admin_delete" ON public.pedidos FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- pedido_items
-- ============================================================
ALTER TABLE public.pedido_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pedido_items_select" ON public.pedido_items;
CREATE POLICY "pedido_items_select" ON public.pedido_items FOR SELECT
  USING (
    pedido_id IN (
      SELECT p.id FROM pedidos p
      LEFT JOIN clientes c ON c.id = p.cliente_id
      WHERE c.user_id = auth.uid() OR public.is_staff()
    )
  );

DROP POLICY IF EXISTS "pedido_items_write" ON public.pedido_items;
CREATE POLICY "pedido_items_write" ON public.pedido_items FOR ALL
  USING (public.is_staff() OR EXISTS (
    SELECT 1 FROM pedidos p
    JOIN clientes c ON c.id = p.cliente_id
    WHERE p.id = pedido_items.pedido_id AND c.user_id = auth.uid()
  ));

-- ============================================================
-- facturas
-- ============================================================
ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "facturas_select" ON public.facturas;
CREATE POLICY "facturas_select" ON public.facturas FOR SELECT
  USING (
    -- clients can see their own invoices
    cliente_id IN (SELECT id FROM clientes WHERE user_id = auth.uid())
    OR public.is_staff()
  );

DROP POLICY IF EXISTS "facturas_staff_write" ON public.facturas;
CREATE POLICY "facturas_staff_write" ON public.facturas FOR ALL
  USING (public.is_staff());

-- ============================================================
-- compras (purchase orders — admin only)
-- ============================================================
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compras_admin_all" ON public.compras;
CREATE POLICY "compras_admin_all" ON public.compras FOR ALL
  USING (public.is_admin());

-- ============================================================
-- compra_items
-- ============================================================
ALTER TABLE public.compra_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compra_items_admin_all" ON public.compra_items;
CREATE POLICY "compra_items_admin_all" ON public.compra_items FOR ALL
  USING (public.is_admin());

-- ============================================================
-- proveedores (admin only for writes, staff for reads)
-- ============================================================
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proveedores_staff_select" ON public.proveedores;
CREATE POLICY "proveedores_staff_select" ON public.proveedores FOR SELECT
  USING (public.is_staff());

DROP POLICY IF EXISTS "proveedores_admin_write" ON public.proveedores;
CREATE POLICY "proveedores_admin_write" ON public.proveedores FOR ALL
  USING (public.is_admin());

-- ============================================================
-- notas_credito
-- ============================================================
ALTER TABLE public.notas_credito ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notas_credito_staff" ON public.notas_credito;
CREATE POLICY "notas_credito_staff" ON public.notas_credito FOR ALL
  USING (public.is_staff());

-- ============================================================
-- activity_logs (append-only — users can only insert, admin reads all)
-- ============================================================
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_logs_insert_authenticated" ON public.activity_logs;
CREATE POLICY "activity_logs_insert_authenticated" ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "activity_logs_admin_select" ON public.activity_logs;
CREATE POLICY "activity_logs_admin_select" ON public.activity_logs FOR SELECT
  USING (public.is_admin());
