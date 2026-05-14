-- ============================================================
-- CANONICAL BRAND DIRECTORY — PHASE 4
-- Within-org dedup + drop legacy mirror columns
-- ============================================================
-- Phase 3 made brand_directory the canonical brand identity. But
-- brand_profiles (the per-distributor listing table) can today contain
-- DUPLICATE listings within a single distributor org for the same
-- canonical brand:
--
--   - The SKU-upload upsert keys on (distributor_org_id, normalized_name).
--   - The directory matcher then collapses different normalized names
--     onto one canonical entry via fuzzy match (similarity >= 0.85).
--   - So uploading "Avallen Spirits Inc" then "Avallen Spirits Ltd" into
--     one distributor org produces two brand_profiles rows pointing at
--     the same brand_directory_id — the distributor sees the same brand
--     twice in their portfolio.
--
-- This migration:
--   1. Defensively backfills brand_directory scores for any entries
--      Phase 3 left NULL (so dropping the brand_profiles mirror columns
--      at step 10 doesn't lose anything).
--   2. Adds a 'portfolio_consolidated' notification type.
--   3. Picks a canonical brand_profile per (distributor, directory)
--      duplicate group, merges per-distributor state into the canonical,
--      re-keys every reference, deletes the loser rows, and notifies the
--      affected distributor.
--   4. Adds unique(distributor_org_id, brand_directory_id) so the matcher
--      can never recreate this state.
--   5. Drops the four legacy score-mirror columns from brand_profiles.
--   6. Asserts post-state is clean.
--
-- Re-runnable: every step uses IF EXISTS / IF NOT EXISTS / coalesce
-- guards so a partial run can be safely retried. The scratch mapping
-- table is a regular table (not TEMP) because Supabase's SQL editor
-- does not preserve temp tables between statements inside a single
-- script — TEMP tables are per-session and the editor's session model
-- doesn't span statements reliably.
-- ============================================================

begin;

-- ============================================================
-- Step 1. Defensive backfill of brand_directory scores from any
-- still-populated brand_profiles mirror. Idempotent — only fills NULLs.
-- (No-op once the mirror columns are dropped at step 10.)
-- ============================================================
do $$
declare
  v_has_mirror boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'brand_profiles'
      and column_name = 'sustainability_score'
  ) into v_has_mirror;
  if v_has_mirror then
    execute $sql$
      update public.brand_directory bd
      set sustainability_score = src.sustainability_score,
          score_tier           = src.score_tier,
          completeness_score   = src.completeness_score,
          score_updated_at     = coalesce(src.score_updated_at, now())
      from (
        select distinct on (bp.brand_directory_id)
               bp.brand_directory_id,
               bp.sustainability_score,
               bp.score_tier,
               bp.completeness_score,
               bp.score_updated_at
        from public.brand_profiles bp
        where bp.sustainability_score is not null
           or bp.completeness_score is not null
        order by bp.brand_directory_id, bp.score_updated_at desc nulls last
      ) src
      where bd.id = src.brand_directory_id
        and bd.sustainability_score is null
        and bd.completeness_score is null
    $sql$;
  end if;
end $$;

-- ============================================================
-- Step 2. Notification type (idempotent)
-- ============================================================
alter table public.distributor_notifications
  drop constraint if exists distributor_notifications_notification_type_check;
alter table public.distributor_notifications
  add constraint distributor_notifications_notification_type_check
  check (notification_type in (
    'brand_joined_alkatera',
    'brand_data_updated',
    'brand_tier_upgraded',
    'new_document_submitted',
    'scraping_complete',
    'conflict_detected',
    'pending_match',
    'portfolio_consolidated'
  ));

-- ============================================================
-- Step 3. Build the loser → canonical mapping in a regular scratch
-- table (NOT a TEMP table — see comment at the top).
-- ============================================================
drop table if exists public._phase4_dedup_map;
create table public._phase4_dedup_map as
with sku_counts as (
  select brand_profile_id, count(*)::int as sku_count
  from public.brand_skus
  group by brand_profile_id
),
ranked as (
  select bp.id,
         bp.distributor_org_id,
         bp.brand_directory_id,
         row_number() over (
           partition by bp.distributor_org_id, bp.brand_directory_id
           order by coalesce(sc.sku_count, 0) desc,
                    bp.first_submission_at asc nulls last,
                    bp.created_at asc
         ) as rk
  from public.brand_profiles bp
  left join sku_counts sc on sc.brand_profile_id = bp.id
),
duplicate_groups as (
  select distributor_org_id, brand_directory_id
  from public.brand_profiles
  group by distributor_org_id, brand_directory_id
  having count(*) > 1
)
select c.id            as canonical_id,
       l.id            as loser_id,
       l.distributor_org_id,
       l.brand_directory_id
from ranked l
join ranked c
  on c.distributor_org_id = l.distributor_org_id
 and c.brand_directory_id = l.brand_directory_id
 and c.rk = 1
where l.rk > 1
  and (l.distributor_org_id, l.brand_directory_id) in (
    select distributor_org_id, brand_directory_id from duplicate_groups
  );

create index on public._phase4_dedup_map (loser_id);
create index on public._phase4_dedup_map (canonical_id);

-- ============================================================
-- Step 4. Merge per-distributor state into the canonical row
-- ============================================================
with members as (
  select canonical_id, canonical_id as member_id from public._phase4_dedup_map
  union
  select canonical_id, loser_id      as member_id from public._phase4_dedup_map
),
merged as (
  select m.canonical_id,
         max(bp.alkatera_tier)                                                      as merged_tier,
         (array_agg(bp.outreach_email) filter (where bp.outreach_email is not null))[1]
                                                                                    as any_outreach_email,
         min(bp.outreach_sent_at)                                                   as merged_outreach_sent_at,
         max(bp.outreach_last_reminder_at)                                          as merged_last_reminder_at,
         coalesce(sum(bp.outreach_reminder_count), 0)::int                          as merged_reminder_count,
         min(bp.first_submission_at)                                                as merged_first_submission_at,
         max(bp.last_submission_at)                                                 as merged_last_submission_at
  from members m
  join public.brand_profiles bp on bp.id = m.member_id
  group by m.canonical_id
)
update public.brand_profiles bp
set alkatera_tier             = greatest(bp.alkatera_tier, merged.merged_tier),
    outreach_email            = coalesce(bp.outreach_email, merged.any_outreach_email),
    outreach_sent_at          = coalesce(bp.outreach_sent_at, merged.merged_outreach_sent_at),
    outreach_last_reminder_at = coalesce(bp.outreach_last_reminder_at, merged.merged_last_reminder_at),
    outreach_reminder_count   = merged.merged_reminder_count,
    first_submission_at       = coalesce(bp.first_submission_at, merged.merged_first_submission_at),
    last_submission_at        = case
                                  when bp.last_submission_at is null then merged.merged_last_submission_at
                                  when merged.merged_last_submission_at is null then bp.last_submission_at
                                  else greatest(bp.last_submission_at, merged.merged_last_submission_at)
                                end,
    updated_at                = now()
from merged
where bp.id = merged.canonical_id;

-- ============================================================
-- Step 5. Re-key everything that references the loser brand_profile_id.
-- ============================================================
update public.brand_skus bs
set brand_profile_id = m.canonical_id
from public._phase4_dedup_map m
where bs.brand_profile_id = m.loser_id;

update public.scraping_jobs sj
set brand_profile_id = m.canonical_id
from public._phase4_dedup_map m
where sj.brand_profile_id = m.loser_id;

update public.outreach_emails oe
set brand_profile_id = m.canonical_id
from public._phase4_dedup_map m
where oe.brand_profile_id = m.loser_id;

update public.outreach_reminder_schedules ors
set brand_profile_id = m.canonical_id
from public._phase4_dedup_map m
where ors.brand_profile_id = m.loser_id;

update public.document_processing_jobs dpj
set brand_profile_id = m.canonical_id
from public._phase4_dedup_map m
where dpj.brand_profile_id = m.loser_id;

update public.distributor_notifications dn
set brand_profile_id = m.canonical_id
from public._phase4_dedup_map m
where dn.brand_profile_id = m.loser_id;

-- ============================================================
-- Step 6. brand_distributor_links special case (unique constraint
-- handling — keep the better of (canonical link, loser link) when
-- both point at the same alkatera org).
-- ============================================================
delete from public.brand_distributor_links bdl
using public._phase4_dedup_map m,
      public.brand_distributor_links keep
where bdl.brand_profile_id = m.loser_id
  and keep.brand_profile_id = m.canonical_id
  and keep.alkatera_org_id = bdl.alkatera_org_id
  and (
    keep.confirmed_by_brand and not bdl.confirmed_by_brand
    or (keep.confirmed_by_brand = bdl.confirmed_by_brand
        and coalesce(keep.confirmed_at, keep.created_at) <= coalesce(bdl.confirmed_at, bdl.created_at))
  );

delete from public.brand_distributor_links bdl
using public._phase4_dedup_map m,
      public.brand_distributor_links other
where bdl.brand_profile_id = m.canonical_id
  and other.brand_profile_id = m.loser_id
  and other.alkatera_org_id = bdl.alkatera_org_id;

update public.brand_distributor_links bdl
set brand_profile_id = m.canonical_id
from public._phase4_dedup_map m
where bdl.brand_profile_id = m.loser_id;

-- ============================================================
-- Step 7. Insert one notification per affected distributor org
-- ============================================================
insert into public.distributor_notifications (
  distributor_org_id, brand_profile_id, notification_type, title, body, link_url
)
select
  agg.distributor_org_id,
  null::uuid,
  'portfolio_consolidated',
  case
    when agg.merged_count = 1 then '1 duplicate brand listing consolidated'
    else (agg.merged_count::text || ' duplicate brand listings consolidated')
  end,
  case
    when agg.merged_count <= 3 then
      'We merged duplicate listings of ' || array_to_string(agg.example_names, ', ') ||
      '. Your portfolio now shows one entry per brand.'
    else
      'We merged duplicate listings of ' || array_to_string(agg.example_names, ', ') ||
      ' and ' || (agg.merged_count - 3)::text || ' more. Your portfolio now shows one entry per brand.'
  end,
  '/distributor/brands'
from (
  select m.distributor_org_id,
         count(*)::int as merged_count,
         (array_agg(distinct bd.name order by bd.name))[1:3] as example_names
  from public._phase4_dedup_map m
  join public.brand_directory bd on bd.id = m.brand_directory_id
  group by m.distributor_org_id
) agg;

-- ============================================================
-- Step 8. Delete the loser brand_profiles rows
-- ============================================================
delete from public.brand_profiles bp
using public._phase4_dedup_map m
where bp.id = m.loser_id;

-- Scratch table no longer needed.
drop table public._phase4_dedup_map;

-- ============================================================
-- Step 9. Add the unique constraint so duplicates can never recur
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'brand_profiles_distributor_directory_uq'
  ) then
    alter table public.brand_profiles
      add constraint brand_profiles_distributor_directory_uq
      unique (distributor_org_id, brand_directory_id);
  end if;
end $$;

-- ============================================================
-- Step 10. Drop the legacy score-mirror columns (idempotent)
-- ============================================================
alter table public.brand_profiles
  drop column if exists completeness_score,
  drop column if exists sustainability_score,
  drop column if exists score_tier,
  drop column if exists score_updated_at;

-- ============================================================
-- Step 11. Sanity assertion
-- ============================================================
do $$
declare
  v_remaining_dupes integer;
  v_orphan_skus     integer;
begin
  select count(*) into v_remaining_dupes
  from (
    select 1
    from public.brand_profiles
    group by distributor_org_id, brand_directory_id
    having count(*) > 1
  ) g;
  if v_remaining_dupes > 0 then
    raise exception 'phase4_aborted: % (distributor_org_id, brand_directory_id) groups still have duplicate listings', v_remaining_dupes;
  end if;

  select count(*) into v_orphan_skus
  from public.brand_skus bs
  left join public.brand_profiles bp on bp.id = bs.brand_profile_id
  where bp.id is null;
  if v_orphan_skus > 0 then
    raise exception 'phase4_aborted: % brand_skus rows orphaned by dedup', v_orphan_skus;
  end if;
end $$;

commit;
