-- Widen profiles.theme_preference to admit the 'warm' theme.
--
-- master_setup.sql created the column as:
--   theme_preference TEXT DEFAULT 'dark' CHECK (theme_preference IN ('dark','light'))
--
-- Nothing in the app writes this column today, so the app is not broken
-- without this — but the moment theme preference starts syncing to the
-- profile, saving 'warm' would be rejected by the constraint.
--
-- Safe to run more than once.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_theme_preference_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_theme_preference_check
  CHECK (theme_preference IN ('dark', 'light', 'warm'));
