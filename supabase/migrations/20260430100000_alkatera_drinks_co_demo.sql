-- ============================================================================
-- Demo Organisation: alkatera Drinks Co
-- For platform demonstrations and sales demos
-- User: Rosa Judge (hello@alkatera.com / alkateraDrinksCo)
-- ============================================================================
-- Plain SQL (no PL/pgSQL DO block) for Supabase SQL editor compatibility.
-- Uses ON CONFLICT for idempotency. Product IDs resolved via SKU subqueries.
-- ============================================================================

-- ==========================================================================
-- 1. ORGANISATION
-- ==========================================================================
INSERT INTO "public"."organizations" (
  id, name, slug, description, address, city, country,
  industry_sector, founding_year, company_size, website,
  subscription_tier, subscription_status, subscription_started_at,
  methodology_access, feature_flags, current_product_count,
  is_platform_admin
) VALUES (
  'b0a00000-0000-4000-8000-000000000001',
  'alkatera Drinks Co',
  'alkatera-drinks-co',
  'Multi-category drinks producer crafting wine, spirits, beer and non-alcoholic beverages with sustainability at the core.',
  '14 Brewery Lane',
  'Bath',
  'United Kingdom',
  'Beverages',
  2020,
  '11-50',
  'https://alkatera.com',
  'canopy',
  'active',
  now(),
  '["recipe_2016"]',
  '{"viticulture_beta": true}',
  5,
  false
) ON CONFLICT (id) DO NOTHING;

-- ==========================================================================
-- 2. UPDATE USER (hello@alkatera.com already exists)
-- ==========================================================================
UPDATE "auth"."users"
SET
  encrypted_password = extensions.crypt('alkateraDrinksCo', extensions.gen_salt('bf')),
  raw_user_meta_data = jsonb_build_object(
    'sub', '27ea31a3-949c-4107-bcd1-e1b1eff818d1',
    'email', 'hello@alkatera.com',
    'full_name', 'Rosa Judge',
    'email_verified', true,
    'current_organization_id', 'b0a00000-0000-4000-8000-000000000001'
  ),
  updated_at = now()
WHERE id = '27ea31a3-949c-4107-bcd1-e1b1eff818d1';

UPDATE "public"."profiles"
SET full_name = 'Rosa Judge', updated_at = now()
WHERE id = '27ea31a3-949c-4107-bcd1-e1b1eff818d1';

-- ==========================================================================
-- 3. ORGANISATION MEMBERSHIP (owner)
-- ==========================================================================
INSERT INTO "public"."organization_members" (organization_id, user_id, role_id, joined_at)
VALUES (
  'b0a00000-0000-4000-8000-000000000001',
  '27ea31a3-949c-4107-bcd1-e1b1eff818d1',
  '8b90b4ff-366c-4bdd-a349-b65f737fe5ef',
  now()
) ON CONFLICT DO NOTHING;

-- ==========================================================================
-- 4. FACILITY TYPE: Office
-- ==========================================================================
INSERT INTO "public"."facility_types" (id, name, created_at)
VALUES ('b0a00000-0000-4000-8000-f00000000001', 'Office', now())
ON CONFLICT (id) DO NOTHING;

-- ==========================================================================
-- 5. FACILITIES (6)
-- ==========================================================================

-- Cotswolds Estate Winery (owned)
INSERT INTO "public"."facilities" (
  id, organization_id, name, facility_type_id, functions, operational_control,
  address_line1, address_city, address_country, address_postcode, location_country_code
) VALUES (
  'b0a10001-0000-4000-8000-000000000001',
  'b0a00000-0000-4000-8000-000000000001',
  'Cotswolds Estate Winery',
  '05f26935-9046-4230-99b1-8dd1304debf5',
  ARRAY['Winery', 'Viticulture'],
  'owned',
  'Vineyard Road', 'Cirencester', 'United Kingdom', 'GL7 5NX', 'GB'
) ON CONFLICT (id) DO NOTHING;

-- Highland Malt Distillery (owned)
INSERT INTO "public"."facilities" (
  id, organization_id, name, facility_type_id, functions, operational_control,
  address_line1, address_city, address_country, address_postcode, location_country_code
) VALUES (
  'b0a10001-0000-4000-8000-000000000002',
  'b0a00000-0000-4000-8000-000000000001',
  'Highland Malt Distillery',
  'c458be01-e3f1-49e8-a5db-2d0b1914a5f4',
  ARRAY['Distillery', 'Maturation'],
  'owned',
  '12 Speyside Lane', 'Aberlour', 'United Kingdom', 'AB38 9QJ', 'GB'
) ON CONFLICT (id) DO NOTHING;

-- Premier Bottling Services (3rd party)
INSERT INTO "public"."facilities" (
  id, organization_id, name, facility_type_id, functions, operational_control,
  address_line1, address_city, address_country, address_postcode, location_country_code
) VALUES (
  'b0a10001-0000-4000-8000-000000000003',
  'b0a00000-0000-4000-8000-000000000001',
  'Premier Bottling Services',
  '98467f09-d9d6-4a05-86b1-cceb8ea9971a',
  ARRAY['Bottling'],
  'third_party',
  'Unit 7 Aston Business Park', 'Birmingham', 'United Kingdom', 'B6 7EU', 'GB'
) ON CONFLICT (id) DO NOTHING;

-- West Country Brewery (owned)
INSERT INTO "public"."facilities" (
  id, organization_id, name, facility_type_id, functions, operational_control,
  address_line1, address_city, address_country, address_postcode, location_country_code
) VALUES (
  'b0a10001-0000-4000-8000-000000000004',
  'b0a00000-0000-4000-8000-000000000001',
  'West Country Brewery',
  '4cf45fb2-38bf-4233-aa34-32a5607bfca0',
  ARRAY['Brewery', 'Fermentation', 'Packaging'],
  'owned',
  '8 Harbourside', 'Bristol', 'United Kingdom', 'BS1 5BA', 'GB'
) ON CONFLICT (id) DO NOTHING;

-- Bath Head Office (owned)
INSERT INTO "public"."facilities" (
  id, organization_id, name, facility_type_id, functions, operational_control,
  address_line1, address_city, address_country, address_postcode, location_country_code
) VALUES (
  'b0a10001-0000-4000-8000-000000000005',
  'b0a00000-0000-4000-8000-000000000001',
  'Bath Head Office',
  'b0a00000-0000-4000-8000-f00000000001',
  ARRAY['Office', 'Administration'],
  'owned',
  '14 Brewery Lane', 'Bath', 'United Kingdom', 'BA1 2BT', 'GB'
) ON CONFLICT (id) DO NOTHING;

-- Botanical Partners Ltd (3rd party contractor)
INSERT INTO "public"."facilities" (
  id, organization_id, name, facility_type_id, functions, operational_control,
  address_line1, address_city, address_country, address_postcode, location_country_code
) VALUES (
  'b0a10001-0000-4000-8000-000000000006',
  'b0a00000-0000-4000-8000-000000000001',
  'Botanical Partners Ltd',
  '01ad88b0-b194-4d01-96b9-0ed362973c66',
  ARRAY['Production', 'Blending'],
  'third_party',
  'The Old Maltings', 'Norwich', 'United Kingdom', 'NR1 1PB', 'GB'
) ON CONFLICT (id) DO NOTHING;

-- ==========================================================================
-- 6. VINEYARD
-- ==========================================================================
INSERT INTO "public"."vineyards" (
  id, organization_id, facility_id, name, hectares,
  grape_varieties, annual_yield_tonnes, yield_tonnes_per_ha,
  certification, climate_zone,
  address_line1, address_city, address_country, address_postcode, location_country_code
) VALUES (
  'b0a20001-0000-4000-8000-000000000001',
  'b0a00000-0000-4000-8000-000000000001',
  'b0a10001-0000-4000-8000-000000000001',
  'Cotswolds Estate Vineyard',
  5.2,
  ARRAY['Bacchus', 'Chardonnay', 'Pinot Noir'],
  20.0,
  3.85,
  'conventional',
  'temperate',
  'Vineyard Road', 'Cirencester', 'United Kingdom', 'GL7 5NX', 'GB'
) ON CONFLICT (id) DO NOTHING;

-- ==========================================================================
-- 7. PRODUCTS (5)
-- ==========================================================================

-- Wine
INSERT INTO "public"."products" (
  organization_id, name, sku, product_description, product_category,
  unit_size_value, unit_size_unit, functional_unit,
  core_operations_facility_id, is_draft, system_boundary
) VALUES (
  'b0a00000-0000-4000-8000-000000000001',
  'Cotswolds Estate Bacchus 2024',
  'WINE-BCH-24',
  'A crisp, aromatic English white wine from our own Cotswolds vineyard. Notes of elderflower, grapefruit and green apple.',
  'Wine',
  750, 'ml', '750 ml',
  'b0a10001-0000-4000-8000-000000000001', false, 'cradle_to_gate'
) ON CONFLICT (organization_id, sku) DO NOTHING;

-- Whisky
INSERT INTO "public"."products" (
  organization_id, name, sku, product_description, product_category,
  unit_size_value, unit_size_unit, functional_unit,
  core_operations_facility_id, is_draft, system_boundary
) VALUES (
  'b0a00000-0000-4000-8000-000000000001',
  'Highland Reserve 12yr Single Malt',
  'WHSK-HR-12',
  'A rich, honeyed single malt aged for 12 years in American oak casks at our Highland distillery. Bottled by Premier Bottling Services.',
  'Spirits',
  700, 'ml', '700 ml',
  'b0a10001-0000-4000-8000-000000000002', false, 'cradle_to_gate'
) ON CONFLICT (organization_id, sku) DO NOTHING;

-- Beer
INSERT INTO "public"."products" (
  organization_id, name, sku, product_description, product_category,
  unit_size_value, unit_size_unit, functional_unit,
  core_operations_facility_id, is_draft, system_boundary
) VALUES (
  'b0a00000-0000-4000-8000-000000000001',
  'West Country Session Ale',
  'BEER-WCSA-01',
  'An easy-drinking session ale brewed with locally sourced Maris Otter malt and English hops. 3.8% ABV.',
  'Beer & Cider',
  330, 'ml', '330 ml',
  'b0a10001-0000-4000-8000-000000000004', false, 'cradle_to_gate'
) ON CONFLICT (organization_id, sku) DO NOTHING;

-- Non-alcoholic botanical liqueur
INSERT INTO "public"."products" (
  organization_id, name, sku, product_description, product_category,
  unit_size_value, unit_size_unit, functional_unit,
  core_operations_facility_id, is_draft, system_boundary
) VALUES (
  'b0a00000-0000-4000-8000-000000000001',
  'Botanica Zero',
  'NALC-BZ-01',
  'A sophisticated non-alcoholic botanical spirit made with a blend of herbs, spices and citrus. Perfect served long with tonic.',
  'Non-Alcoholic',
  500, 'ml', '500 ml',
  'b0a10001-0000-4000-8000-000000000006', false, 'cradle_to_gate'
) ON CONFLICT (organization_id, sku) DO NOTHING;

-- London Dry Gin
INSERT INTO "public"."products" (
  organization_id, name, sku, product_description, product_category,
  unit_size_value, unit_size_unit, functional_unit,
  core_operations_facility_id, is_draft, system_boundary
) VALUES (
  'b0a00000-0000-4000-8000-000000000001',
  'Bath Dry Gin',
  'GIN-BDG-01',
  'A classic London Dry style gin distilled with seven carefully selected botanicals. Juniper-forward with bright citrus and warm spice.',
  'Spirits',
  700, 'ml', '700 ml',
  'b0a10001-0000-4000-8000-000000000002', false, 'cradle_to_gate'
) ON CONFLICT (organization_id, sku) DO NOTHING;

-- ==========================================================================
-- 8. VINEYARD GROWING PROFILE (Wine)
-- ==========================================================================
INSERT INTO "public"."vineyard_growing_profiles" (
  vineyard_id, organization_id, vintage_year,
  area_ha, soil_management, pruning_residue_returned,
  fertiliser_type, fertiliser_quantity_kg, fertiliser_n_content_percent,
  uses_pesticides, pesticide_applications_per_year, pesticide_type,
  uses_herbicides, herbicide_applications_per_year,
  diesel_litres_per_year, petrol_litres_per_year,
  is_irrigated, water_m3_per_ha, irrigation_energy_source,
  grape_yield_tonnes, is_draft
) VALUES (
  'b0a20001-0000-4000-8000-000000000001',
  'b0a00000-0000-4000-8000-000000000001',
  2024,
  5.2, 'cover_cropping', true,
  'organic_compost', 1500, 1.80,
  true, 3, 'copper_fungicide',
  false, 0,
  280.00, 35.00,
  false, 0, 'none',
  20.0, false
) ON CONFLICT (vineyard_id, vintage_year) DO NOTHING;

-- ==========================================================================
-- 9. MATURATION PROFILE (Whisky) - uses SKU subquery for product_id
-- ==========================================================================
INSERT INTO "public"."maturation_profiles" (
  product_id, organization_id,
  barrel_type, barrel_volume_litres, barrel_use_number,
  aging_duration_months, angel_share_percent_per_year, climate_zone,
  fill_volume_litres, number_of_barrels,
  warehouse_energy_kwh_per_barrel_year, warehouse_energy_source,
  allocation_method
)
SELECT
  p.id,
  'b0a00000-0000-4000-8000-000000000001',
  'american_oak_200', 200, 1,
  144, 2.0, 'temperate',
  190.00, 50,
  15.0, 'grid_electricity',
  'cut_off'
FROM "public"."products" p
WHERE p.sku = 'WHSK-HR-12'
  AND p.organization_id = 'b0a00000-0000-4000-8000-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM "public"."maturation_profiles" mp WHERE mp.product_id = p.id
  );

-- ==========================================================================
-- 10. GIN BOTANICALS (product_materials) - uses SKU subquery for product_id
-- ==========================================================================
INSERT INTO "public"."product_materials" (product_id, material_name, material_type, quantity, unit, origin_country, origin_country_code)
SELECT p.id, v.material_name, v.material_type, v.quantity, v.unit, v.origin_country, v.origin_country_code
FROM "public"."products" p
CROSS JOIN (VALUES
  ('Juniper Berries',  'ingredient', 0.0350, 'kg', 'United Kingdom', 'GB'),
  ('Coriander Seed',   'ingredient', 0.0080, 'kg', 'United Kingdom', 'GB'),
  ('Angelica Root',    'ingredient', 0.0050, 'kg', 'United Kingdom', 'GB'),
  ('Orris Root',       'ingredient', 0.0040, 'kg', 'United Kingdom', 'GB'),
  ('Lemon Peel',       'ingredient', 0.0120, 'kg', 'Spain', 'ES'),
  ('Orange Peel',      'ingredient', 0.0100, 'kg', 'Spain', 'ES'),
  ('Liquorice Root',   'ingredient', 0.0030, 'kg', 'United Kingdom', 'GB')
) AS v(material_name, material_type, quantity, unit, origin_country, origin_country_code)
WHERE p.sku = 'GIN-BDG-01'
  AND p.organization_id = 'b0a00000-0000-4000-8000-000000000001';

-- ==========================================================================
-- 11. CORPORATE REPORT + OVERHEADS
-- ==========================================================================

-- Corporate report (required FK for overheads)
INSERT INTO "public"."corporate_reports" (id, organization_id, year, status)
VALUES ('b0a30001-0000-4000-8000-000000000001', 'b0a00000-0000-4000-8000-000000000001', 2025, 'Draft')
ON CONFLICT (id) DO NOTHING;

-- Capital goods: GBP 750,000
INSERT INTO "public"."corporate_overheads" (
  report_id, category, spend_amount, currency, description, asset_type, entry_date
) VALUES (
  'b0a30001-0000-4000-8000-000000000001', 'capital_goods', 750000, 'GBP',
  'Annual capital expenditure including brewing equipment upgrade, bottling line refurbishment and IT infrastructure',
  'equipment', '2025-12-31'
);

-- Business travel: domestic flights
INSERT INTO "public"."corporate_overheads" (
  report_id, category, spend_amount, currency, description,
  transport_mode, distance_km, passenger_count, cabin_class,
  origin_location, destination_location, is_return_trip, entry_date
) VALUES
  ('b0a30001-0000-4000-8000-000000000001', 'business_travel', 4200, 'GBP', 'Sales team flights Bath to Edinburgh (quarterly)',
   'Domestic flight', 600, 4, 'Economy',
   'Bath, UK', 'Edinburgh, UK', true, '2025-06-15'),
  ('b0a30001-0000-4000-8000-000000000001', 'business_travel', 3800, 'GBP', 'Management flights Bath to Glasgow distillery visits',
   'Domestic flight', 570, 3, 'Economy',
   'Bath, UK', 'Glasgow, UK', true, '2025-09-20');

-- Business travel: short-haul international flights
INSERT INTO "public"."corporate_overheads" (
  report_id, category, spend_amount, currency, description,
  transport_mode, distance_km, passenger_count, cabin_class,
  origin_location, destination_location, is_return_trip, entry_date
) VALUES
  ('b0a30001-0000-4000-8000-000000000001', 'business_travel', 8500, 'GBP', 'ProWein Dusseldorf trade show delegation',
   'Short-haul flight', 750, 6, 'Economy',
   'Bristol, UK', 'Dusseldorf, Germany', true, '2025-03-18'),
  ('b0a30001-0000-4000-8000-000000000001', 'business_travel', 5200, 'GBP', 'Vinexpo Paris trade show',
   'Short-haul flight', 480, 4, 'Economy',
   'Bristol, UK', 'Paris, France', true, '2025-06-10'),
  ('b0a30001-0000-4000-8000-000000000001', 'business_travel', 3600, 'GBP', 'Barcelona supplier meetings',
   'Short-haul flight', 1150, 2, 'Business',
   'Bristol, UK', 'Barcelona, Spain', true, '2025-10-05');

-- Business travel: rail
INSERT INTO "public"."corporate_overheads" (
  report_id, category, spend_amount, currency, description,
  transport_mode, distance_km, passenger_count,
  origin_location, destination_location, is_return_trip, entry_date
) VALUES
  ('b0a30001-0000-4000-8000-000000000001', 'business_travel', 6800, 'GBP', 'Regular London client meetings (monthly, multiple staff)',
   'Rail', 185, 8,
   'Bath, UK', 'London, UK', true, '2025-06-30'),
  ('b0a30001-0000-4000-8000-000000000001', 'business_travel', 2400, 'GBP', 'Bristol brewery to Bath office commuter rail (team)',
   'Rail', 20, 5,
   'Bristol, UK', 'Bath, UK', true, '2025-12-31');

-- ==========================================================================
-- 12. VEHICLES (17 company cars/vans)
-- ==========================================================================
INSERT INTO "public"."vehicles" (
  organization_id, facility_id, vehicle_class, propulsion_type, fuel_type,
  registration_number, make_model, year_of_manufacture,
  ownership_type, status, driver_name, department
) VALUES
  -- 10x ICE cars
  ('b0a00000-0000-4000-8000-000000000001', 'b0a10001-0000-4000-8000-000000000005', 'car', 'ICE', 'Diesel', 'AB21 XYZ', 'Volkswagen Golf', 2021, 'company_owned', 'active', 'James Harper', 'Sales'),
  ('b0a00000-0000-4000-8000-000000000001', 'b0a10001-0000-4000-8000-000000000005', 'car', 'ICE', 'Diesel', 'CD22 ABC', 'Volkswagen Golf', 2022, 'company_owned', 'active', 'Emma Collins', 'Sales'),
  ('b0a00000-0000-4000-8000-000000000001', 'b0a10001-0000-4000-8000-000000000005', 'car', 'ICE', 'Petrol', 'EF20 DEF', 'Ford Focus', 2020, 'company_owned', 'active', 'Liam Patel', 'Operations'),
  ('b0a00000-0000-4000-8000-000000000001', 'b0a10001-0000-4000-8000-000000000005', 'car', 'ICE', 'Petrol', 'GH21 GHI', 'Ford Focus', 2021, 'company_owned', 'active', 'Sophie Turner', 'Operations'),
  ('b0a00000-0000-4000-8000-000000000001', 'b0a10001-0000-4000-8000-000000000002', 'car', 'ICE', 'Diesel', 'IJ22 JKL', 'Skoda Octavia', 2022, 'company_owned', 'active', 'Angus McRae', 'Distillery'),
  ('b0a00000-0000-4000-8000-000000000001', 'b0a10001-0000-4000-8000-000000000002', 'car', 'ICE', 'Diesel', 'KL23 MNO', 'Skoda Octavia', 2023, 'company_owned', 'active', 'Fiona Campbell', 'Distillery'),
  ('b0a00000-0000-4000-8000-000000000001', 'b0a10001-0000-4000-8000-000000000004', 'car', 'ICE', 'Petrol', 'MN21 PQR', 'Vauxhall Corsa', 2021, 'company_owned', 'active', 'Tom Bradley', 'Brewery'),
  ('b0a00000-0000-4000-8000-000000000001', 'b0a10001-0000-4000-8000-000000000004', 'car', 'ICE', 'Petrol', 'OP22 STU', 'Vauxhall Corsa', 2022, 'company_owned', 'active', 'Chloe Williams', 'Brewery'),
  ('b0a00000-0000-4000-8000-000000000001', 'b0a10001-0000-4000-8000-000000000001', 'car', 'ICE', 'Diesel', 'QR23 VWX', 'Land Rover Defender', 2023, 'company_owned', 'active', 'Henry Beaumont', 'Vineyard'),
  ('b0a00000-0000-4000-8000-000000000001', 'b0a10001-0000-4000-8000-000000000005', 'car', 'ICE', 'Diesel', 'ST20 YZA', 'BMW 3 Series', 2020, 'company_owned', 'active', 'Rosa Judge', 'Management'),
  -- 3x BEV cars (leased)
  ('b0a00000-0000-4000-8000-000000000001', 'b0a10001-0000-4000-8000-000000000005', 'car', 'BEV', NULL, 'UV24 BEV', 'Tesla Model 3', 2024, 'company_leased', 'active', 'Marcus Chen', 'Finance'),
  ('b0a00000-0000-4000-8000-000000000001', 'b0a10001-0000-4000-8000-000000000005', 'car', 'BEV', NULL, 'WX24 EVC', 'MG4 EV', 2024, 'company_leased', 'active', 'Sarah Okafor', 'Operations'),
  ('b0a00000-0000-4000-8000-000000000001', 'b0a10001-0000-4000-8000-000000000004', 'car', 'BEV', NULL, 'YZ24 EVD', 'Hyundai Ioniq 5', 2024, 'company_leased', 'active', 'Dan Fletcher', 'Brewery'),
  -- 2x HEV cars
  ('b0a00000-0000-4000-8000-000000000001', 'b0a10001-0000-4000-8000-000000000005', 'car', 'HEV', 'Petrol', 'AA23 HEV', 'Toyota Yaris Cross', 2023, 'company_owned', 'active', 'Priya Sharma', 'Sustainability'),
  ('b0a00000-0000-4000-8000-000000000001', 'b0a10001-0000-4000-8000-000000000001', 'car', 'HEV', 'Petrol', 'BB23 HYB', 'Toyota RAV4', 2023, 'company_owned', 'active', 'Will Ashton', 'Vineyard'),
  -- 2x ICE vans
  ('b0a00000-0000-4000-8000-000000000001', 'b0a10001-0000-4000-8000-000000000004', 'van', 'ICE', 'Diesel', 'CC22 VAN', 'Ford Transit', 2022, 'company_owned', 'active', NULL, 'Distribution'),
  ('b0a00000-0000-4000-8000-000000000001', 'b0a10001-0000-4000-8000-000000000001', 'van', 'ICE', 'Diesel', 'DD21 VAN', 'Mercedes Sprinter', 2021, 'company_owned', 'active', NULL, 'Distribution');

-- ==========================================================================
-- 13. PEOPLE & CULTURE
-- ==========================================================================

-- Workforce Demographics: Gender
INSERT INTO "public"."people_workforce_demographics" (
  organization_id, dimension, category_value, employee_count, percentage,
  total_employees, reporting_year, snapshot_date, data_source
) VALUES
  ('b0a00000-0000-4000-8000-000000000001', 'gender', 'Male',       20, 54.05, 37, 2025, '2025-04-01', 'hr_system'),
  ('b0a00000-0000-4000-8000-000000000001', 'gender', 'Female',     15, 40.54, 37, 2025, '2025-04-01', 'hr_system'),
  ('b0a00000-0000-4000-8000-000000000001', 'gender', 'Non-binary',  2,  5.41, 37, 2025, '2025-04-01', 'hr_system');

-- Workforce Demographics: Age
INSERT INTO "public"."people_workforce_demographics" (
  organization_id, dimension, category_value, employee_count, percentage,
  total_employees, reporting_year, snapshot_date, data_source
) VALUES
  ('b0a00000-0000-4000-8000-000000000001', 'age', '18-24',  4, 10.81, 37, 2025, '2025-04-01', 'hr_system'),
  ('b0a00000-0000-4000-8000-000000000001', 'age', '25-34', 12, 32.43, 37, 2025, '2025-04-01', 'hr_system'),
  ('b0a00000-0000-4000-8000-000000000001', 'age', '35-44', 10, 27.03, 37, 2025, '2025-04-01', 'hr_system'),
  ('b0a00000-0000-4000-8000-000000000001', 'age', '45-54',  7, 18.92, 37, 2025, '2025-04-01', 'hr_system'),
  ('b0a00000-0000-4000-8000-000000000001', 'age', '55-64',  4, 10.81, 37, 2025, '2025-04-01', 'hr_system');

-- Training Records
INSERT INTO "public"."people_training_records" (
  organization_id, training_name, training_type, training_provider, provider_type,
  delivery_method, is_mandatory, total_hours, participants, eligible_employees,
  completion_rate, total_cost, currency, training_date, reporting_year, description
) VALUES
  ('b0a00000-0000-4000-8000-000000000001', 'Health & Safety Induction', 'compliance', 'Internal', 'internal',
   'in_person', true, 4, 37, 37, 100.00, 0, 'GBP', '2025-01-15', 2025,
   'Mandatory annual H&S refresher for all staff covering fire safety, manual handling and first aid awareness'),
  ('b0a00000-0000-4000-8000-000000000001', 'Sustainability Awareness Training', 'sustainability', 'alkatera Academy', 'internal',
   'hybrid', true, 8, 37, 37, 97.30, 0, 'GBP', '2025-02-20', 2025,
   'Company-wide sustainability training covering carbon footprinting, circular economy and our net zero roadmap'),
  ('b0a00000-0000-4000-8000-000000000001', 'WSET Level 2 Award in Wines', 'professional_development', 'Wine & Spirit Education Trust', 'external',
   'in_person', false, 28, 6, 12, 100.00, 2340, 'GBP', '2025-03-10', 2025,
   'Internationally recognised wine qualification for customer-facing and production staff'),
  ('b0a00000-0000-4000-8000-000000000001', 'Mental Health First Aid', 'wellbeing', 'MHFA England', 'external',
   'in_person', false, 16, 5, 37, 100.00, 1500, 'GBP', '2025-05-08', 2025,
   'Two-day certified course training designated mental health first aiders across each site'),
  ('b0a00000-0000-4000-8000-000000000001', 'Forklift Truck Certification', 'compliance', 'RTITB Accredited Centre', 'external',
   'in_person', true, 24, 8, 8, 100.00, 3200, 'GBP', '2025-04-14', 2025,
   'Counterbalance forklift certification for warehouse and production floor staff');

-- Benefits
INSERT INTO "public"."people_benefits" (
  organization_id, benefit_name, benefit_category, benefit_type, description,
  eligible_employee_count, uptake_count, employer_contribution, employee_contribution,
  currency, reporting_year, is_active
) VALUES
  ('b0a00000-0000-4000-8000-000000000001', 'Workplace Pension', 'financial', 'pension',
   'Auto-enrolment pension with 8% employer and 5% employee contribution',
   37, 37, 8.00, 5.00, 'GBP', 2025, true),
  ('b0a00000-0000-4000-8000-000000000001', 'Private Health Insurance', 'health', 'health_insurance',
   'Comprehensive private medical insurance including dental and optical cover',
   37, 28, 1200.00, 0, 'GBP', 2025, true),
  ('b0a00000-0000-4000-8000-000000000001', 'Cycle to Work Scheme', 'transport', 'salary_sacrifice',
   'Tax-efficient cycle purchase scheme up to GBP 2,000',
   37, 12, 0, 0, 'GBP', 2025, true),
  ('b0a00000-0000-4000-8000-000000000001', 'Employee Product Discount', 'lifestyle', 'discount',
   '40% discount on all alkatera Drinks Co products for personal use',
   37, 35, 0, 0, 'GBP', 2025, true),
  ('b0a00000-0000-4000-8000-000000000001', 'Enhanced Annual Leave', 'wellbeing', 'leave',
   '28 days annual leave plus bank holidays, increasing to 30 days after 3 years service',
   37, 37, 0, 0, 'GBP', 2025, true);

-- DEI Actions
INSERT INTO "public"."people_dei_actions" (
  organization_id, action_title, action_name, description, action_category, focus_dimension,
  status, priority, start_date, target_date, responsible_person, responsible_department,
  reporting_year
) VALUES
  ('b0a00000-0000-4000-8000-000000000001', 'Gender Pay Gap Audit', 'Gender Pay Gap Audit',
   'Annual review of pay equity across all roles and levels with action plan for any gaps identified',
   'pay_equity', 'gender', 'in_progress', 'high', '2025-01-01', '2025-06-30',
   'Marcus Chen', 'Finance', 2025),
  ('b0a00000-0000-4000-8000-000000000001', 'Inclusive Recruitment Training', 'Inclusive Recruitment Training',
   'Training for all hiring managers on unconscious bias, inclusive job descriptions and structured interviewing',
   'recruitment', 'general', 'completed', 'medium', '2025-02-01', '2025-04-30',
   'Sarah Okafor', 'Operations', 2025),
  ('b0a00000-0000-4000-8000-000000000001', 'Workplace Accessibility Improvements', 'Workplace Accessibility Improvements',
   'Audit and upgrade of all three sites for wheelchair access, hearing loops and quiet spaces',
   'accessibility', 'disability', 'planned', 'medium', '2025-07-01', '2025-12-31',
   'Sarah Okafor', 'Operations', 2025);

-- ==========================================================================
-- 14. GOVERNANCE
-- ==========================================================================

-- Board Members
INSERT INTO "public"."governance_board_members" (
  organization_id, member_name, role, member_type, gender, age_bracket,
  expertise_areas, appointment_date, is_current, is_independent, meeting_attendance_rate
) VALUES
  ('b0a00000-0000-4000-8000-000000000001', 'Rosa Judge', 'Chair & Co-Founder', 'Executive', 'Female', '35-44',
   ARRAY['Strategy', 'Sustainability', 'Brand'], '2020-03-15', true, false, 100.00),
  ('b0a00000-0000-4000-8000-000000000001', 'Marcus Chen', 'Finance Director', 'Executive', 'Male', '45-54',
   ARRAY['Finance', 'Investment', 'Risk Management'], '2020-03-15', true, false, 95.00),
  ('b0a00000-0000-4000-8000-000000000001', 'Sarah Okafor', 'Operations Director', 'Executive', 'Female', '35-44',
   ARRAY['Operations', 'Supply Chain', 'Quality'], '2021-06-01', true, false, 100.00),
  ('b0a00000-0000-4000-8000-000000000001', 'James Whitfield', 'Non-Executive Director', 'Non-Executive', 'Male', '55-64',
   ARRAY['Drinks Industry', 'Export Markets', 'M&A'], '2022-01-10', true, false, 90.00),
  ('b0a00000-0000-4000-8000-000000000001', 'Dr Priya Sharma', 'Independent Non-Executive Director', 'Independent', 'Female', '45-54',
   ARRAY['Environmental Science', 'ESG Reporting', 'Academic Research'], '2023-04-01', true, true, 100.00);

-- Mission
INSERT INTO "public"."governance_mission" (
  organization_id, mission_statement, vision_statement, purpose_statement,
  purpose_type, core_values, sdg_commitments, climate_commitments,
  legal_structure, is_benefit_corporation, articles_include_stakeholder_consideration,
  mission_last_updated
) VALUES (
  'b0a00000-0000-4000-8000-000000000001',
  'To produce exceptional drinks that prove sustainability and quality go hand in hand, setting a new standard for the UK drinks industry.',
  'A drinks industry where every sip contributes to a healthier planet and stronger communities.',
  'We exist to demonstrate that world-class beverages can be produced with a net positive impact on people and planet.',
  'social_enterprise',
  '[{"name": "Sustainability", "description": "Environmental responsibility in every decision"}, {"name": "Transparency", "description": "Open and honest about our impact, good and bad"}, {"name": "Community", "description": "Investing in the places where we live and work"}, {"name": "Quality", "description": "Never compromising on the craft of great drinks"}]'::jsonb,
  ARRAY[12, 13, 15],
  ARRAY['Net zero by 2035', 'Science-based targets validated by SBTi', '50% reduction in Scope 1&2 by 2030'],
  'Limited Company',
  false,
  true,
  '2025-01-15'
) ON CONFLICT (organization_id) DO NOTHING;

-- Policies
INSERT INTO "public"."governance_policies" (
  organization_id, policy_name, policy_code, policy_type, description,
  status, effective_date, review_date, owner_name, owner_department
) VALUES
  ('b0a00000-0000-4000-8000-000000000001', 'Environmental Policy', 'ENV-001', 'environmental',
   'Comprehensive environmental management policy covering emissions, waste, water and biodiversity across all operations',
   'active', '2024-01-01', '2026-01-01', 'Rosa Judge', 'Board'),
  ('b0a00000-0000-4000-8000-000000000001', 'Modern Slavery Statement', 'ETH-001', 'ethics',
   'Annual statement on steps taken to prevent modern slavery and human trafficking in our operations and supply chains',
   'active', '2024-04-01', '2025-04-01', 'Sarah Okafor', 'Operations'),
  ('b0a00000-0000-4000-8000-000000000001', 'Health & Safety Policy', 'HS-001', 'health_safety',
   'Health and safety policy for all production sites, offices and vineyard operations',
   'active', '2024-01-01', '2025-06-01', 'Sarah Okafor', 'Operations'),
  ('b0a00000-0000-4000-8000-000000000001', 'Anti-Corruption & Bribery Policy', 'ETH-002', 'ethics',
   'Zero tolerance policy on bribery and corruption in line with the UK Bribery Act 2010',
   'active', '2024-01-01', '2026-01-01', 'Marcus Chen', 'Finance'),
  ('b0a00000-0000-4000-8000-000000000001', 'Whistleblowing Policy', 'ETH-003', 'ethics',
   'Protected disclosure policy enabling staff to raise concerns confidentially without fear of retaliation',
   'active', '2024-03-01', '2026-03-01', 'Rosa Judge', 'Board'),
  ('b0a00000-0000-4000-8000-000000000001', 'Data Protection Policy', 'DP-001', 'data_protection',
   'GDPR-compliant data protection policy covering customer, employee and supplier personal data',
   'active', '2024-01-01', '2025-07-01', 'Marcus Chen', 'Finance');

-- ==========================================================================
-- 15. COMMUNITY IMPACT
-- ==========================================================================

-- Donations
INSERT INTO "public"."community_donations" (
  organization_id, donation_name, donation_type, description,
  recipient_name, recipient_type, recipient_cause,
  donation_amount, currency, estimated_value, hours_donated,
  donation_date, reporting_year, beneficiaries_count, impact_description
) VALUES
  ('b0a00000-0000-4000-8000-000000000001', 'Annual Donation to Bath Food Bank', 'cash',
   'Unrestricted cash donation to support food distribution in the Bath area',
   'Bath Food Bank', 'charity', 'food_poverty',
   5000, 'GBP', NULL, NULL,
   '2025-03-15', 2025, 2400, 'Helped provide 4,800 emergency food parcels over the year'),
  ('b0a00000-0000-4000-8000-000000000001', 'Charity Auction Product Donation', 'in_kind',
   'Donation of premium product hampers for Julian House charity auction',
   'Julian House', 'charity', 'homelessness',
   NULL, 'GBP', 1200, NULL,
   '2025-06-20', 2025, NULL, 'Raised over GBP 3,500 at auction for homelessness services'),
  ('b0a00000-0000-4000-8000-000000000001', 'Pro Bono Sustainability Consultancy', 'time',
   'Free sustainability advice for local independent pubs looking to reduce their carbon footprint',
   'Bath Independent Pub Collective', 'community_group', 'environment',
   NULL, 'GBP', NULL, 8,
   '2025-09-10', 2025, 12, 'Helped 12 local pubs create carbon reduction action plans'),
  ('b0a00000-0000-4000-8000-000000000001', 'Annual Donation to Surfers Against Sewage', 'cash',
   'Supporting ocean and waterway protection campaigns across the South West',
   'Surfers Against Sewage', 'charity', 'environment',
   2500, 'GBP', NULL, NULL,
   '2025-04-22', 2025, NULL, 'Funded 3 beach clean events and water quality monitoring in Somerset');

-- Volunteer Activities
INSERT INTO "public"."community_volunteer_activities" (
  organization_id, activity_name, activity_type, description,
  partner_organization, partner_cause,
  activity_date, duration_hours, participant_count, total_volunteer_hours,
  beneficiaries_reached, impact_description, is_paid_time
) VALUES
  ('b0a00000-0000-4000-8000-000000000001', 'Weston-super-Mare Beach Cleanup', 'team_volunteering',
   'Full-day team beach cleanup collecting plastic, fishing line and other marine litter',
   'Surfers Against Sewage', 'environment',
   '2025-04-22', 4.0, 15, 60,
   NULL, 'Collected 127kg of marine litter from a 2km stretch of coastline', true),
  ('b0a00000-0000-4000-8000-000000000001', 'Bath College Hospitality Mentoring', 'skills_based',
   'Ongoing mentoring programme pairing our team members with hospitality students',
   'Bath College', 'education',
   '2025-05-15', 2.0, 4, 32,
   16, '16 students received one-to-one mentoring over 8 sessions on careers in the drinks industry', true),
  ('b0a00000-0000-4000-8000-000000000001', 'Twerton Community Garden Restoration', 'team_volunteering',
   'Restoration of raised beds and planting of herb garden at local community allotment',
   'Twerton Community Association', 'community',
   '2025-07-12', 3.0, 8, 24,
   45, 'Restored 6 raised beds and planted a herb garden now used by 45 local families', true);

-- Local Impact
INSERT INTO "public"."community_local_impact" (
  organization_id, reporting_year,
  total_employees, local_employees, local_definition,
  total_procurement_spend, local_procurement_spend, local_supplier_count, total_supplier_count,
  corporate_tax_paid, payroll_taxes_paid, business_rates_paid,
  community_investment_total, notes
) VALUES (
  'b0a00000-0000-4000-8000-000000000001', 2025,
  37, 28, 'Within 30 miles of Bath, Bristol or Cirencester sites',
  1200000, 480000, 34, 85,
  85000, 142000, 28000,
  8700,
  'Local procurement includes malt from Warminster Maltings, hops from Herefordshire and glass from Bristol'
);

-- ==========================================================================
-- 16. ONBOARDING STATE (mark completed)
-- ==========================================================================
INSERT INTO "public"."onboarding_state" (
  organization_id, user_id, state, onboarding_flow
) VALUES (
  'b0a00000-0000-4000-8000-000000000001',
  '27ea31a3-949c-4107-bcd1-e1b1eff818d1',
  '{"completed": true, "dismissed": false, "currentStep": "completion", "completedSteps": ["welcome-screen", "meet-rosa", "personalization", "company-basics", "roadmap", "preview-dashboard", "first-product", "facilities-setup", "core-metrics", "data-entry-method", "foundation-complete", "feature-showcase", "invite-team", "completion"], "startedAt": "2025-01-01T00:00:00Z", "completedAt": "2025-01-01T00:01:00Z"}'::jsonb,
  'owner'
)
ON CONFLICT (organization_id, user_id) DO UPDATE SET
  state = EXCLUDED.state,
  onboarding_flow = EXCLUDED.onboarding_flow,
  updated_at = now();
