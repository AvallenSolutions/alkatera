-- Telemetry: per-step events for the onboarding flow. Used to identify
-- where users drop off, how long each step takes, and which import paths
-- succeed vs fail.
--
-- We deliberately keep this narrow: one row per event, no aggregations,
-- no upserts. The client fires events; analysts query them. Aggregation
-- (drop-off funnels, average time per step, integration success rates)
-- happens at read time so the table stays append-only and cheap to write.

create table if not exists public.onboarding_step_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  flow text not null,                 -- 'owner' | 'member' | 'fast_track'
  step text not null,                 -- step id at the time of the event
  event text not null check (event in (
    'view',         -- step rendered to the user
    'complete',     -- user finished the step (Continue / Done)
    'skip',         -- user skipped a skippable step
    'back',         -- user navigated back to a previous step
    'dismiss',      -- user closed the wizard (whole-wizard event; step = current)
    'error',        -- something failed (network, validation) — `meta` carries detail
    'integration_started',   -- user kicked off a connect / upload flow inside a step
    'integration_completed', -- the connect / upload flow finished successfully
    'integration_failed'     -- the connect / upload flow surfaced an error
  )),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Hot path: querying "where did users drop off in flow X this week"
create index if not exists onboarding_step_events_flow_step_created_idx
  on public.onboarding_step_events (flow, step, created_at desc);

-- Per-org / per-user lookups (for support and per-user funnels)
create index if not exists onboarding_step_events_org_created_idx
  on public.onboarding_step_events (organization_id, created_at desc);

alter table public.onboarding_step_events enable row level security;

-- Anyone in the org can read their own org's events (analyst view).
-- Inserts happen via the service-role client only, so no insert policy
-- is exposed to authenticated clients — keeps the write surface narrow.
create policy "onboarding_step_events_org_member_read"
  on public.onboarding_step_events for select
  using (
    exists (
      select 1
      from public.organization_members om
      where om.organization_id = onboarding_step_events.organization_id
        and om.user_id = auth.uid()
    )
  );
