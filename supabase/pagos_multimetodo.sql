-- ─────────────────────────────────────────────────────────────────────────────
-- MULTI-METHOD PAYMENTS
--
-- Adds the payment-method columns needed by the tienda checkout flow:
--   • empresa_config → Zelle + bank info the admin shows to clients
--   • ordenes        → which method the client chose + reference number
--                      + whether admin confirmed a manual payment
--
-- Safe to re-run. All statements are idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. empresa_config — payment details the admin advertises ---------------------

ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS zelle_numero   text,
  ADD COLUMN IF NOT EXISTS zelle_titular  text,
  ADD COLUMN IF NOT EXISTS banco_nombre   text,
  ADD COLUMN IF NOT EXISTS banco_cuenta   text,
  ADD COLUMN IF NOT EXISTS banco_routing  text,
  ADD COLUMN IF NOT EXISTS banco_titular  text;

-- 2. ordenes — payment method + reference + confirmation flag ------------------

ALTER TABLE public.ordenes
  ADD COLUMN IF NOT EXISTS tipo_pago         text DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS numero_referencia text,
  ADD COLUMN IF NOT EXISTS pago_confirmado   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pago_confirmado_at timestamptz,
  ADD COLUMN IF NOT EXISTS pago_confirmado_por uuid;

-- Widen allowed tipo_pago values. Drop any existing check constraint first so
-- we can redefine it with the 4 supported methods + the initial 'pendiente' state.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE  conname  = 'ordenes_tipo_pago_check'
      AND  conrelid = 'public.ordenes'::regclass
  ) THEN
    ALTER TABLE public.ordenes DROP CONSTRAINT ordenes_tipo_pago_check;
  END IF;
END $$;

ALTER TABLE public.ordenes
  ADD CONSTRAINT ordenes_tipo_pago_check
  CHECK (tipo_pago IN ('pendiente','zelle','transferencia','stripe','credito'));

CREATE INDEX IF NOT EXISTS ordenes_tipo_pago_idx ON public.ordenes (tipo_pago);

-- 3. Sanity check -------------------------------------------------------------
-- SELECT tipo_pago, pago_confirmado, count(*) FROM public.ordenes GROUP BY 1,2;
