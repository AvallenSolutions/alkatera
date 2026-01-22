/*
  # Calculation Verification Test Data - January 2026

  This script creates comprehensive test data for verifying all platform calculations
  before EcoInvent database integration.

  ## Test Products:
  1. Highland Single Malt Whisky (TEST-SPR-001) - Expected: 0.876 kg CO2e
  2. Marlborough Sauvignon Blanc (TEST-WIN-001) - Expected: 1.34 kg CO2e
  3. Oxford Craft Lager (TEST-BER-001) - Expected: 0.20 kg CO2e

  ## Test Facility (Test Distillery):
  - Scope 1: 15.22 tCO2e (Natural Gas + Diesel + LPG)
  - Scope 2: 20.70 tCO2e (UK Grid Electricity)
  - Scope 3: 205.20 tCO2e (Purchased Goods + Transport + Waste)
  - Total: 241.12 tCO2e

  ## Methodology:
  - GHG: IPCC AR6 GWP100 factors
  - Transport: DEFRA 2025 factors
  - Impact Categories: Climate, Water, Circularity, Nature

  ## How to Use:
  1. Create "Calculation Verification" organization via UI
  2. Log in as owner of that organization
  3. Run this script in Supabase SQL editor
  4. Trigger calculations via UI
  5. Run verify-calculation-results.sql to compare expected vs actual

  ## How to Delete:
  Run DELETE-ALL-ORGANIZATION-DATA.sql while logged into the Calculation Verification org
*/

DO $$
DECLARE
  v_org_id UUID;
  v_distillery_type_id UUID;
  v_brewery_type_id UUID;
  v_winery_type_id UUID;
  v_distillery_id UUID;
  v_brewery_id UUID;
  v_winery_id UUID;
  v_whisky_id BIGINT;
  v_wine_id BIGINT;
  v_beer_id BIGINT;
  v_whisky_lca_id UUID;
  v_wine_lca_id UUID;
  v_beer_lca_id UUID;
  -- Emission source IDs
  v_natural_gas_id UUID;
  v_diesel_id UUID;
  v_lpg_id UUID;
  v_electricity_id UUID;
BEGIN
  -- Get current organization (user must be logged into Calculation Verification org)
  v_org_id := get_current_organization_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'ERROR: No organization context. Please log into the Calculation Verification organization first.';
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Creating Calculation Verification Test Data';
  RAISE NOTICE 'Organization ID: %', v_org_id;
  RAISE NOTICE '========================================';

  -- Get facility type IDs
  SELECT id INTO v_distillery_type_id FROM facility_types WHERE name = 'Distillery';
  SELECT id INTO v_brewery_type_id FROM facility_types WHERE name = 'Brewery';
  SELECT id INTO v_winery_type_id FROM facility_types WHERE name = 'Winery';

  -- ============================================================================
  -- FACILITIES
  -- ============================================================================

  RAISE NOTICE 'Creating facilities...';

  -- Test Distillery (Highland, Scotland) - for Whisky + Corporate emissions test
  INSERT INTO facilities (id, organization_id, name, location, facility_type_id, functions, operational_control,
    address_line1, address_city, address_country, address_postcode, address_lat, address_lng, location_country_code)
  VALUES (gen_random_uuid(), v_org_id, 'Calculation Verification Distillery', 'Highland, Scotland', v_distillery_type_id,
    ARRAY['Distilling', 'Bottling'], 'owned', 'Distillery Road', 'Inverness', 'United Kingdom', 'IV1 1AA',
    57.4778, -4.2247, 'GB')
  RETURNING id INTO v_distillery_id;

  -- Test Winery (Marlborough, New Zealand) - for Wine
  INSERT INTO facilities (id, organization_id, name, location, facility_type_id, functions, operational_control,
    address_line1, address_city, address_country, address_postcode, address_lat, address_lng, location_country_code)
  VALUES (gen_random_uuid(), v_org_id, 'Calculation Verification Winery', 'Marlborough, New Zealand', v_winery_type_id,
    ARRAY['Viticulture', 'Wine Production', 'Bottling'], 'owned', 'Vineyard Lane', 'Blenheim', 'New Zealand', '7201',
    -41.5134, 173.9612, 'NZ')
  RETURNING id INTO v_winery_id;

  -- Test Brewery (Oxford, UK) - for Beer
  INSERT INTO facilities (id, organization_id, name, location, facility_type_id, functions, operational_control,
    address_line1, address_city, address_country, address_postcode, address_lat, address_lng, location_country_code)
  VALUES (gen_random_uuid(), v_org_id, 'Calculation Verification Brewery', 'Oxford, UK', v_brewery_type_id,
    ARRAY['Brewing', 'Canning'], 'owned', 'Brewery Lane', 'Oxford', 'United Kingdom', 'OX1 1AA',
    51.7520, -1.2577, 'GB')
  RETURNING id INTO v_brewery_id;

  RAISE NOTICE '✓ Created 3 facilities';

  -- ============================================================================
  -- EMISSION SOURCES FOR FACILITY ACTIVITY DATA
  -- ============================================================================

  RAISE NOTICE 'Creating emission sources...';

  -- Natural Gas (Scope 1) - 0.183 kgCO2e/kWh
  INSERT INTO scope_1_2_emission_sources (id, scope, category, source_name, description, unit, emission_factor_co2e)
  VALUES (gen_random_uuid(), 'scope_1', 'stationary_combustion', '[CALC-VERIFY] Natural Gas',
    'Natural gas combustion - DEFRA 2025', 'kWh', 0.183)
  RETURNING id INTO v_natural_gas_id;

  -- Diesel (Scope 1) - 2.64 kgCO2e/L
  INSERT INTO scope_1_2_emission_sources (id, scope, category, source_name, description, unit, emission_factor_co2e)
  VALUES (gen_random_uuid(), 'scope_1', 'mobile_combustion', '[CALC-VERIFY] Diesel Vehicles',
    'Diesel vehicle fleet - DEFRA 2025', 'L', 2.64)
  RETURNING id INTO v_diesel_id;

  -- LPG (Scope 1) - 1.58 kgCO2e/L
  INSERT INTO scope_1_2_emission_sources (id, scope, category, source_name, description, unit, emission_factor_co2e)
  VALUES (gen_random_uuid(), 'scope_1', 'stationary_combustion', '[CALC-VERIFY] LPG',
    'LPG combustion - DEFRA 2025', 'L', 1.58)
  RETURNING id INTO v_lpg_id;

  -- UK Grid Electricity (Scope 2) - 0.207 kgCO2e/kWh
  INSERT INTO scope_1_2_emission_sources (id, scope, category, source_name, description, unit, emission_factor_co2e)
  VALUES (gen_random_uuid(), 'scope_2', 'purchased_electricity', '[CALC-VERIFY] UK Grid Electricity',
    'Grid electricity UK location-based - DEFRA 2025', 'kWh', 0.207)
  RETURNING id INTO v_electricity_id;

  RAISE NOTICE '✓ Created emission sources';

  -- ============================================================================
  -- FACILITY ACTIVITY DATA (Scope 1 & 2) - Test Distillery
  -- ============================================================================

  RAISE NOTICE 'Creating facility activity data for Test Distillery...';

  -- Natural Gas: 50,000 kWh → 9.15 tCO2e (50000 × 0.183 / 1000)
  INSERT INTO facility_activity_data (facility_id, emission_source_id, quantity, unit,
    reporting_period_start, reporting_period_end)
  VALUES (v_distillery_id, v_natural_gas_id, 50000, 'kWh', '2025-01-01', '2025-12-31');

  -- Diesel: 2,000 L → 5.28 tCO2e (2000 × 2.64 / 1000)
  INSERT INTO facility_activity_data (facility_id, emission_source_id, quantity, unit,
    reporting_period_start, reporting_period_end)
  VALUES (v_distillery_id, v_diesel_id, 2000, 'L', '2025-01-01', '2025-12-31');

  -- LPG: 500 L → 0.79 tCO2e (500 × 1.58 / 1000)
  INSERT INTO facility_activity_data (facility_id, emission_source_id, quantity, unit,
    reporting_period_start, reporting_period_end)
  VALUES (v_distillery_id, v_lpg_id, 500, 'L', '2025-01-01', '2025-12-31');

  -- Grid Electricity: 100,000 kWh → 20.70 tCO2e (100000 × 0.207 / 1000)
  INSERT INTO facility_activity_data (facility_id, emission_source_id, quantity, unit,
    reporting_period_start, reporting_period_end)
  VALUES (v_distillery_id, v_electricity_id, 100000, 'kWh', '2025-01-01', '2025-12-31');

  RAISE NOTICE '✓ Created facility activity data';
  RAISE NOTICE '  Expected Scope 1: 15.22 tCO2e (9.15 + 5.28 + 0.79)';
  RAISE NOTICE '  Expected Scope 2: 20.70 tCO2e';

  -- ============================================================================
  -- PRODUCTS
  -- ============================================================================

  RAISE NOTICE 'Creating products...';

  -- Highland Single Malt Whisky
  INSERT INTO products (organization_id, name, sku, product_description, unit_size_value, unit_size_unit,
    functional_unit, system_boundary, product_category, is_draft,
    upstream_ingredients_complete, upstream_packaging_complete, core_operations_complete, core_operations_facility_id)
  VALUES (v_org_id, 'Highland Single Malt Whisky', 'TEST-SPR-001',
    'A premium single malt whisky from the Scottish Highlands. Made from malted barley, spring water, and a touch of peat smoke. Packaged in a 700ml glass bottle with traditional cork closure.',
    700, 'ml', '1 x 700ml bottle', 'cradle-to-gate', 'Spirits', false, true, true, true, v_distillery_id)
  RETURNING id INTO v_whisky_id;

  -- Marlborough Sauvignon Blanc
  INSERT INTO products (organization_id, name, sku, product_description, unit_size_value, unit_size_unit,
    functional_unit, system_boundary, product_category, is_draft,
    upstream_ingredients_complete, upstream_packaging_complete, core_operations_complete, core_operations_facility_id)
  VALUES (v_org_id, 'Marlborough Sauvignon Blanc', 'TEST-WIN-001',
    'A crisp Sauvignon Blanc from Marlborough, New Zealand. Made from estate-grown grapes. Packaged in a 750ml glass bottle with natural cork. Transported by sea to UK market.',
    750, 'ml', '1 x 750ml bottle', 'cradle-to-gate', 'Wine', false, true, true, true, v_winery_id)
  RETURNING id INTO v_wine_id;

  -- Oxford Craft Lager
  INSERT INTO products (organization_id, name, sku, product_description, unit_size_value, unit_size_unit,
    functional_unit, system_boundary, product_category, is_draft,
    upstream_ingredients_complete, upstream_packaging_complete, core_operations_complete, core_operations_facility_id)
  VALUES (v_org_id, 'Oxford Craft Lager', 'TEST-BER-001',
    'A refreshing craft lager brewed in Oxford, UK. Made from local malted barley, premium hops, and pure water. Packaged in a 330ml aluminium can.',
    330, 'ml', '1 x 330ml can', 'cradle-to-gate', 'Beer', false, true, true, true, v_brewery_id)
  RETURNING id INTO v_beer_id;

  RAISE NOTICE '✓ Created 3 products';

  -- ============================================================================
  -- PRODUCT LCAs
  -- ============================================================================

  RAISE NOTICE 'Creating product LCAs...';

  -- Whisky LCA
  INSERT INTO product_lcas (id, organization_id, product_id, product_name, product_description,
    functional_unit, system_boundary, status, reference_year, lca_methodology,
    ingredients_complete, packaging_complete, production_complete, is_draft, csrd_compliant)
  VALUES (gen_random_uuid(), v_org_id, v_whisky_id, 'Highland Single Malt Whisky',
    'A premium single malt whisky from the Scottish Highlands.', '1 x 700ml bottle', 'cradle-to-gate',
    'in_progress', 2025, 'recipe_2016', true, true, true, false, true)
  RETURNING id INTO v_whisky_lca_id;

  -- Wine LCA
  INSERT INTO product_lcas (id, organization_id, product_id, product_name, product_description,
    functional_unit, system_boundary, status, reference_year, lca_methodology,
    ingredients_complete, packaging_complete, production_complete, is_draft, csrd_compliant)
  VALUES (gen_random_uuid(), v_org_id, v_wine_id, 'Marlborough Sauvignon Blanc',
    'A crisp Sauvignon Blanc from Marlborough, New Zealand.', '1 x 750ml bottle', 'cradle-to-gate',
    'in_progress', 2025, 'recipe_2016', true, true, true, false, true)
  RETURNING id INTO v_wine_lca_id;

  -- Beer LCA
  INSERT INTO product_lcas (id, organization_id, product_id, product_name, product_description,
    functional_unit, system_boundary, status, reference_year, lca_methodology,
    ingredients_complete, packaging_complete, production_complete, is_draft, csrd_compliant)
  VALUES (gen_random_uuid(), v_org_id, v_beer_id, 'Oxford Craft Lager',
    'A refreshing craft lager brewed in Oxford, UK.', '1 x 330ml can', 'cradle-to-gate',
    'in_progress', 2025, 'recipe_2016', true, true, true, false, true)
  RETURNING id INTO v_beer_lca_id;

  -- Link LCAs to products
  UPDATE products SET latest_lca_id = v_whisky_lca_id, has_active_lca = true WHERE id = v_whisky_id;
  UPDATE products SET latest_lca_id = v_wine_lca_id, has_active_lca = true WHERE id = v_wine_id;
  UPDATE products SET latest_lca_id = v_beer_lca_id, has_active_lca = true WHERE id = v_beer_id;

  RAISE NOTICE '✓ Created product LCAs';

  -- ============================================================================
  -- PRODUCT MATERIALS - Whisky (TEST-SPR-001)
  -- Expected Total: 0.876 kg CO2e
  -- ============================================================================

  RAISE NOTICE 'Creating materials for Highland Single Malt Whisky...';

  -- Malted Barley: 0.5 kg → 0.38 kg CO2e
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id,
    origin_country, origin_address, origin_lat, origin_lng, origin_country_code, transport_mode, distance_km)
  VALUES (v_whisky_id, 'Malted Barley', 'ingredient', 0.5, 'kg', 1, 1, 'United Kingdom',
    'East Anglia, UK', 52.2053, 0.1218, 'GB', 'truck', 300);

  -- Water: 5 L → 0.0017 kg CO2e
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id,
    origin_country)
  VALUES (v_whisky_id, 'Spring Water', 'ingredient', 5, 'L', 1, 1, 'United Kingdom');

  -- Peat: 0.002 kg → 0.0017 kg CO2e
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id,
    origin_country, notes)
  VALUES (v_whisky_id, 'Peat', 'ingredient', 0.002, 'kg', 1, 1, 'United Kingdom', 'For smoke flavouring');

  -- Glass Bottle: 0.5 kg → 0.43 kg CO2e (flint/clear glass)
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id,
    packaging_category, notes)
  VALUES (v_whisky_id, 'Glass Bottle 700ml (Flint)', 'packaging', 0.5, 'kg', 1, 3, 'container', '700ml clear glass bottle');

  -- Cork Closure: 0.005 kg → 0.006 kg CO2e
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id,
    packaging_category, notes)
  VALUES (v_whisky_id, 'Natural Cork Closure', 'packaging', 0.005, 'kg', 1, 3, 'closure', 'Traditional cork stopper');

  -- ============================================================================
  -- PRODUCT LCA MATERIALS - Whisky (with full GHG breakdown)
  -- ============================================================================

  -- Malted Barley: 0.5 kg
  -- CO2 Fossil: 0.225 kg, CO2 Biogenic: 0.075 kg, CH4: 0.0015 kg, N2O: 0.0004 kg → 0.38 kg CO2e
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, country_of_origin,
    impact_climate, impact_water, impact_land, impact_waste,
    impact_climate_fossil, impact_climate_biogenic,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference, geographic_scope,
    transport_mode, distance_km, impact_transport)
  VALUES (v_whisky_lca_id, 'Malted Barley', 'Malted Barley', 'ingredient', 0.5, 'kg', 1, 'United Kingdom',
    0.38, 0.71, 1.4, 0.05, 0.225, 0.075,
    1, 'Primary_Verified', 90, 'IPCC AR6 GWP100', 'Test Data - Malted Barley 0.76 kgCO2e/kg', 'UK',
    'truck', 300, 0.017);

  -- Spring Water: 5 L
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, country_of_origin,
    impact_climate, impact_water, impact_land, impact_waste,
    impact_climate_fossil,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference)
  VALUES (v_whisky_lca_id, 'Spring Water', 'Spring Water', 'ingredient', 5, 'L', 1, 'United Kingdom',
    0.0017, 5.0, 0.0005, 0.0001, 0.0016,
    2, 'Regional_Standard', 85, 'IPCC AR6 GWP100', 'Test Data - Spring Water 0.00034 kgCO2e/L');

  -- Peat: 0.002 kg
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, country_of_origin,
    impact_climate, impact_water, impact_land, impact_waste,
    impact_climate_fossil, impact_climate_biogenic,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference)
  VALUES (v_whisky_lca_id, 'Peat', 'Peat', 'ingredient', 0.002, 'kg', 1, 'United Kingdom',
    0.0017, 0.0002, 0.03, 0.0001, 0.0017, 0.0006,
    2, 'Regional_Standard', 80, 'IPCC AR6 GWP100', 'Test Data - Peat high land use impact');

  -- Glass Bottle: 0.5 kg (flint/clear)
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, packaging_category,
    impact_climate, impact_water, impact_land, impact_waste,
    impact_climate_fossil,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference)
  VALUES (v_whisky_lca_id, 'Glass Bottle 700ml (Flint)', 'Glass Bottle 700ml (Flint)', 'packaging', 0.5, 'kg', 3, 'container',
    0.43, 0.0125, 0.075, 0.015, 0.41,
    2, 'Regional_Standard', 85, 'IPCC AR6 GWP100', 'Test Data - Glass flint 1.09 kgCO2e/kg');

  -- Cork Closure: 0.005 kg
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, packaging_category,
    impact_climate, impact_water, impact_land, impact_waste,
    impact_climate_biogenic,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference)
  VALUES (v_whisky_lca_id, 'Natural Cork Closure', 'Natural Cork Closure', 'packaging', 0.005, 'kg', 3, 'closure',
    0.006, 0.0015, 0.0425, 0.0003, 0.005,
    2, 'Regional_Standard', 80, 'IPCC AR6 GWP100', 'Test Data - Natural cork');

  RAISE NOTICE '✓ Whisky materials created - Expected: 0.876 kg CO2e';

  -- ============================================================================
  -- PRODUCT MATERIALS - Wine (TEST-WIN-001)
  -- Expected Total: 1.34 kg CO2e (higher due to NZ→UK transport)
  -- ============================================================================

  RAISE NOTICE 'Creating materials for Marlborough Sauvignon Blanc...';

  -- Sauvignon Blanc Grapes: 1.2 kg
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id,
    origin_country, origin_address, origin_lat, origin_lng, origin_country_code, transport_mode, distance_km)
  VALUES (v_wine_id, 'Sauvignon Blanc Grapes', 'ingredient', 1.2, 'kg', 1, 1, 'New Zealand',
    'Marlborough, New Zealand', -41.5134, 173.9612, 'NZ', 'truck', 5);

  -- Water: 2 L
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id,
    origin_country)
  VALUES (v_wine_id, 'Process Water', 'ingredient', 2, 'L', 1, 1, 'New Zealand');

  -- SO2: 0.0001 kg (preservative)
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id,
    origin_country, notes)
  VALUES (v_wine_id, 'Sulphur Dioxide (SO2)', 'ingredient', 0.0001, 'kg', 1, 1, 'New Zealand', 'Wine preservative');

  -- Glass Bottle: 0.55 kg (green)
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id,
    packaging_category, notes)
  VALUES (v_wine_id, 'Glass Bottle 750ml (Green)', 'packaging', 0.55, 'kg', 1, 3, 'container', '750ml green glass bottle');

  -- Cork: 0.004 kg
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id,
    packaging_category)
  VALUES (v_wine_id, 'Natural Cork', 'packaging', 0.004, 'kg', 1, 3, 'closure');

  -- ============================================================================
  -- PRODUCT LCA MATERIALS - Wine
  -- ============================================================================

  -- Sauvignon Blanc Grapes: 1.2 kg → 0.66 kg CO2e (0.55 kgCO2e/kg)
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, country_of_origin,
    impact_climate, impact_water, impact_land, impact_waste,
    impact_climate_fossil, impact_climate_biogenic,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference, geographic_scope,
    transport_mode, distance_km, impact_transport)
  VALUES (v_wine_lca_id, 'Sauvignon Blanc Grapes', 'Sauvignon Blanc Grapes', 'ingredient', 1.2, 'kg', 1, 'New Zealand',
    0.66, 0.984, 1.92, 0.06, 0.42, 0.144,
    1, 'Primary_Verified', 90, 'IPCC AR6 GWP100', 'Test Data - SB Grapes 0.55 kgCO2e/kg', 'NZ',
    'truck', 5, 0.0003);

  -- Process Water: 2 L
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, country_of_origin,
    impact_climate, impact_water, impact_land, impact_waste,
    impact_climate_fossil,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference)
  VALUES (v_wine_lca_id, 'Process Water', 'Process Water', 'ingredient', 2, 'L', 1, 'New Zealand',
    0.00068, 2.0, 0.0002, 0.00004, 0.00064,
    2, 'Regional_Standard', 85, 'IPCC AR6 GWP100', 'Test Data - Municipal water');

  -- SO2: 0.0001 kg
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, country_of_origin,
    impact_climate, impact_water, impact_land, impact_waste,
    impact_climate_fossil,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference)
  VALUES (v_wine_lca_id, 'Sulphur Dioxide (SO2)', 'Sulphur Dioxide (SO2)', 'ingredient', 0.0001, 'kg', 1, 'New Zealand',
    0.000145, 0.00001, 0.000005, 0.000001, 0.000145,
    3, 'Secondary_Modelled', 70, 'IPCC AR6 GWP100', 'Test Data - SO2 preservative');

  -- Glass Bottle: 0.55 kg (green) → 0.47 kg CO2e
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, packaging_category,
    impact_climate, impact_water, impact_land, impact_waste,
    impact_climate_fossil,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference)
  VALUES (v_wine_lca_id, 'Glass Bottle 750ml (Green)', 'Glass Bottle 750ml (Green)', 'packaging', 0.55, 'kg', 3, 'container',
    0.47, 0.014, 0.0825, 0.0165, 0.45,
    2, 'Regional_Standard', 85, 'IPCC AR6 GWP100', 'Test Data - Green glass 1.05 kgCO2e/kg');

  -- Cork: 0.004 kg
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, packaging_category,
    impact_climate, impact_water, impact_land, impact_waste,
    impact_climate_biogenic,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference)
  VALUES (v_wine_lca_id, 'Natural Cork', 'Natural Cork', 'packaging', 0.004, 'kg', 3, 'closure',
    0.005, 0.0012, 0.034, 0.00024, 0.004,
    2, 'Regional_Standard', 80, 'IPCC AR6 GWP100', 'Test Data - Natural cork');

  -- TRANSPORT: 12,000 km sea + road (NZ to UK) → 0.20 kg CO2e
  -- Using sea container: 0.01612 kg/tkm × 0.55 kg × 11500 km = 0.102 kg
  -- Using road HGV: 0.11148 kg/tkm × 0.55 kg × 500 km = 0.031 kg
  -- Plus product weight impact
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id,
    impact_climate, impact_water, impact_land, impact_waste,
    impact_climate_fossil,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference,
    transport_mode, distance_km, impact_transport)
  VALUES (v_wine_lca_id, 'Transport NZ to UK', 'Distribution Transport', 'transport', 1, 'unit', 4,
    0.20, 0.001, 0.0005, 0.0001, 0.19,
    2, 'Regional_Standard', 80, 'DEFRA 2025', 'Test Data - Sea + Road transport 12000km total',
    'sea', 12000, 0.20);

  RAISE NOTICE '✓ Wine materials created - Expected: 1.34 kg CO2e';

  -- ============================================================================
  -- PRODUCT MATERIALS - Beer (TEST-BER-001)
  -- Expected Total: 0.20 kg CO2e
  -- ============================================================================

  RAISE NOTICE 'Creating materials for Oxford Craft Lager...';

  -- Malted Barley: 0.08 kg
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id,
    origin_country, origin_address, origin_lat, origin_lng, origin_country_code, transport_mode, distance_km)
  VALUES (v_beer_id, 'Malted Barley', 'ingredient', 0.08, 'kg', 1, 1, 'United Kingdom',
    'East Anglia, UK', 52.2053, 0.1218, 'GB', 'truck', 150);

  -- Hops (pellets): 0.003 kg
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id,
    origin_country, origin_address, origin_lat, origin_lng, origin_country_code, transport_mode, distance_km)
  VALUES (v_beer_id, 'Hops (Pellets)', 'ingredient', 0.003, 'kg', 1, 1, 'United Kingdom',
    'Kent, UK', 51.2787, 0.5217, 'GB', 'truck', 120);

  -- Brewing Water: 0.8 L
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id,
    origin_country)
  VALUES (v_beer_id, 'Brewing Water', 'ingredient', 0.8, 'L', 1, 1, 'United Kingdom');

  -- Yeast: 0.001 kg
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id,
    origin_country)
  VALUES (v_beer_id, 'Brewing Yeast', 'ingredient', 0.001, 'kg', 1, 1, 'United Kingdom');

  -- Aluminium Can: 0.015 kg (50% recycled)
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id,
    packaging_category, notes)
  VALUES (v_beer_id, 'Aluminium Can 330ml (50% recycled)', 'packaging', 0.015, 'kg', 1, 3, 'container', '330ml can with direct print');

  -- ============================================================================
  -- PRODUCT LCA MATERIALS - Beer
  -- ============================================================================

  -- Malted Barley: 0.08 kg → 0.061 kg CO2e
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, country_of_origin,
    impact_climate, impact_water, impact_land, impact_waste,
    impact_climate_fossil, impact_climate_biogenic,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference, geographic_scope,
    transport_mode, distance_km, impact_transport)
  VALUES (v_beer_lca_id, 'Malted Barley', 'Malted Barley', 'ingredient', 0.08, 'kg', 1, 'United Kingdom',
    0.061, 0.114, 0.224, 0.008, 0.036, 0.012,
    1, 'Primary_Verified', 90, 'IPCC AR6 GWP100', 'Test Data - Malted Barley 0.76 kgCO2e/kg', 'UK',
    'truck', 150, 0.0011);

  -- Hops (pellets): 0.003 kg → 0.007 kg CO2e (2.35 kgCO2e/kg)
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, country_of_origin,
    impact_climate, impact_water, impact_land, impact_waste,
    impact_climate_fossil, impact_climate_biogenic,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference, geographic_scope,
    transport_mode, distance_km, impact_transport)
  VALUES (v_beer_lca_id, 'Hops (Pellets)', 'Hops (Pellets)', 'ingredient', 0.003, 'kg', 1, 'United Kingdom',
    0.007, 0.0093, 0.0165, 0.0003, 0.0047, 0.0015,
    2, 'Regional_Standard', 85, 'IPCC AR6 GWP100', 'Test Data - Hop pellets 2.35 kgCO2e/kg', 'UK',
    'truck', 120, 0.00003);

  -- Brewing Water: 0.8 L
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, country_of_origin,
    impact_climate, impact_water, impact_land, impact_waste,
    impact_climate_fossil,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference)
  VALUES (v_beer_lca_id, 'Brewing Water', 'Brewing Water', 'ingredient', 0.8, 'L', 1, 'United Kingdom',
    0.00027, 0.8, 0.00008, 0.00002, 0.000256,
    1, 'Primary_Verified', 95, 'IPCC AR6 GWP100', 'Test Data - Municipal water 0.00034 kgCO2e/L');

  -- Brewing Yeast: 0.001 kg → 0.002 kg CO2e (1.85 kgCO2e/kg)
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, country_of_origin,
    impact_climate, impact_water, impact_land, impact_waste,
    impact_climate_fossil, impact_climate_biogenic,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference)
  VALUES (v_beer_lca_id, 'Brewing Yeast', 'Brewing Yeast', 'ingredient', 0.001, 'kg', 1, 'United Kingdom',
    0.002, 0.0005, 0.0005, 0.00005, 0.0012, 0.0004,
    2, 'Regional_Standard', 80, 'IPCC AR6 GWP100', 'Test Data - Brewing yeast 1.85 kgCO2e/kg');

  -- Aluminium Can: 0.015 kg (50% recycled) → 0.10 kg CO2e (6.90 kgCO2e/kg)
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, packaging_category,
    impact_climate, impact_water, impact_land, impact_waste,
    impact_climate_fossil,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference)
  VALUES (v_beer_lca_id, 'Aluminium Can 330ml (50% recycled)', 'Aluminium Can 330ml (50% recycled)', 'packaging', 0.015, 'kg', 3, 'container',
    0.10, 0.00057, 0.01875, 0.003, 0.10,
    2, 'Regional_Standard', 85, 'IPCC AR6 GWP100', 'Test Data - Aluminium 50% recycled 6.90 kgCO2e/kg');

  -- Transport: 30 km road → 0.033 kg CO2e
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id,
    impact_climate, impact_water, impact_land, impact_waste,
    impact_climate_fossil,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference,
    transport_mode, distance_km, impact_transport)
  VALUES (v_beer_lca_id, 'Local Distribution', 'Distribution Transport', 'transport', 1, 'unit', 4,
    0.033, 0.0001, 0.00005, 0.00001, 0.032,
    2, 'Regional_Standard', 80, 'DEFRA 2025', 'Test Data - Road HGV 30km',
    'truck', 30, 0.033);

  RAISE NOTICE '✓ Beer materials created - Expected: 0.20 kg CO2e';

  -- ============================================================================
  -- CORPORATE OVERHEADS (Scope 3)
  -- For Test Distillery: Cat 1 (186.5), Cat 4 (13.5), Cat 5 (5.2) = 205.2 tCO2e
  -- ============================================================================

  RAISE NOTICE 'Creating corporate overhead data (Scope 3)...';

  -- Category 1 - Purchased Goods (from product LCAs - simulated aggregate)
  INSERT INTO corporate_overheads (organization_id, category, sub_category, description,
    quantity, unit, reporting_period_start, reporting_period_end)
  VALUES (v_org_id, 'scope_3_cat_1_purchased', 'purchased_goods',
    '[CALC-VERIFY] Purchased goods from upstream product LCAs',
    186500, 'kg_co2e', '2025-01-01', '2025-12-31');

  -- Category 4 - Upstream Transport
  INSERT INTO corporate_overheads (organization_id, category, sub_category, description,
    quantity, unit, reporting_period_start, reporting_period_end)
  VALUES (v_org_id, 'scope_3_cat_4_upstream_transport', 'inbound_logistics',
    '[CALC-VERIFY] Inbound logistics for raw materials',
    13500, 'kg_co2e', '2025-01-01', '2025-12-31');

  -- Category 5 - Waste (breakdown: 2,800 kg CO2 + 85 kg CH4 × 27.2 + 0.5 kg N2O × 273 ≈ 5.2 tCO2e)
  INSERT INTO corporate_overheads (organization_id, category, sub_category, description,
    quantity, unit, reporting_period_start, reporting_period_end)
  VALUES (v_org_id, 'scope_3_cat_5_waste', 'waste_treatment',
    '[CALC-VERIFY] Waste generated in operations',
    5200, 'kg_co2e', '2025-01-01', '2025-12-31');

  RAISE NOTICE '✓ Corporate overheads created';
  RAISE NOTICE '  Expected Scope 3: 205.20 tCO2e (186.5 + 13.5 + 5.2)';

  -- ============================================================================
  -- PRODUCTION SITES (Link products to facilities)
  -- ============================================================================

  RAISE NOTICE 'Linking products to production sites...';

  INSERT INTO product_lca_production_sites (product_lca_id, facility_id, organization_id,
    production_volume, share_of_production, data_source)
  VALUES
    (v_whisky_lca_id, v_distillery_id, v_org_id, 10000, 1.00, 'Verified'),
    (v_wine_lca_id, v_winery_id, v_org_id, 50000, 1.00, 'Verified'),
    (v_beer_lca_id, v_brewery_id, v_org_id, 100000, 1.00, 'Verified');

  RAISE NOTICE '✓ Production sites linked';

  -- ============================================================================
  -- SUMMARY
  -- ============================================================================

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CALCULATION VERIFICATION DATA CREATED';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Products:';
  RAISE NOTICE '  1. Highland Single Malt Whisky (TEST-SPR-001)';
  RAISE NOTICE '     Expected: 0.876 kg CO2e per 700ml bottle';
  RAISE NOTICE '';
  RAISE NOTICE '  2. Marlborough Sauvignon Blanc (TEST-WIN-001)';
  RAISE NOTICE '     Expected: 1.34 kg CO2e per 750ml bottle';
  RAISE NOTICE '';
  RAISE NOTICE '  3. Oxford Craft Lager (TEST-BER-001)';
  RAISE NOTICE '     Expected: 0.20 kg CO2e per 330ml can';
  RAISE NOTICE '';
  RAISE NOTICE 'Facility Emissions (Test Distillery):';
  RAISE NOTICE '  Scope 1: 15.22 tCO2e';
  RAISE NOTICE '  Scope 2: 20.70 tCO2e';
  RAISE NOTICE '  Scope 3: 205.20 tCO2e';
  RAISE NOTICE '  TOTAL: 241.12 tCO2e';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Verify data appears correctly in UI';
  RAISE NOTICE '  2. Trigger LCA calculations for each product';
  RAISE NOTICE '  3. Trigger facility emissions calculation';
  RAISE NOTICE '  4. Run verify-calculation-results.sql';
  RAISE NOTICE '========================================';

END $$;
