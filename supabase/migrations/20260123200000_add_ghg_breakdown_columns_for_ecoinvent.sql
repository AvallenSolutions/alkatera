/*
  # Add GHG Breakdown Columns for Ecoinvent Integration

  Adds columns for detailed GHG gas breakdown to support proper Ecoinvent data:
  - Fossil/Biogenic/DLUC CO2 split
  - CH4 (methane) - fossil and biogenic
  - N2O (nitrous oxide)

  This enables the waterfall resolver to use actual Ecoinvent GHG breakdown
  instead of hardcoded 85%/15% estimates.

  ## ISO 14067 Compliance
  These columns support mandatory GHG reporting requirements:
  - Separate fossil vs biogenic carbon
  - Report individual GHG gases (CO2, CH4, N2O)
  - Apply correct GWP factors (IPCC AR6)
*/

-- ============================================================================
-- STEP 1: Add GHG breakdown columns to ecoinvent_material_proxies
-- ============================================================================

ALTER TABLE public.ecoinvent_material_proxies
ADD COLUMN IF NOT EXISTS impact_climate_fossil NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS impact_climate_biogenic NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS impact_climate_dluc NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS ch4_factor NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS ch4_fossil_factor NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS ch4_biogenic_factor NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS n2o_factor NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.ecoinvent_material_proxies.impact_climate_fossil IS
  'Fossil CO2e component (kg CO2e per reference unit). From combustion of fossil fuels, mineral processes.';

COMMENT ON COLUMN public.ecoinvent_material_proxies.impact_climate_biogenic IS
  'Biogenic CO2e component (kg CO2e per reference unit). From biomass, fermentation, agricultural processes. Per ISO 14067, reported separately.';

COMMENT ON COLUMN public.ecoinvent_material_proxies.impact_climate_dluc IS
  'Direct Land Use Change CO2e (kg CO2e per reference unit). Deforestation, land conversion.';

COMMENT ON COLUMN public.ecoinvent_material_proxies.ch4_factor IS
  'Total methane emissions (kg CH4 per reference unit). Multiply by GWP (27.2-29.8) for CO2e.';

COMMENT ON COLUMN public.ecoinvent_material_proxies.ch4_fossil_factor IS
  'Fossil methane (kg CH4 per reference unit). From natural gas leaks, coal mining. GWP = 29.8';

COMMENT ON COLUMN public.ecoinvent_material_proxies.ch4_biogenic_factor IS
  'Biogenic methane (kg CH4 per reference unit). From fermentation, enteric fermentation, rice, landfills. GWP = 27.2';

COMMENT ON COLUMN public.ecoinvent_material_proxies.n2o_factor IS
  'Nitrous oxide emissions (kg N2O per reference unit). From fertilizers, manure, combustion. GWP = 273';

-- ============================================================================
-- STEP 2: Add GHG breakdown columns to staging_emission_factors
-- ============================================================================

ALTER TABLE public.staging_emission_factors
ADD COLUMN IF NOT EXISTS co2_fossil_factor NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS co2_biogenic_factor NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS co2_dluc_factor NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS ch4_factor NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS ch4_fossil_factor NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS ch4_biogenic_factor NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS n2o_factor NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.staging_emission_factors.co2_fossil_factor IS
  'Fossil CO2e component (kg CO2e per reference unit)';

COMMENT ON COLUMN public.staging_emission_factors.co2_biogenic_factor IS
  'Biogenic CO2e component (kg CO2e per reference unit)';

COMMENT ON COLUMN public.staging_emission_factors.co2_dluc_factor IS
  'Direct Land Use Change CO2e (kg CO2e per reference unit)';

COMMENT ON COLUMN public.staging_emission_factors.ch4_factor IS
  'Total methane (kg CH4 per reference unit)';

COMMENT ON COLUMN public.staging_emission_factors.ch4_fossil_factor IS
  'Fossil methane (kg CH4 per reference unit). GWP = 29.8';

COMMENT ON COLUMN public.staging_emission_factors.ch4_biogenic_factor IS
  'Biogenic methane (kg CH4 per reference unit). GWP = 27.2';

COMMENT ON COLUMN public.staging_emission_factors.n2o_factor IS
  'Nitrous oxide (kg N2O per reference unit). GWP = 273';

-- ============================================================================
-- STEP 3: Populate estimated GHG breakdown for existing proxies
-- Based on typical material characteristics
-- ============================================================================

-- AGRICULTURAL INGREDIENTS: High biogenic carbon, significant CH4/N2O
UPDATE public.ecoinvent_material_proxies
SET
  impact_climate_fossil = impact_climate * 0.30,
  impact_climate_biogenic = impact_climate * 0.70,
  impact_climate_dluc = 0,
  ch4_biogenic_factor = impact_climate * 0.02 / 27.2,  -- ~2% from fermentation/decomposition
  n2o_factor = impact_climate * 0.03 / 273             -- ~3% from fertilizers
WHERE material_category IN (
  'sugar_beet_eu', 'sugar_cane_global', 'ethanol_grain', 'citric_acid'
);

-- WATER: Minimal emissions, mostly from treatment energy (fossil)
UPDATE public.ecoinvent_material_proxies
SET
  impact_climate_fossil = impact_climate * 0.95,
  impact_climate_biogenic = impact_climate * 0.05,
  impact_climate_dluc = 0,
  ch4_biogenic_factor = 0,
  n2o_factor = 0
WHERE material_category IN ('water_tap_municipal');

-- PACKAGING (Glass, Aluminium, Plastics): Almost entirely fossil
UPDATE public.ecoinvent_material_proxies
SET
  impact_climate_fossil = impact_climate * 0.98,
  impact_climate_biogenic = impact_climate * 0.02,
  impact_climate_dluc = 0,
  ch4_fossil_factor = impact_climate * 0.005 / 29.8,  -- Minimal CH4 from energy
  n2o_factor = impact_climate * 0.002 / 273           -- Minimal N2O from combustion
WHERE material_category IN (
  'glass_bottle_virgin', 'glass_bottle_60pcr', 'aluminium_cap',
  'pet_bottle_virgin', 'hdpe_bottle'
);

-- PAPER/CARDBOARD: Mix of fossil (processing) and biogenic (biomass)
UPDATE public.ecoinvent_material_proxies
SET
  impact_climate_fossil = impact_climate * 0.60,
  impact_climate_biogenic = impact_climate * 0.40,
  impact_climate_dluc = 0,
  ch4_biogenic_factor = impact_climate * 0.01 / 27.2, -- Some decomposition
  n2o_factor = 0
WHERE material_category IN ('paper_label', 'cardboard_corrugated');

-- ENERGY: Depends on source
UPDATE public.ecoinvent_material_proxies
SET
  impact_climate_fossil = impact_climate * 0.85,  -- Grid includes some renewables
  impact_climate_biogenic = impact_climate * 0.15,
  impact_climate_dluc = 0,
  ch4_fossil_factor = impact_climate * 0.01 / 29.8,  -- Natural gas leakage
  n2o_factor = impact_climate * 0.005 / 273          -- Combustion N2O
WHERE material_category IN ('electricity_grid_gb', 'electricity_grid_eu');

-- NATURAL GAS: 100% fossil, significant CH4 leakage
UPDATE public.ecoinvent_material_proxies
SET
  impact_climate_fossil = impact_climate,
  impact_climate_biogenic = 0,
  impact_climate_dluc = 0,
  ch4_fossil_factor = impact_climate * 0.03 / 29.8,  -- ~3% methane leakage
  n2o_factor = impact_climate * 0.003 / 273
WHERE material_category IN ('natural_gas_heat');

-- TRANSPORT: 100% fossil (diesel)
UPDATE public.ecoinvent_material_proxies
SET
  impact_climate_fossil = impact_climate,
  impact_climate_biogenic = 0,
  impact_climate_dluc = 0,
  ch4_fossil_factor = impact_climate * 0.001 / 29.8, -- Minimal CH4
  n2o_factor = impact_climate * 0.01 / 273           -- Diesel combustion N2O
WHERE material_category IN ('transport_hgv_diesel');

-- CO2 INDUSTRIAL: Captured/recycled, fossil origin
UPDATE public.ecoinvent_material_proxies
SET
  impact_climate_fossil = impact_climate,
  impact_climate_biogenic = 0,
  impact_climate_dluc = 0,
  ch4_fossil_factor = 0,
  n2o_factor = 0
WHERE material_category IN ('co2_industrial');

-- ============================================================================
-- STEP 4: Update staging_emission_factors with estimated breakdown
-- ============================================================================

-- INGREDIENTS: Biogenic-heavy
UPDATE public.staging_emission_factors
SET
  co2_fossil_factor = co2_factor * 0.30,
  co2_biogenic_factor = co2_factor * 0.70,
  co2_dluc_factor = 0,
  ch4_biogenic_factor = co2_factor * 0.02 / 27.2,
  n2o_factor = co2_factor * 0.03 / 273
WHERE category = 'Ingredient'
  AND name NOT IN ('Water (Municipal Treatment)', 'CO2 (Industrial)');

-- WATER: Mostly fossil from treatment
UPDATE public.staging_emission_factors
SET
  co2_fossil_factor = co2_factor * 0.95,
  co2_biogenic_factor = co2_factor * 0.05,
  co2_dluc_factor = 0,
  ch4_biogenic_factor = 0,
  n2o_factor = 0
WHERE name ILIKE '%water%';

-- PACKAGING: Fossil-heavy
UPDATE public.staging_emission_factors
SET
  co2_fossil_factor = co2_factor * 0.95,
  co2_biogenic_factor = co2_factor * 0.05,
  co2_dluc_factor = 0,
  ch4_fossil_factor = co2_factor * 0.005 / 29.8,
  n2o_factor = co2_factor * 0.002 / 273
WHERE category = 'Packaging';

-- ENERGY: Grid mix
UPDATE public.staging_emission_factors
SET
  co2_fossil_factor = co2_factor * 0.85,
  co2_biogenic_factor = co2_factor * 0.15,
  co2_dluc_factor = 0,
  ch4_fossil_factor = co2_factor * 0.01 / 29.8,
  n2o_factor = co2_factor * 0.005 / 273
WHERE category = 'Energy';

-- TRANSPORT: 100% fossil
UPDATE public.staging_emission_factors
SET
  co2_fossil_factor = co2_factor,
  co2_biogenic_factor = 0,
  co2_dluc_factor = 0,
  ch4_fossil_factor = co2_factor * 0.001 / 29.8,
  n2o_factor = co2_factor * 0.01 / 273
WHERE category = 'Transport';

-- ============================================================================
-- STEP 5: Add GHG gas columns to product_carbon_footprint_materials
-- ============================================================================

ALTER TABLE public.product_carbon_footprint_materials
ADD COLUMN IF NOT EXISTS ch4_kg NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS ch4_fossil_kg NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS ch4_biogenic_kg NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS n2o_kg NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.product_carbon_footprint_materials.ch4_kg IS
  'Total methane emissions (kg CH4). Multiply by GWP for CO2e contribution.';

COMMENT ON COLUMN public.product_carbon_footprint_materials.ch4_fossil_kg IS
  'Fossil methane (kg CH4). From natural gas, coal. GWP = 29.8 (IPCC AR6)';

COMMENT ON COLUMN public.product_carbon_footprint_materials.ch4_biogenic_kg IS
  'Biogenic methane (kg CH4). From fermentation, agriculture. GWP = 27.2 (IPCC AR6)';

COMMENT ON COLUMN public.product_carbon_footprint_materials.n2o_kg IS
  'Nitrous oxide (kg N2O). From fertilizers, combustion. GWP = 273 (IPCC AR6)';

-- ============================================================================
-- STEP 6: Verification
-- ============================================================================

DO $$
DECLARE
  proxy_count INTEGER;
  staging_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO proxy_count
  FROM public.ecoinvent_material_proxies
  WHERE impact_climate_fossil > 0 OR impact_climate_biogenic > 0;

  SELECT COUNT(*) INTO staging_count
  FROM public.staging_emission_factors
  WHERE co2_fossil_factor > 0 OR co2_biogenic_factor > 0;

  RAISE NOTICE 'GHG Breakdown Columns Added:';
  RAISE NOTICE '  ecoinvent_material_proxies with GHG data: %', proxy_count;
  RAISE NOTICE '  staging_emission_factors with GHG data: %', staging_count;
  RAISE NOTICE '  ✓ Ready for Ecoinvent integration';
END $$;
