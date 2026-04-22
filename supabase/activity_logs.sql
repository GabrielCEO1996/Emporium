-- ============================================================
-- EMPORIUM — Activity Logs Table
-- Run BEFORE rls_policies.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  action      text        NOT NULL,            -- e.g. 'crear_factura', 'eliminar_producto'
  resource    text,                            -- table name: 'facturas', 'productos', …
  resource_id uuid,                            -- ID of the affected row
  details     jsonb,                           -- free-form context (before/after values, etc.)
  ip_address  text,                            -- caller IP (passed from the API route)
  created_at  timestamptz DEFAULT now()
);

-- Index for fast admin queries
CREATE INDEX IF NOT EXISTS activity_logs_user_id_idx    ON public.activity_logs (user_id);
CREATE INDEX IF NOT EXISTS activity_logs_action_idx     ON public.activity_logs (action);
CREATE INDEX IF NOT EXISTS activity_logs_resource_idx   ON public.activity_logs (resource, resource_id);
CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx ON public.activity_logs (created_at DESC);

-- Prevent accidental updates / deletes on log rows (append-only)
CREATE OR REPLACE RULE no_update_activity_logs AS
  ON UPDATE TO public.activity_logs DO INSTEAD NOTHING;

CREATE OR REPLACE RULE no_delete_activity_logs AS
  ON DELETE TO public.activity_logs DO INSTEAD NOTHING;

-- Auto-partition old rows (optional, run manually every ~6 months):
-- DELETE FROM activity_logs WHERE created_at < now() - INTERVAL '1 year';
