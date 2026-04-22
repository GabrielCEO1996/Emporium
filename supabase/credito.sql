-- ============================================================
-- EMPORIUM — Sistema de Crédito para clientes digitales
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- ── 1. Agregar columnas de crédito a clientes
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS credito_autorizado BOOLEAN DEFAULT false;

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS credito_usado DECIMAL(10,2) DEFAULT 0;

-- Note: limite_credito and dias_credito already exist in the schema

-- ── 2. Agregar tipo_pago a pedidos
-- ──────────────────────────────────────────────────────────────────────────────
-- tipo_pago values: 'pendiente', 'credito', 'stripe', 'efectivo', 'transferencia'

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS tipo_pago TEXT DEFAULT 'pendiente';

-- ── 3. Agregar estado 'preparando' al workflow de pedidos
-- ──────────────────────────────────────────────────────────────────────────────
-- The 5-step progress bar uses:
-- borrador → confirmado → preparando → en_ruta → entregado → (pagado)
-- 'pagado' is a final state shown as green complete on the tienda tracker.
-- Add 'pagado' and 'preparando' as valid estados if your DB has a CHECK constraint.

-- If pedidos.estado has a CHECK constraint, update it:
-- ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;
-- ALTER TABLE pedidos ADD CONSTRAINT pedidos_estado_check
--   CHECK (estado IN ('borrador','confirmado','preparando','en_ruta','entregado','facturado','cancelado','pagado'));

-- ── 4. RPC: Autorizar crédito (admin call)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.autorizar_credito(
  p_cliente_id UUID,
  p_limite DECIMAL(10,2),
  p_autorizado BOOLEAN DEFAULT true
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE clientes
  SET
    credito_autorizado = p_autorizado,
    limite_credito = p_limite
  WHERE id = p_cliente_id;
END;
$$;


-- ── 5. RPC: Usar crédito al crear un pedido
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.usar_credito(
  p_cliente_id UUID,
  p_monto DECIMAL(10,2)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limite DECIMAL(10,2);
  v_usado  DECIMAL(10,2);
  v_autorizado BOOLEAN;
BEGIN
  SELECT credito_autorizado, limite_credito, credito_usado
  INTO v_autorizado, v_limite, v_usado
  FROM clientes WHERE id = p_cliente_id;

  IF NOT v_autorizado THEN RETURN false; END IF;
  IF (v_usado + p_monto) > v_limite THEN RETURN false; END IF;

  UPDATE clientes
  SET credito_usado = credito_usado + p_monto
  WHERE id = p_cliente_id;

  RETURN true;
END;
$$;


-- ── 6. RPC: Liberar crédito (cuando pedido a crédito se cancela)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.liberar_credito(
  p_cliente_id UUID,
  p_monto DECIMAL(10,2)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE clientes
  SET credito_usado = GREATEST(0, credito_usado - p_monto)
  WHERE id = p_cliente_id;
END;
$$;
