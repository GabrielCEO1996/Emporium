-- ============================================================
-- EMPORIUM — Fix roles CHECK constraint + handle_new_user trigger
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── 1. Drop the old CHECK constraint that only allowed admin/vendedor/conductor
--       and replace it with one that also allows 'pendiente' and 'cliente'.
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_rol_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_rol_check
  CHECK (rol IN ('admin', 'vendedor', 'conductor', 'pendiente', 'cliente'));


-- ── 2. Add the solicita_vendedor column (used by the client store perfil page)
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS solicita_vendedor BOOLEAN DEFAULT false;


-- ── 3. Add whatsapp to clientes (used by the client type & store queries)
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS whatsapp TEXT;


-- ── 4. handle_new_user trigger
--       Creates a profiles row automatically every time a user signs up.
--       rol defaults to 'cliente' — admins promote users in /equipo.
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nombre, rol, activo)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'nombre',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    'cliente',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop any previous version of the trigger before recreating
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();


-- ── 5. Backfill: create 'cliente' profiles for auth users that have none
--       (users who signed up before the trigger existed)
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO public.profiles (id, email, nombre, rol, activo)
SELECT
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'nombre',
    au.raw_user_meta_data->>'full_name',
    split_part(au.email, '@', 1)
  ),
  'cliente',
  true
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;


-- ── 6. Verify the fix ────────────────────────────────────────────────────────
-- Run these SELECTs to confirm:
--
-- SELECT id, email, nombre, rol FROM profiles ORDER BY created_at DESC LIMIT 20;
-- SELECT COUNT(*) FROM auth.users au LEFT JOIN profiles p ON p.id = au.id WHERE p.id IS NULL;
-- (should return 0)
