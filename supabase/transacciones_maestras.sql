-- ═══════════════════════════════════════════════════════════════════════════
-- TRANSACCIONES MAESTRAS — ID único de extremo a extremo
--
-- Problema actual:
--   Una transacción del cliente atraviesa 3 tablas con IDs distintos:
--     ordenes.numero    → ORD-2026-0042
--     pedidos.numero    → PED-2026-0083  (al aprobar la orden)
--     facturas.numero   → FAC-2026-0017  (al facturar el pedido)
--   Si el cliente llama con un reclamo dando un número, Mache tiene que
--   buscar en los 3 módulos hasta encontrarlo. Los números sueltos siguen
--   siendo útiles internamente (orden de venta, factura fiscal), pero no
--   sirven como handle único para soporte / tracking.
--
-- Solución:
--   Cada transacción nace con un transaccion_id formato EMP-YYYY-NNNN que
--   se hereda transitivamente:
--     orden.transaccion_id       (generado al crear orden)
--     pedido.transaccion_id      = orden.transaccion_id  (al aprobar)
--     factura.transaccion_id     = pedido.transaccion_id (al facturar)
--   Si un pedido se crea sin orden previa (venta directa de Mache) o una
--   factura sin pedido (rare) se genera un EMP-XXXX nuevo allí mismo.
--
-- Esta migration:
--   1. Crea secuencia 'transacciones_maestras' con prefijo 'EMP'.
--   2. Agrega transaccion_id text a ordenes, pedidos, facturas.
--   3. Backfill chain: ordenes → pedidos (vía orden_id) → facturas
--      (vía pedido_id). Lo que quede huérfano se autogenera.
--   4. Indexes btree para búsqueda rápida por transaccion_id.
--
-- Idempotente. Compatible con DBs ya migradas o no.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Sequence row ──────────────────────────────────────────────────────
INSERT INTO secuencias (nombre, prefijo, valor) VALUES
  ('transacciones_maestras', 'EMP', 0)
ON CONFLICT (nombre) DO NOTHING;


-- ── 2. Add transaccion_id columns ────────────────────────────────────────
ALTER TABLE public.ordenes
  ADD COLUMN IF NOT EXISTS transaccion_id text;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS transaccion_id text;

ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS transaccion_id text;


-- ── 3. Backfill chain ─────────────────────────────────────────────────────
-- Tres pasos, cada uno reutiliza el resultado del anterior. La lógica para
-- "ya tiene transaccion_id?" usa COALESCE — si la migration ya corrió antes
-- y dejó valores, no los machaca.

-- 3a. Ordenes: cada orden sin transaccion_id se genera una nueva.
DO $$
DECLARE
  r RECORD;
  v_id text;
BEGIN
  FOR r IN SELECT id FROM public.ordenes WHERE transaccion_id IS NULL ORDER BY created_at LOOP
    v_id := get_next_sequence('transacciones_maestras');
    UPDATE public.ordenes SET transaccion_id = v_id WHERE id = r.id;
  END LOOP;
END $$;

-- 3b. Pedidos: heredan de su orden si existe; si no, generan propio.
UPDATE public.pedidos p
SET transaccion_id = o.transaccion_id
FROM public.ordenes o
WHERE p.orden_id = o.id
  AND p.transaccion_id IS NULL
  AND o.transaccion_id IS NOT NULL;

DO $$
DECLARE
  r RECORD;
  v_id text;
BEGIN
  FOR r IN SELECT id FROM public.pedidos WHERE transaccion_id IS NULL ORDER BY created_at LOOP
    v_id := get_next_sequence('transacciones_maestras');
    UPDATE public.pedidos SET transaccion_id = v_id WHERE id = r.id;
  END LOOP;
END $$;

-- 3c. Facturas: heredan de su pedido si existe; si no, generan propio.
UPDATE public.facturas f
SET transaccion_id = p.transaccion_id
FROM public.pedidos p
WHERE f.pedido_id = p.id
  AND f.transaccion_id IS NULL
  AND p.transaccion_id IS NOT NULL;

DO $$
DECLARE
  r RECORD;
  v_id text;
BEGIN
  FOR r IN SELECT id FROM public.facturas WHERE transaccion_id IS NULL ORDER BY created_at LOOP
    v_id := get_next_sequence('transacciones_maestras');
    UPDATE public.facturas SET transaccion_id = v_id WHERE id = r.id;
  END LOOP;
END $$;


-- ── 4. Indexes ────────────────────────────────────────────────────────────
-- Btree porque el lookup típico es exact match (cliente da el código,
-- backend busca). NO unique global porque las 3 tablas comparten valor
-- intencionalmente — el mismo EMP-X aparece una vez en ordenes, una vez
-- en pedidos, una vez en facturas.
CREATE INDEX IF NOT EXISTS idx_ordenes_transaccion_id  ON public.ordenes(transaccion_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_transaccion_id  ON public.pedidos(transaccion_id);
CREATE INDEX IF NOT EXISTS idx_facturas_transaccion_id ON public.facturas(transaccion_id);

-- ── 5. Unique-per-table ──────────────────────────────────────────────────
-- Dentro de cada tabla, transaccion_id es único: una orden no puede tener
-- el mismo handle que otra orden. Las 3 tablas pueden compartir el mismo
-- valor entre sí (eso es justamente lo que queremos).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ordenes_transaccion_id_unique'
      AND conrelid = 'public.ordenes'::regclass
  ) THEN
    ALTER TABLE public.ordenes
      ADD CONSTRAINT ordenes_transaccion_id_unique UNIQUE (transaccion_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pedidos_transaccion_id_unique'
      AND conrelid = 'public.pedidos'::regclass
  ) THEN
    ALTER TABLE public.pedidos
      ADD CONSTRAINT pedidos_transaccion_id_unique UNIQUE (transaccion_id);
  END IF;
  -- facturas NO tiene unique — un pedido puede tener factura+nota crédito
  -- compartiendo el mismo transaccion_id (la nota crédito hereda el handle
  -- de su factura origen). Si más adelante necesitamos otra condición,
  -- usamos un partial unique con WHERE.
END $$;


-- ── 6. Verify (manual) ────────────────────────────────────────────────────
-- Después de correr esta migration, todos los rows deben tener transaccion_id.
-- Rows sin handle indican backfill incompleto:
--
--   SELECT 'ordenes'  as tabla, count(*) FROM ordenes  WHERE transaccion_id IS NULL
--   UNION ALL
--   SELECT 'pedidos'  as tabla, count(*) FROM pedidos  WHERE transaccion_id IS NULL
--   UNION ALL
--   SELECT 'facturas' as tabla, count(*) FROM facturas WHERE transaccion_id IS NULL;
--
-- Verificar la cadena de herencia para una orden específica:
--   SELECT
--     o.numero AS orden,    o.transaccion_id AS o_emp,
--     p.numero AS pedido,   p.transaccion_id AS p_emp,
--     f.numero AS factura,  f.transaccion_id AS f_emp
--   FROM ordenes o
--   LEFT JOIN pedidos p ON p.orden_id = o.id
--   LEFT JOIN facturas f ON f.pedido_id = p.id
--   ORDER BY o.created_at DESC
--   LIMIT 10;
-- Las 3 columnas o_emp / p_emp / f_emp deben coincidir en cada fila.
