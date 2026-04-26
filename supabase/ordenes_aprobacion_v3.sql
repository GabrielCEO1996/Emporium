-- ═══════════════════════════════════════════════════════════════════════════
-- ORDENES — Aprobación v3
--
-- Refactor del flujo de checkout que separa los conceptos:
--   ORDEN          = solicitud B2B sin método de pago decidido
--   PEDIDO         = orden aprobada por staff, lista para despachar
--   MÉTODO DE PAGO = se decide en facturación al despachar
--
-- Esta migration:
--   1. Permite que `ordenes.tipo_pago` sea NULL (orden B2B "Generar orden"
--      cuyo método se decide después en facturación).
--   2. Extiende `ordenes_estado_pago_check` para incluir 'no_aplica' (el
--      valor que llevarán las órdenes B2B sin método decidido).
--   3. Agrega `ordenes.aprobado_por` y `aprobado_at` para audit trail
--      separado del estado_pago (un admin aprueba una orden B2B aunque
--      el pago sea futuro — no es lo mismo que pagar).
--   4. Agrega un guard de check: si tipo_pago='stripe', estado_pago no
--      puede ser 'no_aplica' (Stripe siempre tiene un pago concreto).
--   5. Index parcial sobre estado='pendiente' para que el panel de
--      órdenes pendientes filtre rápido aunque crezca la tabla.
--
-- Idempotente. Compatible con DBs migradas y sin migrar previamente.
-- Aplicar después de: ordenes.sql, checkout_v2.sql, payment_proofs.sql.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. tipo_pago nullable ─────────────────────────────────────────────────
-- En el flujo viejo todas las órdenes nacían con un tipo_pago concreto. En
-- el nuevo, "Generar orden" crea la orden sin método decidido — el método
-- vive después en la factura cuando el admin/vendedor despache.
ALTER TABLE ordenes
  ALTER COLUMN tipo_pago DROP NOT NULL;


-- ── 2. estado_pago: agregar 'no_aplica' al CHECK ───────────────────────────
-- 'no_aplica' = la orden representa una solicitud sin pago directo asociado.
-- El pago se materializa más adelante en una factura, con el método que
-- elija el admin/cliente al momento del despacho.
ALTER TABLE ordenes DROP CONSTRAINT IF EXISTS ordenes_estado_pago_check;
ALTER TABLE ordenes
  ADD CONSTRAINT ordenes_estado_pago_check
  CHECK (estado_pago IN ('verificado', 'pendiente_verificacion', 'rechazado', 'no_aplica'));


-- ── 3. aprobado_por / aprobado_at ─────────────────────────────────────────
-- verificado_por/at trackea quién verificó el pago (Stripe webhook lo deja
-- vacío y pone estado_pago='verificado'). aprobado_por/at trackea quién
-- aprobó la orden de negocio — distinto de quién verificó el pago.
-- En la práctica para Stripe ambos son la misma acción (webhook), pero
-- para B2B "Generar orden" sólo aprobado_por/at se llena.
ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS aprobado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS aprobado_at timestamptz;

-- Backfill: para órdenes ya en estado 'aprobada', marcar aprobado_at con
-- updated_at (es la mejor aproximación). aprobado_por queda null (no
-- sabemos retroactivamente quién apretó el botón).
UPDATE ordenes
SET aprobado_at = updated_at
WHERE estado = 'aprobada' AND aprobado_at IS NULL;


-- ── 4. Guard: Stripe siempre tiene pago real ──────────────────────────────
-- Una orden con tipo_pago='stripe' nunca debería tener estado_pago=
-- 'no_aplica' — eso indicaría una corrupción de datos. El check no es
-- suficiente para bloquear el bypass (el código tiene que validar
-- igual), pero atrapa rotos a nivel DB que un fix de código no detecta.
ALTER TABLE ordenes DROP CONSTRAINT IF EXISTS ordenes_stripe_requires_payment;
ALTER TABLE ordenes
  ADD CONSTRAINT ordenes_stripe_requires_payment
  CHECK (
    NOT (tipo_pago = 'stripe' AND estado_pago = 'no_aplica')
  );


-- ── 5. Index parcial para listar pendientes ───────────────────────────────
-- El panel admin filtra por estado='pendiente' constantemente; con el
-- volumen creciendo (órdenes B2B + órdenes Stripe sin pagar todavía),
-- este index parcial mantiene la query barata.
CREATE INDEX IF NOT EXISTS idx_ordenes_pendientes
  ON ordenes (created_at DESC)
  WHERE estado = 'pendiente';


-- ── 6. Index para búsqueda por aprobado_por ───────────────────────────────
-- Permite "muéstrame todas las órdenes que aprobé yo" en el dashboard
-- futuro. Liviano (es un uuid).
CREATE INDEX IF NOT EXISTS idx_ordenes_aprobado_por
  ON ordenes (aprobado_por)
  WHERE aprobado_por IS NOT NULL;


-- ── 7. Verify (manual) ────────────────────────────────────────────────────
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'ordenes'
--   AND column_name IN ('tipo_pago', 'estado_pago', 'aprobado_por', 'aprobado_at');
--
-- SELECT conname, pg_get_constraintdef(c.oid)
-- FROM pg_constraint c
-- JOIN pg_class t ON c.conrelid = t.oid
-- WHERE t.relname = 'ordenes' AND conname LIKE 'ordenes_%';
