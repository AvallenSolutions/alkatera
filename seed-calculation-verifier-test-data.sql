/*
  # Calculation Verifier Test Data Seed Script

  IMPORTANT: This script creates TEST DATA ONLY for the Calculation Verifier feature.
  All data created by this script is clearly labelled with "[TEST DATA]" prefixes.

  ## What This Creates:
  1. Test facility: "[TEST DATA] Calculation Verifier Test Facility"
  2. Test emission sources for Scope 1, 2, and 3
  3. Test activity data for facility operations
  4. Test corporate overhead records

  ## How to Delete All Test Data:
  Run the companion script: DELETE-calculation-verifier-test-data.sql

  ## Prerequisites:
  - You must have an active organization_id
  - You must be logged in as an authenticated user
  - This script should be run through the Supabase SQL editor
*/

-- ============================================================================
-- STEP 1: Create Test Facility
-- ============================================================================

INSERT INTO public.facilities (
  organization_id,
  name,
  facility_type,
  location_address,
  location_city,
  location_state_province,
  location_country_code,
  location_postal_code,
  location_coordinates,
  operational_status,
  created_at
)
SELECT
  get_current_organization_id(),
  '[TEST DATA] Calculation Verifier Test Facility',
  'manufacturing_plant',
  '123 Test Street',
  'Test City',
  'Test State',
  'GB',
  'TE5T 1NG',
  point(51.5074, -0.1278), -- London coordinates
  'operational',
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.facilities
  WHERE name = '[TEST DATA] Calculation Verifier Test Facility'
  AND organization_id = get_current_organization_id()
);

-- ============================================================================
-- STEP 2: Create Test Emission Sources
-- ============================================================================

-- Scope 1: Stationary Combustion - Natural Gas
INSERT INTO public.scope_1_2_emission_sources (
  scope,
  category,
  source_name,
  description,
  unit,
  emission_factor_co2e,
  created_at
)
SELECT
  'scope_1',
  'stationary_combustion',
  '[TEST DATA] Natural Gas',
  'Natural gas combustion for heating',
  'kWh',
  0.18385, -- DEFRA 2025 factor
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.scope_1_2_emission_sources
  WHERE source_name = '[TEST DATA] Natural Gas'
);

-- Scope 1: Mobile Combustion - Diesel
INSERT INTO public.scope_1_2_emission_sources (
  scope,
  category,
  source_name,
  description,
  unit,
  emission_factor_co2e,
  created_at
)
SELECT
  'scope_1',
  'mobile_combustion',
  '[TEST DATA] Diesel Vehicles',
  'Diesel vehicle fleet',
  'km',
  0.17078, -- DEFRA 2025 factor
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.scope_1_2_emission_sources
  WHERE source_name = '[TEST DATA] Diesel Vehicles'
);

-- Scope 1: Fugitive Emissions - Refrigerants
INSERT INTO public.scope_1_2_emission_sources (
  scope,
  category,
  source_name,
  description,
  unit,
  emission_factor_co2e,
  created_at
)
SELECT
  'scope_1',
  'fugitive_emissions',
  '[TEST DATA] R-134a Refrigerant',
  'Refrigerant leakage',
  'kg',
  1430, -- GWP of R-134a
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.scope_1_2_emission_sources
  WHERE source_name = '[TEST DATA] R-134a Refrigerant'
);

-- Scope 2: Purchased Electricity (UK Grid)
INSERT INTO public.scope_1_2_emission_sources (
  scope,
  category,
  source_name,
  description,
  unit,
  emission_factor_co2e,
  created_at
)
SELECT
  'scope_2',
  'purchased_electricity',
  '[TEST DATA] UK Grid Electricity',
  'Grid electricity - UK location-based',
  'kWh',
  0.23314, -- DEFRA 2025 UK grid average
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.scope_1_2_emission_sources
  WHERE source_name = '[TEST DATA] UK Grid Electricity'
);

-- Scope 2: District Heating
INSERT INTO public.scope_1_2_emission_sources (
  scope,
  category,
  source_name,
  description,
  unit,
  emission_factor_co2e,
  created_at
)
SELECT
  'scope_2',
  'purchased_heating',
  '[TEST DATA] District Heat',
  'District heating supply',
  'kWh',
  0.21986, -- DEFRA 2025 factor
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.scope_1_2_emission_sources
  WHERE source_name = '[TEST DATA] District Heat'
);

-- ============================================================================
-- STEP 3: Create Test Activity Data for Facility
-- ============================================================================

-- Get the test facility ID and emission source IDs for activity data insertion
DO $$
DECLARE
  test_facility_id uuid;
  natural_gas_id uuid;
  diesel_id uuid;
  refrigerant_id uuid;
  electricity_id uuid;
  heating_id uuid;
  test_org_id uuid;
BEGIN
  -- Get current organization
  test_org_id := get_current_organization_id();

  -- Get test facility ID
  SELECT id INTO test_facility_id
  FROM public.facilities
  WHERE name = '[TEST DATA] Calculation Verifier Test Facility'
  AND organization_id = test_org_id
  LIMIT 1;

  -- Get emission source IDs
  SELECT id INTO natural_gas_id FROM public.scope_1_2_emission_sources WHERE source_name = '[TEST DATA] Natural Gas';
  SELECT id INTO diesel_id FROM public.scope_1_2_emission_sources WHERE source_name = '[TEST DATA] Diesel Vehicles';
  SELECT id INTO refrigerant_id FROM public.scope_1_2_emission_sources WHERE source_name = '[TEST DATA] R-134a Refrigerant';
  SELECT id INTO electricity_id FROM public.scope_1_2_emission_sources WHERE source_name = '[TEST DATA] UK Grid Electricity';
  SELECT id INTO heating_id FROM public.scope_1_2_emission_sources WHERE source_name = '[TEST DATA] District Heat';

  IF test_facility_id IS NOT NULL THEN
    -- Natural Gas Activity (Scope 1)
    INSERT INTO public.facility_activity_data (
      facility_id,
      emission_source_id,
      quantity,
      unit,
      reporting_period_start,
      reporting_period_end,
      created_at
    )
    VALUES (
      test_facility_id,
      natural_gas_id,
      12500, -- 12,500 kWh
      'kWh',
      '2024-01-01'::date,
      '2024-01-31'::date,
      now()
    )
    ON CONFLICT DO NOTHING;

    -- Diesel Vehicle Activity (Scope 1)
    INSERT INTO public.facility_activity_data (
      facility_id,
      emission_source_id,
      quantity,
      unit,
      reporting_period_start,
      reporting_period_end,
      created_at
    )
    VALUES (
      test_facility_id,
      diesel_id,
      8750, -- 8,750 km
      'km',
      '2024-01-01'::date,
      '2024-01-31'::date,
      now()
    )
    ON CONFLICT DO NOTHING;

    -- Refrigerant Leakage (Scope 1)
    INSERT INTO public.facility_activity_data (
      facility_id,
      emission_source_id,
      quantity,
      unit,
      reporting_period_start,
      reporting_period_end,
      created_at
    )
    VALUES (
      test_facility_id,
      refrigerant_id,
      2.5, -- 2.5 kg leaked
      'kg',
      '2024-01-01'::date,
      '2024-01-31'::date,
      now()
    )
    ON CONFLICT DO NOTHING;

    -- Electricity Consumption (Scope 2)
    INSERT INTO public.facility_activity_data (
      facility_id,
      emission_source_id,
      quantity,
      unit,
      reporting_period_start,
      reporting_period_end,
      created_at
    )
    VALUES (
      test_facility_id,
      electricity_id,
      65000, -- 65,000 kWh
      'kWh',
      '2024-01-01'::date,
      '2024-01-31'::date,
      now()
    )
    ON CONFLICT DO NOTHING;

    -- District Heating (Scope 2)
    INSERT INTO public.facility_activity_data (
      facility_id,
      emission_source_id,
      quantity,
      unit,
      reporting_period_start,
      reporting_period_end,
      created_at
    )
    VALUES (
      test_facility_id,
      heating_id,
      18000, -- 18,000 kWh
      'kWh',
      '2024-01-01'::date,
      '2024-01-31'::date,
      now()
    )
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Successfully created test activity data for facility: %', test_facility_id;
  ELSE
    RAISE NOTICE 'Test facility not found - activity data not created';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Create Test Corporate Overhead Data (Scope 3)
-- ============================================================================

DO $$
DECLARE
  test_org_id uuid;
BEGIN
  test_org_id := get_current_organization_id();

  -- Waste to Landfill (Scope 3 Category 5)
  INSERT INTO public.corporate_overheads (
    organization_id,
    category,
    sub_category,
    description,
    quantity,
    unit,
    reporting_period_start,
    reporting_period_end,
    created_at
  )
  VALUES (
    test_org_id,
    'scope_3_cat_5_waste',
    'landfill',
    '[TEST DATA] General waste to landfill',
    450, -- 450 kg
    'kg',
    '2024-01-01'::date,
    '2024-01-31'::date,
    now()
  )
  ON CONFLICT DO NOTHING;

  -- Recycling (Scope 3 Category 5)
  INSERT INTO public.corporate_overheads (
    organization_id,
    category,
    sub_category,
    description,
    quantity,
    unit,
    reporting_period_start,
    reporting_period_end,
    created_at
  )
  VALUES (
    test_org_id,
    'scope_3_cat_5_waste',
    'recycling',
    '[TEST DATA] Mixed recycling',
    180, -- 180 kg
    'kg',
    '2024-01-01'::date,
    '2024-01-31'::date,
    now()
  )
  ON CONFLICT DO NOTHING;

  -- Business Travel - Flights (Scope 3 Category 6)
  INSERT INTO public.corporate_overheads (
    organization_id,
    category,
    sub_category,
    description,
    quantity,
    unit,
    reporting_period_start,
    reporting_period_end,
    created_at
  )
  VALUES (
    test_org_id,
    'scope_3_cat_6_business_travel',
    'flights_short_haul_economy',
    '[TEST DATA] Short-haul economy flights',
    2500, -- 2,500 km
    'km',
    '2024-01-01'::date,
    '2024-01-31'::date,
    now()
  )
  ON CONFLICT DO NOTHING;

  -- Business Travel - Rail (Scope 3 Category 6)
  INSERT INTO public.corporate_overheads (
    organization_id,
    category,
    sub_category,
    description,
    quantity,
    unit,
    reporting_period_start,
    reporting_period_end,
    created_at
  )
  VALUES (
    test_org_id,
    'scope_3_cat_6_business_travel',
    'rail_national',
    '[TEST DATA] National rail travel',
    1200, -- 1,200 km
    'km',
    '2024-01-01'::date,
    '2024-01-31'::date,
    now()
  )
  ON CONFLICT DO NOTHING;

  -- Employee Commuting - Car (Scope 3 Category 7)
  INSERT INTO public.corporate_overheads (
    organization_id,
    category,
    sub_category,
    description,
    quantity,
    unit,
    reporting_period_start,
    reporting_period_end,
    created_at
  )
  VALUES (
    test_org_id,
    'scope_3_cat_7_commuting',
    'car_average',
    '[TEST DATA] Employee car commuting',
    8500, -- 8,500 km
    'km',
    '2024-01-01'::date,
    '2024-01-31'::date,
    now()
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Successfully created test corporate overhead data for organization: %', test_org_id;
END $$;

-- ============================================================================
-- VERIFICATION: Show what was created
-- ============================================================================

-- Show test facility
SELECT
  'TEST FACILITY' as record_type,
  id,
  name,
  facility_type,
  location_city,
  location_country_code,
  created_at
FROM public.facilities
WHERE name LIKE '[TEST DATA]%'
AND organization_id = get_current_organization_id();

-- Show test emission sources
SELECT
  'TEST EMISSION SOURCES' as record_type,
  id,
  scope,
  source_name,
  emission_factor_co2e,
  unit,
  created_at
FROM public.scope_1_2_emission_sources
WHERE source_name LIKE '[TEST DATA]%';

-- Show test activity data count
SELECT
  'TEST ACTIVITY DATA' as record_type,
  COUNT(*) as record_count,
  SUM(quantity) as total_quantity
FROM public.facility_activity_data fad
JOIN public.facilities f ON f.id = fad.facility_id
WHERE f.name = '[TEST DATA] Calculation Verifier Test Facility'
AND f.organization_id = get_current_organization_id();

-- Show test corporate overheads count
SELECT
  'TEST CORPORATE OVERHEADS' as record_type,
  COUNT(*) as record_count,
  category,
  SUM(quantity) as total_quantity
FROM public.corporate_overheads
WHERE description LIKE '[TEST DATA]%'
AND organization_id = get_current_organization_id()
GROUP BY category;

-- ============================================================================
-- EXPECTED RESULTS SUMMARY
-- ============================================================================

/*
  If successful, you should see:

  SCOPE 1 EMISSIONS:
  - Natural Gas: 12,500 kWh × 0.18385 = 2,298.13 kg CO₂e
  - Diesel Vehicles: 8,750 km × 0.17078 = 1,494.33 kg CO₂e
  - Refrigerant: 2.5 kg × 1,430 = 3,575.00 kg CO₂e
  TOTAL SCOPE 1: 7,367.46 kg CO₂e

  SCOPE 2 EMISSIONS:
  - Electricity: 65,000 kWh × 0.23314 = 15,154.10 kg CO₂e
  - District Heat: 18,000 kWh × 0.21986 = 3,957.48 kg CO₂e
  TOTAL SCOPE 2: 19,111.58 kg CO₂e

  SCOPE 3 EMISSIONS:
  - Waste to Landfill: 450 kg × 0.54 = 243.00 kg CO₂e
  - Recycling: 180 kg × 0.021 = 3.78 kg CO₂e
  - Flights: 2,500 km × 0.24587 = 614.68 kg CO₂e
  - Rail: 1,200 km × 0.03549 = 42.59 kg CO₂e
  - Commuting: 8,500 km × 0.17078 = 1,451.63 kg CO₂e
  TOTAL SCOPE 3: 2,355.68 kg CO₂e

  GRAND TOTAL: 28,834.72 kg CO₂e (28.83 tonnes CO₂e)
*/
