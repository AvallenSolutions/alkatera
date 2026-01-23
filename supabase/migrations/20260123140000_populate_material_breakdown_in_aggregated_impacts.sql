/*
  # Populate material breakdown in aggregated_impacts

  Some completed PEIs have materials in product_carbon_footprint_materials but
  the aggregated_impacts.breakdown.by_material field was not populated.

  This migration populates that field for all affected PEIs so the Company
  Vitality Materials tab can display the data.
*/

-- Fix ALL completed LCAs that have materials but missing breakdown.by_material
UPDATE product_carbon_footprints pcf
SET aggregated_impacts = COALESCE(pcf.aggregated_impacts, '{}'::jsonb) ||
  jsonb_build_object(
    'breakdown', COALESCE(pcf.aggregated_impacts->'breakdown', '{}'::jsonb) ||
      jsonb_build_object(
        'by_material', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'name', m.name,
              'unit', m.unit,
              'category', COALESCE(m.packaging_category, 'ingredient'),
              'quantity', m.quantity,
              'emissions', m.impact_climate,
              'dataSource', COALESCE(m.impact_source, 'secondary_modelled')
            )
          )
          FROM product_carbon_footprint_materials m
          WHERE m.product_carbon_footprint_id = pcf.id
        )
      )
  )
WHERE pcf.status = 'completed'
  AND EXISTS (
    SELECT 1 FROM product_carbon_footprint_materials
    WHERE product_carbon_footprint_id = pcf.id
  )
  AND (
    pcf.aggregated_impacts->'breakdown'->'by_material' IS NULL
    OR jsonb_array_length(pcf.aggregated_impacts->'breakdown'->'by_material') = 0
  );
