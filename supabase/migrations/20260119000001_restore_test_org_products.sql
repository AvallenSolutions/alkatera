/*
  # Restore Test Products in Test Organisation

  This migration restores the test products for the Test organisation (test@test.com).
  It first removes any existing partial data and then re-creates the complete test dataset.
*/

DO $$
DECLARE
  v_org_id UUID := '1a82261c-0722-4e9f-9b92-bf8ac914f77e'; -- Test organization
  v_distillery_type_id UUID;
  v_brewery_type_id UUID;
  v_winery_type_id UUID;
  v_bottling_type_id UUID;
  v_distillery_id UUID;
  v_brewery_id UUID;
  v_winery_id UUID;
  v_bottling_plant_id UUID;
  v_calvados_id BIGINT;
  v_beer_id BIGINT;
  v_wine_id BIGINT;
  v_calvados_lca_id UUID;
  v_beer_lca_id UUID;
  v_wine_lca_id UUID;
BEGIN
  -- First, clean up any existing test product data to avoid conflicts
  -- Delete in correct order due to foreign key constraints

  -- Delete production sites for existing test LCAs
  DELETE FROM product_lca_production_sites
  WHERE product_lca_id IN (
    SELECT id FROM product_lcas WHERE organization_id = v_org_id
  );

  -- Delete materials for existing test LCAs
  DELETE FROM product_lca_materials
  WHERE product_lca_id IN (
    SELECT id FROM product_lcas WHERE organization_id = v_org_id
  );

  -- Delete product materials for existing test products
  DELETE FROM product_materials
  WHERE product_id IN (
    SELECT id FROM products WHERE organization_id = v_org_id
  );

  -- Delete LCAs for test org
  DELETE FROM product_lcas WHERE organization_id = v_org_id;

  -- Delete products for test org
  DELETE FROM products WHERE organization_id = v_org_id;

  -- Delete test facilities
  DELETE FROM facilities WHERE organization_id = v_org_id
    AND name IN ('Test Distillery', 'Test Brewery', 'Test Winery', 'Test Bottling Plant');

  -- Now recreate everything
  SELECT id INTO v_distillery_type_id FROM facility_types WHERE name = 'Distillery';
  SELECT id INTO v_brewery_type_id FROM facility_types WHERE name = 'Brewery';
  SELECT id INTO v_winery_type_id FROM facility_types WHERE name = 'Winery';
  SELECT id INTO v_bottling_type_id FROM facility_types WHERE name = 'Bottling';

  -- FACILITIES
  INSERT INTO facilities (id, organization_id, name, location, facility_type_id, functions, operational_control,
    address_line1, address_city, address_country, address_postcode, address_lat, address_lng, location_country_code)
  VALUES (gen_random_uuid(), v_org_id, 'Test Distillery', 'Normandy, France', v_distillery_type_id,
    ARRAY['Distilling', 'Bottling'], 'third_party', 'Route du Calvados', 'Pont-l''Évêque', 'France', '14130',
    49.2833, 0.1833, 'FR')
  RETURNING id INTO v_distillery_id;

  INSERT INTO facilities (id, organization_id, name, location, facility_type_id, functions, operational_control,
    address_line1, address_city, address_country, address_postcode, address_lat, address_lng, location_country_code)
  VALUES (gen_random_uuid(), v_org_id, 'Test Brewery', 'Oxford, UK', v_brewery_type_id,
    ARRAY['Brewing', 'Canning'], 'owned', 'Brewery Lane', 'Oxford', 'United Kingdom', 'OX1 1AA',
    51.7520, -1.2577, 'GB')
  RETURNING id INTO v_brewery_id;

  INSERT INTO facilities (id, organization_id, name, location, facility_type_id, functions, operational_control,
    address_line1, address_city, address_country, address_postcode, address_lat, address_lng, location_country_code)
  VALUES (gen_random_uuid(), v_org_id, 'Test Winery', 'Central Otago, New Zealand', v_winery_type_id,
    ARRAY['Viticulture', 'Wine Production'], 'owned', 'Vineyard Road', 'Cromwell', 'New Zealand', '9310',
    -45.0333, 169.2000, 'NZ')
  RETURNING id INTO v_winery_id;

  INSERT INTO facilities (id, organization_id, name, location, facility_type_id, functions, operational_control,
    address_line1, address_city, address_country, address_postcode, address_lat, address_lng, location_country_code)
  VALUES (gen_random_uuid(), v_org_id, 'Test Bottling Plant', 'Christchurch, New Zealand', v_bottling_type_id,
    ARRAY['Bottling', 'Labelling'], 'third_party', 'Industrial Avenue', 'Christchurch', 'New Zealand', '8011',
    -43.5321, 172.6362, 'NZ')
  RETURNING id INTO v_bottling_plant_id;

  -- PRODUCTS
  INSERT INTO products (organization_id, name, sku, product_description, unit_size_value, unit_size_unit,
    functional_unit, system_boundary, product_category, is_draft,
    upstream_ingredients_complete, upstream_packaging_complete, core_operations_complete)
  VALUES (v_org_id, 'TEST CALVADOS', 'TEST-CAL-001',
    'An apple brandy from Normandy in France. Made from 8kg of organic apples and water, distilled and bottled at a third-party distillery. Packaged in a 700ml glass bottle with traditional wood and cork stopper.',
    700, 'ml', '1 x 700ml bottle', 'cradle_to_gate', 'Spirits', false, true, true, true)
  RETURNING id INTO v_calvados_id;

  INSERT INTO products (organization_id, name, sku, product_description, unit_size_value, unit_size_unit,
    functional_unit, system_boundary, product_category, is_draft,
    upstream_ingredients_complete, upstream_packaging_complete, core_operations_complete, core_operations_facility_id)
  VALUES (v_org_id, 'TEST NON-ALC BEER', 'TEST-NAB-001',
    'A non-alcoholic beer brewed and canned on the same site in Oxford, UK. Made from barley, hops, and water, canned in a 330ml aluminium can with direct printing.',
    330, 'ml', '1 x 330ml can', 'cradle_to_gate', 'Beer', false, true, true, true, v_brewery_id)
  RETURNING id INTO v_beer_id;

  INSERT INTO products (organization_id, name, sku, product_description, unit_size_value, unit_size_unit,
    functional_unit, system_boundary, product_category, is_draft,
    upstream_ingredients_complete, upstream_packaging_complete, core_operations_complete, core_operations_facility_id)
  VALUES (v_org_id, 'TEST WINE', 'TEST-WIN-001',
    'A red wine made from Pinot Noir grapes in Central Otago, New Zealand. Grapes grown at the vineyard, wine processed on site but bottled at a central bottling plant 100km away. Packaged in a 750ml green glass bottle with paper label, traditional cork, and foil wrapper.',
    750, 'ml', '1 x 750ml bottle', 'cradle_to_gate', 'Wine', false, true, true, true, v_winery_id)
  RETURNING id INTO v_wine_id;

  -- PRODUCT LCAs
  INSERT INTO product_lcas (id, organization_id, product_id, product_name, product_description,
    functional_unit, system_boundary, status, reference_year, lca_methodology,
    ingredients_complete, packaging_complete, production_complete, is_draft, csrd_compliant)
  VALUES (gen_random_uuid(), v_org_id, v_calvados_id, 'TEST CALVADOS',
    'An apple brandy from Normandy in France.', '1 x 700ml bottle', 'cradle-to-gate',
    'completed', 2024, 'recipe_2016', true, true, true, false, true)
  RETURNING id INTO v_calvados_lca_id;

  INSERT INTO product_lcas (id, organization_id, product_id, product_name, product_description,
    functional_unit, system_boundary, status, reference_year, lca_methodology,
    ingredients_complete, packaging_complete, production_complete, is_draft, csrd_compliant)
  VALUES (gen_random_uuid(), v_org_id, v_beer_id, 'TEST NON-ALC BEER',
    'A non-alcoholic beer brewed and canned in Oxford, UK.', '1 x 330ml can', 'cradle-to-gate',
    'completed', 2024, 'recipe_2016', true, true, true, false, true)
  RETURNING id INTO v_beer_lca_id;

  INSERT INTO product_lcas (id, organization_id, product_id, product_name, product_description,
    functional_unit, system_boundary, status, reference_year, lca_methodology,
    ingredients_complete, packaging_complete, production_complete, is_draft, csrd_compliant)
  VALUES (gen_random_uuid(), v_org_id, v_wine_id, 'TEST WINE',
    'A red wine made from Pinot Noir grapes in Central Otago, New Zealand.', '1 x 750ml bottle', 'cradle-to-gate',
    'completed', 2024, 'recipe_2016', true, true, true, false, true)
  RETURNING id INTO v_wine_lca_id;

  UPDATE products SET latest_lca_id = v_calvados_lca_id, has_active_lca = true WHERE id = v_calvados_id;
  UPDATE products SET latest_lca_id = v_beer_lca_id, has_active_lca = true WHERE id = v_beer_id;
  UPDATE products SET latest_lca_id = v_wine_lca_id, has_active_lca = true WHERE id = v_wine_id;

  -- PRODUCT MATERIALS
  -- Calvados
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id,
    origin_country, is_organic_certified, origin_address, origin_lat, origin_lng, origin_country_code, transport_mode, distance_km)
  VALUES (v_calvados_id, 'Organic Apples', 'ingredient', 8.0, 'kg', 1, 1, 'France', true,
    'Normandy, France', 49.1829, -0.3707, 'FR', 'truck', 50);
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id, origin_country)
  VALUES (v_calvados_id, 'Process Water', 'ingredient', 2.0, 'L', 1, 1, 'France');
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id, packaging_category, notes)
  VALUES (v_calvados_id, 'Glass Bottle 700ml (65% recycled)', 'packaging', 0.480, 'kg', 1, 3, 'container', '700ml glass bottle, 480g weight, 65% recycled glass content');
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id, packaging_category, notes)
  VALUES (v_calvados_id, 'Paper Label (100% recycled)', 'packaging', 0.005, 'kg', 1, 3, 'label', '100% recycled paper label');
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id, packaging_category, notes)
  VALUES (v_calvados_id, 'Traditional Wood and Cork Stopper', 'packaging', 0.015, 'kg', 1, 3, 'closure', 'Traditional wood and cork stopper');

  -- Beer
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id,
    origin_country, origin_address, origin_lat, origin_lng, origin_country_code, transport_mode, distance_km)
  VALUES (v_beer_id, 'Malted Barley', 'ingredient', 0.080, 'kg', 1, 1, 'United Kingdom',
    'East Anglia, UK', 52.2053, 0.1218, 'GB', 'truck', 150);
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id,
    origin_country, origin_address, origin_lat, origin_lng, origin_country_code, transport_mode, distance_km)
  VALUES (v_beer_id, 'Hops', 'ingredient', 0.003, 'kg', 1, 1, 'United Kingdom',
    'Kent, UK', 51.2787, 0.5217, 'GB', 'truck', 120);
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id, origin_country)
  VALUES (v_beer_id, 'Brewing Water', 'ingredient', 0.5, 'L', 1, 1, 'United Kingdom');
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id, packaging_category, notes)
  VALUES (v_beer_id, 'Aluminium Can 330ml (direct print)', 'packaging', 0.015, 'kg', 1, 3, 'container', '330ml aluminium can with direct printing');

  -- Wine
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id,
    origin_country, origin_address, origin_lat, origin_lng, origin_country_code, transport_mode, distance_km, notes)
  VALUES (v_wine_id, 'Pinot Noir Grapes', 'ingredient', 1.2, 'kg', 1, 1, 'New Zealand',
    'Central Otago, New Zealand', -45.0333, 169.2000, 'NZ', 'truck', 5, 'Grapes grown at the vineyard');
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id, origin_country)
  VALUES (v_wine_id, 'Process Water', 'ingredient', 0.3, 'L', 1, 1, 'New Zealand');
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id, packaging_category, notes,
    origin_address, origin_lat, origin_lng, origin_country_code, transport_mode, distance_km)
  VALUES (v_wine_id, 'Green Glass Bottle 750ml (80% recycled)', 'packaging', 0.500, 'kg', 1, 3, 'container', '750ml green glass bottle, 80% recycled',
    'Christchurch, New Zealand', -43.5321, 172.6362, 'NZ', 'truck', 100);
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id, packaging_category)
  VALUES (v_wine_id, 'Paper Label', 'packaging', 0.004, 'kg', 1, 3, 'label');
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id, packaging_category, notes)
  VALUES (v_wine_id, 'Traditional Cork', 'packaging', 0.004, 'kg', 1, 3, 'closure', 'Natural cork closure');
  INSERT INTO product_materials (product_id, material_name, material_type, quantity, unit, lca_stage_id, lca_sub_stage_id, packaging_category, notes)
  VALUES (v_wine_id, 'Foil Capsule', 'packaging', 0.003, 'kg', 1, 3, 'closure', 'Aluminium foil capsule');

  -- LCA MATERIALS WITH IMPACT DATA
  -- Calvados
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, country_of_origin, is_organic,
    impact_climate, impact_water, impact_land, impact_waste,
    impact_climate_fossil, impact_climate_biogenic,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference, geographic_scope)
  VALUES (v_calvados_lca_id, 'Organic Apples', 'Organic Apples', 'ingredient', 8.0, 'kg', 1, 'France', true,
    2.40, 4.80, 12.00, 0.40, 0.80, 1.60,
    2, 'Regional_Standard', 85, 'ReCiPe 2016 Midpoint (H)', 'Ecoinvent 3.12 - Apple production, organic FR', 'EU');
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, country_of_origin,
    impact_climate, impact_water, impact_land, impact_waste,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference)
  VALUES (v_calvados_lca_id, 'Process Water', 'Process Water', 'ingredient', 2.0, 'L', 1, 'France',
    0.0006, 2.00, 0.0002, 0.0002,
    2, 'Regional_Standard', 90, 'ReCiPe 2016 Midpoint (H)', 'Ecoinvent 3.12 - Tap water FR');
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, packaging_category,
    impact_climate, impact_water, impact_land, impact_waste, impact_climate_fossil,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference)
  VALUES (v_calvados_lca_id, 'Glass Bottle 700ml (65% recycled)', 'Glass Bottle 700ml (65% recycled)', 'packaging', 0.480, 'kg', 3, 'container',
    0.336, 0.0019, 0.0067, 0.0144, 0.336,
    2, 'Regional_Standard', 80, 'ReCiPe 2016 Midpoint (H)', 'Ecoinvent 3.12 - Glass bottle 65% recycled');
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, packaging_category,
    impact_climate, impact_water, impact_land, impact_waste, impact_climate_biogenic,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference)
  VALUES (v_calvados_lca_id, 'Paper Label (100% recycled)', 'Paper Label (100% recycled)', 'packaging', 0.005, 'kg', 3, 'label',
    0.0028, 0.0002, 0.0023, 0.0001, 0.0015,
    2, 'Regional_Standard', 75, 'ReCiPe 2016 Midpoint (H)', 'Ecoinvent 3.12 - Recycled paper label');
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, packaging_category,
    impact_climate, impact_water, impact_land, impact_waste, impact_climate_biogenic,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference)
  VALUES (v_calvados_lca_id, 'Traditional Wood and Cork Stopper', 'Traditional Wood and Cork Stopper', 'packaging', 0.015, 'kg', 3, 'closure',
    0.015, 0.0045, 0.12, 0.0008, 0.020,
    2, 'Regional_Standard', 70, 'ReCiPe 2016 Midpoint (H)', 'Ecoinvent 3.12 - Natural cork stopper');

  -- Beer
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, country_of_origin,
    impact_climate, impact_water, impact_land, impact_waste,
    impact_climate_fossil, impact_climate_biogenic,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference, geographic_scope,
    transport_mode, distance_km, impact_transport)
  VALUES (v_beer_lca_id, 'Malted Barley', 'Malted Barley', 'ingredient', 0.080, 'kg', 1, 'United Kingdom',
    0.104, 0.096, 0.176, 0.008, 0.080, 0.024,
    1, 'Primary_Verified', 90, 'ReCiPe 2016 Midpoint (H)', 'DEFRA 2024 + Ecoinvent 3.12 - Barley malt GB', 'UK',
    'truck', 150, 0.0011);
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, country_of_origin,
    impact_climate, impact_water, impact_land, impact_waste,
    impact_climate_fossil, impact_climate_biogenic,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference, geographic_scope,
    transport_mode, distance_km, impact_transport)
  VALUES (v_beer_lca_id, 'Hops', 'Hops', 'ingredient', 0.003, 'kg', 1, 'United Kingdom',
    0.012, 0.009, 0.027, 0.0003, 0.009, 0.003,
    2, 'Regional_Standard', 85, 'ReCiPe 2016 Midpoint (H)', 'Ecoinvent 3.12 - Hop production GB', 'UK',
    'truck', 120, 0.00003);
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, country_of_origin,
    impact_climate, impact_water, impact_land, impact_waste,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference)
  VALUES (v_beer_lca_id, 'Brewing Water', 'Brewing Water', 'ingredient', 0.5, 'L', 1, 'United Kingdom',
    0.00015, 0.50, 0.00005, 0.00005,
    1, 'Primary_Verified', 95, 'ReCiPe 2016 Midpoint (H)', 'Municipal tap water GB');
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, packaging_category,
    impact_climate, impact_water, impact_land, impact_waste, impact_climate_fossil,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference)
  VALUES (v_beer_lca_id, 'Aluminium Can 330ml', 'Aluminium Can 330ml (direct print)', 'packaging', 0.015, 'kg', 3, 'container',
    0.138, 0.00023, 0.00075, 0.003, 0.138,
    2, 'Regional_Standard', 85, 'ReCiPe 2016 Midpoint (H)', 'Ecoinvent 3.12 - Aluminium can, 60% recycled');

  -- Wine
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, country_of_origin,
    impact_climate, impact_water, impact_land, impact_waste,
    impact_climate_fossil, impact_climate_biogenic, impact_climate_dluc,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference, geographic_scope,
    transport_mode, distance_km, impact_transport)
  VALUES (v_wine_lca_id, 'Pinot Noir Grapes', 'Pinot Noir Grapes', 'ingredient', 1.2, 'kg', 1, 'New Zealand',
    0.72, 3.60, 4.80, 0.12, 0.48, 0.18, 0.06,
    1, 'Primary_Verified', 90, 'ReCiPe 2016 Midpoint (H)', 'Ecoinvent 3.12 - Grape production NZ', 'NZ',
    'truck', 5, 0.00005);
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, country_of_origin,
    impact_climate, impact_water, impact_land, impact_waste,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference)
  VALUES (v_wine_lca_id, 'Process Water', 'Process Water', 'ingredient', 0.3, 'L', 1, 'New Zealand',
    0.00009, 0.30, 0.00003, 0.00003,
    2, 'Regional_Standard', 90, 'ReCiPe 2016 Midpoint (H)', 'Municipal tap water NZ');
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, packaging_category,
    impact_climate, impact_water, impact_land, impact_waste, impact_climate_fossil,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference,
    transport_mode, distance_km, impact_transport)
  VALUES (v_wine_lca_id, 'Green Glass Bottle 750ml', 'Green Glass Bottle 750ml (80% recycled)', 'packaging', 0.500, 'kg', 3, 'container',
    0.275, 0.0018, 0.0055, 0.0125, 0.275,
    2, 'Regional_Standard', 80, 'ReCiPe 2016 Midpoint (H)', 'Ecoinvent 3.12 - Glass bottle 80% recycled',
    'truck', 100, 0.0045);
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, packaging_category,
    impact_climate, impact_water, impact_land, impact_waste, impact_climate_biogenic,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference)
  VALUES (v_wine_lca_id, 'Paper Label', 'Paper Label', 'packaging', 0.004, 'kg', 3, 'label',
    0.0044, 0.00032, 0.0036, 0.0002, 0.002,
    3, 'Secondary_Modelled', 70, 'ReCiPe 2016 Midpoint (H)', 'Ecoinvent 3.12 - Paper label');
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, packaging_category,
    impact_climate, impact_water, impact_land, impact_waste, impact_climate_biogenic,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference)
  VALUES (v_wine_lca_id, 'Traditional Cork', 'Traditional Cork', 'packaging', 0.004, 'kg', 3, 'closure',
    0.004, 0.0012, 0.032, 0.0002, 0.006,
    2, 'Regional_Standard', 75, 'ReCiPe 2016 Midpoint (H)', 'Ecoinvent 3.12 - Natural cork');
  INSERT INTO product_lca_materials (product_lca_id, name, material_name, material_type, quantity, unit,
    lca_sub_stage_id, packaging_category,
    impact_climate, impact_water, impact_land, impact_waste, impact_climate_fossil,
    data_priority, data_quality_tag, confidence_score, methodology, source_reference)
  VALUES (v_wine_lca_id, 'Foil Capsule', 'Foil Capsule', 'packaging', 0.003, 'kg', 3, 'closure',
    0.0276, 0.000045, 0.00015, 0.0006, 0.0276,
    3, 'Secondary_Modelled', 70, 'ReCiPe 2016 Midpoint (H)', 'Ecoinvent 3.12 - Aluminium foil');

  -- PRODUCTION SITES
  INSERT INTO product_lca_production_sites (product_lca_id, facility_id, organization_id, production_volume, share_of_production, data_source)
  VALUES (v_calvados_lca_id, v_distillery_id, v_org_id, 1000, 1.00, 'Industry_Average');
  INSERT INTO product_lca_production_sites (product_lca_id, facility_id, organization_id, production_volume, share_of_production, data_source)
  VALUES (v_beer_lca_id, v_brewery_id, v_org_id, 5000, 1.00, 'Verified');
  INSERT INTO product_lca_production_sites (product_lca_id, facility_id, organization_id, production_volume, share_of_production, data_source)
  VALUES (v_wine_lca_id, v_winery_id, v_org_id, 2000, 0.70, 'Verified');
  INSERT INTO product_lca_production_sites (product_lca_id, facility_id, organization_id, production_volume, share_of_production, data_source)
  VALUES (v_wine_lca_id, v_bottling_plant_id, v_org_id, 2000, 0.30, 'Industry_Average');

  -- AGGREGATED IMPACTS
  UPDATE product_lcas SET aggregated_impacts = jsonb_build_object(
    'climate_change_gwp100', 2.7534,
    'water_consumption', 6.8066,
    'land_use', 12.1290,
    'waste_generation', 0.4153,
    'ghg_breakdown', jsonb_build_object('fossil', 1.1360, 'biogenic', 1.6215, 'luluc', 0.0000),
    'circularity', jsonb_build_object('recycled_content_percentage', 65, 'recyclability_percentage', 85, 'packaging_weight_kg', 0.500)
  ), data_quality_summary = jsonb_build_object(
    'score', 80, 'rating', 'High',
    'breakdown', jsonb_build_object('primary_share', '0%', 'regional_share', '100%', 'secondary_share', '0%')
  ) WHERE id = v_calvados_lca_id;

  UPDATE product_lcas SET aggregated_impacts = jsonb_build_object(
    'climate_change_gwp100', 0.2543,
    'water_consumption', 0.6055,
    'land_use', 0.2040,
    'waste_generation', 0.0114,
    'ghg_breakdown', jsonb_build_object('fossil', 0.2271, 'biogenic', 0.0270, 'luluc', 0.0000),
    'circularity', jsonb_build_object('recycled_content_percentage', 60, 'recyclability_percentage', 95, 'packaging_weight_kg', 0.015)
  ), data_quality_summary = jsonb_build_object(
    'score', 90, 'rating', 'Very High',
    'breakdown', jsonb_build_object('primary_share', '75%', 'regional_share', '25%', 'secondary_share', '0%')
  ) WHERE id = v_beer_lca_id;

  UPDATE product_lcas SET aggregated_impacts = jsonb_build_object(
    'climate_change_gwp100', 1.0311,
    'water_consumption', 3.9032,
    'land_use', 4.8412,
    'waste_generation', 0.1332,
    'ghg_breakdown', jsonb_build_object('fossil', 0.7526, 'biogenic', 0.1880, 'luluc', 0.0600),
    'circularity', jsonb_build_object('recycled_content_percentage', 80, 'recyclability_percentage', 90, 'packaging_weight_kg', 0.511)
  ), data_quality_summary = jsonb_build_object(
    'score', 78, 'rating', 'High',
    'breakdown', jsonb_build_object('primary_share', '40%', 'regional_share', '40%', 'secondary_share', '20%')
  ) WHERE id = v_wine_lca_id;

  RAISE NOTICE 'Successfully restored Test Organisation products:';
  RAISE NOTICE '  - TEST CALVADOS (ID: %)', v_calvados_id;
  RAISE NOTICE '  - TEST NON-ALC BEER (ID: %)', v_beer_id;
  RAISE NOTICE '  - TEST WINE (ID: %)', v_wine_id;
  RAISE NOTICE 'With facilities:';
  RAISE NOTICE '  - Test Distillery (ID: %)', v_distillery_id;
  RAISE NOTICE '  - Test Brewery (ID: %)', v_brewery_id;
  RAISE NOTICE '  - Test Winery (ID: %)', v_winery_id;
  RAISE NOTICE '  - Test Bottling Plant (ID: %)', v_bottling_plant_id;

END $$;
