-- Populate Company Vitality Test Data
-- This adds realistic multi-capital impact metrics to existing product LCAs

-- Update product LCAs with ReCiPe 2016 metrics (beverage industry values)
UPDATE product_carbon_footprints SET
  aggregated_impacts = '{
    "climate_change_gwp100": 245.50,
    "water_consumption": 32.40,
    "water_scarcity_aware": 485.20,
    "land_use": 1250.00,
    "terrestrial_ecotoxicity": 8.45,
    "freshwater_eutrophication": 0.35,
    "terrestrial_acidification": 1.80,
    "fossil_resource_scarcity": 22.30
  }'::jsonb,
  csrd_compliant = true,
  status = 'completed',
  updated_at = now()
WHERE id = '3112ac57-942c-4513-9103-907dac5d7189';

UPDATE product_carbon_footprints SET
  aggregated_impacts = '{
    "climate_change_gwp100": 189.30,
    "water_consumption": 25.60,
    "water_scarcity_aware": 312.80,
    "land_use": 980.00,
    "terrestrial_ecotoxicity": 5.20,
    "freshwater_eutrophication": 0.28,
    "terrestrial_acidification": 1.45,
    "fossil_resource_scarcity": 18.50
  }'::jsonb,
  csrd_compliant = true,
  status = 'completed',
  updated_at = now()
WHERE id = '3ba58ab6-350d-4861-8758-209b9f1836ba';

UPDATE product_carbon_footprints SET
  aggregated_impacts = '{
    "climate_change_gwp100": 320.75,
    "water_consumption": 42.30,
    "water_scarcity_aware": 625.40,
    "land_use": 1850.00,
    "terrestrial_ecotoxicity": 12.60,
    "freshwater_eutrophication": 0.52,
    "terrestrial_acidification": 2.30,
    "fossil_resource_scarcity": 28.90
  }'::jsonb,
  csrd_compliant = true,
  status = 'completed',
  updated_at = now()
WHERE id = '2ff6d3b0-923b-4fdf-af2c-f39e8530c971';

UPDATE product_carbon_footprints SET
  aggregated_impacts = '{
    "climate_change_gwp100": 156.20,
    "water_consumption": 18.50,
    "water_scarcity_aware": 245.60,
    "land_use": 720.00,
    "terrestrial_ecotoxicity": 3.85,
    "freshwater_eutrophication": 0.19,
    "terrestrial_acidification": 1.15,
    "fossil_resource_scarcity": 14.20
  }'::jsonb,
  csrd_compliant = true,
  status = 'completed',
  updated_at = now()
WHERE id = 'de469f87-045e-4589-b101-855ef2941799';

UPDATE product_carbon_footprints SET
  aggregated_impacts = '{
    "climate_change_gwp100": 425.60,
    "water_consumption": 55.80,
    "water_scarcity_aware": 892.30,
    "land_use": 2450.00,
    "terrestrial_ecotoxicity": 15.75,
    "freshwater_eutrophication": 0.68,
    "terrestrial_acidification": 2.95,
    "fossil_resource_scarcity": 38.40
  }'::jsonb,
  csrd_compliant = true,
  status = 'completed',
  updated_at = now()
WHERE id = '47d5c47b-10a8-4b98-a422-8cd58430f4f0';

UPDATE product_carbon_footprints SET
  aggregated_impacts = '{
    "climate_change_gwp100": 278.90,
    "water_consumption": 38.20,
    "water_scarcity_aware": 534.70,
    "land_use": 1420.00,
    "terrestrial_ecotoxicity": 9.30,
    "freshwater_eutrophication": 0.42,
    "terrestrial_acidification": 2.05,
    "fossil_resource_scarcity": 25.60
  }'::jsonb,
  csrd_compliant = true,
  status = 'completed',
  updated_at = now()
WHERE id = '1c5e4ebd-aa65-4777-bf15-550a9b0e5d77';

UPDATE product_carbon_footprints SET
  aggregated_impacts = '{
    "climate_change_gwp100": 198.40,
    "water_consumption": 28.90,
    "water_scarcity_aware": 378.50,
    "land_use": 1050.00,
    "terrestrial_ecotoxicity": 6.45,
    "freshwater_eutrophication": 0.31,
    "terrestrial_acidification": 1.60,
    "fossil_resource_scarcity": 19.80
  }'::jsonb,
  csrd_compliant = true,
  status = 'completed',
  updated_at = now()
WHERE id = 'c0d04915-b235-45e4-b636-cbae81f477b5';

UPDATE product_carbon_footprints SET
  aggregated_impacts = '{
    "climate_change_gwp100": 362.15,
    "water_consumption": 48.70,
    "water_scarcity_aware": 712.90,
    "land_use": 1980.00,
    "terrestrial_ecotoxicity": 13.20,
    "freshwater_eutrophication": 0.58,
    "terrestrial_acidification": 2.55,
    "fossil_resource_scarcity": 32.10
  }'::jsonb,
  csrd_compliant = true,
  status = 'completed',
  updated_at = now()
WHERE id = '940acfa4-b1c4-4b4b-a88e-6f4b0955ed8c';

-- Add Scope 1, 2, 3 emissions data
INSERT INTO calculated_emissions (
  organization_id,
  facility_id,
  scope,
  category,
  subcategory,
  co2e_kg,
  calculation_date,
  data_quality,
  created_at
) VALUES
  -- Scope 1: Direct emissions
  ('2d86de84-e24e-458b-84b9-fd4057998bda', NULL, 'Scope 1', 'Stationary Combustion', 'Natural Gas', 1250.50, now(), 'high', now()),
  ('2d86de84-e24e-458b-84b9-fd4057998bda', NULL, 'Scope 1', 'Mobile Combustion', 'Diesel Vehicles', 850.30, now(), 'high', now()),
  ('2d86de84-e24e-458b-84b9-fd4057998bda', NULL, 'Scope 1', 'Fugitive Emissions', 'Refrigerants', 320.75, now(), 'medium', now()),

  -- Scope 2: Indirect energy
  ('2d86de84-e24e-458b-84b9-fd4057998bda', NULL, 'Scope 2', 'Purchased Electricity', 'Grid Mix', 3450.80, now(), 'high', now()),
  ('2d86de84-e24e-458b-84b9-fd4057998bda', NULL, 'Scope 2', 'Purchased Heat', 'District Heating', 680.20, now(), 'high', now()),

  -- Scope 3: Value chain (largest contributor)
  ('2d86de84-e24e-458b-84b9-fd4057998bda', NULL, 'Scope 3', 'Purchased Goods & Services', 'Raw Materials', 12500.40, now(), 'medium', now()),
  ('2d86de84-e24e-458b-84b9-fd4057998bda', NULL, 'Scope 3', 'Purchased Goods & Services', 'Packaging', 8750.60, now(), 'medium', now()),
  ('2d86de84-e24e-458b-84b9-fd4057998bda', NULL, 'Scope 3', 'Upstream Transportation', 'Freight', 2340.90, now(), 'medium', now()),
  ('2d86de84-e24e-458b-84b9-fd4057998bda', NULL, 'Scope 3', 'Waste Generated', 'Operational Waste', 540.30, now(), 'medium', now()),
  ('2d86de84-e24e-458b-84b9-fd4057998bda', NULL, 'Scope 3', 'Business Travel', 'Flights', 890.50, now(), 'high', now()),
  ('2d86de84-e24e-458b-84b9-fd4057998bda', NULL, 'Scope 3', 'Employee Commuting', 'Daily Commute', 1250.70, now(), 'low', now())
ON CONFLICT DO NOTHING;

-- Add test facilities with water scarcity risk data
INSERT INTO facilities (
  organization_id,
  name,
  facility_type_id,
  location_country_code,
  address_lat,
  address_lng,
  created_at
)
SELECT
  '2d86de84-e24e-458b-84b9-fd4057998bda',
  'London Production Site',
  (SELECT id FROM facility_types WHERE name = 'Manufacturing' LIMIT 1),
  'GB',
  51.5074,
  -0.1278,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM facilities
  WHERE organization_id = '2d86de84-e24e-458b-84b9-fd4057998bda'
  AND name = 'London Production Site'
);

INSERT INTO facilities (
  organization_id,
  name,
  facility_type_id,
  location_country_code,
  address_lat,
  address_lng,
  created_at
)
SELECT
  '2d86de84-e24e-458b-84b9-fd4057998bda',
  'Barcelona Bottling Plant',
  (SELECT id FROM facility_types WHERE name = 'Manufacturing' LIMIT 1),
  'ES',
  41.3851,
  2.1734,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM facilities
  WHERE organization_id = '2d86de84-e24e-458b-84b9-fd4057998bda'
  AND name = 'Barcelona Bottling Plant'
);

INSERT INTO facilities (
  organization_id,
  name,
  facility_type_id,
  location_country_code,
  address_lat,
  address_lng,
  created_at
)
SELECT
  '2d86de84-e24e-458b-84b9-fd4057998bda',
  'Dublin Distribution Centre',
  (SELECT id FROM facility_types WHERE name = 'Warehouse' LIMIT 1),
  'IE',
  53.3498,
  -6.2603,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM facilities
  WHERE organization_id = '2d86de84-e24e-458b-84b9-fd4057998bda'
  AND name = 'Dublin Distribution Centre'
);

-- Verify the data
SELECT
  'Product LCAs Updated' as data_type,
  COUNT(*) as count
FROM product_carbon_footprints
WHERE organization_id = '2d86de84-e24e-458b-84b9-fd4057998bda'
  AND aggregated_impacts IS NOT NULL
UNION ALL
SELECT
  'Scope Emissions Added' as data_type,
  COUNT(*) as count
FROM calculated_emissions
WHERE organization_id = '2d86de84-e24e-458b-84b9-fd4057998bda'
UNION ALL
SELECT
  'Facilities Created' as data_type,
  COUNT(*) as count
FROM facilities
WHERE organization_id = '2d86de84-e24e-458b-84b9-fd4057998bda';
