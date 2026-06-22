-- Pulse on-demand refresh runs.
--
-- The "Refresh data" button used to run all five Pulse data jobs synchronously
-- in one request, which blew past the platform's sync-function timeout (gateway
-- returned HTML, browser failed to parse it as JSON). The refresh now runs in
-- the background via Inngest; this table is the unit of progress the UI polls.
--
-- Reads/writes go through service-role API routes only (owner/admin gated in
-- the route), so RLS is enabled with no client policies — the table is not
-- directly accessible from the browser.

create table if not exists public.pulse_refresh_runs (
  id           uuid primary key default gen_random_uuid(),
  requested_by uuid references auth.users (id) on delete set null,
  status       text not null default 'queued'
                 check (status in ('queued', 'running', 'completed', 'failed')),
  -- Per-job state map, e.g. { "snapshots": { "status": "completed", "httpStatus": 200 }, ... }
  jobs         jsonb not null default '{}'::jsonb,
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists pulse_refresh_runs_created_at_idx
  on public.pulse_refresh_runs (created_at desc);

alter table public.pulse_refresh_runs enable row level security;
-- No policies: server-side service-role access only.
