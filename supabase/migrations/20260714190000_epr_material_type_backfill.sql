-- Backfill epr_material_type on existing packaging rows.
--
-- Only bulk-import ever set this column, so normally-created rows sat at NULL
-- and were billed at the 'other' RPD fee rate. Going forward the shared
-- packaging builder (deriveEprMaterialType) sets it on every save; this fills
-- the historical rows with a SQL approximation of the same material inference
-- (container_material > name/factor keywords). Rows it cannot classify are
-- left NULL so the EPR completeness checker still flags them for the user.
--
-- Safe to re-run: only touches packaging rows whose epr_material_type is NULL.

update public.product_materials pm
set epr_material_type = sub.mat
from (
  select id,
    case
      when hay ~* '\y(glass|flint|cullet)\y' then 'glass'
      when hay ~* '\y(aluminium|aluminum|alu|ropp)\y' then 'aluminium'
      -- generic "can" (after tin-can) is aluminium for drinks
      when hay ~* '\ytin[ -]?can\y' then 'steel'
      when hay ~* '\ycans?\y' then 'aluminium'
      when hay ~* '\ysteel\y' or hay ~* '\y(crown[ -]?cap|metal[ -]?cap)\y' then 'steel'
      when hay ~* '\y(hdpe|pet|pp|polypropylene|plastic|shrink[ -]?wrap|stretch[ -]?wrap|poly[ -]?film|plastic[ -]?film)\y'
           and hay !~* '\ypet[ -]?nat\y' then 'plastic_rigid'
      when hay ~* '\y(cardboard|carton|corrugated|paper|label|trade[ -]?case|shipper|outer[ -]?case|case|box)\y' then 'paper_cardboard'
      when hay ~* '\y(wood|timber|oak|pallet)\y' then 'wood'
      else null
    end as mat
  from (
    select id,
      concat_ws(' ',
        coalesce(container_material, ''),
        coalesce(material_name, ''),
        coalesce(matched_source_name, ''),
        coalesce(packaging_category, '')
      ) as hay
    from public.product_materials
    where lower(coalesce(material_type, '')) in ('packaging', 'packaging_material')
      and epr_material_type is null
  ) h
) sub
where pm.id = sub.id
  and sub.mat is not null;
