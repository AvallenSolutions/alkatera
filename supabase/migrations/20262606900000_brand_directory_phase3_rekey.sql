-- ============================================================
-- CANONICAL BRAND DIRECTORY — PHASE 3
-- Re-key sustainability data from brand_profiles → brand_directory
-- ============================================================
-- Phase 1 created brand_directory and added brand_profiles.brand_directory_id
-- (NOT NULL, fully backfilled). Phase 2 wired the matcher into SKU upload
-- so new brand uploads collapse onto an existing canonical entry.
--
-- Today every fact-about-the-brand still writes to a per-distributor
-- brand_profile_id, so a verification by Avallen on Distributor A's
-- outreach link is invisible to Distributor B. This migration re-keys
-- the four sustainability fact tables to brand_directory_id so that
-- data canonicalises across listings:
--
--   * scraped_brand_data           (every scraped / brand-uploaded /
--                                   brand-verified / alkatera_live finding)
--   * brand_document_submissions   (every uploaded document)
--   * brand_data_conflicts         (the internal "needs verification" log)
--   * brand_completeness_snapshots (per-recalc completeness/vitality history)
--
-- Per-distributor relationship state (listing status, outreach state,
-- alkatera_tier, upload_token) stays on brand_profiles. Outreach + reminder
-- tables, brand_distributor_links, distributor_notifications and the job-
-- queue tables (scraping_jobs, document_processing_jobs) all stay keyed
-- by brand_profile_id — they're per-distributor by construction.
--
-- Score mirroring also flips: brand_directory.{sustainability_score,
-- score_tier, completeness_score, score_updated_at} becomes the single
-- source of truth. The legacy mirror columns on brand_profiles stay in
-- the schema (for now) but no code path writes to them after this PR;
-- a future cleanup migration can drop them once we're confident nothing
-- still reads them.
--
-- Cleanup strategy: legacy brand_profile_id columns drop in this same
-- migration. The codebase is fully under our control, the backfill
-- (UPDATE ... SET brand_directory_id = bp.brand_directory_id FROM
-- brand_profiles bp ...) is deterministic, and a grace period would
-- only postpone the cutover work without de-risking it.
-- ============================================================

begin;

-- ============================================================
-- 0. Pre-flight: brand_profiles.brand_directory_id must be populated.
--    Phase 1 set this NOT NULL after backfill, so this is a belt-and-
--    braces check before we start re-keying child tables.
-- ============================================================
do $$
declare
  v_orphan_listings integer;
begin
  select count(*) into v_orphan_listings
    from public.brand_profiles
    where brand_directory_id is null;
  if v_orphan_listings > 0 then
    raise exception 'phase3_aborted: % brand_profiles rows have null brand_directory_id; rerun Phase 1 backfill first',
      v_orphan_listings;
  end if;
end $$;

-- ============================================================
-- 1. brand_directory: track when scores were last refreshed.
-- ============================================================
-- Phase 1 added sustainability_score / score_tier / completeness_score
-- but no `score_updated_at`. After Phase 3 the directory becomes the
-- canonical scoreboard, so we want the same column the brand_profiles
-- mirror has so the UI can render "scored 2h ago".
alter table public.brand_directory
  add column if not exists score_updated_at timestamptz;

-- ============================================================
-- 2. scraped_brand_data
-- ============================================================
alter table public.scraped_brand_data
  add column brand_directory_id uuid references public.brand_directory(id) on delete cascade;

update public.scraped_brand_data sbd
  set brand_directory_id = bp.brand_directory_id
  from public.brand_profiles bp
  where bp.id = sbd.brand_profile_id;

alter table public.scraped_brand_data
  alter column brand_directory_id set not null;

-- Active-only field lookup (the hot path for the data merger).
create index scraped_brand_data_directory_field_active_idx
  on public.scraped_brand_data (brand_directory_id, field_key)
  where superseded_by is null;

-- Verified-active per-directory (Phase 6 brand_verified rows).
create index scraped_brand_data_directory_verified_active_idx
  on public.scraped_brand_data (brand_directory_id, field_key)
  where source_name = 'brand_verified' and superseded_by is null;

-- Plain index on the FK for joins / scans by directory.
create index scraped_brand_data_directory_idx
  on public.scraped_brand_data (brand_directory_id);

-- Drop the old per-listing indexes — every consumer is moving to the
-- directory-scoped indexes above.
drop index if exists public.scraped_brand_data_brand_idx;
drop index if exists public.scraped_brand_data_field_idx;
drop index if exists public.scraped_brand_data_verified_active_idx;

-- Replace the per-listing read RLS policy with a directory-scoped one.
-- A distributor can read a finding when they have ANY listing pointing
-- at the same directory entry. This is the canonical "default sharing"
-- policy: brand-verified data flows to every distributor that lists the
-- brand. Per-distributor opt-outs are a Phase 5 concern.
drop policy if exists "distributor members read scraped data" on public.scraped_brand_data;
create policy "distributor members read scraped data"
  on public.scraped_brand_data for select
  using (
    exists (
      select 1
      from public.brand_profiles bp
      join public.distributor_members dm
        on dm.distributor_org_id = bp.distributor_org_id
      where bp.brand_directory_id = scraped_brand_data.brand_directory_id
        and dm.user_id = auth.uid()
    )
  );

alter table public.scraped_brand_data
  drop column brand_profile_id;

-- ============================================================
-- 3. brand_document_submissions
-- ============================================================
-- distributor_org_id stays on this table as audit metadata: it tells us
-- which distributor's outreach token the brand used to submit the
-- document. Reads from RLS still scope by directory listing membership
-- AND let the originating distributor see their own audit trail even if
-- they later delist the brand.
alter table public.brand_document_submissions
  add column brand_directory_id uuid references public.brand_directory(id) on delete cascade;

update public.brand_document_submissions bds
  set brand_directory_id = bp.brand_directory_id
  from public.brand_profiles bp
  where bp.id = bds.brand_profile_id;

alter table public.brand_document_submissions
  alter column brand_directory_id set not null;

create index brand_document_submissions_directory_idx
  on public.brand_document_submissions (brand_directory_id, created_at desc);

drop index if exists public.brand_document_submissions_brand_idx;

drop policy if exists "distributor members read brand documents"
  on public.brand_document_submissions;
create policy "distributor members read brand documents"
  on public.brand_document_submissions for select
  using (
    -- Audit-trail view: distributor that received the upload always
    -- keeps visibility, even if they later delist the brand.
    distributor_org_id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid()
    )
    -- Default sharing view: any distributor that currently lists the
    -- brand sees the document.
    or exists (
      select 1
      from public.brand_profiles bp
      join public.distributor_members dm
        on dm.distributor_org_id = bp.distributor_org_id
      where bp.brand_directory_id = brand_document_submissions.brand_directory_id
        and dm.user_id = auth.uid()
    )
  );

alter table public.brand_document_submissions
  drop column brand_profile_id;

-- ============================================================
-- 4. brand_data_conflicts
-- ============================================================
alter table public.brand_data_conflicts
  add column brand_directory_id uuid references public.brand_directory(id) on delete cascade;

update public.brand_data_conflicts bdc
  set brand_directory_id = bp.brand_directory_id
  from public.brand_profiles bp
  where bp.id = bdc.brand_profile_id;

alter table public.brand_data_conflicts
  alter column brand_directory_id set not null;

create index brand_data_conflicts_directory_idx
  on public.brand_data_conflicts (brand_directory_id);
create index brand_data_conflicts_directory_unresolved_idx
  on public.brand_data_conflicts (brand_directory_id, created_at)
  where resolution is null;

drop index if exists public.brand_data_conflicts_brand_idx;
drop index if exists public.brand_data_conflicts_unresolved_idx;

drop policy if exists "distributor members read conflicts" on public.brand_data_conflicts;
drop policy if exists "owners and data_managers resolve conflicts" on public.brand_data_conflicts;

create policy "distributor members read conflicts"
  on public.brand_data_conflicts for select
  using (
    exists (
      select 1
      from public.brand_profiles bp
      join public.distributor_members dm
        on dm.distributor_org_id = bp.distributor_org_id
      where bp.brand_directory_id = brand_data_conflicts.brand_directory_id
        and dm.user_id = auth.uid()
    )
  );

create policy "owners and data_managers resolve conflicts"
  on public.brand_data_conflicts for update
  using (
    exists (
      select 1
      from public.brand_profiles bp
      join public.distributor_members dm
        on dm.distributor_org_id = bp.distributor_org_id
      where bp.brand_directory_id = brand_data_conflicts.brand_directory_id
        and dm.user_id = auth.uid()
        and dm.role in ('owner','data_manager')
    )
  );

alter table public.brand_data_conflicts
  drop column brand_profile_id;

-- ============================================================
-- 5. brand_completeness_snapshots
-- ============================================================
-- Completeness is now brand-level (one snapshot per directory per
-- recalc), so distributor_org_id loses its meaning here. Drop it. The
-- per-distributor membership filter on RLS reads goes through the
-- listing-to-directory join just like the other tables.
alter table public.brand_completeness_snapshots
  add column brand_directory_id uuid references public.brand_directory(id) on delete cascade;

update public.brand_completeness_snapshots bcs
  set brand_directory_id = bp.brand_directory_id
  from public.brand_profiles bp
  where bp.id = bcs.brand_profile_id;

alter table public.brand_completeness_snapshots
  alter column brand_directory_id set not null;

create index brand_completeness_snapshots_directory_idx
  on public.brand_completeness_snapshots (brand_directory_id, calculated_at desc);

create index brand_completeness_snapshots_directory_vitality_idx
  on public.brand_completeness_snapshots (brand_directory_id, calculated_at desc)
  where vitality_score is not null;

drop index if exists public.brand_completeness_snapshots_brand_idx;
drop index if exists public.brand_completeness_snapshots_org_idx;
drop index if exists public.brand_completeness_snapshots_vitality_idx;

drop policy if exists "distributor members read completeness"
  on public.brand_completeness_snapshots;
create policy "distributor members read completeness"
  on public.brand_completeness_snapshots for select
  using (
    exists (
      select 1
      from public.brand_profiles bp
      join public.distributor_members dm
        on dm.distributor_org_id = bp.distributor_org_id
      where bp.brand_directory_id = brand_completeness_snapshots.brand_directory_id
        and dm.user_id = auth.uid()
    )
  );

alter table public.brand_completeness_snapshots
  drop column brand_profile_id,
  drop column distributor_org_id;

-- ============================================================
-- 6. RPC: get_brand_data_for_distributor — re-key to directory
-- ============================================================
-- The Phase 7 RPC takes (p_brand_profile_id, p_distributor_org_id,
-- p_brand_sku_id). We replace it with a directory-scoped variant that
-- returns the canonical findings + the alkatera-live overlay (still
-- gated by brand_distributor_links + brand_sharing_preferences).
--
-- We must drop the old function before recreating with a new signature
-- because Postgres treats parameter names + types as part of the
-- identity.
drop function if exists public.get_brand_data_for_distributor(uuid, uuid);
drop function if exists public.get_brand_data_for_distributor(uuid, uuid, uuid);

create or replace function public.get_brand_data_for_distributor(
  p_brand_directory_id uuid,
  p_distributor_org_id uuid,
  p_brand_sku_id uuid default null
)
returns table(
  field_key text,
  field_value text,
  field_value_numeric numeric,
  source text,
  confidence numeric,
  scraped_at timestamptz,
  brand_sku_id uuid
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_alkatera_org_id uuid;
  v_link_active boolean := false;
begin
  -- Brand-level findings (brand_sku_id is null).
  return query
  select sbd.field_key,
         sbd.field_value,
         sbd.field_value_numeric,
         sbd.source_name,
         sbd.confidence,
         sbd.scraped_at,
         sbd.brand_sku_id
  from public.scraped_brand_data sbd
  where sbd.brand_directory_id = p_brand_directory_id
    and sbd.superseded_by is null
    and sbd.brand_sku_id is null;

  -- Optional SKU-specific findings when caller asked for them.
  if p_brand_sku_id is not null then
    return query
    select sbd.field_key,
           sbd.field_value,
           sbd.field_value_numeric,
           sbd.source_name,
           sbd.confidence,
           sbd.scraped_at,
           sbd.brand_sku_id
    from public.scraped_brand_data sbd
    where sbd.brand_directory_id = p_brand_directory_id
      and sbd.brand_sku_id = p_brand_sku_id
      and sbd.superseded_by is null;
  end if;

  -- Resolve the alka**tera** org for this directory entry. If no org
  -- is linked, there's nothing to overlay.
  select bd.alkatera_org_id into v_alkatera_org_id
  from public.brand_directory bd
  where bd.id = p_brand_directory_id;
  if v_alkatera_org_id is null then return; end if;

  -- An active brand_distributor_links row gates whether the alkatera
  -- overlay flows to this distributor. We check by alkatera_org_id +
  -- distributor_org_id (the listing identity is irrelevant for the
  -- sharing relationship — sharing is brand→distributor).
  select true into v_link_active
  from public.brand_distributor_links bdl
  where bdl.alkatera_org_id = v_alkatera_org_id
    and bdl.distributor_org_id = p_distributor_org_id
    and bdl.sharing_active = true
    and bdl.confirmed_by_brand = true
  limit 1;
  if not coalesce(v_link_active, false) then return; end if;

  return query
  select alk.field_key,
         alk.field_value,
         alk.field_value_numeric,
         'alkatera_live'::text,
         0.99::numeric,
         alk.scraped_at,
         alk.brand_sku_id
  from public.scraped_brand_data alk
  where alk.brand_directory_id = p_brand_directory_id
    and alk.source_name = 'alkatera_live'
    and alk.superseded_by is null
    and (p_brand_sku_id is null or alk.brand_sku_id is null or alk.brand_sku_id = p_brand_sku_id)
    and not exists (
      select 1
      from public.brand_sharing_preferences pref
      where pref.alkatera_org_id = v_alkatera_org_id
        and pref.field_key = alk.field_key
        and pref.sharing_enabled = false
        and (pref.distributor_org_id is null
             or pref.distributor_org_id = p_distributor_org_id)
    );
end;
$$;

grant execute on function public.get_brand_data_for_distributor(uuid, uuid, uuid) to authenticated;

-- ============================================================
-- 7. Sanity assertions — fail loudly if anything looks wrong.
-- ============================================================
do $$
declare
  v_orphan_scraped     integer;
  v_orphan_documents   integer;
  v_orphan_conflicts   integer;
  v_orphan_snapshots   integer;
begin
  select count(*) into v_orphan_scraped
    from public.scraped_brand_data where brand_directory_id is null;
  select count(*) into v_orphan_documents
    from public.brand_document_submissions where brand_directory_id is null;
  select count(*) into v_orphan_conflicts
    from public.brand_data_conflicts where brand_directory_id is null;
  select count(*) into v_orphan_snapshots
    from public.brand_completeness_snapshots where brand_directory_id is null;
  if v_orphan_scraped + v_orphan_documents + v_orphan_conflicts + v_orphan_snapshots > 0 then
    raise exception
      'phase3_sanity_failed: scraped=%, docs=%, conflicts=%, snapshots=%',
      v_orphan_scraped, v_orphan_documents, v_orphan_conflicts, v_orphan_snapshots;
  end if;
end $$;

commit;
