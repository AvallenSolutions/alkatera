-- ============================================================
-- CANONICAL BRAND DIRECTORY — PHASE 5
-- Brand-side per-distributor sharing controls
-- ============================================================
-- After Phase 4, every brand has one canonical brand_directory entry,
-- each distributor has at most one brand_profiles listing per brand,
-- and the data merger is keyed by directory id. The remaining piece is
-- brand-side privacy: a brand needs to be able to opt out of sharing
-- with a specific distributor.
--
-- Three gaps this migration closes:
--
--   1. brand_sharing_preferences.field_key is NOT NULL, so "block ALL
--      fields from this distributor" can't be expressed in one row.
--      Add a block_all_fields boolean and use the sentinel
--      field_key='__all__' so the existing UNIQUE constraints continue
--      to work unchanged.
--
--   2. The Phase 3 get_brand_data_for_distributor RPC gates only the
--      alkatera_live overlay by sharing preferences. brand_verified
--      rows pass through unfiltered. Phase 5 extends the gate to cover
--      brand_verified too (acceptance: "brand opts out -> distributor
--      stops seeing brand-verified data; scraped data still visible").
--
--   3. brand_profiles has no per-listing on/off switch. The master
--      plan's "Remove me from this distributor's portfolio" action
--      sets brand_profiles.listing_status = 'delisted'. Add the column
--      so the distributor portal can hide delisted entries by default.
-- ============================================================

begin;

-- ============================================================
-- Step 1. brand_profiles.listing_status
-- ============================================================
alter table public.brand_profiles
  add column if not exists listing_status text not null default 'active'
  check (listing_status in ('active', 'delisted'));

create index if not exists brand_profiles_listing_status_idx
  on public.brand_profiles (distributor_org_id, listing_status);

-- ============================================================
-- Step 2. brand_sharing_preferences.block_all_fields + check
-- ============================================================
alter table public.brand_sharing_preferences
  add column if not exists block_all_fields boolean not null default false;

-- A "blanket block" row uses the sentinel field_key='__all__' so it
-- coexists with the existing unique (alkatera_org_id, distributor_org_id,
-- field_key) and the partial unique on (alkatera_org_id, field_key)
-- where distributor_org_id is null. The check makes the convention
-- enforceable: block_all_fields=true iff field_key='__all__'.
alter table public.brand_sharing_preferences
  drop constraint if exists brand_sharing_preferences_block_all_fields_consistency;
alter table public.brand_sharing_preferences
  add constraint brand_sharing_preferences_block_all_fields_consistency
  check (
    (block_all_fields = true and field_key = '__all__')
    or (block_all_fields = false and field_key <> '__all__')
  );

-- ============================================================
-- Step 3. Re-key the RPC: gate brand_verified rows AND honour
-- block_all_fields as a wildcard.
-- ============================================================
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
  -- Phase 5: gate brand_verified rows by the brand's sharing
  -- preferences (block_all_fields wildcard OR per-field disabled).
  -- Non-brand sources (scraped, brand_upload, etc.) remain visible —
  -- only data the brand themselves authored or has authority over
  -- (brand_verified, alkatera_live) is subject to brand-side privacy.
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
    and sbd.brand_sku_id is null
    and (
      sbd.source_name <> 'brand_verified'
      or not exists (
        select 1
        from public.brand_directory bd
        join public.brand_sharing_preferences pref
          on pref.alkatera_org_id = bd.alkatera_org_id
        where bd.id = p_brand_directory_id
          and bd.alkatera_org_id is not null
          and (pref.distributor_org_id is null
               or pref.distributor_org_id = p_distributor_org_id)
          and (
            pref.block_all_fields = true
            or (pref.field_key = sbd.field_key and pref.sharing_enabled = false)
          )
      )
    );

  -- Optional SKU-specific findings when caller asked for them. Same
  -- gating rule applies.
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
      and sbd.superseded_by is null
      and (
        sbd.source_name <> 'brand_verified'
        or not exists (
          select 1
          from public.brand_directory bd
          join public.brand_sharing_preferences pref
            on pref.alkatera_org_id = bd.alkatera_org_id
          where bd.id = p_brand_directory_id
            and bd.alkatera_org_id is not null
            and (pref.distributor_org_id is null
                 or pref.distributor_org_id = p_distributor_org_id)
            and (
              pref.block_all_fields = true
              or (pref.field_key = sbd.field_key and pref.sharing_enabled = false)
            )
        )
      );
  end if;

  -- Resolve the alka**tera** org for this directory entry. If no org
  -- is linked, there's nothing to overlay.
  select bd.alkatera_org_id into v_alkatera_org_id
  from public.brand_directory bd
  where bd.id = p_brand_directory_id;
  if v_alkatera_org_id is null then return; end if;

  -- An active brand_distributor_links row gates whether the alkatera
  -- overlay flows to this distributor.
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
        and (pref.distributor_org_id is null
             or pref.distributor_org_id = p_distributor_org_id)
        and (
          pref.block_all_fields = true
          or (pref.field_key = alk.field_key and pref.sharing_enabled = false)
        )
    );
end;
$$;

grant execute on function public.get_brand_data_for_distributor(uuid, uuid, uuid) to authenticated;

-- ============================================================
-- Step 4. Sanity assertions
-- ============================================================
do $$
declare
  v_bad_block_all integer;
begin
  -- block_all_fields=true must always pair with field_key='__all__'
  -- and vice versa; the CHECK constraint enforces this, but double-
  -- check after the column was added (in case of pre-existing junk
  -- from a manual fix).
  select count(*) into v_bad_block_all
  from public.brand_sharing_preferences
  where (block_all_fields = true and field_key <> '__all__')
     or (block_all_fields = false and field_key = '__all__');
  if v_bad_block_all > 0 then
    raise exception 'phase5_aborted: % brand_sharing_preferences rows violate block_all_fields/__all__ pairing', v_bad_block_all;
  end if;
end $$;

commit;
