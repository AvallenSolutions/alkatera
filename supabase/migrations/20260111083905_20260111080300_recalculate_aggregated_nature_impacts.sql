/*
  # Recalculate Aggregated Nature Impacts in Product LCAs

  Updates the aggregated_impacts JSONB field with summed nature impact values.
*/

-- Recalculate aggregated_impacts for all completed LCAs
UPDATE product_lcas pl
SET aggregated_impacts = COALESCE(pl.aggregated_impacts, '{}'::jsonb) ||
  jsonb_build_object(
    'terrestrial_ecotoxicity', (
      SELECT COALESCE(SUM(impact_terrestrial_ecotoxicity), 0)
      FROM product_lca_materials
      WHERE product_lca_id = pl.id
    ),
    'freshwater_eutrophication', (
      SELECT COALESCE(SUM(impact_freshwater_eutrophication), 0)
      FROM product_lca_materials
      WHERE product_lca_id = pl.id
    ),
    'terrestrial_acidification', (
      SELECT COALESCE(SUM(impact_terrestrial_acidification), 0)
      FROM product_lca_materials
      WHERE product_lca_id = pl.id
    )
  )
WHERE pl.status = 'completed'
  AND EXISTS (
    SELECT 1 FROM product_lca_materials
    WHERE product_lca_id = pl.id
  );
