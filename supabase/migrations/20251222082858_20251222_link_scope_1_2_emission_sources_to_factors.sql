/*
  # Link Scope 1-2 Emission Sources to Emission Factors

  ## Summary
  This migration adds missing emission factors and links all scope_1_2_emission_sources
  to their corresponding emissions_factors entries.

  ## Changes

  ### 1. New Emission Factors Added
  - Diesel/Petrol per litre for mobile combustion
  - Burning Oil, Heavy Fuel Oil, Coal for stationary combustion
  - Refrigerants R134a, R404A, R410A for fugitive emissions
  - CO2 process emissions
  - District Heating, Cooling, Steam for purchased energy

  ### 2. All Existing Sources Linked
  - 12 Scope 1 sources linked to appropriate factors
  - 3 Scope 2 sources linked to appropriate factors
*/

-- ============================================
-- PART 1: Add Missing Emission Factors
-- ============================================

-- Scope 1 - Mobile Combustion (per litre)
INSERT INTO emissions_factors (factor_id, name, value, unit, source, source_documentation_link, year_of_publication, geographic_scope, category, category_type)
VALUES
  (gen_random_uuid(), 'Diesel - Mobile Combustion', 2.5121, 'kgCO2e/litre', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 2024, 'UK', 'Scope 1', 'scope1'),
  (gen_random_uuid(), 'Petrol - Mobile Combustion', 2.1044, 'kgCO2e/litre', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 2024, 'UK', 'Scope 1', 'scope1')
ON CONFLICT DO NOTHING;

-- Scope 1 - Stationary Combustion
INSERT INTO emissions_factors (factor_id, name, value, unit, source, source_documentation_link, year_of_publication, geographic_scope, category, category_type)
VALUES
  (gen_random_uuid(), 'Burning Oil (Kerosene)', 2.5401, 'kgCO2e/litre', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 2024, 'UK', 'Scope 1', 'scope1'),
  (gen_random_uuid(), 'Heavy Fuel Oil', 3.1774, 'kgCO2e/litre', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 2024, 'UK', 'Scope 1', 'scope1'),
  (gen_random_uuid(), 'Coal - Industrial', 2252.3, 'kgCO2e/tonne', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 2024, 'UK', 'Scope 1', 'scope1')
ON CONFLICT DO NOTHING;

-- Scope 1 - Fugitive Emissions (Refrigerants with GWP values)
INSERT INTO emissions_factors (factor_id, name, value, unit, source, source_documentation_link, year_of_publication, geographic_scope, category, category_type)
VALUES
  (gen_random_uuid(), 'Refrigerant R134a', 1430.0, 'kgCO2e/kg', 'IPCC AR5 GWP', 'https://www.ipcc.ch/report/ar5/wg1/', 2014, 'Global', 'Scope 1', 'scope1'),
  (gen_random_uuid(), 'Refrigerant R404A', 3922.0, 'kgCO2e/kg', 'IPCC AR5 GWP', 'https://www.ipcc.ch/report/ar5/wg1/', 2014, 'Global', 'Scope 1', 'scope1'),
  (gen_random_uuid(), 'Refrigerant R410A', 2088.0, 'kgCO2e/kg', 'IPCC AR5 GWP', 'https://www.ipcc.ch/report/ar5/wg1/', 2014, 'Global', 'Scope 1', 'scope1'),
  (gen_random_uuid(), 'Carbon Dioxide (CO2) Process', 1.0, 'kgCO2e/kg', 'Direct Emission GWP=1', 'https://www.ipcc.ch/report/ar6/wg1/', 2021, 'Global', 'Scope 1', 'scope1')
ON CONFLICT DO NOTHING;

-- Scope 2 - Purchased Energy (Heat, Steam, Cooling)
INSERT INTO emissions_factors (factor_id, name, value, unit, source, source_documentation_link, year_of_publication, geographic_scope, category, category_type)
VALUES
  (gen_random_uuid(), 'District Heating', 0.1662, 'kgCO2e/kWh', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 2024, 'UK', 'Scope 2', 'scope2'),
  (gen_random_uuid(), 'District Cooling', 0.1680, 'kgCO2e/kWh', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 2024, 'UK', 'Scope 2', 'scope2'),
  (gen_random_uuid(), 'Purchased Steam', 0.1707, 'kgCO2e/kWh', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 2024, 'UK', 'Scope 2', 'scope2')
ON CONFLICT DO NOTHING;

-- ============================================
-- PART 2: Link Scope 1 - Stationary Combustion
-- ============================================

UPDATE scope_1_2_emission_sources
SET emission_factor_id = (
  SELECT factor_id FROM emissions_factors
  WHERE name = 'Natural Gas' AND category_type = 'scope1'
  LIMIT 1
)
WHERE source_name = 'Natural Gas' AND emission_factor_id IS NULL;

UPDATE scope_1_2_emission_sources
SET emission_factor_id = (
  SELECT factor_id FROM emissions_factors
  WHERE name = 'LPG' AND category_type = 'scope1'
  LIMIT 1
)
WHERE source_name = 'Liquefied Petroleum Gas (LPG)' AND emission_factor_id IS NULL;

UPDATE scope_1_2_emission_sources
SET emission_factor_id = (
  SELECT factor_id FROM emissions_factors
  WHERE name = 'Gas Oil' AND category_type = 'scope1'
  LIMIT 1
)
WHERE source_name = 'Gas Oil (Red Diesel)' AND emission_factor_id IS NULL;

UPDATE scope_1_2_emission_sources
SET emission_factor_id = (
  SELECT factor_id FROM emissions_factors
  WHERE name = 'Burning Oil (Kerosene)' AND category_type = 'scope1'
  LIMIT 1
)
WHERE source_name = 'Burning Oil (Kerosene)' AND emission_factor_id IS NULL;

UPDATE scope_1_2_emission_sources
SET emission_factor_id = (
  SELECT factor_id FROM emissions_factors
  WHERE name = 'Heavy Fuel Oil' AND category_type = 'scope1'
  LIMIT 1
)
WHERE source_name = 'Heavy Fuel Oil (HFO)' AND emission_factor_id IS NULL;

UPDATE scope_1_2_emission_sources
SET emission_factor_id = (
  SELECT factor_id FROM emissions_factors
  WHERE name = 'Coal - Industrial' AND category_type = 'scope1'
  LIMIT 1
)
WHERE source_name = 'Coal (Industrial)' AND emission_factor_id IS NULL;

-- ============================================
-- PART 3: Link Scope 1 - Mobile Combustion
-- ============================================

UPDATE scope_1_2_emission_sources
SET emission_factor_id = (
  SELECT factor_id FROM emissions_factors
  WHERE name = 'Diesel - Mobile Combustion' AND category_type = 'scope1'
  LIMIT 1
)
WHERE source_name = 'Diesel (Owned Fleet)' AND emission_factor_id IS NULL;

UPDATE scope_1_2_emission_sources
SET emission_factor_id = (
  SELECT factor_id FROM emissions_factors
  WHERE name = 'Petrol - Mobile Combustion' AND category_type = 'scope1'
  LIMIT 1
)
WHERE source_name = 'Petrol (Owned Fleet)' AND emission_factor_id IS NULL;

-- ============================================
-- PART 4: Link Scope 1 - Fugitive Emissions
-- ============================================

UPDATE scope_1_2_emission_sources
SET emission_factor_id = (
  SELECT factor_id FROM emissions_factors
  WHERE name = 'Refrigerant R134a' AND category_type = 'scope1'
  LIMIT 1
)
WHERE source_name = 'Refrigerant Leakage (R134a)' AND emission_factor_id IS NULL;

UPDATE scope_1_2_emission_sources
SET emission_factor_id = (
  SELECT factor_id FROM emissions_factors
  WHERE name = 'Refrigerant R404A' AND category_type = 'scope1'
  LIMIT 1
)
WHERE source_name = 'Refrigerant Leakage (R404A)' AND emission_factor_id IS NULL;

UPDATE scope_1_2_emission_sources
SET emission_factor_id = (
  SELECT factor_id FROM emissions_factors
  WHERE name = 'Refrigerant R410A' AND category_type = 'scope1'
  LIMIT 1
)
WHERE source_name = 'Refrigerant Leakage (R410A)' AND emission_factor_id IS NULL;

UPDATE scope_1_2_emission_sources
SET emission_factor_id = (
  SELECT factor_id FROM emissions_factors
  WHERE name = 'Carbon Dioxide (CO2) Process' AND category_type = 'scope1'
  LIMIT 1
)
WHERE source_name ILIKE '%CO2%fermentation%' AND emission_factor_id IS NULL;

-- ============================================
-- PART 5: Link Scope 2 - Purchased Energy
-- ============================================

UPDATE scope_1_2_emission_sources
SET emission_factor_id = (
  SELECT factor_id FROM emissions_factors
  WHERE name = 'UK Grid Electricity' AND category_type = 'scope2'
  LIMIT 1
)
WHERE source_name = 'Purchased Grid Electricity' AND emission_factor_id IS NULL;

UPDATE scope_1_2_emission_sources
SET emission_factor_id = (
  SELECT factor_id FROM emissions_factors
  WHERE name = 'District Heating' AND category_type = 'scope2'
  LIMIT 1
)
WHERE source_name = 'Purchased Heat or Steam' AND emission_factor_id IS NULL;

UPDATE scope_1_2_emission_sources
SET emission_factor_id = (
  SELECT factor_id FROM emissions_factors
  WHERE name = 'District Cooling' AND category_type = 'scope2'
  LIMIT 1
)
WHERE source_name = 'Purchased Cooling' AND emission_factor_id IS NULL;

-- ============================================
-- PART 6: Create Indexes for Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_scope_1_2_emission_sources_factor_id
ON scope_1_2_emission_sources(emission_factor_id);

CREATE INDEX IF NOT EXISTS idx_scope_1_2_emission_sources_scope
ON scope_1_2_emission_sources(scope);

CREATE INDEX IF NOT EXISTS idx_emissions_factors_category_type
ON emissions_factors(category_type);
