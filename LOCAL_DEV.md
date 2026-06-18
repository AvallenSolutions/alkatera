# Local development

**Local dev runs against a local Supabase instance — never production.** This is a hard rule
(privacy + safety): the production database holds real customer data, and a service-role key
bypasses Row Level Security entirely. No production credentials belong in this workspace.

## One-time setup

1. **Docker** must be running (local Supabase runs in containers).
2. Start the local stack:
   ```bash
   supabase start
   ```
   Studio: http://127.0.0.1:54323 · API: http://127.0.0.1:54321
3. Build the schema + seed reference data and a synthetic org:
   ```bash
   supabase db reset      # applies the baseline + migrations, then supabase/seed.sql
   ```
4. Create a local login user (talks only to 127.0.0.1):
   ```bash
   ./scripts/seed-local-user.sh
   # default login: dev@local.test / localdev123
   ```
5. Point `.env.local` at local Supabase. Set these three (get the keys from `supabase status`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from `supabase status`>
   SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from `supabase status`>
   ```
   The local keys are the well-known Supabase dev keys — not secret, only valid against the
   local instance. Other third-party keys (Stripe, Resend, etc.) can stay as-is or be swapped
   for test/sandbox values.
6. Run the app:
   ```bash
   pnpm dev   # http://localhost:8888
   ```

## Schema model (read this before adding migrations)

The migration history was **squashed** on 2026-06-18. The historical timeline was not replayable:
24 files shared duplicate version numbers, and there were chronological inversions (migrations
that altered tables created weeks later), because migrations were historically hand-applied to
production via the SQL editor rather than through the CLI.

- `supabase/migrations/00000000000000_baseline_prod_schema.sql` — the authoritative starting
  point, a schema-only dump of the production `public` schema (no data).
- `supabase/migrations/00000000000001_auth_user_created_trigger.sql` — restores the
  `on_auth_user_created` trigger, which production had but the repo never captured.
- `supabase/migrations_archive/` — the 334 historical migrations, kept for reference only. They
  are **not** applied by `supabase db reset`.

**Going forward: write normal timestamped migrations after the baseline, with unique versions.**

## Rich demo data

The seed is intentionally minimal (roles + one synthetic org). For a full showcase dataset
(emission factors, products, LCAs), log in locally and run the in-app seeder at `/admin/demo-seed`.

## Known gaps (follow-ups)

- The baseline excludes the `storage` schema, so app storage buckets/policies are not recreated
  locally yet. File-upload features need a small follow-up migration to create the buckets.
- Reference data beyond roles (emission-factor libraries, templates, subscription tiers) is not
  in `seed.sql`; some pages will be sparse until seeded via `/admin/demo-seed` or a future seed.

## If you need to inspect production

Do it deliberately through the Supabase dashboard with your own login — never by putting a
production service-role key into this workspace.
