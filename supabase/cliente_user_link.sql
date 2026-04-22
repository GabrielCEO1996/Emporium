-- ============================================================
-- LINK CLIENTES ↔ AUTH USERS
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add user_id column to clientes
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS clientes_user_id_idx ON public.clientes(user_id);

-- ============================================================
-- 2. Updated trigger: creates profile + cliente on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile row
  INSERT INTO public.profiles (id, email, nombre, rol, activo)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'cliente',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create matching cliente row
  INSERT INTO public.clientes (nombre, email, user_id, activo)
  VALUES (
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.id,
    true
  )
  ON CONFLICT (email) DO UPDATE
    SET user_id = EXCLUDED.user_id
    WHERE public.clientes.user_id IS NULL;

  RETURN new;
END;
$$;

-- Recreate trigger (drop first to avoid duplicates)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- 3. Backfill: link existing clientes to their auth users
-- ============================================================
UPDATE public.clientes c
SET user_id = p.id
FROM public.profiles p
WHERE c.email = p.email
  AND c.user_id IS NULL;
