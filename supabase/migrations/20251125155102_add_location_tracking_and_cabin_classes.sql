/*
  # Add Location Tracking and Cabin Class Support for Business Travel

  1. Purpose
     - Enable automatic distance calculation with location tracking
     - Add cabin class-specific emission factors for accurate carbon accounting
     - Support worldwide location search and geocoding
     - Enhance audit trail with coordinates and calculation methods

  2. Changes to corporate_overheads table
     New Columns:
     - origin_location (text) - Departure city/location name
     - destination_location (text) - Arrival city/location name
     - origin_coordinates (jsonb) - Departure lat/lng for recalculation
     - destination_coordinates (jsonb) - Arrival lat/lng for recalculation
     - calculated_distance_km (float) - Auto-calculated distance
     - distance_source (text) - "auto" or "manual" calculation method
     - cabin_class (text) - Economy, Premium Economy, Business, First
     - location_search_timestamp (timestamptz) - When locations were searched

  3. New Emission Factors
     Adds cabin class-specific factors for:
     - Domestic flights (3 classes: Economy, Business, First)
     - Short-haul international (4 classes: Economy, Premium Economy, Business, First)
     - Long-haul international (4 classes: Economy, Premium Economy, Business, First)

  4. Data Sources
     DEFRA 2025 Conversion Factors with cabin class differentiation:
     - Economy: 0.117-0.158 kgCO2e/passenger.km
     - Premium Economy: 0.190-0.258 kgCO2e/passenger.km
     - Business: 0.338-0.412 kgCO2e/passenger.km
     - First: 0.468-0.632 kgCO2e/passenger.km

  5. Security
     - Existing RLS policies apply to all new columns
     - No changes to access control required
*/

-- =====================================================
-- ENHANCE CORPORATE_OVERHEADS TABLE
-- =====================================================

-- Add location tracking fields
ALTER TABLE corporate_overheads
ADD COLUMN IF NOT EXISTS origin_location TEXT,
ADD COLUMN IF NOT EXISTS destination_location TEXT,
ADD COLUMN IF NOT EXISTS origin_coordinates JSONB,
ADD COLUMN IF NOT EXISTS destination_coordinates JSONB,
ADD COLUMN IF NOT EXISTS calculated_distance_km FLOAT,
ADD COLUMN IF NOT EXISTS distance_source TEXT CHECK (distance_source IN ('auto', 'manual')),
ADD COLUMN IF NOT EXISTS cabin_class TEXT CHECK (cabin_class IN ('Economy', 'Premium Economy', 'Business', 'First')),
ADD COLUMN IF NOT EXISTS location_search_timestamp TIMESTAMPTZ DEFAULT NOW();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_corporate_overheads_origin_location
  ON corporate_overheads(origin_location);

CREATE INDEX IF NOT EXISTS idx_corporate_overheads_destination_location
  ON corporate_overheads(destination_location);

CREATE INDEX IF NOT EXISTS idx_corporate_overheads_distance_source
  ON corporate_overheads(distance_source);

CREATE INDEX IF NOT EXISTS idx_corporate_overheads_cabin_class
  ON corporate_overheads(cabin_class);

-- Add comments for documentation
COMMENT ON COLUMN corporate_overheads.origin_location IS 'Departure location name from geocoding service';
COMMENT ON COLUMN corporate_overheads.destination_location IS 'Arrival location name from geocoding service';
COMMENT ON COLUMN corporate_overheads.origin_coordinates IS 'Departure coordinates as {"lat": 51.5074, "lng": -0.1278}';
COMMENT ON COLUMN corporate_overheads.destination_coordinates IS 'Arrival coordinates as {"lat": 55.9533, "lng": -3.1883}';
COMMENT ON COLUMN corporate_overheads.calculated_distance_km IS 'Distance calculated using Haversine formula';
COMMENT ON COLUMN corporate_overheads.distance_source IS 'Whether distance was calculated automatically or entered manually';
COMMENT ON COLUMN corporate_overheads.cabin_class IS 'Flight cabin class for accurate emission factors';

-- =====================================================
-- ADD CABIN_CLASS COLUMN TO EMISSIONS_FACTORS
-- =====================================================

-- Add cabin_class column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'emissions_factors' AND column_name = 'cabin_class'
  ) THEN
    ALTER TABLE emissions_factors ADD COLUMN cabin_class TEXT;
    CREATE INDEX IF NOT EXISTS idx_emissions_factors_cabin_class ON emissions_factors(cabin_class);
  END IF;
END $$;

-- Update existing average passenger factors
UPDATE emissions_factors
SET cabin_class = 'Average'
WHERE type = 'Business Travel - Air'
  AND cabin_class IS NULL;

-- =====================================================
-- INSERT CABIN CLASS-SPECIFIC EMISSION FACTORS
-- =====================================================

-- DOMESTIC FLIGHTS
-- Economy Class
INSERT INTO emissions_factors (
  name, value, unit, source, source_documentation_link,
  year_of_publication, geographic_scope, category, type, travel_class, cabin_class
) VALUES (
  'Domestic Flight - Economy Class',
  0.15800,
  'kgCO2e/passenger.km',
  'DEFRA 2025',
  'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
  2025, 'UK', 'Scope 3', 'Business Travel - Air', 'Domestic', 'Economy'
) ON CONFLICT DO NOTHING;

-- Business Class
INSERT INTO emissions_factors (
  name, value, unit, source, source_documentation_link,
  year_of_publication, geographic_scope, category, type, travel_class, cabin_class
) VALUES (
  'Domestic Flight - Business Class',
  0.41200,
  'kgCO2e/passenger.km',
  'DEFRA 2025',
  'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
  2025, 'UK', 'Scope 3', 'Business Travel - Air', 'Domestic', 'Business'
) ON CONFLICT DO NOTHING;

-- First Class
INSERT INTO emissions_factors (
  name, value, unit, source, source_documentation_link,
  year_of_publication, geographic_scope, category, type, travel_class, cabin_class
) VALUES (
  'Domestic Flight - First Class',
  0.63200,
  'kgCO2e/passenger.km',
  'DEFRA 2025',
  'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
  2025, 'UK', 'Scope 3', 'Business Travel - Air', 'Domestic', 'First'
) ON CONFLICT DO NOTHING;

-- SHORT-HAUL INTERNATIONAL FLIGHTS
-- Economy Class
INSERT INTO emissions_factors (
  name, value, unit, source, source_documentation_link,
  year_of_publication, geographic_scope, category, type, travel_class, cabin_class
) VALUES (
  'Short-haul International Flight - Economy Class',
  0.13000,
  'kgCO2e/passenger.km',
  'DEFRA 2025',
  'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
  2025, 'UK', 'Scope 3', 'Business Travel - Air', 'Short-haul', 'Economy'
) ON CONFLICT DO NOTHING;

-- Premium Economy Class
INSERT INTO emissions_factors (
  name, value, unit, source, source_documentation_link,
  year_of_publication, geographic_scope, category, type, travel_class, cabin_class
) VALUES (
  'Short-haul International Flight - Premium Economy Class',
  0.19000,
  'kgCO2e/passenger.km',
  'DEFRA 2025',
  'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
  2025, 'UK', 'Scope 3', 'Business Travel - Air', 'Short-haul', 'Premium Economy'
) ON CONFLICT DO NOTHING;

-- Business Class
INSERT INTO emissions_factors (
  name, value, unit, source, source_documentation_link,
  year_of_publication, geographic_scope, category, type, travel_class, cabin_class
) VALUES (
  'Short-haul International Flight - Business Class',
  0.33800,
  'kgCO2e/passenger.km',
  'DEFRA 2025',
  'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
  2025, 'UK', 'Scope 3', 'Business Travel - Air', 'Short-haul', 'Business'
) ON CONFLICT DO NOTHING;

-- First Class
INSERT INTO emissions_factors (
  name, value, unit, source, source_documentation_link,
  year_of_publication, geographic_scope, category, type, travel_class, cabin_class
) VALUES (
  'Short-haul International Flight - First Class',
  0.52000,
  'kgCO2e/passenger.km',
  'DEFRA 2025',
  'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
  2025, 'UK', 'Scope 3', 'Business Travel - Air', 'Short-haul', 'First'
) ON CONFLICT DO NOTHING;

-- LONG-HAUL INTERNATIONAL FLIGHTS
-- Economy Class
INSERT INTO emissions_factors (
  name, value, unit, source, source_documentation_link,
  year_of_publication, geographic_scope, category, type, travel_class, cabin_class
) VALUES (
  'Long-haul International Flight - Economy Class',
  0.11700,
  'kgCO2e/passenger.km',
  'DEFRA 2025',
  'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
  2025, 'UK', 'Scope 3', 'Business Travel - Air', 'Long-haul', 'Economy'
) ON CONFLICT DO NOTHING;

-- Premium Economy Class
INSERT INTO emissions_factors (
  name, value, unit, source, source_documentation_link,
  year_of_publication, geographic_scope, category, type, travel_class, cabin_class
) VALUES (
  'Long-haul International Flight - Premium Economy Class',
  0.19000,
  'kgCO2e/passenger.km',
  'DEFRA 2025',
  'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
  2025, 'UK', 'Scope 3', 'Business Travel - Air', 'Long-haul', 'Premium Economy'
) ON CONFLICT DO NOTHING;

-- Business Class
INSERT INTO emissions_factors (
  name, value, unit, source, source_documentation_link,
  year_of_publication, geographic_scope, category, type, travel_class, cabin_class
) VALUES (
  'Long-haul International Flight - Business Class',
  0.41100,
  'kgCO2e/passenger.km',
  'DEFRA 2025',
  'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
  2025, 'UK', 'Scope 3', 'Business Travel - Air', 'Long-haul', 'Business'
) ON CONFLICT DO NOTHING;

-- First Class
INSERT INTO emissions_factors (
  name, value, unit, source, source_documentation_link,
  year_of_publication, geographic_scope, category, type, travel_class, cabin_class
) VALUES (
  'Long-haul International Flight - First Class',
  0.46800,
  'kgCO2e/passenger.km',
  'DEFRA 2025',
  'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
  2025, 'UK', 'Scope 3', 'Business Travel - Air', 'Long-haul', 'First'
) ON CONFLICT DO NOTHING;

-- =====================================================
-- SUMMARY
-- =====================================================

DO $$
DECLARE
  location_fields_count INT;
  cabin_class_factors_count INT;
BEGIN
  -- Count new location fields
  SELECT COUNT(*) INTO location_fields_count
  FROM information_schema.columns
  WHERE table_name = 'corporate_overheads'
    AND column_name IN ('origin_location', 'destination_location', 'cabin_class');

  -- Count cabin class factors
  SELECT COUNT(*) INTO cabin_class_factors_count
  FROM emissions_factors
  WHERE cabin_class IN ('Economy', 'Premium Economy', 'Business', 'First');

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Location Tracking & Cabin Class Migration Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'New location tracking fields: %', location_fields_count;
  RAISE NOTICE 'Cabin class emission factors: %', cabin_class_factors_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Features enabled:';
  RAISE NOTICE '  ✓ Worldwide location search';
  RAISE NOTICE '  ✓ Automatic distance calculation';
  RAISE NOTICE '  ✓ Cabin class-specific emission factors';
  RAISE NOTICE '  ✓ Complete audit trail with coordinates';
  RAISE NOTICE '========================================';
END $$;