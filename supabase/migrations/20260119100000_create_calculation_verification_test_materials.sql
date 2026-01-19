/*
  # Create Calculation Verification Test Materials

  ## Overview
  This migration creates test materiality data for the Calculation Verification organization
  to enable end-to-end testing of Product LCA and Corporate Carbon Footprint calculations.

  ## What This Creates
  Test emission factors in the staging_emission_factors table for:
  - Ingredients (21 items): Grains, Fruits/Grapes, Hops, Yeast, Water
  - Packaging (13 items): Glass (various recycled %), Aluminium, Steel, Tinplate

  ## Data Source
  Test data based on representative emission factors from:
  - IPCC AR6 GWP100 factors
  - DEFRA 2025 emission factors

  ## Data Storage
  All impact data stored in staging_emission_factors:
  - co2_factor: kg CO2e per reference unit
  - water_factor: m³ per reference unit
  - land_factor: m² per reference unit
  - waste_factor: kg per reference unit
  - metadata: GHG breakdown and additional attributes

  ## Security
  - Data is organization-specific (not global)
  - Only accessible to Calculation Verification organization members
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
    RAISE EXCEPTION 'ERROR: Could not find "Calculation Verification" organization. Please create the organization first via the UI.';
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Creating Test Materials for LCA Testing';
  RAISE NOTICE 'Organization ID: %', v_org_id;
  RAISE NOTICE '========================================';

  -- ============================================================================
  -- GRAINS & CEREALS (per kg)
  -- ============================================================================

  RAISE NOTICE 'Creating Grains & Cereals...';

  INSERT INTO staging_emission_factors (organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor, reference_unit, source, metadata) VALUES
  (v_org_id, 'Malted Barley', 'Ingredient', 0.76, 1.42, 2.8, 0.10, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 0.45, "ghg_biogenic": 0.15, "geographic_scope": "UK", "description": "Malted barley for brewing and distilling"}'::jsonb),
  (v_org_id, 'Barley (raw)', 'Ingredient', 0.52, 1.10, 2.4, 0.08, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 0.32, "ghg_biogenic": 0.10, "geographic_scope": "UK", "description": "Raw barley grain"}'::jsonb),
  (v_org_id, 'Wheat', 'Ingredient', 0.48, 1.05, 2.2, 0.07, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 0.28, "ghg_biogenic": 0.08, "geographic_scope": "UK", "description": "Wheat grain for distilling"}'::jsonb),
  (v_org_id, 'Maize/Corn', 'Ingredient', 0.44, 0.95, 2.0, 0.06, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 0.26, "ghg_biogenic": 0.07, "geographic_scope": "Global", "description": "Maize/corn grain"}'::jsonb),
  (v_org_id, 'Rice', 'Ingredient', 2.55, 2.50, 3.5, 0.12, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 0.85, "ghg_biogenic": 0.25, "geographic_scope": "Global", "description": "Rice grain (high methane from paddy)"}'::jsonb),
  (v_org_id, 'Oats', 'Ingredient', 0.62, 1.20, 2.5, 0.08, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 0.38, "ghg_biogenic": 0.12, "geographic_scope": "UK", "description": "Oat grain"}'::jsonb);

  RAISE NOTICE '  Created 6 grain ingredients';

  -- ============================================================================
  -- FRUITS & GRAPES (per kg)
  -- ============================================================================

  RAISE NOTICE 'Creating Fruits & Grapes...';

  INSERT INTO staging_emission_factors (organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor, reference_unit, source, metadata) VALUES
  (v_org_id, 'Sauvignon Blanc Grapes', 'Ingredient', 0.55, 0.82, 1.6, 0.05, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 0.35, "ghg_biogenic": 0.12, "geographic_scope": "NZ", "description": "Wine grapes - Sauvignon Blanc variety"}'::jsonb),
  (v_org_id, 'Pinot Noir Grapes', 'Ingredient', 0.58, 0.80, 1.55, 0.05, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 0.38, "ghg_biogenic": 0.13, "geographic_scope": "FR", "description": "Wine grapes - Pinot Noir variety"}'::jsonb),
  (v_org_id, 'Chardonnay Grapes', 'Ingredient', 0.54, 0.78, 1.5, 0.05, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 0.34, "ghg_biogenic": 0.12, "geographic_scope": "FR", "description": "Wine grapes - Chardonnay variety"}'::jsonb),
  (v_org_id, 'Apples (cider)', 'Ingredient', 0.32, 0.70, 1.2, 0.04, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 0.20, "ghg_biogenic": 0.08, "geographic_scope": "UK", "description": "Cider apples for pressing"}'::jsonb),
  (v_org_id, 'Agave', 'Ingredient', 0.45, 0.55, 1.8, 0.06, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 0.28, "ghg_biogenic": 0.10, "geographic_scope": "MX", "description": "Blue agave for tequila/mezcal production"}'::jsonb),
  (v_org_id, 'Juniper Berries', 'Ingredient', 1.20, 1.50, 3.5, 0.08, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 0.75, "ghg_biogenic": 0.25, "geographic_scope": "EU", "description": "Juniper berries for gin production"}'::jsonb);

  RAISE NOTICE '  Created 6 fruit/grape ingredients';

  -- ============================================================================
  -- HOPS & BREWING ADDITIVES (per kg)
  -- ============================================================================

  RAISE NOTICE 'Creating Hops & Brewing Additives...';

  INSERT INTO staging_emission_factors (organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor, reference_unit, source, metadata) VALUES
  (v_org_id, 'Hops (whole)', 'Ingredient', 2.10, 2.85, 5.2, 0.15, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 1.35, "ghg_biogenic": 0.45, "geographic_scope": "UK", "description": "Whole hop cones for brewing"}'::jsonb),
  (v_org_id, 'Hops (pellets)', 'Ingredient', 2.35, 3.10, 5.5, 0.18, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 1.55, "ghg_biogenic": 0.50, "geographic_scope": "UK", "description": "Hop pellets - processed and concentrated"}'::jsonb),
  (v_org_id, 'Brewing Yeast', 'Ingredient', 1.85, 0.65, 0.5, 0.10, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 1.20, "ghg_biogenic": 0.40, "geographic_scope": "EU", "description": "Saccharomyces cerevisiae for beer fermentation"}'::jsonb),
  (v_org_id, 'Wine Yeast', 'Ingredient', 1.85, 0.65, 0.5, 0.10, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 1.20, "ghg_biogenic": 0.40, "geographic_scope": "EU", "description": "Saccharomyces cerevisiae for wine fermentation"}'::jsonb),
  (v_org_id, 'Distilling Yeast', 'Ingredient', 1.85, 0.65, 0.5, 0.10, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 1.20, "ghg_biogenic": 0.40, "geographic_scope": "EU", "description": "High-alcohol tolerant yeast for spirits"}'::jsonb);

  RAISE NOTICE '  Created 5 hops/yeast ingredients';

  -- ============================================================================
  -- WATER (per L)
  -- ============================================================================

  RAISE NOTICE 'Creating Water ingredients...';

  INSERT INTO staging_emission_factors (organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor, reference_unit, source, metadata) VALUES
  (v_org_id, 'Municipal Water', 'Ingredient', 0.00034, 0.001, 0.00001, 0.00001, 'L', 'Test Data - DEFRA 2025',
   '{"ghg_fossil": 0.00032, "ghg_biogenic": 0.0, "geographic_scope": "UK", "description": "Treated municipal tap water"}'::jsonb),
  (v_org_id, 'Brewing Water', 'Ingredient', 0.00034, 0.001, 0.00001, 0.00001, 'L', 'Test Data - DEFRA 2025',
   '{"ghg_fossil": 0.00032, "ghg_biogenic": 0.0, "geographic_scope": "UK", "description": "Treated water for brewing (same as municipal)"}'::jsonb),
  (v_org_id, 'Spring Water', 'Ingredient', 0.00015, 0.001, 0.000005, 0.000005, 'L', 'Test Data - DEFRA 2025',
   '{"ghg_fossil": 0.00014, "ghg_biogenic": 0.0, "geographic_scope": "UK", "description": "Natural spring water - minimal treatment"}'::jsonb),
  (v_org_id, 'Bore Water', 'Ingredient', 0.00020, 0.001, 0.000008, 0.000008, 'L', 'Test Data - DEFRA 2025',
   '{"ghg_fossil": 0.00019, "ghg_biogenic": 0.0, "geographic_scope": "UK", "description": "Groundwater from borehole - pumped"}'::jsonb);

  RAISE NOTICE '  Created 4 water ingredients';

  -- ============================================================================
  -- GLASS PACKAGING (per kg)
  -- ============================================================================

  RAISE NOTICE 'Creating Glass Packaging...';

  INSERT INTO staging_emission_factors (organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor, reference_unit, source, metadata) VALUES
  (v_org_id, 'Glass (flint/clear)', 'Packaging', 1.09, 0.025, 0.15, 0.03, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 1.05, "ghg_biogenic": 0.02, "recycled_content_pct": 0, "recyclability_pct": 95, "geographic_scope": "EU", "description": "Clear/flint glass - virgin material"}'::jsonb),
  (v_org_id, 'Glass (green)', 'Packaging', 1.05, 0.024, 0.14, 0.03, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 1.01, "ghg_biogenic": 0.02, "recycled_content_pct": 0, "recyclability_pct": 95, "geographic_scope": "EU", "description": "Green glass - virgin material"}'::jsonb),
  (v_org_id, 'Glass (amber)', 'Packaging', 1.07, 0.024, 0.145, 0.03, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 1.03, "ghg_biogenic": 0.02, "recycled_content_pct": 0, "recyclability_pct": 95, "geographic_scope": "EU", "description": "Amber/brown glass - virgin material"}'::jsonb),
  (v_org_id, 'Glass (35% recycled)', 'Packaging', 0.85, 0.020, 0.12, 0.025, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 0.82, "ghg_biogenic": 0.015, "recycled_content_pct": 35, "recyclability_pct": 95, "geographic_scope": "EU", "description": "Glass with 35% recycled content"}'::jsonb),
  (v_org_id, 'Glass (50% recycled)', 'Packaging', 0.72, 0.018, 0.10, 0.022, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 0.69, "ghg_biogenic": 0.015, "recycled_content_pct": 50, "recyclability_pct": 95, "geographic_scope": "EU", "description": "Glass with 50% recycled content"}'::jsonb),
  (v_org_id, 'Glass (80% recycled)', 'Packaging', 0.52, 0.014, 0.08, 0.018, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 0.50, "ghg_biogenic": 0.01, "recycled_content_pct": 80, "recyclability_pct": 95, "geographic_scope": "EU", "description": "Glass with 80% recycled content"}'::jsonb);

  RAISE NOTICE '  Created 6 glass packaging materials';

  -- ============================================================================
  -- METALS PACKAGING (per kg)
  -- ============================================================================

  RAISE NOTICE 'Creating Metals Packaging...';

  INSERT INTO staging_emission_factors (organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor, reference_unit, source, metadata) VALUES
  (v_org_id, 'Aluminium (primary)', 'Packaging', 11.50, 0.085, 0.25, 0.08, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 11.20, "ghg_biogenic": 0.10, "recycled_content_pct": 0, "recyclability_pct": 100, "geographic_scope": "Global", "description": "Primary aluminium - virgin material"}'::jsonb),
  (v_org_id, 'Aluminium (30% recycled)', 'Packaging', 8.65, 0.070, 0.20, 0.06, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 8.40, "ghg_biogenic": 0.08, "recycled_content_pct": 30, "recyclability_pct": 100, "geographic_scope": "Global", "description": "Aluminium with 30% recycled content"}'::jsonb),
  (v_org_id, 'Aluminium (50% recycled)', 'Packaging', 6.90, 0.055, 0.16, 0.05, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 6.70, "ghg_biogenic": 0.06, "recycled_content_pct": 50, "recyclability_pct": 100, "geographic_scope": "Global", "description": "Aluminium with 50% recycled content"}'::jsonb),
  (v_org_id, 'Aluminium (70% recycled)', 'Packaging', 5.15, 0.042, 0.12, 0.04, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 5.00, "ghg_biogenic": 0.05, "recycled_content_pct": 70, "recyclability_pct": 100, "geographic_scope": "Global", "description": "Aluminium with 70% recycled content"}'::jsonb),
  (v_org_id, 'Steel (primary)', 'Packaging', 2.89, 0.035, 0.12, 0.05, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 2.80, "ghg_biogenic": 0.03, "recycled_content_pct": 0, "recyclability_pct": 90, "geographic_scope": "EU", "description": "Primary steel - virgin material"}'::jsonb),
  (v_org_id, 'Steel (60% recycled)', 'Packaging', 1.45, 0.022, 0.08, 0.03, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 1.40, "ghg_biogenic": 0.02, "recycled_content_pct": 60, "recyclability_pct": 90, "geographic_scope": "EU", "description": "Steel with 60% recycled content"}'::jsonb),
  (v_org_id, 'Tinplate', 'Packaging', 3.10, 0.038, 0.14, 0.05, 'kg', 'Test Data - IPCC AR6',
   '{"ghg_fossil": 3.00, "ghg_biogenic": 0.03, "recycled_content_pct": 25, "recyclability_pct": 85, "geographic_scope": "EU", "description": "Tin-coated steel for cans"}'::jsonb);

  RAISE NOTICE '  Created 7 metal packaging materials';

  -- ============================================================================
  -- SUMMARY
  -- ============================================================================

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST MATERIALS CREATED SUCCESSFULLY';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Materials Created in staging_emission_factors:';
  RAISE NOTICE '  - Grains & Cereals: 6 items';
  RAISE NOTICE '  - Fruits & Grapes: 6 items';
  RAISE NOTICE '  - Hops & Brewing Additives: 5 items';
  RAISE NOTICE '  - Water: 4 items';
  RAISE NOTICE '  - Glass Packaging: 6 items';
  RAISE NOTICE '  - Metals Packaging: 7 items';
  RAISE NOTICE '  ---------------------';
  RAISE NOTICE '  TOTAL: 34 test materials';
  RAISE NOTICE '';
  RAISE NOTICE 'Impact Factors Included:';
  RAISE NOTICE '  - co2_factor: kg CO2e per unit';
  RAISE NOTICE '  - water_factor: m³ per unit';
  RAISE NOTICE '  - land_factor: m² per unit';
  RAISE NOTICE '  - waste_factor: kg per unit';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Search for materials in the product recipe builder';
  RAISE NOTICE '  2. Add materials to test products';
  RAISE NOTICE '  3. Run LCA calculations';
  RAISE NOTICE '  4. Verify results against expected values';
  RAISE NOTICE '========================================';

END $$;
