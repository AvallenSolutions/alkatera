-- ============================================================
-- DISTRIBUTOR BACKFILL RUNS
--   Records the outcome of a "find brand websites" backfill so the
--   portal can show WHY a run found nothing (grounded-search error,
--   Gemini key not visible to the functions runtime, parse failure,
--   or genuinely no discoverable site) instead of a silent 0.
--
--   The work runs in netlify/functions/find-websites-background.ts;
--   that function writes results back onto the row it's handed. The
--   client polls GET /api/distributor/brands/find-websites?run_id=…
-- ============================================================

begin;

create table if not exists public.distributor_backfill_runs (
  id uuid primary key default gen_random_uuid(),
  distributor_org_id uuid not null
    references public.distributor_organizations(id) on delete cascade,
  kind text not null default 'find_websites',
  status text not null default 'running',        -- running | done | error
  total int not null default 0,                  -- brands attempted
  found int not null default 0,                  -- websites found + saved
  queued int not null default 0,                 -- scrapes queued
  gemini_configured boolean,                     -- was GEMINI_API_KEY visible at run time
  errors jsonb not null default '[]'::jsonb,     -- distinct grounded-search failure reasons
  samples jsonb not null default '[]'::jsonb,    -- raw model-response samples (admin debugging)
  message text,                                  -- terminal note (e.g. nothing-to-do)
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists distributor_backfill_runs_org_idx
  on public.distributor_backfill_runs (distributor_org_id, created_at desc);

-- All reads/writes go through the service-role API client (requireDistributor),
-- which bypasses RLS. Enable RLS with no broad policy so direct anon/auth
-- access is denied by default.
alter table public.distributor_backfill_runs enable row level security;

commit;
