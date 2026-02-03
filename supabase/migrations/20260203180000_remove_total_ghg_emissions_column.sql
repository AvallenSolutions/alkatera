-- Migration: Remove deprecated total_ghg_emissions column
-- This column stored redundant data that is now stored exclusively in
-- aggregated_impacts.climate_change_gwp100 (the single source of truth)
--
-- CONTEXT:
-- The total_ghg_emissions column and aggregated_impacts.climate_change_gwp100
-- both stored the same carbon footprint value. This redundancy caused stale data
-- issues where Rosa AI would read incorrect values from total_ghg_emissions
-- while the UI correctly displayed aggregated_impacts.climate_change_gwp100.
--
-- All code has been updated to read/write only to aggregated_impacts.
-- This migration removes the deprecated column to prevent future confusion.

-- Step 1: Drop any indexes that reference the column
DROP INDEX IF EXISTS idx_product_lcas_org_ghg;

-- Step 2: Drop the deprecated columns
-- Note: We also drop the related sub-columns that were part of the same redundant pattern
ALTER TABLE product_carbon_footprints
  DROP COLUMN IF EXISTS total_ghg_emissions,
  DROP COLUMN IF EXISTS total_ghg_emissions_fossil,
  DROP COLUMN IF EXISTS total_ghg_emissions_biogenic,
  DROP COLUMN IF EXISTS total_ghg_emissions_dluc;

-- Step 3: Add a comment to aggregated_impacts clarifying it's the single source of truth
COMMENT ON COLUMN product_carbon_footprints.aggregated_impacts IS
  'SINGLE SOURCE OF TRUTH for all product impact metrics. Contains climate_change_gwp100 (kg CO2e per functional unit), water metrics, and scope breakdowns. This field replaces the deprecated total_ghg_emissions column.';

-- Step 4: Create a new index for querying by carbon footprint if needed
-- This uses a functional index to extract the value from JSONB
CREATE INDEX IF NOT EXISTS idx_product_lcas_org_climate_impact
  ON product_carbon_footprints (organization_id, ((aggregated_impacts->>'climate_change_gwp100')::numeric))
  WHERE status = 'completed';
