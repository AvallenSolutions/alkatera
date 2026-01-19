/*
  # Add Missing Emission Factors for Highland Single Malt Whisky LCA Testing

  ## Overview
  This migration adds the specific emission factors needed for the Highland Single Malt Whisky
  product (ID 56) to enable LCA calculation testing.

  ## Materials Added
  From test document requirements:
  - Barley (Organic Production): 0.45 kg CO2e/kg
  - Peat (Organic Production): 0.01 kg CO2e/kg
  - Cork: 2.5 kg CO2e/kg
  - Glass Bottle (Standard): 0.7 kg CO2e/kg
  - Water (Distilling): 0.0001 kg CO2e/L

  ## Expected LCA Result
  Highland Single Malt Whisky should calculate to approximately 0.876 kg CO2e (±10%)
*/

DO $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Look up the Calculation Verification organization by name
  SELECT id INTO v_org_id
  FROM organizations
  WHERE name ILIKE '%Calculation Verification%'
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'ERROR: Could not find "Calculation Verification" organization.';
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Adding Highland Single Malt Whisky Test Materials';
  RAISE NOTICE 'Organization ID: %', v_org_id;
  RAISE NOTICE '========================================';

  -- ============================================================================
  -- INGREDIENTS FOR HIGHLAND SINGLE MALT WHISKY
  -- ============================================================================

  -- Barley (Organic Production) - matches product specification name
  INSERT INTO staging_emission_factors (organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor, reference_unit, source, metadata) VALUES
  (v_org_id, 'barley - Organic Production', 'Ingredient', 0.45, 1.20, 2.5, 0.08, 'kg', 'Test Data - Highland Whisky',
   '{"ghg_fossil": 0.30, "ghg_biogenic": 0.10, "geographic_scope": "UK", "description": "Organic barley for whisky production", "is_organic": true}'::jsonb);

  RAISE NOTICE '  Added: barley - Organic Production (0.45 kg CO2e/kg)';

  -- Peat (Organic Production) - matches product specification name
  INSERT INTO staging_emission_factors (organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor, reference_unit, source, metadata) VALUES
  (v_org_id, 'Peat - Organic Production', 'Ingredient', 0.01, 0.001, 15.0, 0.005, 'kg', 'Test Data - Highland Whisky',
   '{"ghg_fossil": 0.008, "ghg_biogenic": 0.002, "geographic_scope": "UK", "description": "Peat for whisky smoking/drying"}'::jsonb);

  RAISE NOTICE '  Added: Peat - Organic Production (0.01 kg CO2e/kg)';

  -- Water (Distilling) - 0.0001 kg CO2e/L as per test document
  INSERT INTO staging_emission_factors (organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor, reference_unit, source, metadata) VALUES
  (v_org_id, 'Water (Distilling)', 'Ingredient', 0.0001, 0.001, 0.000001, 0.000001, 'L', 'Test Data - Highland Whisky',
   '{"ghg_fossil": 0.0001, "ghg_biogenic": 0.0, "geographic_scope": "UK", "description": "Water for distilling process"}'::jsonb);

  RAISE NOTICE '  Added: Water (Distilling) (0.0001 kg CO2e/L)';

  -- ============================================================================
  -- PACKAGING FOR HIGHLAND SINGLE MALT WHISKY
  -- ============================================================================

  -- Glass Bottle (Standard) - 0.7 kg CO2e/kg as per test document
  INSERT INTO staging_emission_factors (organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor, reference_unit, source, metadata) VALUES
  (v_org_id, 'Glass Bottle (Standard)', 'Packaging', 0.70, 0.020, 0.12, 0.025, 'kg', 'Test Data - Highland Whisky',
   '{"ghg_fossil": 0.68, "ghg_biogenic": 0.02, "recycled_content_pct": 30, "recyclability_pct": 95, "geographic_scope": "EU", "description": "Standard glass bottle for spirits"}'::jsonb);

  RAISE NOTICE '  Added: Glass Bottle (Standard) (0.70 kg CO2e/kg)';

  -- Cork - 2.5 kg CO2e/kg as per test document
  INSERT INTO staging_emission_factors (organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor, reference_unit, source, metadata) VALUES
  (v_org_id, 'Cork', 'Packaging', 2.50, 0.15, 8.0, 0.05, 'kg', 'Test Data - Highland Whisky',
   '{"ghg_fossil": 1.50, "ghg_biogenic": 0.80, "recycled_content_pct": 0, "recyclability_pct": 100, "geographic_scope": "PT", "description": "Natural cork stopper"}'::jsonb);

  RAISE NOTICE '  Added: Cork (2.50 kg CO2e/kg)';

  -- ============================================================================
  -- SUMMARY
  -- ============================================================================

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'HIGHLAND WHISKY MATERIALS ADDED';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Ingredients:';
  RAISE NOTICE '  - barley - Organic Production: 0.45 kg CO2e/kg';
  RAISE NOTICE '  - Peat - Organic Production: 0.01 kg CO2e/kg';
  RAISE NOTICE '  - Water (Distilling): 0.0001 kg CO2e/L';
  RAISE NOTICE '';
  RAISE NOTICE 'Packaging:';
  RAISE NOTICE '  - Glass Bottle (Standard): 0.70 kg CO2e/kg';
  RAISE NOTICE '  - Cork: 2.50 kg CO2e/kg';
  RAISE NOTICE '';
  RAISE NOTICE 'Expected LCA Calculation:';
  RAISE NOTICE '  Barley: 0.5 kg × 0.45 = 0.225 kg CO2e';
  RAISE NOTICE '  Water: 5 L × 0.0001 = 0.0005 kg CO2e';
  RAISE NOTICE '  Peat: 0.002 kg × 0.01 = 0.00002 kg CO2e';
  RAISE NOTICE '  Glass: 0.5 kg × 0.70 = 0.35 kg CO2e';
  RAISE NOTICE '  Cork: 0.005 kg × 2.50 = 0.0125 kg CO2e';
  RAISE NOTICE '  ---------------------------------';
  RAISE NOTICE '  Total: ~0.588 kg CO2e';
  RAISE NOTICE '';
  RAISE NOTICE 'Note: Test document expects 0.876 kg CO2e - check quantities';
  RAISE NOTICE '========================================';

END $$;
