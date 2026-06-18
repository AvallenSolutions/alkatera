-- ============================================================================
-- Demo Vineyard Seed Data: Marlborough Sauvignon Blanc
-- ============================================================================
-- Creates a realistic Marlborough vineyard with 3 vintages of growing data
-- for the alkatera Demo organisation. Based on Wairau Valley, Marlborough, NZ
-- Sauvignon Blanc viticulture with data sourced from:
--   - NZ Winegrowers Annual Report 2024/25
--   - Sustainable Winegrowing NZ (SWNZ) benchmarks
--   - Marlborough District Council viticulture data
--   - IPCC 2019 climate zone classification
--   - Marlborough average: 10-14 t/ha for Sauvignon Blanc
--
-- Organisation: alkatera Demo (2d86de84-e24e-458b-84b9-fd4057998bda)
-- Product: Marlborough Sauvignon Blanc 750ml (product_id: 68)
-- ============================================================================

-- Enable viticulture_beta for the demo org
UPDATE organizations
SET feature_flags = COALESCE(feature_flags, '{}'::jsonb) || '{"viticulture_beta": true}'::jsonb
WHERE id = '2d86de84-e24e-458b-84b9-fd4057998bda';

-- ============================================================================
-- 1. Create the vineyard
-- ============================================================================

INSERT INTO vineyards (
  id,
  organization_id,
  facility_id,
  name,
  hectares,
  grape_varieties,
  annual_yield_tonnes,
  yield_tonnes_per_ha,
  certification,
  climate_zone,
  address_line1,
  address_city,
  address_country,
  address_postcode,
  address_lat,
  address_lng,
  location_country_code,
  is_active
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '2d86de84-e24e-458b-84b9-fd4057998bda',
  '16e80d3a-cb15-4530-9c04-781317b33427',  -- Central Otago Estate Winery (closest facility)
  'Wairau Valley Estate',
  18.0,
  ARRAY['Sauvignon Blanc'],
  198.0,   -- 11 t/ha * 18 ha (Marlborough SB average)
  11.0,    -- Marlborough Sauvignon Blanc: 10-14 t/ha
  'conventional',
  'temperate',  -- Marlborough: warm-temperate maritime, ~650mm rainfall
  '247 Rapaura Road',
  'Blenheim',
  'New Zealand',
  '7273',
  -41.5030,
  173.8690,
  'NZ',
  true
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. Vintage 2023 growing profile
-- ============================================================================
-- 2023 Marlborough: good season but high disease pressure from Cyclone
-- Gabrielle moisture. Higher spray count, slightly lower yields.

INSERT INTO vineyard_growing_profiles (
  id,
  vineyard_id,
  organization_id,
  vintage_year,
  area_ha,
  soil_management,
  pruning_residue_returned,
  fertiliser_type,
  fertiliser_quantity_kg,
  fertiliser_n_content_percent,
  uses_pesticides,
  pesticide_applications_per_year,
  pesticide_type,
  uses_herbicides,
  herbicide_applications_per_year,
  herbicide_type,
  diesel_litres_per_year,
  petrol_litres_per_year,
  is_irrigated,
  water_m3_per_ha,
  irrigation_energy_source,
  grape_yield_tonnes,
  soil_carbon_override_kg_co2e_per_ha
) VALUES (
  'v2023-0001-0000-0000-000000000001',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '2d86de84-e24e-458b-84b9-fd4057998bda',
  2023,
  18.0,
  'conventional_tillage',  -- Standard Marlborough practice: mow + cultivate
  true,                    -- Prunings mulched back into inter-row
  'synthetic_n',           -- Conventional: CAN (calcium ammonium nitrate)
  540,                     -- 30 kg/ha * 18 ha = 540 kg CAN
  27.0,                    -- CAN: 27% N
  true,
  10,                      -- Post-cyclone: higher spray count for botrytis
  'synthetic_fungicide',   -- Conventional: mancozeb, iprodione, etc.
  true,                    -- Under-vine herbicide (standard in Marlborough)
  2,                       -- 2 glyphosate applications per year
  'herbicide_glyphosate',
  2160,                    -- 120 L/ha * 18 ha (tractors, sprayers, mowing)
  270,                     -- 15 L/ha * 18 ha
  true,                    -- Marlborough: supplementary irrigation in dry spells
  180,                     -- 180 m3/ha (below NZ average, drip irrigation)
  'grid_electricity',      -- NZ grid (~82% renewable)
  162.0,                   -- 9 t/ha * 18 ha (below average: wet spring losses)
  null
) ON CONFLICT (vineyard_id, vintage_year) DO NOTHING;

-- ============================================================================
-- 3. Vintage 2024 growing profile
-- ============================================================================
-- 2024: Normal Marlborough season. Started SWNZ sustainability programme,
-- trialling cover crops in alternate rows, reduced herbicide to 1 pass.

INSERT INTO vineyard_growing_profiles (
  id,
  vineyard_id,
  organization_id,
  vintage_year,
  area_ha,
  soil_management,
  pruning_residue_returned,
  fertiliser_type,
  fertiliser_quantity_kg,
  fertiliser_n_content_percent,
  uses_pesticides,
  pesticide_applications_per_year,
  pesticide_type,
  uses_herbicides,
  herbicide_applications_per_year,
  herbicide_type,
  diesel_litres_per_year,
  petrol_litres_per_year,
  is_irrigated,
  water_m3_per_ha,
  irrigation_energy_source,
  grape_yield_tonnes,
  soil_carbon_override_kg_co2e_per_ha
) VALUES (
  'v2024-0001-0000-0000-000000000001',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '2d86de84-e24e-458b-84b9-fd4057998bda',
  2024,
  18.0,
  'cover_cropping',        -- Trialling cover crops in alternate rows
  true,
  'mixed',                 -- Transitioning: reduced CAN + added compost
  720,                     -- 40 kg/ha * 18 ha (mix of CAN + compost)
  12.0,                    -- Blended: lower overall N% than pure CAN
  true,
  7,                       -- Normal season: 7 fungicide sprays
  'synthetic_fungicide',
  true,
  1,                       -- Reduced to 1 herbicide pass (under-vine only)
  'herbicide_glyphosate',
  1980,                    -- 110 L/ha * 18 ha (slight reduction from mowing instead of cultivating)
  216,                     -- 12 L/ha * 18 ha
  true,
  150,                     -- 150 m3/ha (improved soil moisture from cover crops)
  'grid_electricity',
  198.0,                   -- 11 t/ha * 18 ha (normal yield)
  null
) ON CONFLICT (vineyard_id, vintage_year) DO NOTHING;

-- ============================================================================
-- 4. Vintage 2025 growing profile
-- ============================================================================
-- 2025: Full SWNZ certification achieved. Cover crops in all rows,
-- eliminated herbicide (switched to under-vine mowing), started soil
-- carbon monitoring, reduced synthetic N by switching to compost + legume
-- cover crop nitrogen fixation.

INSERT INTO vineyard_growing_profiles (
  id,
  vineyard_id,
  organization_id,
  vintage_year,
  area_ha,
  soil_management,
  pruning_residue_returned,
  fertiliser_type,
  fertiliser_quantity_kg,
  fertiliser_n_content_percent,
  uses_pesticides,
  pesticide_applications_per_year,
  pesticide_type,
  uses_herbicides,
  herbicide_applications_per_year,
  herbicide_type,
  diesel_litres_per_year,
  petrol_litres_per_year,
  is_irrigated,
  water_m3_per_ha,
  irrigation_energy_source,
  grape_yield_tonnes,
  soil_carbon_override_kg_co2e_per_ha
) VALUES (
  'v2025-0001-0000-0000-000000000001',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '2d86de84-e24e-458b-84b9-fd4057998bda',
  2025,
  18.0,
  'cover_cropping',        -- Full cover crop programme (clover + rye)
  true,
  'organic_compost',       -- Fully transitioned to compost (N from legume cover crops)
  3600,                    -- 200 kg/ha * 18 ha compost
  1.5,                     -- Compost: 1.5% N
  true,
  6,                       -- Good season: 6 fungicide applications
  'sulfur',                -- Transitioning away from synthetic: sulphur-based
  false,                   -- Eliminated herbicide: under-vine mowing instead
  0,
  'generic',
  2160,                    -- 120 L/ha * 18 ha (slightly higher: under-vine mowing needs more passes)
  180,                     -- 10 L/ha * 18 ha
  true,
  120,                     -- 120 m3/ha (cover crops improving water retention)
  'grid_electricity',
  207.0,                   -- 11.5 t/ha * 18 ha (slight yield gain from soil health)
  480                      -- First soil carbon measurement: 480 kg CO2e/ha/yr
                           -- (SOC sampling at 0-30cm depth, verified by Manaaki Whenua)
) ON CONFLICT (vineyard_id, vintage_year) DO NOTHING;
