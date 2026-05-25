-- ============================================================
-- MERGE BRAND DIRECTORY DUPES (admin)
-- ============================================================
-- Existing duplicate directory rows (e.g. "Two Drifters Rum" and
-- "Two Drifters Distillery", or yesterday's pre-normaliser-fix Warner's
-- pending row vs the alka**tera**-linked Warners Distillery Ltd row)
-- can't be auto-removed by the matcher alone — the matcher prevents
-- future dupes but the existing pair sits there cluttering the review
-- queue and confusing the data merger.
--
-- This SQL function folds a `dupe_id` into a `canonical_id` by moving
-- every FK reference and deleting the dupe row. Called by the admin
-- "Fold duplicate in" button on the brand-detail page.
--
-- Tables handled (in order of dependency):
--   1. brand_profiles            -- unique(distributor_org_id, brand_directory_id),
--                                   collisions: keep canonical, drop dupe
--   2. product_directory         -- partial unique on gtin,
--                                   collisions: keep canonical, drop dupe
--   3. scraped_brand_data        -- straight move
--   4. brand_document_submissions -- straight move
--   5. brand_data_conflicts      -- straight move
--   6. brand_completeness_snapshots -- straight move
--   7. scraping_jobs             -- straight move
--   8. directory_brand_views     -- straight move (telemetry)
--   9. directory_contacts        -- straight move (telemetry)
--
-- brand_sharing_preferences keys on alkatera_org_id (not directory id),
-- so it's untouched. alkatera_realtime_sync uses ON DELETE SET NULL so
-- the row's reference clears automatically on dupe delete.
--
-- The dupe's name is captured into the canonical row's `aliases` array
-- before deletion so future lookups by the dupe's spelling still
-- resolve.
--
-- Guards:
--   - canonical_id != dupe_id
--   - both rows must exist
--   - refuse if both rows are alka**tera**-linked to DIFFERENT orgs
--     (legitimately distinct customers — admin must clean up by hand)
-- ============================================================

begin;

create or replace function public.merge_brand_directory_dupe(
  p_canonical_id uuid,
  p_dupe_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_canonical_name        text;
  v_canonical_org         uuid;
  v_canonical_aliases     text[];
  v_dupe_name             text;
  v_dupe_org              uuid;
  v_dupe_aliases          text[];
begin
  if p_canonical_id = p_dupe_id then
    raise exception 'merge_dupe: canonical and dupe must differ';
  end if;

  select name, alkatera_org_id, aliases
    into v_canonical_name, v_canonical_org, v_canonical_aliases
  from public.brand_directory where id = p_canonical_id;
  if not found then
    raise exception 'merge_dupe: canonical % not found', p_canonical_id;
  end if;

  select name, alkatera_org_id, aliases
    into v_dupe_name, v_dupe_org, v_dupe_aliases
  from public.brand_directory where id = p_dupe_id;
  if not found then
    raise exception 'merge_dupe: dupe % not found', p_dupe_id;
  end if;

  -- Refuse if both rows belong to distinct alka**tera** customers —
  -- they're genuinely different brands, not duplicates.
  if v_canonical_org is not null and v_dupe_org is not null
     and v_canonical_org <> v_dupe_org then
    raise exception 'merge_dupe: both rows are alkatera-linked to different orgs (% vs %)',
      v_canonical_org, v_dupe_org;
  end if;

  -- 1. brand_profiles: handle the Phase 4 unique(distributor, directory)
  --    constraint by deleting the dupe's listing where the canonical
  --    already has one in the same distributor.
  delete from public.brand_profiles bp_dupe
  where bp_dupe.brand_directory_id = p_dupe_id
    and exists (
      select 1 from public.brand_profiles bp_canon
      where bp_canon.brand_directory_id = p_canonical_id
        and bp_canon.distributor_org_id = bp_dupe.distributor_org_id
    );
  update public.brand_profiles
    set brand_directory_id = p_canonical_id, updated_at = now()
    where brand_directory_id = p_dupe_id;

  -- 2. product_directory: GTIN collisions delete the dupe's product;
  --    everything else moves.
  delete from public.product_directory pd_dupe
  where pd_dupe.brand_directory_id = p_dupe_id
    and pd_dupe.gtin is not null
    and exists (
      select 1 from public.product_directory pd_canon
      where pd_canon.brand_directory_id = p_canonical_id
        and pd_canon.gtin = pd_dupe.gtin
    );
  update public.product_directory
    set brand_directory_id = p_canonical_id, updated_at = now()
    where brand_directory_id = p_dupe_id;

  -- 3. scraped_brand_data: just move. The data-merger picks the
  --    active row per field after the move; alka**tera**-source rows
  --    still win via the existing precedence.
  update public.scraped_brand_data
    set brand_directory_id = p_canonical_id
    where brand_directory_id = p_dupe_id;

  -- 4. brand_document_submissions
  update public.brand_document_submissions
    set brand_directory_id = p_canonical_id
    where brand_directory_id = p_dupe_id;

  -- 5. brand_data_conflicts
  update public.brand_data_conflicts
    set brand_directory_id = p_canonical_id
    where brand_directory_id = p_dupe_id;

  -- 6. brand_completeness_snapshots
  update public.brand_completeness_snapshots
    set brand_directory_id = p_canonical_id
    where brand_directory_id = p_dupe_id;

  -- 7. scraping_jobs (admin-intake + future variants)
  update public.scraping_jobs
    set brand_directory_id = p_canonical_id
    where brand_directory_id = p_dupe_id;

  -- 8-9. Telemetry tables — also keyed on brand_directory_id.
  update public.directory_brand_views
    set brand_directory_id = p_canonical_id
    where brand_directory_id = p_dupe_id;
  update public.directory_contacts
    set brand_directory_id = p_canonical_id
    where brand_directory_id = p_dupe_id;

  -- 10. Capture the dupe's name + aliases on the canonical row so
  --     legacy spellings still resolve. Case-insensitive dedup.
  declare
    v_new_aliases text[] := coalesce(v_canonical_aliases, array[]::text[]);
    v_existing_lower text[] :=
      coalesce(
        array(
          select lower(unnest(v_canonical_aliases))
        ),
        array[]::text[]
      );
    v_candidate text;
  begin
    -- Dupe's primary name
    if v_dupe_name is not null
       and lower(v_dupe_name) <> lower(v_canonical_name)
       and not (lower(v_dupe_name) = any(v_existing_lower))
    then
      v_new_aliases := v_new_aliases || array[v_dupe_name];
      v_existing_lower := v_existing_lower || array[lower(v_dupe_name)];
    end if;
    -- Dupe's existing aliases
    if v_dupe_aliases is not null then
      foreach v_candidate in array v_dupe_aliases loop
        if lower(v_candidate) <> lower(v_canonical_name)
           and not (lower(v_candidate) = any(v_existing_lower))
        then
          v_new_aliases := v_new_aliases || array[v_candidate];
          v_existing_lower := v_existing_lower || array[lower(v_candidate)];
        end if;
      end loop;
    end if;
    if array_length(v_new_aliases, 1) is distinct from
       array_length(coalesce(v_canonical_aliases, array[]::text[]), 1) then
      update public.brand_directory
        set aliases = v_new_aliases, updated_at = now()
        where id = p_canonical_id;
    end if;
  end;

  -- 11. Delete the dupe row. Anything still pointing at it with
  --     ON DELETE CASCADE / SET NULL handles itself.
  delete from public.brand_directory where id = p_dupe_id;
end;
$$;

grant execute on function public.merge_brand_directory_dupe(uuid, uuid) to service_role;

commit;
