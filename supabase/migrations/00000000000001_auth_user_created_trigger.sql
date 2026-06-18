-- The `on_auth_user_created` trigger binds public.handle_new_user() to auth.users so a
-- profile (and, from invite metadata, an organization_members row) is created on signup.
--
-- In production this trigger was created by hand in the dashboard and was never captured in
-- a migration, so the schema-only baseline (which excludes the auth schema) did not include
-- it. This migration restores it for local dev and finally version-controls it.
-- Guarded + idempotent, and harmless if applied to an environment that already has it.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
