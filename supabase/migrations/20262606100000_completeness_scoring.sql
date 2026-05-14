-- ============================================================
-- DISTRIBUTOR PORTAL — PHASE 5: COMPLETENESS SCORING
--                              + REMINDER SCHEDULES
-- ============================================================
-- "Completeness" here is "how much data do we have on this brand?",
-- not "how sustainable is the brand?". Sustainability performance
-- scoring lands in Phase 8 and reuses the same brand_profiles columns
-- (sustainability_score, score_tier) which were provisioned in Phase 1.
--
-- This phase adds:
--   - brand_completeness_snapshots: append-only history of per-brand
--     completeness as we recalculate after each scrape / document
--     process / conflict resolution
--   - outreach_reminder_schedules: distributor-defined automated
--     reminder cadence (e.g. "remind every 14 days, up to 3 times")
-- ============================================================

begin;

-- ============================================================
-- Tables
-- ============================================================

-- One row per (re)calculation. brand_profiles.completeness_score is
-- always kept in sync with the latest row for that brand so common
-- queries don't need a join. Snapshots also let us draw "completeness
-- over time" charts in later phases.
create table public.brand_completeness_snapshots (
  id                       uuid primary key default gen_random_uuid(),
  brand_profile_id         uuid not null references public.brand_profiles(id) on delete cascade,
  distributor_org_id       uuid not null references public.distributor_organizations(id) on delete cascade,
  completeness_score       numeric(5,2) not null,
  carbon_completeness      numeric(5,2),
  water_completeness       numeric(5,2),
  packaging_completeness   numeric(5,2),
  agriculture_completeness numeric(5,2),
  governance_completeness  numeric(5,2),
  corporate_completeness   numeric(5,2),
  fields_populated         integer not null default 0,
  fields_total             integer not null default 0,
  calculated_at            timestamptz not null default now()
);

-- Distributor-configured reminder cadence. A null brand_profile_id
-- means "applies to every non-responding brand in this org" — the
-- common case. Per-brand overrides allow VIPs to have a different
-- cadence (e.g. shorter for retail-priority brands).
create table public.outreach_reminder_schedules (
  id                  uuid primary key default gen_random_uuid(),
  distributor_org_id  uuid not null references public.distributor_organizations(id) on delete cascade,
  created_by          uuid not null references auth.users(id),
  brand_profile_id    uuid references public.brand_profiles(id) on delete cascade,
  interval_days       integer not null default 14 check (interval_days between 1 and 90),
  max_reminders       integer not null default 3 check (max_reminders between 1 and 10),
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================
create index brand_completeness_snapshots_brand_idx
  on public.brand_completeness_snapshots (brand_profile_id, calculated_at desc);
create index brand_completeness_snapshots_org_idx
  on public.brand_completeness_snapshots (distributor_org_id);

create index outreach_reminder_schedules_org_idx
  on public.outreach_reminder_schedules (distributor_org_id) where active;
create index outreach_reminder_schedules_brand_idx
  on public.outreach_reminder_schedules (brand_profile_id) where active and brand_profile_id is not null;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.brand_completeness_snapshots enable row level security;
alter table public.outreach_reminder_schedules  enable row level security;

create policy "distributor members read completeness"
  on public.brand_completeness_snapshots for select
  using (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members where user_id = auth.uid()
    )
  );

create policy "distributor members read reminder schedules"
  on public.outreach_reminder_schedules for select
  using (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members where user_id = auth.uid()
    )
  );

create policy "owners and data_managers manage reminder schedules"
  on public.outreach_reminder_schedules for all
  using (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid() and role in ('owner','data_manager')
    )
  )
  with check (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid() and role in ('owner','data_manager')
    )
  );

-- brand_completeness_snapshots is written by the cron / pipeline routes
-- via service role. No user-facing insert policies are needed.

commit;
