/*
  # Recalculate Aggregated Nature Impacts in Product Carbon Footprints

  The previous migration (20260111080300) referenced old table names (product_lcas).
  This migration uses the correct current table names (product_carbon_footprints).

  Updates the aggregated_impacts JSONB field with summed nature impact values
  from the materials in each completed PEI assessment.
*/

-- Recalculate aggregated_impacts for all completed PEIs
UPDATE product_carbon_footprints pcf
SET aggregated_impacts = COALESCE(pcf.aggregated_impacts, '{}'::jsonb) ||
  jsonb_build_object(
    'terrestrial_ecotoxicity', (
      SELECT COALESCE(SUM(impact_terrestrial_ecotoxicity), 0)
      FROM product_carbon_footprint_materials
      WHERE product_carbon_footprint_id = pcf.id
    ),
    'freshwater_eutrophication', (
      SELECT COALESCE(SUM(impact_freshwater_eutrophication), 0)
      FROM product_carbon_footprint_materials
      WHERE product_carbon_footprint_id = pcf.id
    ),
    'terrestrial_acidification', (
      SELECT COALESCE(SUM(impact_terrestrial_acidification), 0)
      FROM product_carbon_footprint_materials
      WHERE product_carbon_footprint_id = pcf.id
    )
  )
WHERE pcf.status = 'completed'
  AND EXISTS (
    SELECT 1 FROM product_carbon_footprint_materials
    WHERE product_carbon_footprint_id = pcf.id
  );

-- Add a comment explaining this fix
COMMENT ON TABLE product_carbon_footprints IS 'Product Environmental Impact (PEI) assessments with aggregated nature impacts (ecotoxicity, eutrophication, acidification)';
