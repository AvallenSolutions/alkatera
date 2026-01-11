/*
  # Backfill Nature Impact Values in Product LCA Materials

  Recalculates nature impacts for all existing materials in completed LCAs
  using the newly populated factors from staging_emission_factors.

  Formula: impact = quantity × factor
*/

-- Update terrestrial ecotoxicity
UPDATE product_lca_materials plm
SET impact_terrestrial_ecotoxicity = plm.quantity * COALESCE(sef.terrestrial_ecotoxicity_factor, 0)
FROM staging_emission_factors sef
WHERE plm.name = sef.name
  AND plm.product_lca_id IN (
    SELECT id FROM product_lcas WHERE status = 'completed'
  );

-- Update freshwater eutrophication
UPDATE product_lca_materials plm
SET impact_freshwater_eutrophication = plm.quantity * COALESCE(sef.freshwater_eutrophication_factor, 0)
FROM staging_emission_factors sef
WHERE plm.name = sef.name
  AND plm.product_lca_id IN (
    SELECT id FROM product_lcas WHERE status = 'completed'
  );

-- Update terrestrial acidification
UPDATE product_lca_materials plm
SET impact_terrestrial_acidification = plm.quantity * COALESCE(sef.terrestrial_acidification_factor, 0)
FROM staging_emission_factors sef
WHERE plm.name = sef.name
  AND plm.product_lca_id IN (
    SELECT id FROM product_lcas WHERE status = 'completed'
  );
