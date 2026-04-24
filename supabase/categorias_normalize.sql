-- ============================================================
-- EMPORIUM — One-time category normalization
-- Run in Supabase SQL Editor to collapse duplicate category
-- strings ("Salud", "Salud.", "Health") into a single canonical
-- label. Mirror of `normalizeCategoriaKey()` in TiendaClient.tsx.
-- ============================================================

-- ── 1. Preview what would change (safe to run first) ──────────
SELECT
  categoria AS original,
  CASE
    WHEN lower(trim(regexp_replace(categoria, '[.,;:!? \-_/\\]+$', '', 'g'))) IN ('health','salud')            THEN 'Salud'
    WHEN lower(trim(regexp_replace(categoria, '[.,;:!? \-_/\\]+$', '', 'g'))) IN ('beauty','belleza')         THEN 'Belleza'
    WHEN lower(trim(regexp_replace(categoria, '[.,;:!? \-_/\\]+$', '', 'g'))) IN ('cleaning','limpieza')      THEN 'Limpieza'
    WHEN lower(trim(regexp_replace(categoria, '[.,;:!? \-_/\\]+$', '', 'g'))) IN ('food','alimentos','comida','groceries') THEN 'Alimentos'
    WHEN lower(trim(regexp_replace(categoria, '[.,;:!? \-_/\\]+$', '', 'g'))) IN ('beverages','bebidas','drinks')           THEN 'Bebidas'
    WHEN lower(trim(regexp_replace(categoria, '[.,;:!? \-_/\\]+$', '', 'g'))) IN ('personal care','cuidado personal','personal-care','cuidado-personal') THEN 'Cuidado personal'
    WHEN lower(trim(regexp_replace(categoria, '[.,;:!? \-_/\\]+$', '', 'g'))) IN ('others','other','otros','otro','misc')   THEN 'Otros'
    ELSE initcap(trim(regexp_replace(categoria, '[.,;:!? \-_/\\]+$', '', 'g')))
  END AS normalized,
  COUNT(*) AS productos
FROM productos
WHERE categoria IS NOT NULL AND categoria <> ''
GROUP BY categoria
ORDER BY normalized, original;


-- ── 2. Apply the normalization ────────────────────────────────
-- Uncomment to run.
--
-- UPDATE productos
-- SET categoria = CASE
--   WHEN lower(trim(regexp_replace(categoria, '[.,;:!? \-_/\\]+$', '', 'g'))) IN ('health','salud')            THEN 'Salud'
--   WHEN lower(trim(regexp_replace(categoria, '[.,;:!? \-_/\\]+$', '', 'g'))) IN ('beauty','belleza')         THEN 'Belleza'
--   WHEN lower(trim(regexp_replace(categoria, '[.,;:!? \-_/\\]+$', '', 'g'))) IN ('cleaning','limpieza')      THEN 'Limpieza'
--   WHEN lower(trim(regexp_replace(categoria, '[.,;:!? \-_/\\]+$', '', 'g'))) IN ('food','alimentos','comida','groceries') THEN 'Alimentos'
--   WHEN lower(trim(regexp_replace(categoria, '[.,;:!? \-_/\\]+$', '', 'g'))) IN ('beverages','bebidas','drinks')           THEN 'Bebidas'
--   WHEN lower(trim(regexp_replace(categoria, '[.,;:!? \-_/\\]+$', '', 'g'))) IN ('personal care','cuidado personal','personal-care','cuidado-personal') THEN 'Cuidado personal'
--   WHEN lower(trim(regexp_replace(categoria, '[.,;:!? \-_/\\]+$', '', 'g'))) IN ('others','other','otros','otro','misc')   THEN 'Otros'
--   ELSE initcap(trim(regexp_replace(categoria, '[.,;:!? \-_/\\]+$', '', 'g')))
-- END
-- WHERE categoria IS NOT NULL AND categoria <> '';
