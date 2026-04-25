-- ═══════════════════════════════════════════════════════════════════════════
-- indexes_v2.sql
--
-- Three compound indexes recommended by the production-readiness audit
-- (Phase 5). Each addresses a frequent filter pattern that currently does
-- a sequential scan or partial-index scan.
--
-- Idempotent: safe to re-run (CREATE INDEX IF NOT EXISTS).
-- Run with: supabase db execute --file supabase/indexes_v2.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Facturas filtered by cliente + sorted by fecha_emision DESC
--    Used by:
--      • /clientes/[id] tab "Estado de cuenta" (list facturas of a cliente,
--        most-recent-first, page-of-N)
--      • /facturas list when admin filters by cliente
--      • /api/clientes/[id]/contexto recent-pedidos panel
CREATE INDEX IF NOT EXISTS idx_facturas_cliente_fecha
  ON facturas(cliente_id, fecha_emision DESC);

COMMENT ON INDEX idx_facturas_cliente_fecha IS
  'Composite index: cliente_id + fecha_emision DESC. Backs the "facturas of a cliente, most recent first" query (cliente detail page).';

-- 2) Inventario filtered by presentacion + sorted by fecha_vencimiento ASC
--    Used by:
--      • FEFO consumption (lib/fefo.ts) — picks oldest non-expired lot first
--      • /inventario page rendering "vence pronto" KPIs
--      • Pedido delivery flow (entregar) lot allocation
CREATE INDEX IF NOT EXISTS idx_inventario_pres_expiry
  ON inventario(presentacion_id, fecha_vencimiento NULLS LAST);

COMMENT ON INDEX idx_inventario_pres_expiry IS
  'Composite index for FEFO lot selection: presentacion_id + fecha_vencimiento ASC NULLS LAST.';

-- 3) Clientes lookup by user_id (auth UUID)
--    Used by:
--      • /tienda/* every request (resolve cliente from auth user)
--      • /api/clientes/[id] fallback path (id OR user_id)
--      • /api/tienda/perfil (cliente data for the logged-in app user)
CREATE INDEX IF NOT EXISTS idx_clientes_user
  ON clientes(user_id)
  WHERE user_id IS NOT NULL;

COMMENT ON INDEX idx_clientes_user IS
  'Partial index on clientes.user_id (only rows with a linked auth user). Backs every tienda lookup.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Verification
-- ═══════════════════════════════════════════════════════════════════════════
-- After running, confirm with:
--   SELECT indexname FROM pg_indexes
--    WHERE tablename IN ('facturas','inventario','clientes')
--      AND indexname IN (
--        'idx_facturas_cliente_fecha',
--        'idx_inventario_pres_expiry',
--        'idx_clientes_user'
--      );
-- Expected: 3 rows.
-- ═══════════════════════════════════════════════════════════════════════════
