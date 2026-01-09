/*
  # Add Location Columns to Facilities Table

  1. Changes
    - Add `location_city` (text) - City where facility is located
    - Add `location_country_code` (text) - ISO country code
    - Add `location_address` (text) - Full address
    - Add `latitude` (double precision) - Coordinates for mapping
    - Add `longitude` (double precision) - Coordinates for mapping

  2. Migration Strategy
    - Safely add columns if they don't already exist
    - Keep existing `location` column for backward compatibility
    - Add index on country_code for efficient filtering

  3. Notes
    - This fixes the 400 error: "column facilities_1.location_city does not exist"
    - Existing data in `location` column is preserved
*/

-- Add location_city column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'location_city'
  ) THEN
    ALTER TABLE facilities ADD COLUMN location_city text;
  END IF;
END $$;

-- Add location_country_code column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'location_country_code'
  ) THEN
    ALTER TABLE facilities ADD COLUMN location_country_code text;
  END IF;
END $$;

-- Add location_address column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'location_address'
  ) THEN
    ALTER TABLE facilities ADD COLUMN location_address text;
  END IF;
END $$;

-- Add latitude column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE facilities ADD COLUMN latitude double precision;
  END IF;
END $$;

-- Add longitude column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE facilities ADD COLUMN longitude double precision;
  END IF;
END $$;

-- Create index for efficient country filtering
CREATE INDEX IF NOT EXISTS idx_facilities_country_code 
  ON facilities(location_country_code) 
  WHERE location_country_code IS NOT NULL;

-- Create spatial index for coordinate queries (if PostGIS is enabled)
CREATE INDEX IF NOT EXISTS idx_facilities_coordinates 
  ON facilities(latitude, longitude) 
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
