-- ═══════════════════════════════════════════════════════════════════════════
-- PEDIDOS — Estados simplificados + estado_despacho separado (Fase 4)
--
-- Refactor mayor del lifecycle del pedido para reflejar el modelo limpio
-- que el negocio realmente usa.
--
-- Antes (varios estados secuenciales en una sola columna):
--   borrador → confirmada → aprobada → despachada → entregada
--   con legacy: confirmado, preparando, despachado, en_ruta, entregado,
--               facturado, pagado, cancelado
--
-- Ahora (separación entre "vida del pedido" y "vida del despacho"):
--   pedido.estado            ∈ {'aprobada', 'cancelada'}
--   pedido.estado_despacho   ∈ {'por_despachar', 'despachado', 'entregado'}
--
-- Lógica:
--   • Pedido nace siempre 'aprobada' + 'por_despachar'.
--   • Despacho: 'por_despachar' → 'despachado' (Mache imprime guía)
--                              → 'entregado'  (cliente recibió)
--   • Cancelar pone estado='cancelada' y deja estado_despacho como estaba
--     (audit trail — sabes en qué etapa se canceló).
--
-- Esta migration:
--   1. Agrega pedidos.estado_despacho con CHECK + default 'por_despachar'.
--   2. Backfill estado_despacho mapeando estados viejos al equivalente.
--   3. Normaliza pedido.estado: todo lo activo → 'aprobada', cancelados
--      → 'cancelada'. Datos viejos (borrador/preparando/facturado/etc.)
--      conservan info en activity_logs y en estado_despacho.
--   4. Aprieta el CHECK de estado a sólo 2 valores.
--
-- Idempotente. Compatible con DBs ya migradas o no.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Columna estado_despacho ────────────────────────────────────────────
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS estado_despacho text DEFAULT 'por_despachar';

-- CHECK (idempotente vía guard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE  conname  = 'pedidos_estado_despacho_check'
      AND  conrelid = 'public.pedidos'::regclass
  ) THEN
    ALTER TABLE public.pedidos
      ADD CONSTRAINT pedidos_estado_despacho_check
      CHECK (estado_despacho IN ('por_despachar', 'despachado', 'entregado'));
  END IF;
END $$;


-- ── 2. Backfill estado_despacho desde el estado viejo ─────────────────────
-- Heurística:
--   estado IN ('entregada','entregado','pagado')           → 'entregado'
--   estado IN ('despachada','despachado','en_ruta')        → 'despachado'
--   resto                                                  → 'por_despachar'
-- Sólo tocamos rows donde estado_despacho ya quedó en su default —
-- así no machacamos backfills previos si la migration se corre 2 veces.
UPDATE public.pedidos
SET estado_despacho = CASE
  WHEN estado IN ('entregada', 'entregado', 'pagado')        THEN 'entregado'
  WHEN estado IN ('despachada', 'despachado', 'en_ruta')     THEN 'despachado'
  ELSE 'por_despachar'
END
WHERE estado_despacho = 'por_despachar';


-- ── 3. Normalizar pedido.estado al modelo nuevo ──────────────────────────
-- Todo pedido vivo (no cancelado) pasa a 'aprobada'. Los detalles de su
-- etapa actual viven ahora en estado_despacho. Pedidos cancelados se
-- normalizan al femenino ('cancelada') si están en legacy 'cancelado'.
UPDATE public.pedidos
SET estado = 'cancelada'
WHERE estado = 'cancelado';

UPDATE public.pedidos
SET estado = 'aprobada'
WHERE estado NOT IN ('aprobada', 'cancelada');


-- ── 4. Apretar el CHECK de pedido.estado ─────────────────────────────────
ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;
ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_estado_check
  CHECK (estado IN ('aprobada', 'cancelada'));


-- ── 5. Index para el panel de despachos ───────────────────────────────────
-- Mache abre el panel y filtra "qué tengo que despachar hoy" — partial
-- index sobre los 2 estados activos.
CREATE INDEX IF NOT EXISTS idx_pedidos_estado_despacho
  ON public.pedidos (estado_despacho, created_at DESC)
  WHERE estado = 'aprobada';


-- ── 6. Verify (manual) ────────────────────────────────────────────────────
-- Después de la migration:
--
-- (A) Distribución de estados — debería haber sólo 'aprobada' y 'cancelada'
--   SELECT estado, count(*) FROM pedidos GROUP BY estado ORDER BY estado;
--
-- (B) Distribución de estado_despacho
--   SELECT estado_despacho, count(*)
--   FROM pedidos
--   WHERE estado = 'aprobada'
--   GROUP BY estado_despacho ORDER BY estado_despacho;
--
-- (C) Constraint check
--   SELECT conname, pg_get_constraintdef(c.oid)
--   FROM pg_constraint c
--   JOIN pg_class t ON c.conrelid = t.oid
--   WHERE t.relname = 'pedidos'
--     AND conname IN ('pedidos_estado_check', 'pedidos_estado_despacho_check');
