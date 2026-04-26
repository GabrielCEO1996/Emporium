-- ═══════════════════════════════════════════════════════════════════════════
-- FACTURAS — Alineación de estados al modelo nuevo (Fase 3)
--
-- El modelo nuevo separa el origen de cada factura según el flow:
--
--   FLOW                         estado al nacer            transición a 'pagada'
--   ────────────────────────────────────────────────────────────────────────
--   Stripe (B2C)                 'pagada'                   N/A (nace pagada)
--   Zelle / cheque / efectivo    'pagada'                   N/A (Mache confirma
--   (cliente B2C o B2B)                                      en confirmar-pago)
--   B2B "Generar orden"          'pendiente_pago'           Mache marca pago
--                                                            recibido
--   Reservado: 'pendiente_verificacion' para futuros flows que separen
--   "uploaded comprobante" de "verificado deposito" en dos pasos. Hoy
--   no se usa en el flow natural — Mache verifica de una.
--
-- Esta migration:
--   1. Extiende el CHECK de facturas.estado para incluir los nuevos estados.
--   2. Agrega columnas tipo_pago + pago_confirmado_at + pago_confirmado_por
--      para que la factura conozca su origen y trace cuándo + quién marcó
--      el pago como recibido.
--   3. NO toca filas existentes — las facturas viejas se quedan en
--      'emitida' (estado válido por legacy). El admin puede migrarlas
--      manualmente si quiere.
--
-- Idempotente. Compatible con DBs ya migradas o no.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Extender CHECK de facturas.estado ──────────────────────────────────
ALTER TABLE public.facturas DROP CONSTRAINT IF EXISTS facturas_estado_check;
ALTER TABLE public.facturas
  ADD CONSTRAINT facturas_estado_check
  CHECK (estado IN (
    'emitida',                  -- legacy, mantener compat con datos históricos
    'pendiente_pago',           -- B2B credito sin pagar todavía
    'pendiente_verificacion',   -- reservado para futuro 2-paso de Zelle
    'pagada',                   -- Stripe ok / B2B pagó / Zelle verificada
    'anulada',                  -- factura cerrada sin contraprestación
    'con_nota_credito'          -- factura compensada por nota de crédito
  ));


-- ── 2. tipo_pago en facturas ──────────────────────────────────────────────
-- Hasta ahora vivía solo en `ordenes`. Replicamos a facturas para que la
-- factura sepa con qué método se cobró (o se va a cobrar) sin tener que
-- joinear de vuelta. Acepta los mismos valores que ordenes.tipo_pago + un
-- NULL para "todavía no decidido" (B2B "Generar orden" antes de cobrar).
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS tipo_pago text;

-- Solo agregar el CHECK si no existe ya — idempotente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'facturas_tipo_pago_check'
      AND conrelid = 'public.facturas'::regclass
  ) THEN
    ALTER TABLE public.facturas
      ADD CONSTRAINT facturas_tipo_pago_check
      CHECK (
        tipo_pago IS NULL OR tipo_pago IN
          ('zelle', 'stripe', 'credito', 'cheque', 'efectivo', 'transferencia')
      );
  END IF;
END $$;


-- ── 3. Audit del pago ─────────────────────────────────────────────────────
-- Cuándo y quién marcó la factura como pagada. Para Stripe ambos quedan
-- null (la "marca" la hace el webhook con la firma de Stripe — no hay
-- usuario humano). Para Zelle/cheque/efectivo lo escribe el endpoint
-- /api/ordenes/[id]/confirmar-pago.
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS pago_confirmado_at timestamptz;

ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS pago_confirmado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;


-- ── 4. Index de facturas pendientes ───────────────────────────────────────
-- El admin abre el panel de facturas y filtra por "qué me deben" — un
-- partial index sobre pendiente_pago + pendiente_verificacion mantiene
-- esa query rápida aunque crezca la tabla.
CREATE INDEX IF NOT EXISTS idx_facturas_pendientes
  ON public.facturas (created_at DESC)
  WHERE estado IN ('pendiente_pago', 'pendiente_verificacion');


-- ── 5. Verify (manual) ────────────────────────────────────────────────────
-- Confirmar que el constraint nuevo aceptó los 4 estados nuevos:
--
--   SELECT conname, pg_get_constraintdef(c.oid)
--   FROM pg_constraint c
--   JOIN pg_class t ON c.conrelid = t.oid
--   WHERE t.relname = 'facturas'
--     AND conname IN ('facturas_estado_check', 'facturas_tipo_pago_check');
--
-- Confirmar columnas agregadas:
--
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'facturas'
--     AND column_name IN ('tipo_pago', 'pago_confirmado_at', 'pago_confirmado_por');
