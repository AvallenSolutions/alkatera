/*
  # Recalculate Existing Facility Intensities

  This migration fixes any existing facility_emissions_aggregated records that have
  production volume and emissions data but are missing calculated_intensity.

  It triggers the existing calculate_facility_intensity() trigger by updating the
  records, which will automatically compute the intensity.

  ## Changes
  - Updates all facility_emissions_aggregated records with PRIMARY data source
  - That have both total_co2e > 0 and total_production_volume > 0
  - But are missing calculated_intensity

  ## Purpose
  - Fixes historical data entered before automatic calculation was implemented
  - Ensures all facilities with complete data show valid intensity in UI
*/

-- Update existing records to trigger intensity calculation
-- The BEFORE UPDATE trigger will automatically calculate the intensity
UPDATE facility_emissions_aggregated
SET calculation_date = now()
WHERE data_source_type = 'Primary'
  AND total_production_volume IS NOT NULL
  AND total_production_volume > 0
  AND total_co2e IS NOT NULL
  AND total_co2e > 0
  AND (calculated_intensity IS NULL OR calculated_intensity = 0);
