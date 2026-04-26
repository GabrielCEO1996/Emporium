-- ═══════════════════════════════════════════════════════════════════════════
-- PAGOS — comprobante_url + soporte tarjeta_fisica (Fase 5/6)
--
-- Cuando Mache marca una factura como pagada via el modal "Registrar pago"
-- de /facturas/[id], el endpoint inserta una fila en pagos con el método
-- usado. Esta migration:
--
--   1. Agrega pagos.comprobante_url para la foto del comprobante
--      (Zelle/cheque/transferencia opcional, tarjeta_fisica raramente).
--   2. Extiende el CHECK de pagos.metodo para incluir 'tarjeta_fisica'
--      (POS en mostrador — distinto del 'stripe' online).
--   3. Misma extensión en facturas.tipo_pago (Fase 3 había agregado el
--      CHECK con 7 valores; agregamos tarjeta_fisica al final).
--
-- Idempotente. Compatible con DBs ya migradas o no.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. comprobante_url en pagos ───────────────────────────────────────────
ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS comprobante_url text;


-- ── 2. metodo CHECK incluye tarjeta_fisica ────────────────────────────────
ALTER TABLE public.pagos DROP CONSTRAINT IF EXISTS pagos_metodo_check;
ALTER TABLE public.pagos
  ADD CONSTRAINT pagos_metodo_check
  CHECK (metodo IN (
    'efectivo',
    'transferencia',
    'zelle',
    'cheque',
    'credito',
    'stripe',
    'tarjeta_fisica'
  ));


-- ── 3. facturas.tipo_pago CHECK incluye tarjeta_fisica ────────────────────
ALTER TABLE public.facturas DROP CONSTRAINT IF EXISTS facturas_tipo_pago_check;
ALTER TABLE public.facturas
  ADD CONSTRAINT facturas_tipo_pago_check
  CHECK (
    tipo_pago IS NULL OR tipo_pago IN (
      'zelle',
      'stripe',
      'credito',
      'cheque',
      'efectivo',
      'transferencia',
      'tarjeta_fisica'
    )
  );


-- ── 4. Verify (manual) ────────────────────────────────────────────────────
-- SELECT conname, pg_get_constraintdef(c.oid)
-- FROM pg_constraint c
-- JOIN pg_class t ON c.conrelid = t.oid
-- WHERE t.relname IN ('pagos', 'facturas')
--   AND conname IN ('pagos_metodo_check', 'facturas_tipo_pago_check');
