/*
  # Add Nature Impact Factors to Staging Emission Factors

  1. New Columns
    - `terrestrial_ecotoxicity_factor` - ReCiPe 2016 Midpoint (kg 1,4-DCB eq per reference unit)
    - `freshwater_eutrophication_factor` - ReCiPe 2016 Midpoint (kg P eq per reference unit)
    - `terrestrial_acidification_factor` - ReCiPe 2016 Midpoint (kg SO2 eq per reference unit)
    - `freshwater_ecotoxicity_factor` - ReCiPe 2016 Midpoint (kg 1,4-DCB eq per reference unit)
    - `marine_ecotoxicity_factor` - ReCiPe 2016 Midpoint (kg 1,4-DCB eq per reference unit)
    - `marine_eutrophication_factor` - ReCiPe 2016 Midpoint (kg N eq per reference unit)

  2. Purpose
    - Enable calculation of comprehensive nature impact metrics
    - Support CSRD E4 biodiversity reporting requirements
    - Align with ReCiPe 2016 and EF 3.1 methodologies

  3. Notes
    - All factors are per reference_unit (typically kg or L)
    - Values sourced from Ecoinvent 3.x with ReCiPe 2016 characterisation
    - Null values indicate no data available (will default to 0 in calculations)
*/

-- Add nature impact factor columns
ALTER TABLE staging_emission_factors
ADD COLUMN IF NOT EXISTS terrestrial_ecotoxicity_factor NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS freshwater_eutrophication_factor NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS terrestrial_acidification_factor NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS freshwater_ecotoxicity_factor NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS marine_ecotoxicity_factor NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS marine_eutrophication_factor NUMERIC DEFAULT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_staging_ef_nature_impacts
ON staging_emission_factors(terrestrial_ecotoxicity_factor, freshwater_eutrophication_factor, terrestrial_acidification_factor)
WHERE terrestrial_ecotoxicity_factor IS NOT NULL
   OR freshwater_eutrophication_factor IS NOT NULL
   OR terrestrial_acidification_factor IS NOT NULL;

-- Add comments
COMMENT ON COLUMN staging_emission_factors.terrestrial_ecotoxicity_factor IS 'ReCiPe 2016: kg 1,4-dichlorobenzene equivalents per reference unit';
COMMENT ON COLUMN staging_emission_factors.freshwater_eutrophication_factor IS 'ReCiPe 2016: kg phosphorus equivalents per reference unit';
COMMENT ON COLUMN staging_emission_factors.terrestrial_acidification_factor IS 'ReCiPe 2016: kg sulfur dioxide equivalents per reference unit';
COMMENT ON COLUMN staging_emission_factors.freshwater_ecotoxicity_factor IS 'ReCiPe 2016: kg 1,4-dichlorobenzene equivalents per reference unit';
COMMENT ON COLUMN staging_emission_factors.marine_ecotoxicity_factor IS 'ReCiPe 2016: kg 1,4-dichlorobenzene equivalents per reference unit';
COMMENT ON COLUMN staging_emission_factors.marine_eutrophication_factor IS 'ReCiPe 2016: kg nitrogen equivalents per reference unit';
