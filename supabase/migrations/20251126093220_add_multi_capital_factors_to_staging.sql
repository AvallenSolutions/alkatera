/*
  # Add Multi-Capital Impact Factors to Staging Emission Factors

  1. Purpose
     - Add water_factor, land_factor, waste_factor columns
     - Populate with realistic proxy data for all 15 staging items
     - Enable multi-capital impact assessments (Planet tab)

  2. New Columns
     - water_factor (numeric) - Water consumption per reference unit (m³/unit)
     - land_factor (numeric) - Land use per reference unit (m²/unit)
     - waste_factor (numeric) - Waste generated per reference unit (kg/unit)

  3. Data Sources
     - Packaging: Mining/manufacturing water, land, and waste intensity
     - Ingredients: Agricultural water usage, land occupation, processing waste
     - Energy/Transport: Infrastructure and extraction impacts

  4. Multi-Capital Framework
     - Climate: co2_factor (existing)
     - Water: water_factor (new)
     - Land/Nature: land_factor (new)
     - Circularity/Waste: waste_factor (new)
*/

-- =====================================================
-- SECTION 1: ADD MULTI-CAPITAL COLUMNS
-- =====================================================

ALTER TABLE staging_emission_factors
ADD COLUMN IF NOT EXISTS water_factor numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS land_factor numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS waste_factor numeric DEFAULT 0;

-- Add check constraints
ALTER TABLE staging_emission_factors
ADD CONSTRAINT check_water_factor_non_negative CHECK (water_factor >= 0);

ALTER TABLE staging_emission_factors
ADD CONSTRAINT check_land_factor_non_negative CHECK (land_factor >= 0);

ALTER TABLE staging_emission_factors
ADD CONSTRAINT check_waste_factor_non_negative CHECK (waste_factor >= 0);

-- Add comments
COMMENT ON COLUMN staging_emission_factors.water_factor IS 'Water consumption per reference unit (m³/unit or L/unit depending on scale)';
COMMENT ON COLUMN staging_emission_factors.land_factor IS 'Land use per reference unit (m² or m²·year depending on context)';
COMMENT ON COLUMN staging_emission_factors.waste_factor IS 'Waste generated per reference unit (kg/unit)';

-- =====================================================
-- SECTION 2: POPULATE PACKAGING FACTORS
-- =====================================================

-- 1. Glass Bottle (Standard Flint)
-- Heavy energy, low land use, moderate waste (mining/slag)
UPDATE staging_emission_factors SET 
    water_factor = 0.005, 
    land_factor = 0.02, 
    waste_factor = 0.05 
WHERE name = 'Glass Bottle (Standard Flint)';

-- 2. Glass Bottle (60% PCR)
-- Recycled content reduces mining waste and energy water usage
UPDATE staging_emission_factors SET 
    water_factor = 0.003, 
    land_factor = 0.01, 
    waste_factor = 0.02 
WHERE name = 'Glass Bottle (60% PCR)';

-- 3. Aluminium Cap
-- Bauxite mining is waste-intensive (Red Mud) and uses water
UPDATE staging_emission_factors SET 
    water_factor = 0.015, 
    land_factor = 0.05, 
    waste_factor = 0.20 
WHERE name = 'Aluminium Cap';

-- 4. Paper Label (Wet Glue)
-- Forestry requires land and water; pulp processing is water-intensive
UPDATE staging_emission_factors SET 
    water_factor = 0.08, 
    land_factor = 0.90, 
    waste_factor = 0.05 
WHERE name = 'Paper Label (Wet Glue)';

-- 5. Corrugated Cardboard
-- High recycled content generally, moderate water/land
UPDATE staging_emission_factors SET 
    water_factor = 0.06, 
    land_factor = 0.60, 
    waste_factor = 0.08 
WHERE name = 'Corrugated Cardboard';

-- =====================================================
-- SECTION 3: POPULATE INGREDIENT FACTORS
-- =====================================================

-- 6. Water (Municipal Treatment)
-- 1:1 consumption logic, negligible land/waste
UPDATE staging_emission_factors SET 
    water_factor = 1.00, 
    land_factor = 0.0001, 
    waste_factor = 0.0001 
WHERE name = 'Water (Municipal Treatment)';

-- 7. Sugar (Beet - EU)
-- Crop: High Land Use, Moderate Irrigation
UPDATE staging_emission_factors SET 
    water_factor = 0.15, 
    land_factor = 1.20, 
    waste_factor = 0.05 
WHERE name = 'Sugar (Beet - EU)';

-- 8. Sugar (Cane - Global)
-- Crop: Very High Water (Tropical), High Land Use
UPDATE staging_emission_factors SET 
    water_factor = 0.25, 
    land_factor = 1.40, 
    waste_factor = 0.10 
WHERE name = 'Sugar (Cane - Global)';

-- 9. Citric Acid
-- Industrial Fermentation: High processing water/energy
UPDATE staging_emission_factors SET 
    water_factor = 0.12, 
    land_factor = 0.40, 
    waste_factor = 0.08 
WHERE name = 'Citric Acid';

-- 10. Ethanol (Grain)
-- Intensive Agriculture + Distillation Energy/Water
UPDATE staging_emission_factors SET 
    water_factor = 0.40, 
    land_factor = 1.80, 
    waste_factor = 0.15 
WHERE name = 'Ethanol (Grain)';

-- 11. Gin Concentrate
-- Botanical farming (High Land Value) + Extraction
UPDATE staging_emission_factors SET 
    water_factor = 0.10, 
    land_factor = 0.80, 
    waste_factor = 0.05 
WHERE name = 'Gin Concentrate';

-- 12. CO2 (Industrial)
-- By-product capture, very low land/water
UPDATE staging_emission_factors SET 
    water_factor = 0.002, 
    land_factor = 0.001, 
    waste_factor = 0.001 
WHERE name = 'CO2 (Industrial)';

-- =====================================================
-- SECTION 4: POPULATE ENERGY & TRANSPORT FACTORS
-- =====================================================

-- 13. Electricity (Grid - UK)
-- Cooling water for thermal plants
UPDATE staging_emission_factors SET 
    water_factor = 0.04, 
    land_factor = 0.001, 
    waste_factor = 0.005 
WHERE name = 'Electricity (Grid - UK)';

-- 14. Natural Gas (Heat)
-- Extraction water/waste
UPDATE staging_emission_factors SET 
    water_factor = 0.001, 
    land_factor = 0.002, 
    waste_factor = 0.002 
WHERE name = 'Natural Gas (Heat)';

-- 15. Transport (HGV Diesel)
-- Road infrastructure land use (allocated), minor water
UPDATE staging_emission_factors SET 
    water_factor = 0.001, 
    land_factor = 0.03, 
    waste_factor = 0.005 
WHERE name = 'Transport (HGV Diesel)';

-- =====================================================
-- SECTION 5: VERIFICATION QUERY
-- =====================================================

-- Verify all factors are populated
DO $$
DECLARE
    total_factors integer;
    populated_factors integer;
BEGIN
    SELECT COUNT(*) INTO total_factors FROM staging_emission_factors;
    
    SELECT COUNT(*) INTO populated_factors 
    FROM staging_emission_factors 
    WHERE water_factor > 0 AND land_factor > 0 AND waste_factor > 0;
    
    RAISE NOTICE 'Multi-Capital Factor Population Summary:';
    RAISE NOTICE '  Total staging factors: %', total_factors;
    RAISE NOTICE '  Fully populated (all 4 capitals): %', populated_factors;
    
    IF total_factors = populated_factors THEN
        RAISE NOTICE '  ✓ SUCCESS: All factors populated';
    ELSE
        RAISE WARNING '  ⚠ WARNING: % factors missing multi-capital data', (total_factors - populated_factors);
    END IF;
END $$;
