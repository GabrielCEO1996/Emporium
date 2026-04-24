-- ═══════════════════════════════════════════════════════════════════════════
-- Cancel test orders placed during development (Laura's probes)
--
-- Run in Supabase SQL editor. The SELECT first shows what will be affected —
-- review it, then run the UPDATE.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Preview: which ordenes will be cancelled?
-- --------------------------------------------------------------------------
SELECT
  o.id,
  o.numero,
  o.estado,
  o.tipo_pago,
  o.total,
  o.created_at,
  c.nombre  AS cliente_nombre,
  c.email   AS cliente_email
FROM ordenes o
LEFT JOIN clientes c ON c.id = o.cliente_id
WHERE o.estado = 'pendiente'
  AND (
    c.nombre  ILIKE '%laura%' OR
    c.email   ILIKE '%laura%'
  )
ORDER BY o.created_at DESC;

-- 2. Cancellation — uncomment after reviewing the preview above.
-- --------------------------------------------------------------------------
-- UPDATE ordenes
-- SET
--   estado          = 'cancelada',
--   motivo_rechazo  = 'Orden de prueba durante desarrollo — cancelada por el equipo.',
--   updated_at      = NOW()
-- WHERE id IN (
--   SELECT o.id
--   FROM ordenes o
--   LEFT JOIN clientes c ON c.id = o.cliente_id
--   WHERE o.estado = 'pendiente'
--     AND (
--       c.nombre  ILIKE '%laura%' OR
--       c.email   ILIKE '%laura%'
--     )
-- );

-- 3. Optional: mark the corresponding pedidos as cancelada too (if any were created)
-- --------------------------------------------------------------------------
-- UPDATE pedidos
-- SET estado = 'cancelada', updated_at = NOW()
-- WHERE orden_id IN (
--   SELECT o.id
--   FROM ordenes o
--   LEFT JOIN clientes c ON c.id = o.cliente_id
--   WHERE (c.nombre ILIKE '%laura%' OR c.email ILIKE '%laura%')
-- );
