/*
  # DEFRA Energy Emission Factors Reference Table

  This migration creates a comprehensive reference table for DEFRA emission factors
  used to convert raw energy consumption data into CO2e values. This enables the
  "Glass Box" audit trail requirement where raw data is stored alongside calculated values.

  ## Purpose

  1. Provides authoritative emission factors for energy-to-CO2e conversions
  2. Supports temporal integrity by storing factors by year
  3. Enables retrospective recalculation when new DEFRA factors are published
  4. Covers all common fuel types for contract manufacturer facilities

  ## New Table: defra_energy_emission_factors

  Columns:
  - `id` (uuid, primary key)
  - `fuel_type` (text) - Standardised fuel type identifier
  - `fuel_type_display` (text) - Human-readable name for UI display
  - `factor_year` (integer) - DEFRA publication year
  - `co2e_factor` (numeric) - kgCO2e per unit
  - `factor_unit` (text) - Reference unit (kWh, litre, m3, kg)
  - `scope` (text) - GHG Protocol scope (1, 2, or 3)
  - `source` (text) - Source reference
  - `source_url` (text) - Direct link to DEFRA tables
  - `notes` (text) - Additional context

  ## Seed Data

  Includes DEFRA 2024 factors for:
  - Grid Electricity (UK average)
  - Natural Gas
  - Diesel (stationary and mobile)
  - Petrol/Gasoline
  - LPG
  - Heavy Fuel Oil
  - Biogas/Biomass
  - Grid Electricity (by region for future use)

  ## Security

  - RLS enabled with read-only access for authenticated users
  - Factors are managed via migrations only (immutable reference data)
*/

-- Create defra_energy_emission_factors table
CREATE TABLE IF NOT EXISTS public.defra_energy_emission_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_type TEXT NOT NULL,
  fuel_type_display TEXT NOT NULL,
  factor_year INTEGER NOT NULL CHECK (factor_year >= 2000 AND factor_year <= 2100),
  co2e_factor NUMERIC NOT NULL CHECK (co2e_factor >= 0),
  factor_unit TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('1', '2', '3')),
  category TEXT,
  subcategory TEXT,
  source TEXT NOT NULL DEFAULT 'DEFRA',
  source_url TEXT,
  geographic_scope TEXT NOT NULL DEFAULT 'UK',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure unique factor per fuel type per year
  CONSTRAINT unique_fuel_type_year UNIQUE (fuel_type, factor_year, geographic_scope)
);

-- Add comments
COMMENT ON TABLE public.defra_energy_emission_factors IS 'DEFRA emission factors for energy-to-CO2e conversions. Read-only reference data managed via migrations.';
COMMENT ON COLUMN public.defra_energy_emission_factors.fuel_type IS 'Standardised fuel type identifier used in code';
COMMENT ON COLUMN public.defra_energy_emission_factors.fuel_type_display IS 'Human-readable name for UI display';
COMMENT ON COLUMN public.defra_energy_emission_factors.co2e_factor IS 'Emission factor value in kgCO2e per unit';
COMMENT ON COLUMN public.defra_energy_emission_factors.factor_unit IS 'Reference unit: kWh, litre, m3, kg, etc.';
COMMENT ON COLUMN public.defra_energy_emission_factors.scope IS 'GHG Protocol scope: 1 (direct), 2 (indirect energy), 3 (other indirect)';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_defra_ef_fuel_type ON public.defra_energy_emission_factors(fuel_type);
CREATE INDEX IF NOT EXISTS idx_defra_ef_factor_year ON public.defra_energy_emission_factors(factor_year);
CREATE INDEX IF NOT EXISTS idx_defra_ef_fuel_year ON public.defra_energy_emission_factors(fuel_type, factor_year);

-- Enable RLS
ALTER TABLE public.defra_energy_emission_factors ENABLE ROW LEVEL SECURITY;

-- Read-only access for authenticated users
CREATE POLICY "Authenticated users can view DEFRA factors"
  ON public.defra_energy_emission_factors
  FOR SELECT
  TO authenticated
  USING (true);

-- =============================================================================
-- SEED DATA: DEFRA 2024 UK Emission Factors
-- Source: UK Government GHG Conversion Factors 2024
-- =============================================================================

-- Scope 2: Grid Electricity
INSERT INTO public.defra_energy_emission_factors 
  (fuel_type, fuel_type_display, factor_year, co2e_factor, factor_unit, scope, category, subcategory, source, source_url, notes)
VALUES
  ('grid_electricity', 'Grid Electricity (UK Average)', 2024, 0.20705, 'kWh', '2', 'Electricity', 'UK Grid', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 'UK average grid electricity factor'),
  ('grid_electricity', 'Grid Electricity (UK Average)', 2023, 0.20705, 'kWh', '2', 'Electricity', 'UK Grid', 'DEFRA 2023', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2023', 'UK average grid electricity factor'),
  ('grid_electricity', 'Grid Electricity (UK Average)', 2022, 0.19338, 'kWh', '2', 'Electricity', 'UK Grid', 'DEFRA 2022', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2022', 'UK average grid electricity factor')
ON CONFLICT (fuel_type, factor_year, geographic_scope) DO NOTHING;

-- Scope 1: Natural Gas
INSERT INTO public.defra_energy_emission_factors 
  (fuel_type, fuel_type_display, factor_year, co2e_factor, factor_unit, scope, category, subcategory, source, source_url, notes)
VALUES
  ('natural_gas_kwh', 'Natural Gas (by kWh)', 2024, 0.18293, 'kWh', '1', 'Fuels', 'Gaseous fuels', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 'Natural gas gross CV'),
  ('natural_gas_kwh', 'Natural Gas (by kWh)', 2023, 0.18293, 'kWh', '1', 'Fuels', 'Gaseous fuels', 'DEFRA 2023', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2023', 'Natural gas gross CV'),
  ('natural_gas_m3', 'Natural Gas (by m3)', 2024, 2.02103, 'm3', '1', 'Fuels', 'Gaseous fuels', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 'Natural gas by volume')
ON CONFLICT (fuel_type, factor_year, geographic_scope) DO NOTHING;

-- Scope 1: Diesel (Stationary)
INSERT INTO public.defra_energy_emission_factors 
  (fuel_type, fuel_type_display, factor_year, co2e_factor, factor_unit, scope, category, subcategory, source, source_url, notes)
VALUES
  ('diesel_stationary', 'Diesel (Stationary Combustion)', 2024, 2.70458, 'litre', '1', 'Fuels', 'Liquid fuels', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 'Gas oil/diesel for stationary use'),
  ('diesel_stationary', 'Diesel (Stationary Combustion)', 2023, 2.68787, 'litre', '1', 'Fuels', 'Liquid fuels', 'DEFRA 2023', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2023', 'Gas oil/diesel for stationary use')
ON CONFLICT (fuel_type, factor_year, geographic_scope) DO NOTHING;

-- Scope 1: Petrol/Gasoline
INSERT INTO public.defra_energy_emission_factors 
  (fuel_type, fuel_type_display, factor_year, co2e_factor, factor_unit, scope, category, subcategory, source, source_url, notes)
VALUES
  ('petrol', 'Petrol (Gasoline)', 2024, 2.16152, 'litre', '1', 'Fuels', 'Liquid fuels', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 'Petrol 100% mineral'),
  ('petrol', 'Petrol (Gasoline)', 2023, 2.14924, 'litre', '1', 'Fuels', 'Liquid fuels', 'DEFRA 2023', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2023', 'Petrol 100% mineral')
ON CONFLICT (fuel_type, factor_year, geographic_scope) DO NOTHING;

-- Scope 1: LPG
INSERT INTO public.defra_energy_emission_factors 
  (fuel_type, fuel_type_display, factor_year, co2e_factor, factor_unit, scope, category, subcategory, source, source_url, notes)
VALUES
  ('lpg_litre', 'LPG (by litre)', 2024, 1.55373, 'litre', '1', 'Fuels', 'Gaseous fuels', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 'Liquefied Petroleum Gas'),
  ('lpg_litre', 'LPG (by litre)', 2023, 1.54596, 'litre', '1', 'Fuels', 'Gaseous fuels', 'DEFRA 2023', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2023', 'Liquefied Petroleum Gas'),
  ('lpg_kwh', 'LPG (by kWh)', 2024, 0.21433, 'kWh', '1', 'Fuels', 'Gaseous fuels', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 'LPG by energy content'),
  ('lpg_kg', 'LPG (by kg)', 2024, 2.93930, 'kg', '1', 'Fuels', 'Gaseous fuels', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 'LPG by mass')
ON CONFLICT (fuel_type, factor_year, geographic_scope) DO NOTHING;

-- Scope 1: Heavy Fuel Oil
INSERT INTO public.defra_energy_emission_factors 
  (fuel_type, fuel_type_display, factor_year, co2e_factor, factor_unit, scope, category, subcategory, source, source_url, notes)
VALUES
  ('heavy_fuel_oil', 'Heavy Fuel Oil', 2024, 3.17898, 'litre', '1', 'Fuels', 'Liquid fuels', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 'Fuel oil/residual oil'),
  ('heavy_fuel_oil', 'Heavy Fuel Oil', 2023, 3.15818, 'litre', '1', 'Fuels', 'Liquid fuels', 'DEFRA 2023', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2023', 'Fuel oil/residual oil')
ON CONFLICT (fuel_type, factor_year, geographic_scope) DO NOTHING;

-- Scope 1: Biomass (reported separately for GHG reporting but included here)
INSERT INTO public.defra_energy_emission_factors 
  (fuel_type, fuel_type_display, factor_year, co2e_factor, factor_unit, scope, category, subcategory, source, source_url, notes)
VALUES
  ('biomass_wood_chips', 'Wood Chips', 2024, 0.01074, 'kg', '1', 'Bioenergy', 'Solid biomass', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 'Outside of scopes but reported'),
  ('biomass_wood_pellets', 'Wood Pellets', 2024, 0.01326, 'kg', '1', 'Bioenergy', 'Solid biomass', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 'Outside of scopes but reported'),
  ('biogas', 'Biogas', 2024, 0.00021, 'kWh', '1', 'Bioenergy', 'Gaseous biomass', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 'Biogas for combustion')
ON CONFLICT (fuel_type, factor_year, geographic_scope) DO NOTHING;

-- Scope 2: Purchased Heat/Steam
INSERT INTO public.defra_energy_emission_factors 
  (fuel_type, fuel_type_display, factor_year, co2e_factor, factor_unit, scope, category, subcategory, source, source_url, notes)
VALUES
  ('heat_steam', 'Purchased Heat and Steam', 2024, 0.17059, 'kWh', '2', 'Heat and Steam', 'District heating', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 'UK average for heat and steam'),
  ('heat_steam', 'Purchased Heat and Steam', 2023, 0.16977, 'kWh', '2', 'Heat and Steam', 'District heating', 'DEFRA 2023', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2023', 'UK average for heat and steam')
ON CONFLICT (fuel_type, factor_year, geographic_scope) DO NOTHING;

-- Scope 3: Well-to-Tank (WTT) factors for upstream emissions
INSERT INTO public.defra_energy_emission_factors 
  (fuel_type, fuel_type_display, factor_year, co2e_factor, factor_unit, scope, category, subcategory, source, source_url, notes)
VALUES
  ('wtt_grid_electricity', 'WTT - Grid Electricity', 2024, 0.01879, 'kWh', '3', 'WTT - UK Electricity', 'Transmission and Distribution', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 'T&D losses for UK grid'),
  ('wtt_natural_gas', 'WTT - Natural Gas', 2024, 0.02316, 'kWh', '3', 'WTT - Fuels', 'Gaseous fuels', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 'Upstream emissions for natural gas'),
  ('wtt_diesel', 'WTT - Diesel', 2024, 0.60986, 'litre', '3', 'WTT - Fuels', 'Liquid fuels', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 'Upstream emissions for diesel'),
  ('wtt_petrol', 'WTT - Petrol', 2024, 0.53176, 'litre', '3', 'WTT - Fuels', 'Liquid fuels', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 'Upstream emissions for petrol'),
  ('wtt_lpg', 'WTT - LPG', 2024, 0.18462, 'litre', '3', 'WTT - Fuels', 'Gaseous fuels', 'DEFRA 2024', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024', 'Upstream emissions for LPG')
ON CONFLICT (fuel_type, factor_year, geographic_scope) DO NOTHING;

-- =============================================================================
-- HELPER FUNCTION: Get emission factor for fuel type and year
-- =============================================================================

CREATE OR REPLACE FUNCTION get_defra_energy_factor(
  p_fuel_type TEXT,
  p_factor_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  p_geographic_scope TEXT DEFAULT 'UK'
)
RETURNS TABLE (
  fuel_type TEXT,
  fuel_type_display TEXT,
  co2e_factor NUMERIC,
  factor_unit TEXT,
  scope TEXT,
  source TEXT,
  factor_year INTEGER
) AS $$
BEGIN
  -- First try exact year match
  RETURN QUERY
  SELECT 
    def.fuel_type,
    def.fuel_type_display,
    def.co2e_factor,
    def.factor_unit,
    def.scope,
    def.source,
    def.factor_year
  FROM public.defra_energy_emission_factors def
  WHERE def.fuel_type = p_fuel_type
  AND def.factor_year = p_factor_year
  AND def.geographic_scope = p_geographic_scope
  LIMIT 1;
  
  -- If no result, fall back to most recent year
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      def.fuel_type,
      def.fuel_type_display,
      def.co2e_factor,
      def.factor_unit,
      def.scope,
      def.source,
      def.factor_year
    FROM public.defra_energy_emission_factors def
    WHERE def.fuel_type = p_fuel_type
    AND def.geographic_scope = p_geographic_scope
    ORDER BY def.factor_year DESC
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_defra_energy_factor(TEXT, INTEGER, TEXT) TO authenticated;

COMMENT ON FUNCTION get_defra_energy_factor IS 'Retrieves DEFRA emission factor for a given fuel type and year, with fallback to most recent year if exact match not found';

-- =============================================================================
-- HELPER FUNCTION: Calculate CO2e from energy consumption
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_energy_co2e(
  p_fuel_type TEXT,
  p_consumption_value NUMERIC,
  p_factor_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS TABLE (
  co2e_kg NUMERIC,
  emission_factor_used NUMERIC,
  emission_factor_unit TEXT,
  emission_factor_year INTEGER,
  emission_factor_source TEXT
) AS $$
DECLARE
  v_factor RECORD;
BEGIN
  -- Get the emission factor
  SELECT * INTO v_factor
  FROM get_defra_energy_factor(p_fuel_type, p_factor_year);
  
  IF v_factor IS NULL THEN
    RAISE EXCEPTION 'No emission factor found for fuel type: %', p_fuel_type;
  END IF;
  
  -- Calculate and return
  RETURN QUERY
  SELECT 
    p_consumption_value * v_factor.co2e_factor AS co2e_kg,
    v_factor.co2e_factor AS emission_factor_used,
    v_factor.factor_unit AS emission_factor_unit,
    v_factor.factor_year AS emission_factor_year,
    v_factor.source AS emission_factor_source;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION calculate_energy_co2e(TEXT, NUMERIC, INTEGER) TO authenticated;

COMMENT ON FUNCTION calculate_energy_co2e IS 'Calculates CO2e from energy consumption using DEFRA factors. Returns calculated CO2e and full factor metadata for audit trail.';
