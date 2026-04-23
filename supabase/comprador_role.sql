-- ============================================================
-- EMPORIUM — Add 'comprador' role
-- ============================================================
-- Roles:
--   admin     — full access
--   vendedor  — dashboard access
--   conductor — dashboard / routes
--   cliente   — tienda + can create ordenes (admin approval, no Stripe)
--   comprador — tienda + only Stripe payment (new signups default here)
--   pendiente — legacy holding state before approval
-- ============================================================

-- ── 1. Extend the rol CHECK constraint to allow 'comprador' ────────────────
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_rol_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_rol_check
  CHECK (rol IN ('admin', 'vendedor', 'conductor', 'cliente', 'comprador', 'pendiente'));


-- ── 2. New users default to 'comprador' (Stripe-only buyers) ───────────────
--     Admins promote comprador → cliente from /equipo to authorize orders.
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
    'comprador',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();
