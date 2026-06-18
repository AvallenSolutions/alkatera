-- Local development seed — runs automatically on `supabase db reset`.
-- SYNTHETIC DATA ONLY. Never put real customer data here.
--
-- The schema baseline (00000000000000_baseline_prod_schema.sql) is schema-only, so this
-- file restores the minimum reference data the app needs to boot locally, plus one
-- synthetic organisation. Create the matching login user with scripts/seed-local-user.sh
-- (it needs the local Auth admin API, which SQL alone can't do cleanly).
--
-- For rich demo data (emission factors, products, LCAs), log in locally and run the
-- in-app seeder at /admin/demo-seed.

-- ---------------------------------------------------------------------------
-- Canonical roles (stable UUIDs — these match every environment)
-- ---------------------------------------------------------------------------
INSERT INTO public.roles (id, name, description, created_at, updated_at) VALUES
  ('8b90b4ff-366c-4bdd-a349-b65f737fe5ef', 'owner',  'Full access to all organization resources and settings', now(), now()),
  ('458a6f53-7416-47b9-9658-03c4ffd2eb4b', 'admin',  'Administrative access with ability to manage users and settings', now(), now()),
  ('6a665bc6-738a-4a04-a407-166108ea198a', 'member', 'Standard user access with limited permissions', now(), now()),
  ('6fcf5c42-db9a-4f8e-9ff6-158f0ffe1d6c', 'viewer', 'Read-only access to organization resources', now(), now())
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- One synthetic organisation for local dev.
-- The test user (created by scripts/seed-local-user.sh) is attached to this org.
-- ---------------------------------------------------------------------------
INSERT INTO public.organizations (id, name, slug, created_at, updated_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Local Dev Co', 'local-dev-co', now(), now())
ON CONFLICT (id) DO NOTHING;
