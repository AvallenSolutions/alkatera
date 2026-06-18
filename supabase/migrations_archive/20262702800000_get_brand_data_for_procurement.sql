-- ============================================================
-- get_brand_data_for_procurement
-- ============================================================
-- Procurement-aware read of brand sustainability findings, mirroring
-- get_brand_data_for_distributor but scoped to a procurement org. It:
--   * gates access via procurement_has_access_to_brand (the brand must be
--     listed by one of the procurement org's active linked distributors),
--   * returns brand-level findings (brand_sku_id is null),
--   * honours brand_sharing_preferences opt-outs: a brand-authored field
--     (brand_verified / alkatera_live) is hidden if the brand blocked it
--     globally (distributor_org_id is null) OR for any distributor the
--     procurement org sources it through.
--
-- The alkatera_live overlay flows on the strength of the brand being
-- listed by a linked distributor (brand_profiles linkage), NOT on
-- brand_distributor_links, because the procurement tier aggregates across
-- distributor tenants. Confidence-floor gating
-- (procurement_visibility_threshold) stays in app code, as today.
-- ============================================================

create or replace function public.get_brand_data_for_procurement(
  p_procurement_org_id uuid,
  p_brand_directory_id uuid
)
returns table(
  field_key text,
  field_value text,
  field_value_numeric numeric,
  source text,
  confidence numeric,
  scraped_at timestamptz
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.procurement_has_access_to_brand(p_procurement_org_id, p_brand_directory_id) then
    return;
  end if;

  return query
  select sbd.field_key,
         sbd.field_value,
         sbd.field_value_numeric,
         sbd.source_name,
         sbd.confidence,
         sbd.scraped_at
  from public.scraped_brand_data sbd
  where sbd.brand_directory_id = p_brand_directory_id
    and sbd.superseded_by is null
    and sbd.brand_sku_id is null
    and (
      -- Non brand-authored sources (web scrapes, brand uploads) are not
      -- subject to brand-side sharing opt-outs.
      sbd.source_name not in ('brand_verified', 'alkatera_live')
      or not exists (
        select 1
        from public.brand_directory bd
        join public.brand_sharing_preferences pref
          on pref.alkatera_org_id = bd.alkatera_org_id
        where bd.id = p_brand_directory_id
          and bd.alkatera_org_id is not null
          and (
            pref.distributor_org_id is null
            or pref.distributor_org_id in (
              select pdl.distributor_org_id
              from public.procurement_distributor_links pdl
              where pdl.procurement_org_id = p_procurement_org_id
                and pdl.status = 'active'
            )
          )
          and (
            pref.block_all_fields = true
            or (pref.field_key = sbd.field_key and pref.sharing_enabled = false)
          )
      )
    );
end;
$$;

revoke all on function public.get_brand_data_for_procurement(uuid, uuid) from public;
grant execute on function public.get_brand_data_for_procurement(uuid, uuid) to authenticated;
