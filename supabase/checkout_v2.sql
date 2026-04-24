-- ═══════════════════════════════════════════════════════════════════════════
-- Checkout v2 — payment verification workflow
--
-- Adds a 3-state payment verification column to `ordenes` (independent from
-- order `estado` — an orden can be pendiente yet have verified payment, or
-- aprobada with still-pending payment verification when we approve manually
-- on trust).
--
-- Also adds admin-facing empresa_config fields for Zelle/cheque/email:
--   - email_admin                  (where notifications are routed)
--   - direccion_envio_cheques      (shown to comprador on cheque checkout)
--
-- All statements are idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. ordenes: payment verification columns
-- --------------------------------------------------------------------------
ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS estado_pago text
    NOT NULL DEFAULT 'pendiente_verificacion';

-- Drop the old constraint if present, then re-add with the 3-state check.
ALTER TABLE ordenes DROP CONSTRAINT IF EXISTS ordenes_estado_pago_check;
ALTER TABLE ordenes
  ADD CONSTRAINT ordenes_estado_pago_check
  CHECK (estado_pago IN ('verificado', 'pendiente_verificacion', 'rechazado'));

ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS verificado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS verificado_at timestamptz;

-- Backfill: anything currently marked pago_confirmado=true is considered verified.
UPDATE ordenes
SET estado_pago = 'verificado'
WHERE pago_confirmado IS TRUE
  AND estado_pago = 'pendiente_verificacion';

-- Rejected orders (estado='rechazada') carry rechazado as their payment state.
UPDATE ordenes
SET estado_pago = 'rechazado'
WHERE estado = 'rechazada'
  AND estado_pago = 'pendiente_verificacion';

CREATE INDEX IF NOT EXISTS idx_ordenes_estado_pago
  ON ordenes (estado_pago)
  WHERE estado_pago = 'pendiente_verificacion';


-- 2. empresa_config: admin-facing comms + cheque mailing fields
-- --------------------------------------------------------------------------
ALTER TABLE empresa_config
  ADD COLUMN IF NOT EXISTS email_admin text;

ALTER TABLE empresa_config
  ADD COLUMN IF NOT EXISTS direccion_envio_cheques text;


-- 3. Verify
-- --------------------------------------------------------------------------
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'ordenes'
--   AND column_name IN ('estado_pago', 'verificado_por', 'verificado_at');
--
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_name = 'empresa_config'
--   AND column_name IN ('email_admin', 'direccion_envio_cheques');
