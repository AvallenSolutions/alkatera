# Staging database setup

The staging Supabase is the repurposed **HHRubbish Runners** project
(ref `jfzsrahzbeoffvywholp`, region eu-west-1). It has been confirmed empty of
real data, only its own app schema and PostGIS reference rows, so it is safe to
wipe and repurpose.

We seed it from the **local** database (full alkatera schema + synthetic test
orgs, zero customer PII). The anonymised production clone is a separate,
later step for the migration rehearsal (Phase 4), not needed to get staging
live.

## One-time build (run on your machine)

Needs the Supabase CLI (`brew install supabase/tap/supabase`) and the staging
project's database password (Supabase > Project Settings > Database).

```bash
cd /Users/timej/Documents/GitHub/alkatera/.claude/worktrees/redesign

# 1. Link the CLI to the staging project
supabase link --project-ref jfzsrahzbeoffvywholp

# 2. Wipe it and replay ALL alkatera migrations (the full schema).
#    This is destructive to the old HHRubbish schema, which is the intent.
supabase db reset --linked
```

That applies all 59 migration files, so staging ends up on the exact redesign
schema (including every migration this session added).

## Seed test data

Two options once the app is deployed and pointed at staging:

- **Simplest:** sign in and use the in-app admin seeder at
  `/admin/demo-seed` (the alka**tera** Drinks Co demo) plus create a couple of
  test orgs, exactly as we have locally.
- **Fuller:** dump the local synthetic data and load it into staging:
  ```bash
  # dump local public-schema data only (no schema, no auth)
  docker exec supabase_db_alkatera pg_dump -U postgres -d postgres \
    --data-only --schema public --no-owner --no-privileges \
    > /tmp/alkatera-local-data.sql
  # load into staging (uses the staging DB connection string)
  psql "$STAGING_DB_URL" -f /tmp/alkatera-local-data.sql
  ```
  Note: `auth.users` is managed by Supabase Auth; create staging test users via
  the dashboard (Authentication > Users) or the Auth admin API, then their org
  memberships come from the public-schema data above.

## The secret Claude still needs from you for Vercel

Only `SUPABASE_SERVICE_ROLE_KEY` (Supabase > Project Settings > API >
`service_role`). The URL and anon key are public and already pre-filled in
`deploy/vercel-staging-setup.sh`.

## Later: the anonymised production clone (Phase 4 rehearsal)

When you want to rehearse the real cutover against production-shaped data, clone
prod into a scratch project and run the pending migrations + the anonymisation
pass there. That step needs production credentials and so stays with you; Claude
will write the anonymisation SQL and run the migration stack against the clone
once it exists.
