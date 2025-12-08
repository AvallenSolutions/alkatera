/*
  # Add Missing Impact Columns to product_lca_materials

  1. Purpose
     - Add missing environmental impact indicator columns
     - Enable comprehensive LCA calculations aligned with ReCiPe 2016 methodology
     - Support ISO 14044 compliant impact assessments

  2. New Columns
     - impact_water_scarcity: Water scarcity footprint (m³ world eq.)
     - impact_terrestrial_ecotoxicity: Terrestrial ecotoxicity potential (kg 1,4-DCB)
     - impact_freshwater_eutrophication: Freshwater eutrophication potential (kg P eq.)
     - impact_terrestrial_acidification: Terrestrial acidification potential (kg SO₂ eq.)
     - impact_fossil_resource_scarcity: Fossil resource scarcity (kg oil eq.)

  3. Changes
     - All columns are numeric and nullable
     - Default value is NULL (not 0) to distinguish between no data and zero impact
*/

-- Add water scarcity impact indicator
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'impact_water_scarcity'
  ) THEN
    ALTER TABLE product_lca_materials 
    ADD COLUMN impact_water_scarcity NUMERIC DEFAULT NULL;
    RAISE NOTICE 'Added column: impact_water_scarcity';
  END IF;
END $$;

-- Add terrestrial ecotoxicity impact indicator
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'impact_terrestrial_ecotoxicity'
  ) THEN
    ALTER TABLE product_lca_materials 
    ADD COLUMN impact_terrestrial_ecotoxicity NUMERIC DEFAULT NULL;
    RAISE NOTICE 'Added column: impact_terrestrial_ecotoxicity';
  END IF;
END $$;

-- Add freshwater eutrophication impact indicator
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'impact_freshwater_eutrophication'
  ) THEN
    ALTER TABLE product_lca_materials 
    ADD COLUMN impact_freshwater_eutrophication NUMERIC DEFAULT NULL;
    RAISE NOTICE 'Added column: impact_freshwater_eutrophication';
  END IF;
END $$;

-- Add terrestrial acidification impact indicator
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'impact_terrestrial_acidification'
  ) THEN
    ALTER TABLE product_lca_materials 
    ADD COLUMN impact_terrestrial_acidification NUMERIC DEFAULT NULL;
    RAISE NOTICE 'Added column: impact_terrestrial_acidification';
  END IF;
END $$;

-- Add fossil resource scarcity impact indicator
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'impact_fossil_resource_scarcity'
  ) THEN
    ALTER TABLE product_lca_materials 
    ADD COLUMN impact_fossil_resource_scarcity NUMERIC DEFAULT NULL;
    RAISE NOTICE 'Added column: impact_fossil_resource_scarcity';
  END IF;
END $$;

-- Add column comments for documentation
COMMENT ON COLUMN product_lca_materials.impact_water_scarcity IS 
  'Water scarcity footprint in cubic metres world equivalent (m³ world eq.) - ReCiPe 2016 midpoint indicator';

COMMENT ON COLUMN product_lca_materials.impact_terrestrial_ecotoxicity IS 
  'Terrestrial ecotoxicity potential in kg 1,4-dichlorobenzene equivalent (kg 1,4-DCB) - ReCiPe 2016 midpoint indicator';

COMMENT ON COLUMN product_lca_materials.impact_freshwater_eutrophication IS 
  'Freshwater eutrophication potential in kg phosphorus equivalent (kg P eq.) - ReCiPe 2016 midpoint indicator';

COMMENT ON COLUMN product_lca_materials.impact_terrestrial_acidification IS 
  'Terrestrial acidification potential in kg sulfur dioxide equivalent (kg SO₂ eq.) - ReCiPe 2016 midpoint indicator';

COMMENT ON COLUMN product_lca_materials.impact_fossil_resource_scarcity IS 
  'Fossil resource scarcity in kg oil equivalent (kg oil eq.) - ReCiPe 2016 midpoint indicator';

-- Verification
DO $$
DECLARE
  column_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns
  WHERE table_name = 'product_lca_materials'
    AND column_name IN (
      'impact_water_scarcity',
      'impact_terrestrial_ecotoxicity',
      'impact_freshwater_eutrophication',
      'impact_terrestrial_acidification',
      'impact_fossil_resource_scarcity'
    );
  
  RAISE NOTICE 'Successfully verified % of 5 expected impact columns exist', column_count;
  
  IF column_count < 5 THEN
    RAISE WARNING 'Expected 5 columns but only found %', column_count;
  END IF;
END $$;
