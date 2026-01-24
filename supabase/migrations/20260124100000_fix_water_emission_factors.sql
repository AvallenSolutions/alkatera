/*
  # Fix Water Emission Factors

  ## Problem
  The water_factor for water-based ingredients (Process Water, Brewing Water, etc.)
  was incorrectly set to 1.0 m³ per litre, meaning 1 litre of tap water was calculated
  as consuming 1000 litres (1 m³) of water. This caused water footprint calculations
  to be approximately 1000x higher than they should be.

  ## Fix
  - Change water_factor from 1.0 m³/L to 0.0011 m³/L (1.1 litres including ~10% treatment losses)
  - This correctly represents that 1 litre of tap water delivered = 1.1 litres consumed

  ## Impact
  - Water footprint values will decrease by approximately 1000x for products containing water ingredients
  - This affects: Process Water, Brewing Water, Municipal Water, Tap Water

  ## Data Sources
  - Direct water consumption: 1 litre consumed per litre delivered
  - Treatment/distribution losses: ~10% overhead (conservative estimate from water utility data)
  - Total: 0.0011 m³ per litre (1.1 litres per litre delivered)
*/

-- Fix global staging factors (no organization_id filter)
UPDATE staging_emission_factors
SET water_factor = 0.0011
WHERE name IN (
  'Water (Municipal Treatment)',
  'Tap Water',
  'Municipal Water'
)
AND water_factor >= 0.9
AND water_factor <= 1.1;

-- Fix organization-specific staging factors (test org and any others)
UPDATE staging_emission_factors
SET water_factor = 0.0011
WHERE name IN (
  'Process Water',
  'Brewing Water'
)
AND water_factor >= 0.9
AND water_factor <= 1.1;

-- Log the changes
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_updated_count
  FROM staging_emission_factors
  WHERE name IN ('Water (Municipal Treatment)', 'Tap Water', 'Municipal Water', 'Process Water', 'Brewing Water')
  AND water_factor = 0.0011;

  RAISE NOTICE 'Water factor fix applied to % staging factors', v_updated_count;
  RAISE NOTICE 'Water-based ingredients now use 0.0011 m³/L instead of 1.0 m³/L';
  RAISE NOTICE 'This represents a ~909x reduction in water consumption attribution';

  IF v_updated_count = 0 THEN
    RAISE WARNING 'No factors were updated - they may have already been fixed or have different values';
  END IF;
END $$;

-- Also update any existing product_lca_materials that were calculated with the wrong factor
-- These are pre-calculated impact values that need recalculation
-- Mark affected LCAs for recalculation by setting needs_recalculation flag if it exists
DO $$
BEGIN
  -- Check if the column exists and update affected LCAs
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_carbon_footprints'
    AND column_name = 'needs_recalculation'
  ) THEN
    UPDATE product_carbon_footprints pcf
    SET needs_recalculation = true,
        updated_at = NOW()
    FROM product_carbon_footprint_materials pcfm
    WHERE pcfm.product_carbon_footprint_id = pcf.id
    AND pcfm.name IN ('Process Water', 'Brewing Water', 'Water (Municipal Treatment)', 'Tap Water', 'Municipal Water')
    AND pcfm.impact_water > pcfm.quantity * 0.01; -- impact_water seems too high (> 10L per L input)

    RAISE NOTICE 'Marked affected PEIs for recalculation';
  ELSE
    RAISE NOTICE 'needs_recalculation column does not exist - PEIs will need manual recalculation';
  END IF;
END $$;

-- Add a comment documenting the correct water_factor interpretation
COMMENT ON COLUMN staging_emission_factors.water_factor IS
'Water consumption per reference unit (m³). For water ingredients with reference_unit=L,
use 0.0011 m³/L (1.1 litres per litre delivered, including ~10% treatment losses).
DO NOT use 1.0 m³/L as this incorrectly implies 1000:1 water consumption ratio.';
