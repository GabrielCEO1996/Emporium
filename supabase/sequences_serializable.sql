-- ═══════════════════════════════════════════════════════════════════════════
-- sequences_serializable.sql
--
-- Phase-4 audit fix #3: get_next_sequence() runs at READ COMMITTED by
-- default, which lets two concurrent transactions both UPDATE...RETURNING
-- the same `secuencias` row and observe the same value. With high enough
-- concurrency that's a genuine duplicate-numero risk.
--
-- Fix: take a transaction-scoped row-level lock on the `secuencias` row
-- before reading it. PostgreSQL's UPDATE already takes ROW EXCLUSIVE, but
-- we make it explicit + serialize across the function via SELECT … FOR
-- UPDATE first. That forces concurrent callers to wait their turn instead
-- of reading the same value.
--
-- Idempotent: CREATE OR REPLACE FUNCTION rewrites in place. No data is
-- touched. Run on prod after taking a Supabase point-in-time snapshot
-- as a safety belt.
--
-- BACKUP REFERENCE before running this migration:
--   1. Take a Supabase point-in-time snapshot via the dashboard
--      (Project → Database → Backups), OR
--   2. pg_dump --schema-only --table=secuencias to a local .sql file:
--        supabase db dump --schema-only --table=secuencias \
--          > backups/secuencias-pre-lock.sql
--   3. Note the current sequence values:
--        SELECT * FROM secuencias ORDER BY nombre;
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_next_sequence(seq_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_valor    INTEGER;
  v_prefijo  TEXT;
  v_anio     INTEGER;
BEGIN
  -- Acquire a row-level lock on this sequence so concurrent calls serialize.
  -- PERFORM forces the SELECT but discards the row; the lock persists for
  -- the rest of this transaction (i.e. through the UPDATE below).
  PERFORM 1 FROM secuencias WHERE nombre = seq_name FOR UPDATE;

  -- Now safely increment. RETURNING gives us the post-update values atomically.
  UPDATE secuencias
     SET valor = valor + 1
   WHERE nombre = seq_name
   RETURNING valor, prefijo, EXTRACT(YEAR FROM NOW())::INTEGER
     INTO v_valor, v_prefijo, v_anio;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sequence % not found', seq_name;
  END IF;

  RETURN v_prefijo || '-' || v_anio || '-' || LPAD(v_valor::TEXT, 4, '0');
END;
$$;

COMMENT ON FUNCTION get_next_sequence(TEXT) IS
  'Returns next sequenced numero (e.g. PED-2026-0042). Takes SELECT FOR UPDATE on the secuencias row first to prevent concurrent callers from reading the same value (Phase-4 race-condition fix).';

-- ═══════════════════════════════════════════════════════════════════════════
-- Verification
-- ═══════════════════════════════════════════════════════════════════════════
-- After running, confirm the function picks up the new definition:
--   \df+ get_next_sequence
--
-- Quick smoke test (single transaction):
--   SELECT get_next_sequence('pedidos');
--
-- Concurrent test (run from two psql sessions A and B simultaneously):
--   A: BEGIN; SELECT get_next_sequence('pedidos');  -- holds lock
--   B: BEGIN; SELECT get_next_sequence('pedidos');  -- waits on A
--   A: COMMIT;                                       -- B unblocks
--   B: COMMIT;
-- Both should return DIFFERENT numeros.
-- ═══════════════════════════════════════════════════════════════════════════
