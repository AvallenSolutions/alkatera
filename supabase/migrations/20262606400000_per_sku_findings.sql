-- ============================================================
-- PHASE 7: per-SKU finding attribution
-- ============================================================
-- Until now every finding lived at the brand level — scraped_brand_data
-- rows pointed only at a brand_profile_id. That's correct for things
-- like "is this brand B Corp certified?", but useless for fields that
-- legitimately differ between SKUs of the same brand: carbon intensity,
-- packaging material, vintage year, country of origin (for wines from
-- multi-country producers), etc.
--
-- This migration adds two attribution fields:
--
--   * scraped_brand_data.brand_sku_id (nullable)
--       Null  → finding applies to the whole brand. Existing rows
--               continue to behave exactly as before.
--       Set   → finding applies only to that specific SKU.
--
--   * brand_document_submissions.brand_sku_ids (uuid[], default empty)
--       When the brand uploader tags a document with one or more SKUs,
--       the Phase 4 document processor writes findings against each of
--       those SKUs (one row per SKU per field). Empty array =
--       "applies to the whole brand" (the existing behaviour).
--
-- Why an array on submissions but a single column on findings?
-- A single LCA PDF can apply to multiple SKUs ("our 2018 + 2019
-- vintages"), so the submission stores the set. The processor fans
-- out one finding row per SKU so each (brand, sku, field) tuple has
-- its own audit trail and supersede chain.
-- ============================================================

begin;

alter table public.scraped_brand_data
  add column if not exists brand_sku_id uuid references public.brand_skus(id) on delete cascade;

create index if not exists scraped_brand_data_sku_idx
  on public.scraped_brand_data (brand_sku_id)
  where brand_sku_id is not null;

-- Active-finding index for SKU-scoped queries. Pairs with the existing
-- (brand_profile_id, field_key) WHERE superseded_by IS NULL index.
create index if not exists scraped_brand_data_sku_field_active_idx
  on public.scraped_brand_data (brand_sku_id, field_key)
  where superseded_by is null and brand_sku_id is not null;

alter table public.brand_document_submissions
  add column if not exists brand_sku_ids uuid[] not null default '{}';

-- Helpful index for "find all submissions that touch SKU X".
create index if not exists brand_document_submissions_sku_ids_idx
  on public.brand_document_submissions using gin (brand_sku_ids);

-- ============================================================
-- Update the get_brand_data_for_distributor RPC so it accepts an
-- optional SKU filter. When p_brand_sku_id is null the function behaves
-- exactly as before (returns brand-level findings + alkatera_live
-- overlay). When set, it ALSO returns SKU-specific findings for that
-- SKU — letting the per-SKU detail page render "inherited from brand"
-- + "specific to this product" sections from one call.
-- ============================================================
create or replace function public.get_brand_data_for_distributor(
  p_brand_profile_id uuid,
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
as $$
declare
  v_link record;
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
  where sbd.brand_profile_id = p_brand_profile_id
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
    where sbd.brand_profile_id = p_brand_profile_id
      and sbd.brand_sku_id = p_brand_sku_id
      and sbd.superseded_by is null;
  end if;

  -- alkatera-live overlay (Phase 6) — unchanged.
  select bdl.* into v_link
  from public.brand_distributor_links bdl
  where bdl.brand_profile_id = p_brand_profile_id
    and bdl.distributor_org_id = p_distributor_org_id
    and bdl.sharing_active = true
    and bdl.confirmed_by_brand = true
  limit 1;
  if v_link.id is null then return; end if;

  return query
  select alk.field_key,
         alk.field_value,
         alk.field_value_numeric,
         'alkatera_live'::text,
         0.99::numeric,
         alk.scraped_at,
         alk.brand_sku_id
  from public.scraped_brand_data alk
  where alk.brand_profile_id = p_brand_profile_id
    and alk.source_name = 'alkatera_live'
    and alk.superseded_by is null
    and (p_brand_sku_id is null or alk.brand_sku_id is null or alk.brand_sku_id = p_brand_sku_id)
    and not exists (
      select 1
      from public.brand_sharing_preferences pref
      where pref.alkatera_org_id = v_link.alkatera_org_id
        and pref.field_key = alk.field_key
        and pref.sharing_enabled = false
        and (pref.distributor_org_id is null
             or pref.distributor_org_id = p_distributor_org_id)
    );
end;
$$;

grant execute on function public.get_brand_data_for_distributor(uuid, uuid, uuid) to authenticated;

commit;
