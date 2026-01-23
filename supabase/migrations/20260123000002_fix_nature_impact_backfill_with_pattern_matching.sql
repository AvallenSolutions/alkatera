-- ============================================================================
-- FIX: Backfill nature impacts using pattern matching instead of exact match
-- ============================================================================
-- The previous backfill (20260111083837) used exact name matching which doesn't
-- work because staging_emission_factors names don't match product_lca_materials
-- names exactly. This migration uses pattern matching similar to how the
-- factors were originally populated.
-- ============================================================================

-- ================================================================
-- AGRICULTURE & CROPS
-- ================================================================

-- Apples
UPDATE product_lca_materials plm
SET
  impact_terrestrial_ecotoxicity = plm.quantity * 0.15,
  impact_freshwater_eutrophication = plm.quantity * 0.0012,
  impact_terrestrial_acidification = plm.quantity * 0.0045
WHERE plm.name ILIKE '%apple%'
  AND NOT plm.name ILIKE '%organic%'
  AND plm.product_lca_id IN (SELECT id FROM product_lcas WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- Organic apples
UPDATE product_lca_materials plm
SET
  impact_terrestrial_ecotoxicity = plm.quantity * 0.08,
  impact_freshwater_eutrophication = plm.quantity * 0.0010,
  impact_terrestrial_acidification = plm.quantity * 0.0038
WHERE plm.name ILIKE '%organic%apple%'
  AND plm.product_lca_id IN (SELECT id FROM product_lcas WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- Grapes
UPDATE product_lca_materials plm
SET
  impact_terrestrial_ecotoxicity = plm.quantity * 0.22,
  impact_freshwater_eutrophication = plm.quantity * 0.0018,
  impact_terrestrial_acidification = plm.quantity * 0.0038
WHERE plm.name ILIKE '%grape%'
  AND plm.product_lca_id IN (SELECT id FROM product_lcas WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- Barley
UPDATE product_lca_materials plm
SET
  impact_terrestrial_ecotoxicity = plm.quantity * 0.18,
  impact_freshwater_eutrophication = plm.quantity * 0.0015,
  impact_terrestrial_acidification = plm.quantity * 0.0052
WHERE plm.name ILIKE '%barley%'
  AND plm.product_lca_id IN (SELECT id FROM product_lcas WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- Malt (typically from barley)
UPDATE product_lca_materials plm
SET
  impact_terrestrial_ecotoxicity = plm.quantity * 0.18,
  impact_freshwater_eutrophication = plm.quantity * 0.0015,
  impact_terrestrial_acidification = plm.quantity * 0.0052
WHERE plm.name ILIKE '%malt%'
  AND plm.product_lca_id IN (SELECT id FROM product_lcas WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- Hops
UPDATE product_lca_materials plm
SET
  impact_terrestrial_ecotoxicity = plm.quantity * 0.45,
  impact_freshwater_eutrophication = plm.quantity * 0.0035,
  impact_terrestrial_acidification = plm.quantity * 0.0095
WHERE plm.name ILIKE '%hop%'
  AND plm.product_lca_id IN (SELECT id FROM product_lcas WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- Sugar/Sweeteners
UPDATE product_lca_materials plm
SET
  impact_terrestrial_ecotoxicity = plm.quantity * 0.12,
  impact_freshwater_eutrophication = plm.quantity * 0.0008,
  impact_terrestrial_acidification = plm.quantity * 0.0032
WHERE (plm.name ILIKE '%sugar%' OR plm.name ILIKE '%sweetener%')
  AND plm.product_lca_id IN (SELECT id FROM product_lcas WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- Yeast (fermentation)
UPDATE product_lca_materials plm
SET
  impact_terrestrial_ecotoxicity = plm.quantity * 0.08,
  impact_freshwater_eutrophication = plm.quantity * 0.0006,
  impact_terrestrial_acidification = plm.quantity * 0.0028
WHERE plm.name ILIKE '%yeast%'
  AND plm.product_lca_id IN (SELECT id FROM product_lcas WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- Wheat
UPDATE product_lca_materials plm
SET
  impact_terrestrial_ecotoxicity = plm.quantity * 0.16,
  impact_freshwater_eutrophication = plm.quantity * 0.0014,
  impact_terrestrial_acidification = plm.quantity * 0.0048
WHERE plm.name ILIKE '%wheat%'
  AND plm.product_lca_id IN (SELECT id FROM product_lcas WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- Corn/Maize
UPDATE product_lca_materials plm
SET
  impact_terrestrial_ecotoxicity = plm.quantity * 0.20,
  impact_freshwater_eutrophication = plm.quantity * 0.0016,
  impact_terrestrial_acidification = plm.quantity * 0.0055
WHERE (plm.name ILIKE '%corn%' OR plm.name ILIKE '%maize%')
  AND plm.product_lca_id IN (SELECT id FROM product_lcas WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- ================================================================
-- PACKAGING MATERIALS
-- ================================================================

-- Glass
UPDATE product_lca_materials plm
SET
  impact_terrestrial_ecotoxicity = plm.quantity * 0.012,
  impact_freshwater_eutrophication = plm.quantity * 0.00008,
  impact_terrestrial_acidification = plm.quantity * 0.0018
WHERE (plm.name ILIKE '%glass%' OR plm.name ILIKE '%bottle%')
  AND NOT plm.name ILIKE '%plastic%'
  AND plm.product_lca_id IN (SELECT id FROM product_lcas WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- Aluminium
UPDATE product_lca_materials plm
SET
  impact_terrestrial_ecotoxicity = plm.quantity * 0.025,
  impact_freshwater_eutrophication = plm.quantity * 0.00015,
  impact_terrestrial_acidification = plm.quantity * 0.0042
WHERE (plm.name ILIKE '%aluminium%' OR plm.name ILIKE '%aluminum%' OR plm.name ILIKE '%can%' OR plm.name ILIKE '%cap%')
  AND plm.product_lca_id IN (SELECT id FROM product_lcas WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- Paper & Cardboard
UPDATE product_lca_materials plm
SET
  impact_terrestrial_ecotoxicity = plm.quantity * 0.018,
  impact_freshwater_eutrophication = plm.quantity * 0.0001,
  impact_terrestrial_acidification = plm.quantity * 0.0025
WHERE (plm.name ILIKE '%paper%' OR plm.name ILIKE '%cardboard%' OR plm.name ILIKE '%label%' OR plm.name ILIKE '%carton%')
  AND plm.product_lca_id IN (SELECT id FROM product_lcas WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- Cork
UPDATE product_lca_materials plm
SET
  impact_terrestrial_ecotoxicity = plm.quantity * 0.008,
  impact_freshwater_eutrophication = plm.quantity * 0.00005,
  impact_terrestrial_acidification = plm.quantity * 0.0012
WHERE plm.name ILIKE '%cork%'
  AND plm.product_lca_id IN (SELECT id FROM product_lcas WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- Plastic/PET
UPDATE product_lca_materials plm
SET
  impact_terrestrial_ecotoxicity = plm.quantity * 0.032,
  impact_freshwater_eutrophication = plm.quantity * 0.00012,
  impact_terrestrial_acidification = plm.quantity * 0.0038
WHERE (plm.name ILIKE '%plastic%' OR plm.name ILIKE '%PET%' OR plm.name ILIKE '%polyethylene%')
  AND plm.product_lca_id IN (SELECT id FROM product_lcas WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- ================================================================
-- WATER & ENERGY
-- ================================================================

-- Process Water
UPDATE product_lca_materials plm
SET
  impact_terrestrial_ecotoxicity = plm.quantity * 0.0005,
  impact_freshwater_eutrophication = plm.quantity * 0.00001,
  impact_terrestrial_acidification = plm.quantity * 0.0002
WHERE plm.name ILIKE '%water%'
  AND NOT plm.name ILIKE '%waste%'
  AND plm.product_lca_id IN (SELECT id FROM product_lcas WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- Electricity
UPDATE product_lca_materials plm
SET
  impact_terrestrial_ecotoxicity = plm.quantity * 0.0008,
  impact_freshwater_eutrophication = plm.quantity * 0.00003,
  impact_terrestrial_acidification = plm.quantity * 0.0015
WHERE plm.name ILIKE '%electric%'
  AND plm.product_lca_id IN (SELECT id FROM product_lcas WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- Natural Gas
UPDATE product_lca_materials plm
SET
  impact_terrestrial_ecotoxicity = plm.quantity * 0.0002,
  impact_freshwater_eutrophication = plm.quantity * 0.00001,
  impact_terrestrial_acidification = plm.quantity * 0.0004
WHERE (plm.name ILIKE '%natural gas%' OR plm.name ILIKE '%gas%heating%')
  AND plm.product_lca_id IN (SELECT id FROM product_lcas WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- ================================================================
-- TRANSPORT
-- ================================================================

-- Road Transport
UPDATE product_lca_materials plm
SET
  impact_terrestrial_ecotoxicity = plm.quantity * 0.005,
  impact_freshwater_eutrophication = plm.quantity * 0.00002,
  impact_terrestrial_acidification = plm.quantity * 0.0008
WHERE (plm.name ILIKE '%transport%' OR plm.name ILIKE '%truck%' OR plm.name ILIKE '%road%')
  AND plm.product_lca_id IN (SELECT id FROM product_lcas WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- ================================================================
-- DEFAULT FALLBACK for remaining materials
-- ================================================================

-- Set minimal default values for any materials that haven't been matched
-- This ensures all materials have some nature impact value
UPDATE product_lca_materials plm
SET
  impact_terrestrial_ecotoxicity = COALESCE(plm.impact_terrestrial_ecotoxicity, plm.quantity * 0.01),
  impact_freshwater_eutrophication = COALESCE(plm.impact_freshwater_eutrophication, plm.quantity * 0.00005),
  impact_terrestrial_acidification = COALESCE(plm.impact_terrestrial_acidification, plm.quantity * 0.001)
WHERE plm.product_lca_id IN (SELECT id FROM product_lcas WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- ================================================================
-- RECALCULATE AGGREGATED IMPACTS
-- ================================================================

-- Update aggregated_impacts JSONB in product_lcas with nature impact totals
UPDATE product_lcas pl
SET aggregated_impacts = aggregated_impacts || jsonb_build_object(
  'terrestrial_ecotoxicity', (
    SELECT COALESCE(SUM(impact_terrestrial_ecotoxicity), 0)
    FROM product_lca_materials plm
    WHERE plm.product_lca_id = pl.id
  ),
  'freshwater_eutrophication', (
    SELECT COALESCE(SUM(impact_freshwater_eutrophication), 0)
    FROM product_lca_materials plm
    WHERE plm.product_lca_id = pl.id
  ),
  'terrestrial_acidification', (
    SELECT COALESCE(SUM(impact_terrestrial_acidification), 0)
    FROM product_lca_materials plm
    WHERE plm.product_lca_id = pl.id
  )
)
WHERE status = 'completed'
  AND aggregated_impacts IS NOT NULL;

-- Also update the product_carbon_footprints table if it exists (for PEI terminology)
UPDATE product_carbon_footprints pcf
SET aggregated_impacts = aggregated_impacts || jsonb_build_object(
  'terrestrial_ecotoxicity', (
    SELECT COALESCE(SUM(impact_terrestrial_ecotoxicity), 0)
    FROM product_carbon_footprint_materials pcfm
    WHERE pcfm.product_carbon_footprint_id = pcf.id
  ),
  'freshwater_eutrophication', (
    SELECT COALESCE(SUM(impact_freshwater_eutrophication), 0)
    FROM product_carbon_footprint_materials pcfm
    WHERE pcfm.product_carbon_footprint_id = pcf.id
  ),
  'terrestrial_acidification', (
    SELECT COALESCE(SUM(impact_terrestrial_acidification), 0)
    FROM product_carbon_footprint_materials pcfm
    WHERE pcfm.product_carbon_footprint_id = pcf.id
  )
)
WHERE status = 'completed'
  AND aggregated_impacts IS NOT NULL;

-- Update materials in product_carbon_footprint_materials too
-- Apples
UPDATE product_carbon_footprint_materials pcfm
SET
  impact_terrestrial_ecotoxicity = pcfm.quantity * 0.15,
  impact_freshwater_eutrophication = pcfm.quantity * 0.0012,
  impact_terrestrial_acidification = pcfm.quantity * 0.0045
WHERE pcfm.name ILIKE '%apple%'
  AND NOT pcfm.name ILIKE '%organic%'
  AND pcfm.product_carbon_footprint_id IN (SELECT id FROM product_carbon_footprints WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- Glass bottles
UPDATE product_carbon_footprint_materials pcfm
SET
  impact_terrestrial_ecotoxicity = pcfm.quantity * 0.012,
  impact_freshwater_eutrophication = pcfm.quantity * 0.00008,
  impact_terrestrial_acidification = pcfm.quantity * 0.0018
WHERE (pcfm.name ILIKE '%glass%' OR pcfm.name ILIKE '%bottle%')
  AND NOT pcfm.name ILIKE '%plastic%'
  AND pcfm.product_carbon_footprint_id IN (SELECT id FROM product_carbon_footprints WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- Labels
UPDATE product_carbon_footprint_materials pcfm
SET
  impact_terrestrial_ecotoxicity = pcfm.quantity * 0.018,
  impact_freshwater_eutrophication = pcfm.quantity * 0.0001,
  impact_terrestrial_acidification = pcfm.quantity * 0.0025
WHERE pcfm.name ILIKE '%label%'
  AND pcfm.product_carbon_footprint_id IN (SELECT id FROM product_carbon_footprints WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- Cork
UPDATE product_carbon_footprint_materials pcfm
SET
  impact_terrestrial_ecotoxicity = pcfm.quantity * 0.008,
  impact_freshwater_eutrophication = pcfm.quantity * 0.00005,
  impact_terrestrial_acidification = pcfm.quantity * 0.0012
WHERE pcfm.name ILIKE '%cork%'
  AND pcfm.product_carbon_footprint_id IN (SELECT id FROM product_carbon_footprints WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- Caps
UPDATE product_carbon_footprint_materials pcfm
SET
  impact_terrestrial_ecotoxicity = pcfm.quantity * 0.025,
  impact_freshwater_eutrophication = pcfm.quantity * 0.00015,
  impact_terrestrial_acidification = pcfm.quantity * 0.0042
WHERE pcfm.name ILIKE '%cap%'
  AND pcfm.product_carbon_footprint_id IN (SELECT id FROM product_carbon_footprints WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- Transport
UPDATE product_carbon_footprint_materials pcfm
SET
  impact_terrestrial_ecotoxicity = pcfm.quantity * 0.005,
  impact_freshwater_eutrophication = pcfm.quantity * 0.00002,
  impact_terrestrial_acidification = pcfm.quantity * 0.0008
WHERE pcfm.name ILIKE '%transport%'
  AND pcfm.product_carbon_footprint_id IN (SELECT id FROM product_carbon_footprints WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);

-- Default fallback for product_carbon_footprint_materials
UPDATE product_carbon_footprint_materials pcfm
SET
  impact_terrestrial_ecotoxicity = COALESCE(pcfm.impact_terrestrial_ecotoxicity, pcfm.quantity * 0.01),
  impact_freshwater_eutrophication = COALESCE(pcfm.impact_freshwater_eutrophication, pcfm.quantity * 0.00005),
  impact_terrestrial_acidification = COALESCE(pcfm.impact_terrestrial_acidification, pcfm.quantity * 0.001)
WHERE pcfm.product_carbon_footprint_id IN (SELECT id FROM product_carbon_footprints WHERE status = 'completed')
  AND (impact_terrestrial_ecotoxicity IS NULL OR impact_terrestrial_ecotoxicity = 0);
