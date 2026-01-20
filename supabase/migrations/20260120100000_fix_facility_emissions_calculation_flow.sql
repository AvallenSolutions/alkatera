/*
  # Fix Facility Emissions Calculation Flow

  This migration fixes several issues preventing facility Scope 1 & 2 emissions
  from appearing correctly on product pages:

  ## Issues Fixed

  1. **Missing facility_id on activity_data**: Activity data wasn't linked to specific facilities,
     causing emissions to be aggregated across all facilities incorrectly.

  2. **Missing fuel_type mapping**: Activity data didn't store the DEFRA fuel_type, making it
     impossible to match with the correct emission factors.

  3. **Missing reporting period on activity_data**: Without start/end dates, we couldn't
     properly aggregate emissions by reporting period.

  ## Changes

  1. Add `facility_id` column to activity_data
  2. Add `fuel_type` column to activity_data (maps to defra_energy_emission_factors.fuel_type)
  3. Add `reporting_period_start` and `reporting_period_end` columns
  4. Create a unit normalization function to handle unit mismatches
  5. Create a mapping table from utility types to DEFRA fuel types
*/

-- =============================================================================
-- 1. Add new columns to activity_data table
-- =============================================================================

-- Add facility_id to link activity data to specific facilities
ALTER TABLE public.activity_data
  ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL;

-- Add fuel_type to directly map to DEFRA emission factors
ALTER TABLE public.activity_data
  ADD COLUMN IF NOT EXISTS fuel_type TEXT;

-- Add reporting period columns for proper aggregation
ALTER TABLE public.activity_data
  ADD COLUMN IF NOT EXISTS reporting_period_start DATE;

ALTER TABLE public.activity_data
  ADD COLUMN IF NOT EXISTS reporting_period_end DATE;

-- Add comments
COMMENT ON COLUMN public.activity_data.facility_id IS 'Links activity data to a specific facility for per-facility emissions aggregation';
COMMENT ON COLUMN public.activity_data.fuel_type IS 'DEFRA fuel type identifier for emission factor matching (e.g., natural_gas_kwh, diesel_stationary)';
COMMENT ON COLUMN public.activity_data.reporting_period_start IS 'Start date of the reporting period for this activity';
COMMENT ON COLUMN public.activity_data.reporting_period_end IS 'End date of the reporting period for this activity';

-- Create index for facility lookups
CREATE INDEX IF NOT EXISTS idx_activity_data_facility_id
  ON public.activity_data(facility_id);

CREATE INDEX IF NOT EXISTS idx_activity_data_fuel_type
  ON public.activity_data(fuel_type);

CREATE INDEX IF NOT EXISTS idx_activity_data_reporting_period
  ON public.activity_data(reporting_period_start, reporting_period_end);

-- =============================================================================
-- 2. Create utility type to DEFRA fuel type mapping table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.utility_fuel_type_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utility_type TEXT NOT NULL UNIQUE,
  utility_type_display TEXT NOT NULL,
  fuel_type TEXT NOT NULL,
  default_unit TEXT NOT NULL,
  normalized_unit TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('1', '2')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.utility_fuel_type_mapping IS 'Maps utility types from the UI to DEFRA fuel types for emission factor lookup';

-- Insert the mapping data (must match DEFRA fuel_type values exactly)
INSERT INTO public.utility_fuel_type_mapping
  (utility_type, utility_type_display, fuel_type, default_unit, normalized_unit, scope)
VALUES
  ('electricity_grid', 'Purchased Electricity', 'grid_electricity', 'kWh', 'kWh', '2'),
  ('heat_steam_purchased', 'Purchased Heat / Steam', 'heat_steam', 'kWh', 'kWh', '2'),
  ('natural_gas', 'Natural Gas (by kWh)', 'natural_gas_kwh', 'kWh', 'kWh', '1'),
  ('natural_gas_m3', 'Natural Gas (by m³)', 'natural_gas_m3', 'm3', 'm3', '1'),
  ('lpg', 'LPG (Propane/Butane)', 'lpg_litre', 'litre', 'litre', '1'),
  ('diesel_stationary', 'Diesel (Generators/Stationary)', 'diesel_stationary', 'litre', 'litre', '1'),
  ('heavy_fuel_oil', 'Heavy Fuel Oil', 'heavy_fuel_oil', 'litre', 'litre', '1'),
  ('biomass_solid', 'Biogas / Biomass', 'biomass_wood_chips', 'kg', 'kg', '1'),
  ('refrigerant_leakage', 'Refrigerants (Leakage)', 'refrigerant_r410a', 'kg', 'kg', '1'),
  ('diesel_mobile', 'Company Fleet (Diesel)', 'diesel_stationary', 'litre', 'litre', '1'),
  ('petrol_mobile', 'Company Fleet (Petrol/Gasoline)', 'petrol', 'litre', 'litre', '1')
ON CONFLICT (utility_type) DO UPDATE SET
  fuel_type = EXCLUDED.fuel_type,
  default_unit = EXCLUDED.default_unit,
  normalized_unit = EXCLUDED.normalized_unit;

-- Enable RLS
ALTER TABLE public.utility_fuel_type_mapping ENABLE ROW LEVEL SECURITY;

-- Read-only access for authenticated users
CREATE POLICY "Authenticated users can view utility fuel type mapping"
  ON public.utility_fuel_type_mapping
  FOR SELECT
  TO authenticated
  USING (true);

-- =============================================================================
-- 3. Create unit normalization function
-- =============================================================================

CREATE OR REPLACE FUNCTION normalize_unit(input_unit TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Normalize common unit variations to match DEFRA factor units
  RETURN CASE
    -- Volume units
    WHEN lower(input_unit) IN ('litres', 'liters', 'l', 'ltr') THEN 'litre'
    WHEN lower(input_unit) IN ('m³', 'm3', 'cubic metres', 'cubic meters') THEN 'm3'
    WHEN lower(input_unit) IN ('gallons', 'gal') THEN 'gallon'

    -- Energy units
    WHEN lower(input_unit) IN ('kwh', 'kilowatt-hours', 'kilowatt hours') THEN 'kWh'
    WHEN lower(input_unit) IN ('mwh', 'megawatt-hours') THEN 'MWh'
    WHEN lower(input_unit) IN ('therm', 'therms') THEN 'therm'

    -- Mass units
    WHEN lower(input_unit) IN ('kg', 'kilograms', 'kilogram', 'kgs') THEN 'kg'
    WHEN lower(input_unit) IN ('tonnes', 'tonne', 'metric tons', 'metric ton') THEN 'tonne'

    -- Default: return lowercase
    ELSE lower(input_unit)
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION normalize_unit IS 'Normalizes unit strings to match DEFRA emission factor units';

-- =============================================================================
-- 4. Create function to get correct DEFRA year from reporting period
-- =============================================================================

CREATE OR REPLACE FUNCTION get_defra_factor_year(
  p_reporting_period_start DATE,
  p_reporting_period_end DATE
)
RETURNS INTEGER AS $$
DECLARE
  v_period_year INTEGER;
  v_available_year INTEGER;
BEGIN
  -- Use the year from the end of the reporting period
  v_period_year := EXTRACT(YEAR FROM p_reporting_period_end)::INTEGER;

  -- Find the closest available DEFRA factor year (same or earlier)
  SELECT MAX(factor_year) INTO v_available_year
  FROM public.defra_energy_emission_factors
  WHERE factor_year <= v_period_year;

  -- If no earlier year found, get the earliest available
  IF v_available_year IS NULL THEN
    SELECT MIN(factor_year) INTO v_available_year
    FROM public.defra_energy_emission_factors;
  END IF;

  RETURN COALESCE(v_available_year, v_period_year);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_defra_factor_year IS 'Returns the appropriate DEFRA emission factor year based on reporting period. Uses the year from period end date, falling back to closest available year.';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_defra_factor_year(DATE, DATE) TO authenticated;

-- =============================================================================
-- 5. Create improved facility emissions calculation function
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_facility_emissions_from_activity(
  p_facility_id UUID,
  p_reporting_period_start DATE,
  p_reporting_period_end DATE
)
RETURNS TABLE (
  total_co2e NUMERIC,
  scope1_co2e NUMERIC,
  scope2_co2e NUMERIC,
  activity_count INTEGER,
  factor_year INTEGER
) AS $$
DECLARE
  v_factor_year INTEGER;
  v_scope1 NUMERIC := 0;
  v_scope2 NUMERIC := 0;
  v_total NUMERIC := 0;
  v_count INTEGER := 0;
  v_activity RECORD;
  v_factor RECORD;
BEGIN
  -- Determine the correct DEFRA factor year
  v_factor_year := get_defra_factor_year(p_reporting_period_start, p_reporting_period_end);

  -- Loop through all activity data for this facility and period
  FOR v_activity IN
    SELECT
      ad.id,
      ad.fuel_type,
      ad.quantity,
      ad.unit,
      ad.category,
      COALESCE(ufm.fuel_type, ad.fuel_type) AS mapped_fuel_type,
      COALESCE(ufm.scope,
        CASE WHEN ad.category = 'Scope 1' THEN '1' ELSE '2' END
      ) AS activity_scope
    FROM public.activity_data ad
    LEFT JOIN public.utility_fuel_type_mapping ufm
      ON ufm.utility_type = ad.fuel_type OR ufm.utility_type = ad.name
    WHERE ad.facility_id = p_facility_id
      AND (
        (ad.reporting_period_start = p_reporting_period_start AND ad.reporting_period_end = p_reporting_period_end)
        OR ad.activity_date BETWEEN p_reporting_period_start AND p_reporting_period_end
      )
  LOOP
    -- Get the emission factor
    SELECT def.co2e_factor, def.factor_unit, def.scope
    INTO v_factor
    FROM public.defra_energy_emission_factors def
    WHERE def.fuel_type = v_activity.mapped_fuel_type
      AND def.factor_year = v_factor_year
    LIMIT 1;

    -- If factor found, calculate emissions
    IF v_factor IS NOT NULL THEN
      v_count := v_count + 1;

      -- Check if units match (after normalization)
      IF normalize_unit(v_activity.unit) = normalize_unit(v_factor.factor_unit) THEN
        IF v_activity.activity_scope = '1' THEN
          v_scope1 := v_scope1 + (v_activity.quantity * v_factor.co2e_factor);
        ELSE
          v_scope2 := v_scope2 + (v_activity.quantity * v_factor.co2e_factor);
        END IF;
      END IF;
    END IF;
  END LOOP;

  v_total := v_scope1 + v_scope2;

  RETURN QUERY SELECT v_total, v_scope1, v_scope2, v_count, v_factor_year;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION calculate_facility_emissions_from_activity IS 'Calculates total Scope 1 & 2 emissions for a facility using DEFRA factors appropriate for the reporting period';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION calculate_facility_emissions_from_activity(UUID, DATE, DATE) TO authenticated;

-- =============================================================================
-- 6. Add DEFRA 2024 factors if missing (for the user's 2024 reporting period)
-- =============================================================================

-- Ensure we have 2024 factors (copy from existing if needed)
INSERT INTO public.defra_energy_emission_factors
  (fuel_type, fuel_type_display, factor_year, co2e_factor, factor_unit, scope, category, subcategory, source, source_url, notes, geographic_scope)
SELECT
  fuel_type,
  fuel_type_display,
  2024 as factor_year,
  co2e_factor,
  factor_unit,
  scope,
  category,
  subcategory,
  REPLACE(source, '2023', '2024') as source,
  source_url,
  notes,
  geographic_scope
FROM public.defra_energy_emission_factors
WHERE factor_year = 2023
  AND NOT EXISTS (
    SELECT 1 FROM public.defra_energy_emission_factors ef2
    WHERE ef2.fuel_type = defra_energy_emission_factors.fuel_type
      AND ef2.factor_year = 2024
      AND ef2.geographic_scope = defra_energy_emission_factors.geographic_scope
  )
ON CONFLICT (fuel_type, factor_year, geographic_scope) DO NOTHING;
