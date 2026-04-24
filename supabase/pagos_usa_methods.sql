-- ============================================================
-- Expand pagos.metodo to support USA-oriented payment methods
-- Adds: zelle, cheque
-- Keeps: transferencia (for historical compat — no longer exposed in UI)
-- Run this script in the Supabase SQL editor
-- ============================================================

ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_metodo_check;
ALTER TABLE pagos ADD CONSTRAINT pagos_metodo_check
  CHECK (metodo IN ('efectivo', 'transferencia', 'zelle', 'cheque', 'credito', 'stripe'));
