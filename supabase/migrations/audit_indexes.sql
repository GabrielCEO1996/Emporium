-- ────────────────────────────────────────────────────────────────────────────
-- Performance indexes derived from the 2026-04-24 technical audit.
--
-- All statements are idempotent (`IF NOT EXISTS`) and can be safely re-run
-- against an existing database. None of these lock tables in ACCESS EXCLUSIVE
-- mode in normal use, but run them off-peak the first time to be safe.
--
-- Hot paths addressed:
--   1. /facturas list page — order by fecha_emision DESC + cliente filter
--   2. /pedidos  list page — order by fecha_pedido DESC + cliente filter
--   3. /historial          — activity_logs by created_at DESC
--   4. inventory cards     — inventario_movimientos(presentacion_id, created_at DESC)
--   5. /compras list page  — order by fecha DESC
--   6. factura detail page — pagos(factura_id, created_at DESC)
--   7. filters on facturas.estado excluding 'pagada' (smaller partial index)
-- ────────────────────────────────────────────────────────────────────────────

-- Facturas ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_facturas_fecha_emision
  ON facturas(fecha_emision DESC);

CREATE INDEX IF NOT EXISTS idx_facturas_cliente
  ON facturas(cliente_id);

-- Partial index: the dashboard cares almost exclusively about NON-pagada
-- invoices (emitidas, enviadas, vencidas). Partial indexes are smaller and
-- faster to scan than full indexes.
CREATE INDEX IF NOT EXISTS idx_facturas_estado_open
  ON facturas(estado) WHERE estado != 'pagada';

-- Combined for the common role-scoped "vendedor sees own" query.
CREATE INDEX IF NOT EXISTS idx_facturas_vendedor_fecha
  ON facturas(vendedor_id, fecha_emision DESC);

-- Pedidos ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_pedido
  ON pedidos(fecha_pedido DESC);

-- The /pedidos page filters by cliente_id and orders by fecha — composite
-- serves both the filter and the ORDER BY in one scan.
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_fecha
  ON pedidos(cliente_id, fecha_pedido DESC);

CREATE INDEX IF NOT EXISTS idx_pedidos_vendedor_fecha
  ON pedidos(vendedor_id, fecha_pedido DESC);

CREATE INDEX IF NOT EXISTS idx_pedidos_estado
  ON pedidos(estado);

-- Activity logs ──────────────────────────────────────────────────────────────
-- Append-only table; the /historial page always orders DESC by created_at.
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
  ON activity_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_action
  ON activity_logs(user_id, action);

-- Inventory movements ────────────────────────────────────────────────────────
-- Product detail cards query: last N movements for a presentación.
CREATE INDEX IF NOT EXISTS idx_inv_movimientos_presentacion_created
  ON inventario_movimientos(presentacion_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inv_movimientos_referencia
  ON inventario_movimientos(referencia_tipo, referencia_id);

-- Compras ────────────────────────────────────────────────────────────────────
-- The compras table column is `fecha` (not `fecha_compra`) per schema.sql.
CREATE INDEX IF NOT EXISTS idx_compras_fecha
  ON compras(fecha DESC);

CREATE INDEX IF NOT EXISTS idx_compras_proveedor
  ON compras(proveedor_id);

-- Pagos ──────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pagos_factura_created
  ON pagos(factura_id, created_at DESC);

-- Notas de crédito ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notas_credito_factura
  ON notas_credito(factura_id);

CREATE INDEX IF NOT EXISTS idx_notas_credito_cliente_created
  ON notas_credito(cliente_id, created_at DESC);

-- Clientes ───────────────────────────────────────────────────────────────────
-- Lookups by user_id are used by both the tienda checkout and the
-- role-scoping logic in /api/facturas GET.
CREATE INDEX IF NOT EXISTS idx_clientes_user_id
  ON clientes(user_id);

-- Presentaciones / Inventario ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inventario_presentacion
  ON inventario(presentacion_id);

-- Transacciones ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_transacciones_fecha
  ON transacciones(fecha DESC);

CREATE INDEX IF NOT EXISTS idx_transacciones_referencia
  ON transacciones(referencia_tipo, referencia_id);

-- Orden items & factura items ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_factura_items_factura
  ON factura_items(factura_id);

CREATE INDEX IF NOT EXISTS idx_pedido_items_pedido
  ON pedido_items(pedido_id);

CREATE INDEX IF NOT EXISTS idx_orden_items_orden
  ON orden_items(orden_id);

CREATE INDEX IF NOT EXISTS idx_nota_credito_items_nc
  ON nota_credito_items(nota_credito_id);

ANALYZE;
