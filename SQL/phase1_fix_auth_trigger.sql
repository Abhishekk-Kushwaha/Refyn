-- ============================================================
-- REFYN — FIX: "Database error saving new user" on sign-up
-- Run this in the Supabase SQL Editor. Idempotent.
--
-- CAUSE
-- master_setup.sql created handle_new_user() as SECURITY DEFINER but did not
-- pin a search_path. The trigger fires on INSERT INTO auth.users from GoTrue,
-- whose connection does not have `public` first on its search_path — so the
-- unqualified `INSERT INTO profiles` resolves to a non-existent auth.profiles,
-- the trigger raises, and the whole signup transaction aborts. GoTrue surfaces
-- that as HTTP 500 "Database error saving new user".
--
-- FIX
--   1. Pin `SET search_path = public` and schema-qualify the insert.
--   2. ON CONFLICT DO NOTHING so a retried signup can't collide.
--   3. Never let a profile-row problem block authentication — the app
--      self-heals the row on first load if it's somehow missing.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(COALESCE(NEW.email, ''), '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Authentication must never fail because of profile bookkeeping.
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- Backfill: create profile rows for any users who already signed up
-- during the broken window.
-- ------------------------------------------------------------
INSERT INTO public.profiles (id, display_name)
SELECT u.id, split_part(COALESCE(u.email, ''), '@', 1)
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- ------------------------------------------------------------
-- Sanity check — every auth user should now have a profile row.
-- Expect missing_profiles = 0.
-- ------------------------------------------------------------
SELECT
  (SELECT count(*) FROM auth.users)    AS auth_users,
  (SELECT count(*) FROM public.profiles) AS profiles,
  (SELECT count(*) FROM auth.users u
     LEFT JOIN public.profiles p ON p.id = u.id
    WHERE p.id IS NULL)                AS missing_profiles;
