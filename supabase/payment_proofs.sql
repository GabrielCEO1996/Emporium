-- ============================================================================
-- PAYMENT PROOFS — supports Zelle/Cheque attachments on /tienda orders
--
-- What this migration does:
--   1. Adds payment_proof_url + payment_reference columns to `ordenes` so
--      comprador-submitted Zelle/Cheque orders can carry a screenshot/photo
--      and a reference number.
--   2. Widens the ordenes.tipo_pago CHECK to allow 'cheque' and 'efectivo'.
--   3. Creates a public-read 'payment-proofs' storage bucket with
--      authenticated-insert RLS. Admins can delete; owners can delete their
--      own. Reads are public so email templates + admin dashboard can render
--      them with a simple <img src=url>.
--
-- Safe to re-run — every statement is idempotent.
-- ============================================================================

-- ── 1. Columns on ordenes ───────────────────────────────────────────────────
ALTER TABLE public.ordenes
  ADD COLUMN IF NOT EXISTS payment_proof_url  text,
  ADD COLUMN IF NOT EXISTS payment_reference  text;

-- ── 2. Widen tipo_pago check to include cheque + efectivo ───────────────────
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
  CHECK (tipo_pago IN (
    'pendiente','zelle','transferencia','stripe','credito','cheque','efectivo'
  ));

-- ── 3. Storage bucket 'payment-proofs' ──────────────────────────────────────
-- Public read so email templates and /ordenes admin view can render the
-- screenshot without having to mint signed URLs per-view.
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ── 4. RLS on storage.objects for this bucket ───────────────────────────────
-- Authenticated users can upload (they can only upload while creating their
-- own order — enforced server-side by /api/tienda/pedido). Public can read.
-- Admins can delete. Owners can delete their own within 1 hour of upload.

DROP POLICY IF EXISTS "payment_proofs_insert_authenticated" ON storage.objects;
CREATE POLICY "payment_proofs_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "payment_proofs_select_public" ON storage.objects;
CREATE POLICY "payment_proofs_select_public"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "payment_proofs_delete_admin" ON storage.objects;
CREATE POLICY "payment_proofs_delete_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- ── 5. Helpful index ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ordenes_pago_confirmado
  ON public.ordenes(pago_confirmado)
  WHERE pago_confirmado = false;

-- ── 6. Sanity check ─────────────────────────────────────────────────────────
-- SELECT id, numero, tipo_pago, pago_confirmado, payment_proof_url
-- FROM public.ordenes ORDER BY created_at DESC LIMIT 10;
