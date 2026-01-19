/*
  # Create Calculation Verification Test Materials

  ## Overview
  This migration creates test materiality data for the Calculation Verification organization
  to enable end-to-end testing of Product LCA and Corporate Carbon Footprint calculations.

  ## What This Creates
  1. A "Test Materials Library" supplier for the Calculation Verification organization
  2. Test ingredient supplier products with full multi-capital impact data
  3. Test packaging supplier products with full multi-capital impact data

  ## Data Source
  Test data based on representative emission factors from:
  - IPCC AR6 GWP100 factors
  - DEFRA 2025 emission factors
  - ReCiPe 2016 midpoint methodology

  ## Categories Included

  ### Ingredients (17 items):
  - Grains & Cereals: Malted Barley, Raw Barley, Wheat, Maize/Corn, Rice, Oats
  - Fruits & Grapes: Sauvignon Blanc Grapes, Pinot Noir Grapes, Chardonnay Grapes, Apples (cider), Agave, Juniper Berries
  - Hops & Brewing Additives: Hops (whole), Hops (pellets), Brewing Yeast, Wine Yeast, Distilling Yeast
  - Water: Municipal Water, Brewing Water, Spring Water, Bore Water

  ### Packaging (13 items):
  - Glass: Flint/Clear, Green, Amber, 35% recycled, 50% recycled, 80% recycled
  - Metals: Aluminium (primary, 30%, 50%, 70% recycled), Steel (primary, 60% recycled), Tinplate

  ## How to Use
  1. Log into the Calculation Verification organization
  2. Run this migration in Supabase SQL editor
  3. Materials will appear in ingredient/packaging search on the front-end

  ## Security
  - Data is organization-specific (not global)
  - Only accessible to Calculation Verification organization members
*/

DO $$
DECLARE
  v_org_id UUID;
  v_supplier_id UUID;
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
  -- STEP 1: Create Test Materials Library Supplier
  -- ============================================================================

  RAISE NOTICE 'Creating Test Materials Library supplier...';

  INSERT INTO suppliers (id, organization_id, name, contact_email, contact_name, industry_sector, country, notes)
  VALUES (
    gen_random_uuid(),
    v_org_id,
    'Test Materials Library',
    'test@calculation-verification.local',
    'Test Data Manager',
    'Materials Testing',
    'United Kingdom',
    'Test materials library for LCA calculation verification. Contains representative emission factors for ingredients and packaging.'
  )
  RETURNING id INTO v_supplier_id;

  RAISE NOTICE '  Created supplier: Test Materials Library (ID: %)', v_supplier_id;

  -- ============================================================================
  -- STEP 2: Create Supplier Engagement Record
  -- ============================================================================

  INSERT INTO supplier_engagements (supplier_id, status, invited_date, accepted_date, data_submitted_date, data_quality_score, notes)
  VALUES (
    v_supplier_id,
    'data_provided',
    CURRENT_DATE,
    CURRENT_DATE,
    CURRENT_DATE,
    95,
    'Test data library for calculation verification'
  );

  RAISE NOTICE '  Created supplier engagement record';

  -- ============================================================================
  -- STEP 3: Insert GRAINS & CEREALS Ingredients
  -- ============================================================================

  RAISE NOTICE 'Creating Grains & Cereals ingredients...';

  -- Malted Barley
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Malted Barley', 'Malted barley for brewing and distilling', 'Ingredient', 'kg', 'ING-MALT-001',
    0.76, 1.42, 2.8, 0.10,
    0.45, 0.15,
    '{"co2_fossil": 0.45, "co2_biogenic": 0.15, "ch4_fossil": 0.001, "ch4_biogenic": 0.002, "n2o": 0.0008}'::jsonb,
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'UK',
    2, 85, '1 kg malted barley at maltings gate', 'cradle_to_gate'
  );

  -- Barley (raw)
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Barley (raw)', 'Raw barley grain', 'Ingredient', 'kg', 'ING-BARL-001',
    0.52, 1.10, 2.4, 0.08,
    0.32, 0.10,
    '{"co2_fossil": 0.32, "co2_biogenic": 0.10, "ch4_fossil": 0.0008, "ch4_biogenic": 0.0015, "n2o": 0.0006}'::jsonb,
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'UK',
    2, 85, '1 kg raw barley at farm gate', 'cradle_to_gate'
  );

  -- Wheat
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Wheat', 'Wheat grain for distilling', 'Ingredient', 'kg', 'ING-WHEA-001',
    0.48, 1.05, 2.2, 0.07,
    0.28, 0.08,
    '{"co2_fossil": 0.28, "co2_biogenic": 0.08, "ch4_fossil": 0.0006, "ch4_biogenic": 0.0012, "n2o": 0.0007}'::jsonb,
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'UK',
    2, 85, '1 kg wheat at farm gate', 'cradle_to_gate'
  );

  -- Maize/Corn
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Maize/Corn', 'Maize/corn grain', 'Ingredient', 'kg', 'ING-CORN-001',
    0.44, 0.95, 2.0, 0.06,
    0.26, 0.07,
    '{"co2_fossil": 0.26, "co2_biogenic": 0.07, "ch4_fossil": 0.0005, "ch4_biogenic": 0.0010, "n2o": 0.0006}'::jsonb,
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'Global',
    2, 80, '1 kg maize at farm gate', 'cradle_to_gate'
  );

  -- Rice
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Rice', 'Rice grain (high methane from paddy)', 'Ingredient', 'kg', 'ING-RICE-001',
    2.55, 2.50, 3.5, 0.12,
    0.85, 0.25,
    '{"co2_fossil": 0.85, "co2_biogenic": 0.25, "ch4_fossil": 0.035, "ch4_biogenic": 0.015, "n2o": 0.0012}'::jsonb,
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'Global',
    2, 80, '1 kg rice at mill gate', 'cradle_to_gate'
  );

  -- Oats
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Oats', 'Oat grain', 'Ingredient', 'kg', 'ING-OATS-001',
    0.62, 1.20, 2.5, 0.08,
    0.38, 0.12,
    '{"co2_fossil": 0.38, "co2_biogenic": 0.12, "ch4_fossil": 0.0007, "ch4_biogenic": 0.0014, "n2o": 0.0006}'::jsonb,
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'UK',
    2, 85, '1 kg oats at farm gate', 'cradle_to_gate'
  );

  RAISE NOTICE '  Created 6 grain ingredients';

  -- ============================================================================
  -- STEP 4: Insert FRUITS & GRAPES Ingredients
  -- ============================================================================

  RAISE NOTICE 'Creating Fruits & Grapes ingredients...';

  -- Sauvignon Blanc Grapes
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Sauvignon Blanc Grapes', 'Wine grapes - Sauvignon Blanc variety', 'Ingredient', 'kg', 'ING-GRPE-SAU-001',
    0.55, 0.82, 1.6, 0.05,
    0.35, 0.12,
    '{"co2_fossil": 0.35, "co2_biogenic": 0.12, "ch4_fossil": 0.0005, "ch4_biogenic": 0.0008, "n2o": 0.0004}'::jsonb,
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'NZ',
    2, 85, '1 kg grapes at vineyard gate', 'cradle_to_gate'
  );

  -- Pinot Noir Grapes
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Pinot Noir Grapes', 'Wine grapes - Pinot Noir variety', 'Ingredient', 'kg', 'ING-GRPE-PIN-001',
    0.58, 0.80, 1.55, 0.05,
    0.38, 0.13,
    '{"co2_fossil": 0.38, "co2_biogenic": 0.13, "ch4_fossil": 0.0005, "ch4_biogenic": 0.0008, "n2o": 0.0004}'::jsonb,
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'FR',
    2, 85, '1 kg grapes at vineyard gate', 'cradle_to_gate'
  );

  -- Chardonnay Grapes
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Chardonnay Grapes', 'Wine grapes - Chardonnay variety', 'Ingredient', 'kg', 'ING-GRPE-CHA-001',
    0.54, 0.78, 1.5, 0.05,
    0.34, 0.12,
    '{"co2_fossil": 0.34, "co2_biogenic": 0.12, "ch4_fossil": 0.0005, "ch4_biogenic": 0.0008, "n2o": 0.0004}'::jsonb,
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'FR',
    2, 85, '1 kg grapes at vineyard gate', 'cradle_to_gate'
  );

  -- Apples (cider)
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Apples (cider)', 'Cider apples for pressing', 'Ingredient', 'kg', 'ING-APPL-001',
    0.32, 0.70, 1.2, 0.04,
    0.20, 0.08,
    '{"co2_fossil": 0.20, "co2_biogenic": 0.08, "ch4_fossil": 0.0003, "ch4_biogenic": 0.0006, "n2o": 0.0003}'::jsonb,
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'UK',
    2, 85, '1 kg cider apples at orchard gate', 'cradle_to_gate'
  );

  -- Agave
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Agave', 'Blue agave for tequila/mezcal production', 'Ingredient', 'kg', 'ING-AGAV-001',
    0.45, 0.55, 1.8, 0.06,
    0.28, 0.10,
    '{"co2_fossil": 0.28, "co2_biogenic": 0.10, "ch4_fossil": 0.0004, "ch4_biogenic": 0.0008, "n2o": 0.0004}'::jsonb,
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'MX',
    2, 80, '1 kg agave at farm gate', 'cradle_to_gate'
  );

  -- Juniper Berries
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Juniper Berries', 'Juniper berries for gin production', 'Ingredient', 'kg', 'ING-JUNI-001',
    1.20, 1.50, 3.5, 0.08,
    0.75, 0.25,
    '{"co2_fossil": 0.75, "co2_biogenic": 0.25, "ch4_fossil": 0.0010, "ch4_biogenic": 0.0020, "n2o": 0.0008}'::jsonb,
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'EU',
    2, 80, '1 kg juniper berries dried', 'cradle_to_gate'
  );

  RAISE NOTICE '  Created 6 fruit/grape ingredients';

  -- ============================================================================
  -- STEP 5: Insert HOPS & BREWING ADDITIVES Ingredients
  -- ============================================================================

  RAISE NOTICE 'Creating Hops & Brewing Additives ingredients...';

  -- Hops (whole)
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Hops (whole)', 'Whole hop cones for brewing', 'Ingredient', 'kg', 'ING-HOPS-WHO-001',
    2.10, 2.85, 5.2, 0.15,
    1.35, 0.45,
    '{"co2_fossil": 1.35, "co2_biogenic": 0.45, "ch4_fossil": 0.0015, "ch4_biogenic": 0.0030, "n2o": 0.0015}'::jsonb,
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'UK',
    2, 85, '1 kg whole hops at processing gate', 'cradle_to_gate'
  );

  -- Hops (pellets)
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Hops (pellets)', 'Hop pellets - processed and concentrated', 'Ingredient', 'kg', 'ING-HOPS-PEL-001',
    2.35, 3.10, 5.5, 0.18,
    1.55, 0.50,
    '{"co2_fossil": 1.55, "co2_biogenic": 0.50, "ch4_fossil": 0.0018, "ch4_biogenic": 0.0035, "n2o": 0.0016}'::jsonb,
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'UK',
    2, 85, '1 kg hop pellets at processing gate', 'cradle_to_gate'
  );

  -- Brewing Yeast
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Brewing Yeast', 'Saccharomyces cerevisiae for beer fermentation', 'Ingredient', 'kg', 'ING-YEAS-BRE-001',
    1.85, 0.65, 0.5, 0.10,
    1.20, 0.40,
    '{"co2_fossil": 1.20, "co2_biogenic": 0.40, "ch4_fossil": 0.0012, "ch4_biogenic": 0.0025, "n2o": 0.0010}'::jsonb,
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'EU',
    2, 80, '1 kg active dried yeast', 'cradle_to_gate'
  );

  -- Wine Yeast
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Wine Yeast', 'Saccharomyces cerevisiae for wine fermentation', 'Ingredient', 'kg', 'ING-YEAS-WIN-001',
    1.85, 0.65, 0.5, 0.10,
    1.20, 0.40,
    '{"co2_fossil": 1.20, "co2_biogenic": 0.40, "ch4_fossil": 0.0012, "ch4_biogenic": 0.0025, "n2o": 0.0010}'::jsonb,
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'EU',
    2, 80, '1 kg active dried yeast', 'cradle_to_gate'
  );

  -- Distilling Yeast
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Distilling Yeast', 'High-alcohol tolerant yeast for spirits', 'Ingredient', 'kg', 'ING-YEAS-DIS-001',
    1.85, 0.65, 0.5, 0.10,
    1.20, 0.40,
    '{"co2_fossil": 1.20, "co2_biogenic": 0.40, "ch4_fossil": 0.0012, "ch4_biogenic": 0.0025, "n2o": 0.0010}'::jsonb,
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'EU',
    2, 80, '1 kg active dried yeast', 'cradle_to_gate'
  );

  RAISE NOTICE '  Created 5 hops/yeast ingredients';

  -- ============================================================================
  -- STEP 6: Insert WATER Ingredients
  -- ============================================================================

  RAISE NOTICE 'Creating Water ingredients...';

  -- Municipal Water
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Municipal Water', 'Treated municipal tap water', 'Ingredient', 'L', 'ING-WATR-MUN-001',
    0.00034, 0.001, 0.00001, 0.00001,
    0.00032, 0.0,
    '{"co2_fossil": 0.00032, "co2_biogenic": 0.0, "ch4": 0.000001, "n2o": 0.0000001}'::jsonb,
    'secondary_modelled', 'DEFRA_2025', 2025, 'UK',
    1, 95, '1 L municipal water delivered', 'cradle_to_gate'
  );

  -- Brewing Water
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Brewing Water', 'Treated water for brewing (same as municipal)', 'Ingredient', 'L', 'ING-WATR-BRE-001',
    0.00034, 0.001, 0.00001, 0.00001,
    0.00032, 0.0,
    '{"co2_fossil": 0.00032, "co2_biogenic": 0.0, "ch4": 0.000001, "n2o": 0.0000001}'::jsonb,
    'secondary_modelled', 'DEFRA_2025', 2025, 'UK',
    1, 95, '1 L brewing water', 'cradle_to_gate'
  );

  -- Spring Water
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Spring Water', 'Natural spring water - minimal treatment', 'Ingredient', 'L', 'ING-WATR-SPR-001',
    0.00015, 0.001, 0.000005, 0.000005,
    0.00014, 0.0,
    '{"co2_fossil": 0.00014, "co2_biogenic": 0.0, "ch4": 0.0000005, "n2o": 0.00000005}'::jsonb,
    'secondary_modelled', 'DEFRA_2025', 2025, 'UK',
    2, 90, '1 L spring water at source', 'cradle_to_gate'
  );

  -- Bore Water
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Bore Water', 'Groundwater from borehole - pumped', 'Ingredient', 'L', 'ING-WATR-BOR-001',
    0.00020, 0.001, 0.000008, 0.000008,
    0.00019, 0.0,
    '{"co2_fossil": 0.00019, "co2_biogenic": 0.0, "ch4": 0.0000008, "n2o": 0.00000008}'::jsonb,
    'secondary_modelled', 'DEFRA_2025', 2025, 'UK',
    2, 90, '1 L bore water pumped', 'cradle_to_gate'
  );

  RAISE NOTICE '  Created 4 water ingredients';

  -- ============================================================================
  -- STEP 7: Insert GLASS PACKAGING
  -- ============================================================================

  RAISE NOTICE 'Creating Glass Packaging materials...';

  -- Glass (flint/clear)
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    recycled_content_pct, recyclability_pct, end_of_life_pathway,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Glass (flint/clear)', 'Clear/flint glass - virgin material', 'Packaging', 'kg', 'PKG-GLAS-FLI-001',
    1.09, 0.025, 0.15, 0.03,
    1.05, 0.02,
    '{"co2_fossil": 1.05, "co2_biogenic": 0.02, "ch4": 0.0005, "n2o": 0.0001}'::jsonb,
    0, 95, 'recycling',
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'EU',
    2, 85, '1 kg glass at factory gate', 'cradle_to_gate'
  );

  -- Glass (green)
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    recycled_content_pct, recyclability_pct, end_of_life_pathway,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Glass (green)', 'Green glass - virgin material', 'Packaging', 'kg', 'PKG-GLAS-GRE-001',
    1.05, 0.024, 0.14, 0.03,
    1.01, 0.02,
    '{"co2_fossil": 1.01, "co2_biogenic": 0.02, "ch4": 0.0005, "n2o": 0.0001}'::jsonb,
    0, 95, 'recycling',
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'EU',
    2, 85, '1 kg glass at factory gate', 'cradle_to_gate'
  );

  -- Glass (amber)
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    recycled_content_pct, recyclability_pct, end_of_life_pathway,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Glass (amber)', 'Amber/brown glass - virgin material', 'Packaging', 'kg', 'PKG-GLAS-AMB-001',
    1.07, 0.024, 0.145, 0.03,
    1.03, 0.02,
    '{"co2_fossil": 1.03, "co2_biogenic": 0.02, "ch4": 0.0005, "n2o": 0.0001}'::jsonb,
    0, 95, 'recycling',
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'EU',
    2, 85, '1 kg glass at factory gate', 'cradle_to_gate'
  );

  -- Glass (35% recycled)
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    recycled_content_pct, recyclability_pct, end_of_life_pathway,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Glass (35% recycled)', 'Glass with 35% recycled content', 'Packaging', 'kg', 'PKG-GLAS-R35-001',
    0.85, 0.020, 0.12, 0.025,
    0.82, 0.015,
    '{"co2_fossil": 0.82, "co2_biogenic": 0.015, "ch4": 0.0004, "n2o": 0.0001}'::jsonb,
    35, 95, 'recycling',
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'EU',
    2, 85, '1 kg glass at factory gate', 'cradle_to_gate'
  );

  -- Glass (50% recycled)
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    recycled_content_pct, recyclability_pct, end_of_life_pathway,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Glass (50% recycled)', 'Glass with 50% recycled content', 'Packaging', 'kg', 'PKG-GLAS-R50-001',
    0.72, 0.018, 0.10, 0.022,
    0.69, 0.015,
    '{"co2_fossil": 0.69, "co2_biogenic": 0.015, "ch4": 0.0003, "n2o": 0.0001}'::jsonb,
    50, 95, 'recycling',
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'EU',
    2, 85, '1 kg glass at factory gate', 'cradle_to_gate'
  );

  -- Glass (80% recycled)
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    recycled_content_pct, recyclability_pct, end_of_life_pathway,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Glass (80% recycled)', 'Glass with 80% recycled content', 'Packaging', 'kg', 'PKG-GLAS-R80-001',
    0.52, 0.014, 0.08, 0.018,
    0.50, 0.01,
    '{"co2_fossil": 0.50, "co2_biogenic": 0.01, "ch4": 0.0002, "n2o": 0.0001}'::jsonb,
    80, 95, 'recycling',
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'EU',
    2, 85, '1 kg glass at factory gate', 'cradle_to_gate'
  );

  RAISE NOTICE '  Created 6 glass packaging materials';

  -- ============================================================================
  -- STEP 8: Insert METALS PACKAGING
  -- ============================================================================

  RAISE NOTICE 'Creating Metals Packaging materials...';

  -- Aluminium (primary)
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    recycled_content_pct, recyclability_pct, end_of_life_pathway,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Aluminium (primary)', 'Primary aluminium - virgin material', 'Packaging', 'kg', 'PKG-ALUM-PRI-001',
    11.50, 0.085, 0.25, 0.08,
    11.20, 0.10,
    '{"co2_fossil": 11.20, "co2_biogenic": 0.10, "ch4": 0.005, "n2o": 0.002}'::jsonb,
    0, 100, 'recycling',
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'Global',
    2, 85, '1 kg aluminium at smelter gate', 'cradle_to_gate'
  );

  -- Aluminium (30% recycled)
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    recycled_content_pct, recyclability_pct, end_of_life_pathway,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Aluminium (30% recycled)', 'Aluminium with 30% recycled content', 'Packaging', 'kg', 'PKG-ALUM-R30-001',
    8.65, 0.070, 0.20, 0.06,
    8.40, 0.08,
    '{"co2_fossil": 8.40, "co2_biogenic": 0.08, "ch4": 0.004, "n2o": 0.0015}'::jsonb,
    30, 100, 'recycling',
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'Global',
    2, 85, '1 kg aluminium at factory gate', 'cradle_to_gate'
  );

  -- Aluminium (50% recycled)
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    recycled_content_pct, recyclability_pct, end_of_life_pathway,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Aluminium (50% recycled)', 'Aluminium with 50% recycled content', 'Packaging', 'kg', 'PKG-ALUM-R50-001',
    6.90, 0.055, 0.16, 0.05,
    6.70, 0.06,
    '{"co2_fossil": 6.70, "co2_biogenic": 0.06, "ch4": 0.003, "n2o": 0.0012}'::jsonb,
    50, 100, 'recycling',
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'Global',
    2, 85, '1 kg aluminium at factory gate', 'cradle_to_gate'
  );

  -- Aluminium (70% recycled)
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    recycled_content_pct, recyclability_pct, end_of_life_pathway,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Aluminium (70% recycled)', 'Aluminium with 70% recycled content', 'Packaging', 'kg', 'PKG-ALUM-R70-001',
    5.15, 0.042, 0.12, 0.04,
    5.00, 0.05,
    '{"co2_fossil": 5.00, "co2_biogenic": 0.05, "ch4": 0.002, "n2o": 0.0010}'::jsonb,
    70, 100, 'recycling',
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'Global',
    2, 85, '1 kg aluminium at factory gate', 'cradle_to_gate'
  );

  -- Steel (primary)
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    recycled_content_pct, recyclability_pct, end_of_life_pathway,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Steel (primary)', 'Primary steel - virgin material', 'Packaging', 'kg', 'PKG-STEL-PRI-001',
    2.89, 0.035, 0.12, 0.05,
    2.80, 0.03,
    '{"co2_fossil": 2.80, "co2_biogenic": 0.03, "ch4": 0.002, "n2o": 0.001}'::jsonb,
    0, 90, 'recycling',
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'EU',
    2, 85, '1 kg steel at mill gate', 'cradle_to_gate'
  );

  -- Steel (60% recycled)
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    recycled_content_pct, recyclability_pct, end_of_life_pathway,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Steel (60% recycled)', 'Steel with 60% recycled content', 'Packaging', 'kg', 'PKG-STEL-R60-001',
    1.45, 0.022, 0.08, 0.03,
    1.40, 0.02,
    '{"co2_fossil": 1.40, "co2_biogenic": 0.02, "ch4": 0.001, "n2o": 0.0005}'::jsonb,
    60, 90, 'recycling',
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'EU',
    2, 85, '1 kg steel at mill gate', 'cradle_to_gate'
  );

  -- Tinplate
  INSERT INTO supplier_products (
    supplier_id, organization_id, name, description, category, unit, product_code,
    impact_climate, impact_water, impact_land, impact_waste,
    ghg_fossil, ghg_biogenic, ghg_breakdown,
    recycled_content_pct, recyclability_pct, end_of_life_pathway,
    data_source_type, methodology_standard, reference_year, geographic_scope,
    data_quality_score, data_confidence_pct, functional_unit, system_boundary
  ) VALUES (
    v_supplier_id, v_org_id, 'Tinplate', 'Tin-coated steel for cans', 'Packaging', 'kg', 'PKG-TINP-001',
    3.10, 0.038, 0.14, 0.05,
    3.00, 0.03,
    '{"co2_fossil": 3.00, "co2_biogenic": 0.03, "ch4": 0.002, "n2o": 0.001}'::jsonb,
    25, 85, 'recycling',
    'secondary_modelled', 'IPCC_AR6_GWP100', 2025, 'EU',
    2, 85, '1 kg tinplate at factory gate', 'cradle_to_gate'
  );

  RAISE NOTICE '  Created 7 metal packaging materials';

  -- ============================================================================
  -- SUMMARY
  -- ============================================================================

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST MATERIALS CREATED SUCCESSFULLY';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Supplier: Test Materials Library';
  RAISE NOTICE 'Supplier ID: %', v_supplier_id;
  RAISE NOTICE '';
  RAISE NOTICE 'Materials Created:';
  RAISE NOTICE '  - Grains & Cereals: 6 items';
  RAISE NOTICE '  - Fruits & Grapes: 6 items';
  RAISE NOTICE '  - Hops & Brewing Additives: 5 items';
  RAISE NOTICE '  - Water: 4 items';
  RAISE NOTICE '  - Glass Packaging: 6 items';
  RAISE NOTICE '  - Metals Packaging: 7 items';
  RAISE NOTICE '  ---------------------';
  RAISE NOTICE '  TOTAL: 34 test materials';
  RAISE NOTICE '';
  RAISE NOTICE 'All materials include:';
  RAISE NOTICE '  - Multi-capital impacts (Climate, Water, Land, Waste)';
  RAISE NOTICE '  - GHG breakdown (Fossil, Biogenic, CH4, N2O)';
  RAISE NOTICE '  - Data quality metadata';
  RAISE NOTICE '  - Methodology standards (IPCC AR6 GWP100)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Search for materials in the product recipe builder';
  RAISE NOTICE '  2. Add materials to test products';
  RAISE NOTICE '  3. Run LCA calculations';
  RAISE NOTICE '  4. Verify results against expected values';
  RAISE NOTICE '========================================';

END $$;
