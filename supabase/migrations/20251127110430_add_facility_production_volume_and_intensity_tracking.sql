/*
  # Add Production Volume and Emission Intensity Tracking to Facilities

  This migration implements ISO 14044-compliant allocation by centralising production volume
  data at the facility level to calculate fixed "Emission Intensity" factors. This prevents
  "Denominator Drift" where product LCAs use inconsistent production volumes.

  ## Changes

  1. **New Enums**
     - `facility_data_source_type`: Tracks whether facility uses primary data or industry averages
     - `production_volume_unit`: Standard units for production volume (Litres, Hectolitres, Units)

  2. **Facility Emissions Aggregated Table Updates**
     - `total_production_volume`: Total production volume for the reporting period
     - `volume_unit`: Unit of measurement for production volume
     - `data_source_type`: Whether using verified bills (Primary) or industry average (Secondary)
     - `calculated_intensity`: Emission intensity per unit (kg CO2e / unit)
     - `fallback_intensity_factor`: Industry average intensity (used when data_source_type = 'Secondary_Average')
     - `facility_activity_type`: Type of manufacturing activity for industry average lookup

  3. **Manufacturing Proxy Emission Factors**
     - Seed data for common beverage manufacturing types
     - Used as fallback when primary facility data is unavailable
     - Updates emissions_factors category constraint to allow 'Manufacturing_Proxy'

  ## Notes

  - Primary data path: Intensity = Total Emissions / Total Production Volume
  - Secondary data path: Uses pre-defined proxy factors from emissions_factors table
  - Product LCAs will inherit facility intensity automatically
  - Prevents denominator drift by maintaining single source of truth for facility capacity
*/

-- Create enum for facility data source type
DO $$ BEGIN
  CREATE TYPE facility_data_source_type AS ENUM ('Primary', 'Secondary_Average');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create enum for production volume units
DO $$ BEGIN
  CREATE TYPE production_volume_unit AS ENUM ('Litres', 'Hectolitres', 'Units', 'kg');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add production volume and intensity columns to facility_emissions_aggregated
ALTER TABLE facility_emissions_aggregated
  ADD COLUMN IF NOT EXISTS total_production_volume numeric,
  ADD COLUMN IF NOT EXISTS volume_unit production_volume_unit,
  ADD COLUMN IF NOT EXISTS data_source_type facility_data_source_type DEFAULT 'Primary',
  ADD COLUMN IF NOT EXISTS calculated_intensity numeric,
  ADD COLUMN IF NOT EXISTS fallback_intensity_factor numeric,
  ADD COLUMN IF NOT EXISTS facility_activity_type text;

-- Add comments for documentation
COMMENT ON COLUMN facility_emissions_aggregated.total_production_volume IS 'Total production volume for the reporting period. Mandatory if data_source_type = Primary';
COMMENT ON COLUMN facility_emissions_aggregated.volume_unit IS 'Unit of measurement for production volume';
COMMENT ON COLUMN facility_emissions_aggregated.data_source_type IS 'Primary = Verified utility bills, Secondary_Average = Industry average proxy';
COMMENT ON COLUMN facility_emissions_aggregated.calculated_intensity IS 'Emission intensity per unit of production (kg CO2e / unit). Calculated as total_co2e / total_production_volume';
COMMENT ON COLUMN facility_emissions_aggregated.fallback_intensity_factor IS 'Industry average emission intensity. Used when data_source_type = Secondary_Average';
COMMENT ON COLUMN facility_emissions_aggregated.facility_activity_type IS 'Type of manufacturing activity for industry average lookup (e.g., Soft Drinks Bottling, Brewing)';

-- Update the emissions_factors category constraint to allow Manufacturing_Proxy
ALTER TABLE emissions_factors
  DROP CONSTRAINT IF EXISTS chk_emissions_factors_category;

ALTER TABLE emissions_factors
  ADD CONSTRAINT chk_emissions_factors_category 
  CHECK (category IS NULL OR category = ANY (ARRAY['Scope 1'::text, 'Scope 2'::text, 'Scope 3'::text, 'Manufacturing_Proxy'::text]));

-- Insert manufacturing proxy emission factors for industry averages
INSERT INTO emissions_factors (
  name,
  category,
  subcategory,
  unit,
  value,
  source,
  source_documentation_link,
  year_of_publication,
  year,
  geographic_scope,
  region,
  created_at,
  updated_at
) VALUES
  (
    'Average Beverage Bottling (Global)',
    'Manufacturing_Proxy',
    'Soft Drinks Bottling',
    'litre',
    0.15,
    'Industry Average - Defra 2025 Derived',
    'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
    2025,
    2025,
    'Global',
    'Global',
    now(),
    now()
  ),
  (
    'Average Brewing (Global)',
    'Manufacturing_Proxy',
    'Brewing',
    'litre',
    0.22,
    'Industry Average - Defra 2025 Derived',
    'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
    2025,
    2025,
    'Global',
    'Global',
    now(),
    now()
  ),
  (
    'Average Distilling (Global)',
    'Manufacturing_Proxy',
    'Distilling',
    'litre',
    0.35,
    'Industry Average - Defra 2025 Derived',
    'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
    2025,
    2025,
    'Global',
    'Global',
    now(),
    now()
  ),
  (
    'Average Juice Processing (Global)',
    'Manufacturing_Proxy',
    'Juice Processing',
    'litre',
    0.18,
    'Industry Average - Defra 2025 Derived',
    'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
    2025,
    2025,
    'Global',
    'Global',
    now(),
    now()
  ),
  (
    'Average Dairy Processing (Global)',
    'Manufacturing_Proxy',
    'Dairy Processing',
    'litre',
    0.25,
    'Industry Average - Defra 2025 Derived',
    'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
    2025,
    2025,
    'Global',
    'Global',
    now(),
    now()
  )
ON CONFLICT DO NOTHING;

-- Create index for fast lookups of manufacturing proxy factors
CREATE INDEX IF NOT EXISTS idx_emissions_factors_manufacturing_proxy 
  ON emissions_factors(category, subcategory) 
  WHERE category = 'Manufacturing_Proxy';

-- Create a function to automatically calculate intensity when emissions are logged
CREATE OR REPLACE FUNCTION calculate_facility_intensity()
RETURNS TRIGGER AS $$
BEGIN
  -- If primary data and production volume is provided, calculate intensity
  IF NEW.data_source_type = 'Primary' AND NEW.total_production_volume IS NOT NULL AND NEW.total_production_volume > 0 THEN
    NEW.calculated_intensity := NEW.total_co2e / NEW.total_production_volume;
  END IF;
  
  -- If secondary data, use fallback intensity
  IF NEW.data_source_type = 'Secondary_Average' AND NEW.fallback_intensity_factor IS NOT NULL THEN
    NEW.calculated_intensity := NEW.fallback_intensity_factor;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-calculate intensity
DROP TRIGGER IF EXISTS trigger_calculate_facility_intensity ON facility_emissions_aggregated;
CREATE TRIGGER trigger_calculate_facility_intensity
  BEFORE INSERT OR UPDATE ON facility_emissions_aggregated
  FOR EACH ROW
  EXECUTE FUNCTION calculate_facility_intensity();
