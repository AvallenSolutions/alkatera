-- =============================================================================
-- Impact Focus Sample Data
-- Organisation: Impact Focus (45e7a52a-8d18-40c7-939e-c7c1d9aa9c1f)
-- =============================================================================

DO $BODY$
DECLARE
  v_org_id             uuid    := '45e7a52a-8d18-40c7-939e-c7c1d9aa9c1f';

  -- Facility UUIDs (fixed so script is idempotent)
  v_winery_id          uuid    := 'a1f10001-0000-4000-8000-000000000001';
  v_distillery_id      uuid    := 'a1f10001-0000-4000-8000-000000000002';
  v_bottling_id        uuid    := 'a1f10001-0000-4000-8000-000000000003';

  -- Vineyard UUID
  v_vineyard_id        uuid    := 'a2f20001-0000-4000-8000-000000000001';

  -- Product IDs (bigint, captured via RETURNING)
  v_wine_product_id    bigint;
  v_gin_product_id     bigint;

  -- LCA UUIDs
  v_wine_lca_id        uuid    := 'a3f30001-0000-4000-8000-000000000001';
  v_gin_lca_id         uuid    := 'a3f30001-0000-4000-8000-000000000002';

  -- EPR UUID
  v_epr_submission_id  uuid    := 'a4f40001-0000-4000-8000-000000000001';

BEGIN

  -- Guard: skip if Impact Focus already has products
  IF EXISTS (
    SELECT 1 FROM public.products WHERE organization_id = v_org_id LIMIT 1
  ) THEN
    RAISE NOTICE 'Impact Focus sample data already exists. Skipping.';
    RETURN;
  END IF;

  -- ===========================================================================
  -- 1. FACILITIES
  -- ===========================================================================
  INSERT INTO public.facilities (
    id, organization_id, name, facility_type_id, functions, operational_control,
    address_line1, address_city, address_country, address_postcode,
    address_lat, address_lng, location_country_code
  ) VALUES
    (
      v_winery_id, v_org_id,
      'Chalkhills Estate Winery',
      '05f26935-9046-4230-99b1-8dd1304debf5',
      '{Winery,Viticulture}', 'owned',
      'Mill Lane', 'Alresford', 'United Kingdom', 'SO24 9AT',
      51.0882, -1.1635, 'GB'
    ),
    (
      v_distillery_id, v_org_id,
      'Edinburgh Gin Distillery',
      'c458be01-e3f1-49e8-a5db-2d0b1914a5f4',
      '{Distillery}', 'owned',
      '24 Rutland Street', 'Edinburgh', 'United Kingdom', 'EH1 2DA',
      55.9486, -3.2090, 'GB'
    ),
    (
      v_bottling_id, v_org_id,
      'Southside Bottling Co',
      '98467f09-d9d6-4a05-86b1-cceb8ea9771a',
      '{Bottling}', 'third_party',
      '18 Temple Gate', 'Bristol', 'United Kingdom', 'BS1 6PL',
      51.4509, -2.5970, 'GB'
    )
  ON CONFLICT (id) DO NOTHING;

  -- ===========================================================================
  -- 2. VINEYARD
  -- ===========================================================================
  INSERT INTO public.vineyards (
    id, organization_id, facility_id,
    name, hectares, grape_varieties, annual_yield_tonnes, yield_tonnes_per_ha,
    certification, climate_zone,
    address_line1, address_city, address_country, address_postcode,
    address_lat, address_lng, location_country_code,
    is_active
  ) VALUES (
    v_vineyard_id, v_org_id, v_winery_id,
    'Chalkhills Vineyard', 8.5,
    ARRAY['Bacchus', 'Chardonnay', 'Pinot Gris'],
    30.0, 3.53,
    'organic', 'temperate',
    'Chalkhills Farm, Winchester Road', 'Alresford', 'United Kingdom', 'SO24 0LT',
    51.0910, -1.1560, 'GB',
    true
  ) ON CONFLICT (id) DO NOTHING;

  -- ===========================================================================
  -- 3. PRODUCTS
  -- ===========================================================================
  INSERT INTO public.products (
    organization_id, name, sku, unit_size_value, unit_size_unit, system_boundary,
    product_description, product_category, core_operations_facility_id,
    upstream_ingredients_complete, upstream_packaging_complete,
    core_operations_complete, downstream_distribution_complete,
    use_end_of_life_complete, is_draft, certifications, awards
  ) VALUES (
    v_org_id,
    'Chalkhills Estate White 2023',
    'CEW-750-2023',
    750, 'ml',
    'cradle_to_grave',
    'Organic English white wine from Hampshire. Aromatic blend of Bacchus, Chardonnay and Pinot Gris, estate grown and bottled at our Hampshire winery. Certified organic by the Soil Association.',
    'wine',
    v_winery_id,
    true, true, true, true, true,
    false,
    '[{"name": "Organic (Soil Association)", "expiry_date": "2026-09-30"}]',
    '[{"name": "WineGB Quality Award 2023", "awarded_by": "WineGB"}]'
  )
  RETURNING id INTO v_wine_product_id;

  INSERT INTO public.products (
    organization_id, name, sku, unit_size_value, unit_size_unit, system_boundary,
    product_description, product_category, core_operations_facility_id,
    upstream_ingredients_complete, upstream_packaging_complete,
    core_operations_complete, is_draft, certifications
  ) VALUES (
    v_org_id,
    'Chalkhills London Dry Gin',
    'CDG-700',
    700, 'ml',
    'cradle_to_gate',
    'Classic London Dry Gin distilled in Edinburgh using traditional copper pot stills. Juniper-led botanical recipe with citrus and spice notes. 40% ABV. Bottled by Southside Bottling Co, Bristol.',
    'spirits',
    v_distillery_id,
    true, true, true,
    false,
    '[]'
  )
  RETURNING id INTO v_gin_product_id;

  -- ===========================================================================
  -- 4. VINEYARD GROWING PROFILE (FLAG-compliant)
  -- ===========================================================================
  INSERT INTO public.vineyard_growing_profiles (
    organization_id, vineyard_id, reference_year,
    area_ha, soil_management,
    fertiliser_type, fertiliser_quantity_kg, fertiliser_n_content_percent,
    uses_pesticides, pesticide_applications_per_year,
    uses_herbicides, herbicide_applications_per_year,
    diesel_litres_per_year, petrol_litres_per_year,
    is_irrigated, water_m3_per_ha, irrigation_energy_source,
    grape_yield_tonnes,
    soil_carbon_override_kg_co2e_per_ha,
    soil_carbon_measurement_date,
    soil_carbon_methodology
  ) VALUES (
    v_org_id, v_vineyard_id, 2023,
    8.5, 'no_till',
    'organic_compost', 2100, 2.2,
    false, 0,
    false, 0,
    380, 45,
    false, 0, 'none',
    30.0,
    920.0,
    '2023-10-15',
    'SOC 0-30cm fixed depth; loss-on-ignition method, ISO 10694'
  ) ON CONFLICT (vineyard_id) DO NOTHING;

  -- ===========================================================================
  -- 5. LCA RECORDS
  -- ===========================================================================

  -- White wine: cradle-to-grave, 1.42 kg CO2e/bottle
  INSERT INTO public.product_carbon_footprints (
    id, organization_id, product_id, product_name, product_description,
    functional_unit, lca_scope_type, system_boundary, status, reference_year,
    lca_methodology, goal_and_scope_confirmed, goal_and_scope_confirmed_at, is_draft,
    ingredients_complete, packaging_complete, production_complete,
    total_ghg_emissions, total_ghg_emissions_fossil, total_ghg_emissions_biogenic,
    total_ghg_emissions_dluc,
    total_ghg_raw_materials, total_ghg_packaging, total_ghg_transport,
    total_ghg_use, total_ghg_end_of_life,
    csrd_compliant, data_quality_summary
  ) VALUES (
    v_wine_lca_id, v_org_id, v_wine_product_id,
    'Chalkhills Estate White 2023',
    'Organic English white wine, 750ml bottle. Cradle-to-grave LCA per ISO 14044 / ISO 14067.',
    '1 x 750ml bottle',
    'cradle-to-grave', 'cradle-to-grave',
    'completed', 2023,
    'recipe_2016',
    true, '2024-02-15 10:00:00+00', false,
    true, true, true,
    1.42, 1.08, 0.24, 0.10,
    0.58, 0.48, 0.22, 0.08, 0.06,
    false,
    '{"score": 72, "rating": "Medium", "breakdown": {"primary_share": "35%", "regional_share": "20%", "secondary_share": "45%"}}'
  ) ON CONFLICT (id) DO NOTHING;

  -- Gin: cradle-to-gate, 0.95 kg CO2e/bottle (Ecoinvent-based)
  INSERT INTO public.product_carbon_footprints (
    id, organization_id, product_id, product_name, product_description,
    functional_unit, lca_scope_type, system_boundary, status, reference_year,
    lca_methodology, goal_and_scope_confirmed, is_draft,
    ingredients_complete, packaging_complete, production_complete,
    total_ghg_emissions, total_ghg_emissions_fossil, total_ghg_emissions_biogenic,
    total_ghg_emissions_dluc,
    total_ghg_raw_materials, total_ghg_packaging, total_ghg_transport,
    csrd_compliant, data_quality_summary
  ) VALUES (
    v_gin_lca_id, v_org_id, v_gin_product_id,
    'Chalkhills London Dry Gin',
    'London Dry Gin, 700ml bottle. Cradle-to-gate LCA per ISO 14044 / ISO 14067. Ecoinvent 3.12 emission factors (ReCiPe 2016 Midpoint H).',
    '1 x 700ml bottle',
    'cradle-to-gate', 'cradle-to-gate',
    'completed', 2024,
    'recipe_2016',
    true, false,
    true, true, true,
    0.95, 0.84, 0.08, 0.03,
    0.38, 0.42, 0.15,
    false,
    '{"score": 68, "rating": "Medium", "breakdown": {"primary_share": "15%", "regional_share": "10%", "secondary_share": "75%"}}'
  ) ON CONFLICT (id) DO NOTHING;

  -- ===========================================================================
  -- 6. LINK LCAs TO PRODUCTS
  -- ===========================================================================
  UPDATE public.products SET has_active_lca = true, latest_lca_id = v_wine_lca_id WHERE id = v_wine_product_id;
  UPDATE public.products SET has_active_lca = true, latest_lca_id = v_gin_lca_id  WHERE id = v_gin_product_id;

  -- ===========================================================================
  -- 7. LCA MATERIALS - WHITE WINE (ingredients)
  -- ===========================================================================
  INSERT INTO public.product_carbon_footprint_materials (
    product_carbon_footprint_id,
    name, material_type, quantity, unit,
    country_of_origin, origin_country_code, is_organic, is_organic_certified,
    impact_climate, impact_climate_fossil, impact_climate_biogenic, impact_climate_dluc,
    impact_removals_co2e,
    data_priority, data_quality_grade, data_quality_tag, impact_source,
    gwp_method, ghg_data_quality, notes
  ) VALUES (
    v_wine_lca_id,
    'Organic white grapes (estate grown)', 'Ingredient', 1.5, 'kg',
    'United Kingdom', 'GB', true, true,
    0.058, 0.048, 0.008, 0.002,
    0.391,
    1, 'HIGH', 'Primary_Verified', 'primary_verified',
    'IPCC AR6 GWP100', 'primary',
    'FLAG-compliant: emissions and removals reported separately. Vineyard: Chalkhills Vineyard, Alresford SO24 0LT. Soil carbon measured SOC 0-30cm, 2023-10-15.'
  );

  INSERT INTO public.product_carbon_footprint_materials (
    product_carbon_footprint_id,
    name, material_type, quantity, unit,
    country_of_origin, origin_country_code,
    impact_climate, impact_climate_fossil, impact_climate_biogenic,
    impact_removals_co2e,
    data_priority, data_quality_grade, data_quality_tag, impact_source,
    gwp_method, ghg_data_quality
  ) VALUES
  (
    v_wine_lca_id,
    'Process water (winery)', 'Ingredient', 0.3, 'L',
    'United Kingdom', 'GB',
    0.0001, 0.0001, 0.0, 0.0,
    3, 'LOW', 'Secondary_Modelled', 'secondary_modelled',
    'IPCC AR6 GWP100', 'secondary'
  ),
  (
    v_wine_lca_id,
    'Sulphur dioxide (SO2 - sulphites)', 'Ingredient', 0.00008, 'kg',
    'United Kingdom', 'GB',
    0.0003, 0.0003, 0.0, 0.0,
    3, 'MEDIUM', 'Secondary_Modelled', 'secondary_modelled',
    'IPCC AR6 GWP100', 'secondary'
  );

  -- ===========================================================================
  -- 7b. LCA MATERIALS - WHITE WINE (packaging)
  -- ===========================================================================
  INSERT INTO public.product_carbon_footprint_materials (
    product_carbon_footprint_id,
    name, material_type, quantity, unit, packaging_category, label_printing_type,
    recycled_content_percentage, recyclability_score, is_reusable, end_of_life_pathway,
    country_of_origin, origin_country_code, transport_mode, distance_km, impact_transport,
    impact_climate, impact_climate_fossil, impact_climate_biogenic, impact_climate_dluc,
    impact_removals_co2e,
    data_priority, data_quality_grade, data_quality_tag, impact_source,
    gwp_method, ghg_data_quality
  ) VALUES
  (
    v_wine_lca_id,
    'Clear glass bottle (750ml)', 'Packaging', 0.4, 'kg', 'container', NULL,
    30, 95, false, 'recycling',
    'Italy', 'IT', 'truck', 1680, 0.028,
    0.31, 0.29, 0.020, 0.000, 0.0,
    2, 'MEDIUM', 'Regional_Standard', 'secondary_modelled',
    'IPCC AR6 GWP100', 'secondary'
  ),
  (
    v_wine_lca_id,
    'Natural cork stopper (45mm)', 'Packaging', 0.008, 'kg', 'closure', NULL,
    0, 70, false, 'composting',
    'Portugal', 'PT', 'truck', 1750, 0.002,
    0.012, 0.005, 0.007, 0.000, 0.0,
    2, 'MEDIUM', 'Regional_Standard', 'secondary_modelled',
    'IPCC AR6 GWP100', 'secondary'
  ),
  (
    v_wine_lca_id,
    'Paper label (front + back, offset)', 'Packaging', 0.006, 'kg', 'label', 'offset',
    30, 80, false, 'recycling',
    'United Kingdom', 'GB', 'truck', 120, 0.001,
    0.008, 0.007, 0.001, 0.000, 0.0,
    2, 'MEDIUM', 'Regional_Standard', 'secondary_modelled',
    'IPCC AR6 GWP100', 'secondary'
  ),
  (
    v_wine_lca_id,
    'Cardboard shipper case (6-bottle, 1/6 allocation)', 'Packaging', 0.12, 'kg', 'secondary', NULL,
    70, 90, false, 'recycling',
    'United Kingdom', 'GB', 'truck', 80, 0.001,
    0.035, 0.033, 0.002, 0.000, 0.0,
    2, 'MEDIUM', 'Regional_Standard', 'secondary_modelled',
    'IPCC AR6 GWP100', 'secondary'
  );

  -- ===========================================================================
  -- 8. LCA MATERIALS - GIN (ingredients, Ecoinvent 3.12)
  -- ===========================================================================
  INSERT INTO public.product_carbon_footprint_materials (
    product_carbon_footprint_id,
    name, material_type, quantity, unit,
    data_source, data_source_id, gwp_data_source, non_gwp_data_source,
    gwp_reference_id, is_hybrid_source,
    impact_climate, impact_climate_fossil, impact_climate_biogenic, impact_climate_dluc,
    impact_removals_co2e, geographic_scope,
    data_priority, data_quality_grade, data_quality_tag, impact_source,
    gwp_method, ghg_data_quality
  ) VALUES
  (
    v_gin_lca_id,
    'Neutral grain spirit (wheat, 96% ABV)', 'Ingredient', 0.56, 'L',
    'openlca', 'e8a28b18-1d7a-4f2b-91c3-4f7b2a9e1234',
    'Ecoinvent', 'Ecoinvent', 'ei3.12-ethanol-fermentation-grain-GLO-cutoff', true,
    0.250, 0.220, 0.025, 0.005, 0.0, 'GLO',
    3, 'MEDIUM', 'Secondary_Modelled', 'secondary_modelled',
    'IPCC AR6 GWP100', 'secondary'
  ),
  (
    v_gin_lca_id,
    'Juniper berries (Juniperus communis)', 'Ingredient', 0.010, 'kg',
    'openlca', 'f3c19d47-8b2e-4a1c-b8f5-2e9d4c7a5678',
    'Ecoinvent', 'Ecoinvent', 'ei3.12-berry-production-organic-RER-cutoff', true,
    0.018, 0.016, 0.002, 0.000, 0.0, 'RER',
    3, 'MEDIUM', 'Secondary_Modelled', 'secondary_modelled',
    'IPCC AR6 GWP100', 'secondary'
  ),
  (
    v_gin_lca_id,
    'Coriander seed (Coriandrum sativum)', 'Ingredient', 0.003, 'kg',
    'openlca', 'a7d58e23-6c4f-4b2d-a9c1-7f3e8b2d9abc',
    'Ecoinvent', 'Ecoinvent', 'ei3.12-spice-crop-production-GLO-cutoff', true,
    0.004, 0.004, 0.000, 0.000, 0.0, 'GLO',
    3, 'MEDIUM', 'Secondary_Modelled', 'secondary_modelled',
    'IPCC AR6 GWP100', 'secondary'
  ),
  (
    v_gin_lca_id,
    'Angelica root (Angelica archangelica)', 'Ingredient', 0.001, 'kg',
    'openlca', 'b9e47f15-2a8d-4c3e-b7d2-9c4f1e8a6def',
    'Ecoinvent', 'Ecoinvent', 'ei3.12-herb-crop-production-EU-cutoff', true,
    0.002, 0.002, 0.000, 0.000, 0.0, 'RER',
    3, 'MEDIUM', 'Secondary_Modelled', 'secondary_modelled',
    'IPCC AR6 GWP100', 'secondary'
  ),
  (
    v_gin_lca_id,
    'Dilution water (to 40% ABV)', 'Ingredient', 0.14, 'L',
    NULL, NULL, NULL, NULL, NULL, false,
    0.00005, 0.00005, 0.000, 0.000, 0.0, 'GB',
    3, 'LOW', 'Secondary_Modelled', 'secondary_modelled',
    'IPCC AR6 GWP100', 'secondary'
  );

  -- ===========================================================================
  -- 8b. LCA MATERIALS - GIN (packaging, Ecoinvent 3.12)
  -- ===========================================================================
  INSERT INTO public.product_carbon_footprint_materials (
    product_carbon_footprint_id,
    name, material_type, quantity, unit, packaging_category, label_printing_type,
    recycled_content_percentage, recyclability_score, is_reusable, end_of_life_pathway,
    data_source, data_source_id, gwp_data_source, non_gwp_data_source,
    gwp_reference_id, is_hybrid_source,
    origin_country_code, transport_mode, distance_km, impact_transport,
    impact_climate, impact_climate_fossil, impact_climate_biogenic, impact_climate_dluc,
    impact_removals_co2e, geographic_scope,
    data_priority, data_quality_grade, data_quality_tag, impact_source,
    gwp_method, ghg_data_quality
  ) VALUES
  (
    v_gin_lca_id,
    'Flint glass bottle (700ml, lightweight 350g)', 'Packaging', 0.35, 'kg', 'container', NULL,
    30, 95, false, 'recycling',
    'openlca', 'c2b38a94-5d7e-4f1c-b6a3-8e5d2f4b7890',
    'Ecoinvent', 'Ecoinvent', 'ei3.12-glass-container-production-flint-GLO-cutoff', true,
    'DE', 'truck', 1100, 0.022,
    0.280, 0.260, 0.018, 0.002, 0.0, 'GLO',
    3, 'MEDIUM', 'Secondary_Modelled', 'secondary_modelled',
    'IPCC AR6 GWP100', 'secondary'
  ),
  (
    v_gin_lca_id,
    'Aluminium screw closure (28mm)', 'Packaging', 0.008, 'kg', 'closure', NULL,
    35, 90, false, 'recycling',
    'openlca', 'd4e59b17-3f8a-4d2e-c7b4-9f6e3a5c8901',
    'Ecoinvent', 'Ecoinvent', 'ei3.12-aluminium-sheet-production-GLO-cutoff', true,
    'GB', 'truck', 350, 0.003,
    0.045, 0.042, 0.002, 0.001, 0.0, 'GLO',
    3, 'MEDIUM', 'Secondary_Modelled', 'secondary_modelled',
    'IPCC AR6 GWP100', 'secondary'
  ),
  (
    v_gin_lca_id,
    'Cardboard label (offset printed)', 'Packaging', 0.004, 'kg', 'label', 'offset',
    50, 85, false, 'recycling',
    'openlca', 'e6f70c28-4a9b-4e3f-d8c5-af7d4b6e9012',
    'Ecoinvent', 'Ecoinvent', 'ei3.12-paper-production-RER-cutoff', true,
    'GB', 'truck', 180, 0.001,
    0.009, 0.008, 0.001, 0.000, 0.0, 'RER',
    3, 'MEDIUM', 'Secondary_Modelled', 'secondary_modelled',
    'IPCC AR6 GWP100', 'secondary'
  );

  -- ===========================================================================
  -- 9. UTILITY DATA ENTRIES - Scope 1 & 2 (full year 2024)
  -- ===========================================================================

  -- Chalkhills Estate Winery (owned)
  INSERT INTO public.utility_data_entries (
    facility_id, utility_type, quantity, unit,
    reporting_period_start, reporting_period_end, data_quality, calculated_scope, notes
  ) VALUES
  (v_winery_id, 'electricity_grid',    85000,  'kWh',   '2024-01-01', '2024-12-31', 'actual',    'Scope 2', 'Annual electricity: winery operations, temperature-controlled storage and barrel hall'),
  (v_winery_id, 'natural_gas',         42000,  'kWh',   '2024-01-01', '2024-12-31', 'actual',    'Scope 1', 'Natural gas: fermentation temperature control, hot water and space heating'),
  (v_winery_id, 'diesel_stationary',   400,    'litre', '2024-01-01', '2024-12-31', 'actual',    'Scope 1', 'Diesel: backup generator'),
  (v_winery_id, 'refrigerant_leakage', 2.0,    'kg',    '2024-01-01', '2024-12-31', 'actual',    'Scope 1', 'R-404A refrigerant loss from temperature-controlled storage (annual service check)');

  -- Edinburgh Gin Distillery (owned)
  INSERT INTO public.utility_data_entries (
    facility_id, utility_type, quantity, unit,
    reporting_period_start, reporting_period_end, data_quality, calculated_scope, notes
  ) VALUES
  (v_distillery_id, 'electricity_grid',    120000, 'kWh',   '2024-01-01', '2024-12-31', 'actual',    'Scope 2', 'Annual electricity: production equipment, chill filtration, lighting and offices'),
  (v_distillery_id, 'natural_gas',         180000, 'kWh',   '2024-01-01', '2024-12-31', 'actual',    'Scope 1', 'Natural gas: copper pot still heating (primary energy for distillation, high intensity)'),
  (v_distillery_id, 'diesel_mobile',       350,    'litre', '2024-01-01', '2024-12-31', 'actual',    'Scope 1', 'Diesel: forklift and yard vehicles'),
  (v_distillery_id, 'refrigerant_leakage', 1.5,    'kg',    '2024-01-01', '2024-12-31', 'actual',    'Scope 1', 'R-134a refrigerant loss from chill filtration unit');

  -- Southside Bottling Co (third_party - estimated allocation)
  INSERT INTO public.utility_data_entries (
    facility_id, utility_type, quantity, unit,
    reporting_period_start, reporting_period_end, data_quality, calculated_scope, notes
  ) VALUES
  (v_bottling_id, 'electricity_grid', 45000, 'kWh', '2024-01-01', '2024-12-31', 'estimated', 'Scope 2', 'Estimated allocation: third-party bottler, based on gin throughput'),
  (v_bottling_id, 'natural_gas',      8000,  'kWh', '2024-01-01', '2024-12-31', 'estimated', 'Scope 1', 'Estimated allocation: label application and bottle washing heat');

  -- ===========================================================================
  -- 10. CORPORATE GHG REPORT (2024, Draft)
  -- ===========================================================================
  INSERT INTO public.corporate_reports (
    organization_id, year, status, total_emissions, breakdown_json
  ) VALUES (
    v_org_id, 2024, 'Draft', 225.5,
    '{"scope1": 42.5, "scope2": 58.2, "scope3": 124.8, "total": 225.5, "methodology": "GHG Protocol Corporate Standard", "base_year": 2024}'
  )
  ON CONFLICT (organization_id, year) DO NOTHING;

  -- ===========================================================================
  -- 11. EPR ORGANISATION SETTINGS
  -- ===========================================================================
  INSERT INTO public.epr_organization_settings (
    organization_id, rpd_organization_id,
    annual_turnover_gbp, estimated_annual_packaging_tonnage, obligation_size,
    default_packaging_activity, default_uk_nation,
    nation_sales_england_pct, nation_sales_scotland_pct,
    nation_sales_wales_pct, nation_sales_ni_pct,
    nation_sales_method, drs_applies
  ) VALUES (
    v_org_id, 'IF2025001',
    4500000, 8.5, 'large',
    'brand', 'england',
    88, 8, 4, 0,
    'manual', false
  )
  ON CONFLICT (organization_id) DO NOTHING;

  -- ===========================================================================
  -- 12. EPR SUBMISSION (Draft, H1 2025)
  -- ===========================================================================
  INSERT INTO public.epr_submissions (
    id, organization_id,
    submission_period, fee_year, organization_size, status,
    total_packaging_weight_kg, total_estimated_fee_gbp, total_line_items,
    material_summary, notes
  ) VALUES (
    v_epr_submission_id, v_org_id,
    '2025-H1', '2025-26', 'L', 'draft',
    6009, 1177.0, 3,
    '{"GL": {"weight_kg": 5810, "fee_gbp": 1115.52, "count": 1}, "AL": {"weight_kg": 133, "fee_gbp": 61.45, "count": 1}, "PC": {"weight_kg": 66, "fee_gbp": 2.77, "count": 1}}',
    'Draft submission - awaiting final H1 production data from Southside Bottling Co.'
  )
  ON CONFLICT (organization_id, submission_period, fee_year) DO NOTHING;

  -- ===========================================================================
  -- 13. EPR SUBMISSION LINES
  -- ===========================================================================
  INSERT INTO public.epr_submission_lines (
    submission_id, organization_id, product_id, product_name,
    rpd_organisation_id, rpd_organisation_size, rpd_submission_period,
    rpd_packaging_activity, rpd_packaging_type, rpd_packaging_class,
    rpd_packaging_material, rpd_from_nation,
    rpd_material_weight_kg, rpd_recyclability_rating,
    fee_rate_per_tonne, estimated_fee_gbp, is_drs_excluded
  ) VALUES
  (
    v_epr_submission_id, v_org_id, v_gin_product_id, 'Chalkhills London Dry Gin',
    'IF2025001', 'L', '2025-H1', 'SO', 'HH', 'P1', 'GL', 'EN',
    5810, 'G', 192, 1115.52, false
  ),
  (
    v_epr_submission_id, v_org_id, v_gin_product_id, 'Chalkhills London Dry Gin',
    'IF2025001', 'L', '2025-H1', 'SO', 'HH', 'P1', 'AL', 'EN',
    133, 'G', 462, 61.45, false
  ),
  (
    v_epr_submission_id, v_org_id, v_gin_product_id, 'Chalkhills London Dry Gin',
    'IF2025001', 'L', '2025-H1', 'SO', 'HH', 'P1', 'PC', 'EN',
    66, 'G', 42, 2.77, false
  );

  -- ===========================================================================
  -- 14. PRODUCTION LOGS
  -- ===========================================================================

  -- White wine: quarterly bottling runs
  INSERT INTO public.production_logs (
    organization_id, facility_id, product_id, product_sku,
    date, volume, unit, units_produced, conversion_factor
  ) VALUES
  (v_org_id, v_winery_id, v_wine_product_id, 'CEW-750-2023', '2024-03-20', 3150.0, 'Litre', 4200, 750),
  (v_org_id, v_winery_id, v_wine_product_id, 'CEW-750-2023', '2024-07-15', 6375.0, 'Litre', 8500, 750),
  (v_org_id, v_winery_id, v_wine_product_id, 'CEW-750-2023', '2024-10-10', 2850.0, 'Litre', 3800, 750);

  -- Gin: monthly distillation runs
  INSERT INTO public.production_logs (
    organization_id, facility_id, product_id, product_sku,
    date, volume, unit, units_produced, conversion_factor
  ) VALUES
  (v_org_id, v_distillery_id, v_gin_product_id, 'CDG-700', '2024-01-31',  700.0, 'Litre', 1000, 700),
  (v_org_id, v_distillery_id, v_gin_product_id, 'CDG-700', '2024-02-29',  700.0, 'Litre', 1000, 700),
  (v_org_id, v_distillery_id, v_gin_product_id, 'CDG-700', '2024-03-31',  840.0, 'Litre', 1200, 700),
  (v_org_id, v_distillery_id, v_gin_product_id, 'CDG-700', '2024-04-30',  840.0, 'Litre', 1200, 700),
  (v_org_id, v_distillery_id, v_gin_product_id, 'CDG-700', '2024-05-31',  980.0, 'Litre', 1400, 700),
  (v_org_id, v_distillery_id, v_gin_product_id, 'CDG-700', '2024-06-30',  980.0, 'Litre', 1400, 700),
  (v_org_id, v_distillery_id, v_gin_product_id, 'CDG-700', '2024-07-31', 1120.0, 'Litre', 1600, 700),
  (v_org_id, v_distillery_id, v_gin_product_id, 'CDG-700', '2024-08-31', 1120.0, 'Litre', 1600, 700),
  (v_org_id, v_distillery_id, v_gin_product_id, 'CDG-700', '2024-09-30', 1050.0, 'Litre', 1500, 700),
  (v_org_id, v_distillery_id, v_gin_product_id, 'CDG-700', '2024-10-31', 1050.0, 'Litre', 1500, 700),
  (v_org_id, v_distillery_id, v_gin_product_id, 'CDG-700', '2024-11-30', 1190.0, 'Litre', 1700, 700),
  (v_org_id, v_distillery_id, v_gin_product_id, 'CDG-700', '2024-12-31', 1330.0, 'Litre', 1900, 700);

  RAISE NOTICE 'Impact Focus sample data seeded successfully.';
  RAISE NOTICE '  Wine product ID: %', v_wine_product_id;
  RAISE NOTICE '  Gin product ID: %', v_gin_product_id;

END $BODY$;
