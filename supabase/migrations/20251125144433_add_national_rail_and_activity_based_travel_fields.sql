/*
  # Add National Rail Factor & Activity-Based Travel Fields

  1. Purpose
     - Add National Rail emission factor for business travel
     - Add fields to corporate_overheads for activity-based travel tracking
     - Support migration from spend-based to activity-based Scope 3 calculations

  2. New Factors
     - National rail: 0.03549 kgCO2e/passenger.km (DEFRA 2025)

  3. New Fields
     - passenger_count: Number of passengers for business travel
     - is_return_trip: Boolean flag to double the distance for return journeys
     - description: Text field for travel/material descriptions

  4. Security
     - RLS policies already exist on both tables
*/

-- =====================================================
-- ADD NATIONAL RAIL EMISSION FACTOR
-- =====================================================

INSERT INTO emissions_factors (
  name,
  value,
  unit,
  source,
  source_documentation_link,
  year_of_publication,
  geographic_scope,
  category,
  type,
  travel_class
) VALUES (
  'National Rail - Average',
  0.03549,
  'kgCO2e/passenger.km',
  'DEFRA 2025',
  'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
  2025,
  'UK',
  'Scope 3',
  'Business Travel - Rail',
  'National'
) ON CONFLICT DO NOTHING;

-- =====================================================
-- ADD ACTIVITY-BASED FIELDS TO CORPORATE_OVERHEADS
-- =====================================================

-- Add passenger_count for business travel
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'corporate_overheads' AND column_name = 'passenger_count'
  ) THEN
    ALTER TABLE corporate_overheads ADD COLUMN passenger_count integer CHECK (passenger_count > 0);
  END IF;
END $$;

-- Add is_return_trip flag
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'corporate_overheads' AND column_name = 'is_return_trip'
  ) THEN
    ALTER TABLE corporate_overheads ADD COLUMN is_return_trip boolean DEFAULT false;
  END IF;
END $$;

-- Add description field if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'corporate_overheads' AND column_name = 'description'
  ) THEN
    ALTER TABLE corporate_overheads ADD COLUMN description text;
  END IF;
END $$;

-- Add entry_date field if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'corporate_overheads' AND column_name = 'entry_date'
  ) THEN
    ALTER TABLE corporate_overheads ADD COLUMN entry_date date DEFAULT CURRENT_DATE;
  END IF;
END $$;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_corporate_overheads_passenger_count ON corporate_overheads(passenger_count);
CREATE INDEX IF NOT EXISTS idx_corporate_overheads_entry_date ON corporate_overheads(entry_date);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN corporate_overheads.passenger_count IS 'Number of passengers for business travel calculations (activity-based)';
COMMENT ON COLUMN corporate_overheads.is_return_trip IS 'Flag to indicate if journey is return trip (multiplies distance by 2)';
COMMENT ON COLUMN corporate_overheads.description IS 'User-friendly description of the overhead entry';
COMMENT ON COLUMN corporate_overheads.entry_date IS 'Date when the activity occurred';

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  rail_count int;
BEGIN
  SELECT COUNT(*) INTO rail_count
  FROM emissions_factors
  WHERE source = 'DEFRA 2025'
    AND category = 'Scope 3'
    AND type = 'Business Travel - Rail';

  RAISE NOTICE 'National Rail factors loaded: %', rail_count;
  
  IF rail_count >= 1 THEN
    RAISE NOTICE '✅ National Rail factor available for activity-based business travel!';
  END IF;
END $$;
