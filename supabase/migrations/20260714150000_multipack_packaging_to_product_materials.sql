-- Unify multipack packaging onto product_materials.
--
-- Multipacks used to store their transit/grouping packaging in the parallel
-- multipack_secondary_packaging table, which had no packaging_category, no
-- units_per_group and no EPR fields. That made it invisible to the Specification
-- tab, the LCA calculator and EPR reporting. We now store a multipack's own
-- packaging as ordinary product_materials packaging rows on the multipack
-- product, exactly like a single SKU.
--
-- This migration copies any existing multipack_secondary_packaging rows into
-- product_materials. Mapping mirrors buildPackagingMaterialData / the create
-- flow:
--   material_type            -> 'packaging'
--   packaging_category       -> 'shipment' (the DTC default; the old table had
--                               no role, and a multipack's own packaging is
--                               transit/grouping — shipment is the safe default,
--                               editable afterwards in the packaging editor)
--   weight_grams             -> quantity (unit 'g') AND net_weight_g
--   recycled_content_percentage carried across
--   is_recyclable            -> recyclability_percent (100 or 0)
--   units_per_group          -> 1 (one pack per multipack unit)
--   epr_packaging_level      -> 'shipment' (deterministic from the category)
--
-- Idempotent: skips a secondary-packaging row if a matching packaging row
-- (same product + material_name) already exists, so re-running is safe. The old
-- table is intentionally left in place (deprecated, no longer written or read).

INSERT INTO product_materials (
  product_id,
  material_name,
  material_type,
  packaging_category,
  quantity,
  unit,
  net_weight_g,
  recycled_content_percentage,
  recyclability_percent,
  units_per_group,
  epr_packaging_level,
  has_component_breakdown,
  epr_is_household,
  epr_is_drinks_container
)
SELECT
  msp.multipack_product_id,
  msp.material_name,
  'packaging',
  'shipment',
  msp.weight_grams,
  'g',
  msp.weight_grams,
  msp.recycled_content_percentage,
  CASE WHEN COALESCE(msp.is_recyclable, true) THEN 100 ELSE 0 END,
  1,
  'shipment',
  false,
  true,
  false
FROM multipack_secondary_packaging msp
WHERE NOT EXISTS (
  SELECT 1 FROM product_materials pm
  WHERE pm.product_id = msp.multipack_product_id
    AND pm.material_type = 'packaging'
    AND pm.material_name = msp.material_name
);
