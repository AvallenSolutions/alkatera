/*
  # Seed Fleet Emission Sources with DEFRA 2025 Factors

  ## Summary
  Populates the fleet_emission_sources reference table with emission sources
  for various vehicle types, linking them to the appropriate DEFRA 2025 
  emission factors.

  ## Sources Seeded
  - Diesel cars (Scope 1 - company owned/leased)
  - Petrol cars (Scope 1 - company owned/leased)
  - Electric cars (Scope 2 - company owned/leased)
  - Diesel vans (Scope 1 - company owned/leased)
  - Electric vans (Scope 2 - company owned/leased)
  - HGV (Scope 1 - company owned/leased)
  - Grey fleet variants (Scope 3 Cat 6 - employee owned/rental)

  ## Data Entry Methods
  - Volume-based: Litres of fuel consumed
  - Distance-based: Kilometres travelled
  - Consumption-based: kWh for electric vehicles
*/

-- Company-owned Diesel Cars (Scope 1)
INSERT INTO fleet_emission_sources (
  source_name, fuel_type, vehicle_category, calculated_scope, default_unit, 
  supports_volume, supports_distance, supports_spend, supports_consumption,
  emission_factor_volume_id, emission_factor_distance_id
) VALUES (
  'Diesel Car (Company Fleet)', 'diesel', 'car', 'Scope 1', 'km',
  true, true, false, false,
  'd7868785-8d06-46bc-ba88-a479f8014c54',
  'c6a6b01b-8865-45d3-8806-e184399f47b1'
) ON CONFLICT (fuel_type, vehicle_category, calculated_scope) DO UPDATE SET
  source_name = EXCLUDED.source_name,
  emission_factor_volume_id = EXCLUDED.emission_factor_volume_id,
  emission_factor_distance_id = EXCLUDED.emission_factor_distance_id;

-- Company-owned Petrol Cars (Scope 1)
INSERT INTO fleet_emission_sources (
  source_name, fuel_type, vehicle_category, calculated_scope, default_unit, 
  supports_volume, supports_distance, supports_spend, supports_consumption,
  emission_factor_volume_id, emission_factor_distance_id
) VALUES (
  'Petrol Car (Company Fleet)', 'petrol', 'car', 'Scope 1', 'km',
  true, true, false, false,
  '613cbc95-28f0-410c-a01a-bc5bd5c3c6c1',
  'c99acb70-9d37-4be4-9de4-adcccd133e4f'
) ON CONFLICT (fuel_type, vehicle_category, calculated_scope) DO UPDATE SET
  source_name = EXCLUDED.source_name,
  emission_factor_volume_id = EXCLUDED.emission_factor_volume_id,
  emission_factor_distance_id = EXCLUDED.emission_factor_distance_id;

-- Company-owned Electric Cars (Scope 2)
INSERT INTO fleet_emission_sources (
  source_name, fuel_type, vehicle_category, calculated_scope, default_unit, 
  supports_volume, supports_distance, supports_spend, supports_consumption,
  emission_factor_volume_id, emission_factor_distance_id
) VALUES (
  'Electric Car (Company Fleet)', 'electric', 'car', 'Scope 2', 'km',
  false, true, false, true,
  NULL,
  'f48be3dc-80c0-441c-9ee7-44f1dd079b57'
) ON CONFLICT (fuel_type, vehicle_category, calculated_scope) DO UPDATE SET
  source_name = EXCLUDED.source_name,
  emission_factor_distance_id = EXCLUDED.emission_factor_distance_id;

-- Company-owned Diesel Vans (Scope 1)
INSERT INTO fleet_emission_sources (
  source_name, fuel_type, vehicle_category, calculated_scope, default_unit, 
  supports_volume, supports_distance, supports_spend, supports_consumption,
  emission_factor_volume_id, emission_factor_distance_id
) VALUES (
  'Diesel Van (Company Fleet)', 'diesel', 'van', 'Scope 1', 'km',
  true, true, false, false,
  'd7868785-8d06-46bc-ba88-a479f8014c54',
  'eb8aaa0a-4b0f-42ea-bf92-d2a31cf72d73'
) ON CONFLICT (fuel_type, vehicle_category, calculated_scope) DO UPDATE SET
  source_name = EXCLUDED.source_name,
  emission_factor_volume_id = EXCLUDED.emission_factor_volume_id,
  emission_factor_distance_id = EXCLUDED.emission_factor_distance_id;

-- Company-owned Petrol Vans (Scope 1)
INSERT INTO fleet_emission_sources (
  source_name, fuel_type, vehicle_category, calculated_scope, default_unit, 
  supports_volume, supports_distance, supports_spend, supports_consumption,
  emission_factor_volume_id, emission_factor_distance_id
) VALUES (
  'Petrol Van (Company Fleet)', 'petrol', 'van', 'Scope 1', 'km',
  true, true, false, false,
  '613cbc95-28f0-410c-a01a-bc5bd5c3c6c1',
  'eb8aaa0a-4b0f-42ea-bf92-d2a31cf72d73'
) ON CONFLICT (fuel_type, vehicle_category, calculated_scope) DO UPDATE SET
  source_name = EXCLUDED.source_name,
  emission_factor_volume_id = EXCLUDED.emission_factor_volume_id,
  emission_factor_distance_id = EXCLUDED.emission_factor_distance_id;

-- Company-owned Electric Vans (Scope 2)
INSERT INTO fleet_emission_sources (
  source_name, fuel_type, vehicle_category, calculated_scope, default_unit, 
  supports_volume, supports_distance, supports_spend, supports_consumption,
  emission_factor_volume_id, emission_factor_distance_id
) VALUES (
  'Electric Van (Company Fleet)', 'electric', 'van', 'Scope 2', 'km',
  false, true, false, true,
  NULL,
  '91a6a5fb-d804-4c4d-bba4-8404d4d09eef'
) ON CONFLICT (fuel_type, vehicle_category, calculated_scope) DO UPDATE SET
  source_name = EXCLUDED.source_name,
  emission_factor_distance_id = EXCLUDED.emission_factor_distance_id;

-- Company-owned HGV (Scope 1)
INSERT INTO fleet_emission_sources (
  source_name, fuel_type, vehicle_category, calculated_scope, default_unit, 
  supports_volume, supports_distance, supports_spend, supports_consumption,
  emission_factor_volume_id, emission_factor_distance_id
) VALUES (
  'HGV - Articulated (Company Fleet)', 'diesel', 'hgv', 'Scope 1', 'km',
  true, true, false, false,
  'd7868785-8d06-46bc-ba88-a479f8014c54',
  'fab0fac3-6ce8-45fd-b050-03ed9aaa8f84'
) ON CONFLICT (fuel_type, vehicle_category, calculated_scope) DO UPDATE SET
  source_name = EXCLUDED.source_name,
  emission_factor_volume_id = EXCLUDED.emission_factor_volume_id,
  emission_factor_distance_id = EXCLUDED.emission_factor_distance_id;

-- Grey Fleet - Employee Diesel Car (Scope 3 Cat 6)
INSERT INTO fleet_emission_sources (
  source_name, fuel_type, vehicle_category, calculated_scope, default_unit, 
  supports_volume, supports_distance, supports_spend, supports_consumption,
  emission_factor_volume_id, emission_factor_distance_id
) VALUES (
  'Diesel Car (Grey Fleet)', 'diesel', 'car', 'Scope 3 Cat 6', 'km',
  true, true, false, false,
  'd7868785-8d06-46bc-ba88-a479f8014c54',
  'c6a6b01b-8865-45d3-8806-e184399f47b1'
) ON CONFLICT (fuel_type, vehicle_category, calculated_scope) DO UPDATE SET
  source_name = EXCLUDED.source_name,
  emission_factor_volume_id = EXCLUDED.emission_factor_volume_id,
  emission_factor_distance_id = EXCLUDED.emission_factor_distance_id;

-- Grey Fleet - Employee Petrol Car (Scope 3 Cat 6)
INSERT INTO fleet_emission_sources (
  source_name, fuel_type, vehicle_category, calculated_scope, default_unit, 
  supports_volume, supports_distance, supports_spend, supports_consumption,
  emission_factor_volume_id, emission_factor_distance_id
) VALUES (
  'Petrol Car (Grey Fleet)', 'petrol', 'car', 'Scope 3 Cat 6', 'km',
  true, true, false, false,
  '613cbc95-28f0-410c-a01a-bc5bd5c3c6c1',
  'c99acb70-9d37-4be4-9de4-adcccd133e4f'
) ON CONFLICT (fuel_type, vehicle_category, calculated_scope) DO UPDATE SET
  source_name = EXCLUDED.source_name,
  emission_factor_volume_id = EXCLUDED.emission_factor_volume_id,
  emission_factor_distance_id = EXCLUDED.emission_factor_distance_id;

-- Grey Fleet - Employee Electric Car (Scope 3 Cat 6)
INSERT INTO fleet_emission_sources (
  source_name, fuel_type, vehicle_category, calculated_scope, default_unit, 
  supports_volume, supports_distance, supports_spend, supports_consumption,
  emission_factor_volume_id, emission_factor_distance_id
) VALUES (
  'Electric Car (Grey Fleet)', 'electric', 'car', 'Scope 3 Cat 6', 'km',
  false, true, false, true,
  NULL,
  'f48be3dc-80c0-441c-9ee7-44f1dd079b57'
) ON CONFLICT (fuel_type, vehicle_category, calculated_scope) DO UPDATE SET
  source_name = EXCLUDED.source_name,
  emission_factor_distance_id = EXCLUDED.emission_factor_distance_id;

-- Grey Fleet - Diesel Van (Scope 3 Cat 6)
INSERT INTO fleet_emission_sources (
  source_name, fuel_type, vehicle_category, calculated_scope, default_unit, 
  supports_volume, supports_distance, supports_spend, supports_consumption,
  emission_factor_volume_id, emission_factor_distance_id
) VALUES (
  'Diesel Van (Grey Fleet)', 'diesel', 'van', 'Scope 3 Cat 6', 'km',
  true, true, false, false,
  'd7868785-8d06-46bc-ba88-a479f8014c54',
  'eb8aaa0a-4b0f-42ea-bf92-d2a31cf72d73'
) ON CONFLICT (fuel_type, vehicle_category, calculated_scope) DO UPDATE SET
  source_name = EXCLUDED.source_name,
  emission_factor_volume_id = EXCLUDED.emission_factor_volume_id,
  emission_factor_distance_id = EXCLUDED.emission_factor_distance_id;
