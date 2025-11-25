/*
  # Load DEFRA 2025 Scope 3 Emission Factors - Materials & Business Travel

  1. Purpose
     - Add Scope 3 emission factors for Point of Sale (POS) materials and business air travel
     - Enable carbon accounting for branded merchandise and employee business travel
     - Support full lifecycle calculations with Well-To-Tank (WTT) factors

  2. Data Sources (DEFRA 2025 Conversion Factors)
     - Tab: "Material use" - Glass, Paper, Textiles, Plastic
     - Tab: "Business travel - air" - Domestic, Short-haul, Long-haul flights
     - Tab: "WTT- business travel - air" - Well-To-Tank upstream emissions

  3. New Factors Added
     Materials (4 factors):
     - Glass (aggregate) - 0.53700 kgCO2e/kg
     - Paper and board - 0.91050 kgCO2e/kg
     - Textiles (clothing) - 21.500 kgCO2e/kg
     - Plastic (average) - 2.5300 kgCO2e/kg

     Business Travel - Air (3 factors):
     - Domestic flight - 0.25591 kgCO2e/passenger.km
     - Short-haul international - 0.15881 kgCO2e/passenger.km
     - Long-haul international - 0.19561 kgCO2e/passenger.km

     Well-To-Tank Air Travel (3 factors):
     - WTT Domestic flight - 0.05391 kgCO2e/passenger.km
     - WTT Short-haul international - 0.03347 kgCO2e/passenger.km
     - WTT Long-haul international - 0.04121 kgCO2e/passenger.km

  4. Schema Compatibility
     - Assumes emissions_factors table has: category, type columns
     - If columns don't exist, this migration will add them
     - All factors include full traceability and audit metadata

  5. Security
     - RLS policies already exist on emissions_factors table
     - Read-only access for authenticated users
*/

-- =====================================================
-- ENSURE SCHEMA COMPATIBILITY
-- =====================================================

-- Add category column if it doesn't exist (Scope 1, 2, or 3)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'emissions_factors' AND column_name = 'category'
  ) THEN
    ALTER TABLE emissions_factors ADD COLUMN category text;
    CREATE INDEX IF NOT EXISTS idx_emissions_factors_category ON emissions_factors(category);
  END IF;
END $$;

-- Add type column if it doesn't exist (detailed classification)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'emissions_factors' AND column_name = 'type'
  ) THEN
    ALTER TABLE emissions_factors ADD COLUMN type text;
    CREATE INDEX IF NOT EXISTS idx_emissions_factors_type ON emissions_factors(type);
  END IF;
END $$;

-- Add material_type column for materials classification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'emissions_factors' AND column_name = 'material_type'
  ) THEN
    ALTER TABLE emissions_factors ADD COLUMN material_type text;
    CREATE INDEX IF NOT EXISTS idx_emissions_factors_material_type ON emissions_factors(material_type);
  END IF;
END $$;

-- Add travel_class column for flight classifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'emissions_factors' AND column_name = 'travel_class'
  ) THEN
    ALTER TABLE emissions_factors ADD COLUMN travel_class text;
    CREATE INDEX IF NOT EXISTS idx_emissions_factors_travel_class ON emissions_factors(travel_class);
  END IF;
END $$;

-- =====================================================
-- INSERT SCOPE 3 MATERIALS FACTORS
-- =====================================================

-- Glass (Aggregate)
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
  material_type
) VALUES (
  'Glass - Aggregate',
  0.53700,
  'kgCO2e/kg',
  'DEFRA 2025',
  'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
  2025,
  'UK',
  'Scope 3',
  'Materials',
  'Glass'
) ON CONFLICT DO NOTHING;

-- Paper and Board
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
  material_type
) VALUES (
  'Paper and Board',
  0.91050,
  'kgCO2e/kg',
  'DEFRA 2025',
  'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
  2025,
  'UK',
  'Scope 3',
  'Materials',
  'Paper'
) ON CONFLICT DO NOTHING;

-- Textiles (Clothing)
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
  material_type
) VALUES (
  'Textiles - Clothing',
  21.500,
  'kgCO2e/kg',
  'DEFRA 2025',
  'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
  2025,
  'UK',
  'Scope 3',
  'Materials',
  'Textiles'
) ON CONFLICT DO NOTHING;

-- Plastic (Average)
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
  material_type
) VALUES (
  'Plastic - Average',
  2.5300,
  'kgCO2e/kg',
  'DEFRA 2025',
  'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
  2025,
  'UK',
  'Scope 3',
  'Materials',
  'Plastic'
) ON CONFLICT DO NOTHING;

-- =====================================================
-- INSERT SCOPE 3 BUSINESS TRAVEL - AIR FACTORS
-- =====================================================

-- Domestic Flight (Average Passenger)
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
  'Domestic Flight - Average Passenger',
  0.25591,
  'kgCO2e/passenger.km',
  'DEFRA 2025',
  'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
  2025,
  'UK',
  'Scope 3',
  'Business Travel - Air',
  'Domestic'
) ON CONFLICT DO NOTHING;

-- Short-haul International Flight (Average Passenger)
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
  'Short-haul International Flight - Average Passenger',
  0.15881,
  'kgCO2e/passenger.km',
  'DEFRA 2025',
  'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
  2025,
  'UK',
  'Scope 3',
  'Business Travel - Air',
  'Short-haul'
) ON CONFLICT DO NOTHING;

-- Long-haul International Flight (Average Passenger)
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
  'Long-haul International Flight - Average Passenger',
  0.19561,
  'kgCO2e/passenger.km',
  'DEFRA 2025',
  'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
  2025,
  'UK',
  'Scope 3',
  'Business Travel - Air',
  'Long-haul'
) ON CONFLICT DO NOTHING;

-- =====================================================
-- INSERT WTT (WELL-TO-TANK) AIR TRAVEL FACTORS
-- =====================================================

-- WTT Domestic Flight
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
  'WTT Domestic Flight - Average Passenger',
  0.05391,
  'kgCO2e/passenger.km',
  'DEFRA 2025',
  'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
  2025,
  'UK',
  'Scope 3',
  'WTT - Business Travel - Air',
  'Domestic'
) ON CONFLICT DO NOTHING;

-- WTT Short-haul International Flight
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
  'WTT Short-haul International Flight - Average Passenger',
  0.03347,
  'kgCO2e/passenger.km',
  'DEFRA 2025',
  'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
  2025,
  'UK',
  'Scope 3',
  'WTT - Business Travel - Air',
  'Short-haul'
) ON CONFLICT DO NOTHING;

-- WTT Long-haul International Flight
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
  'WTT Long-haul International Flight - Average Passenger',
  0.04121,
  'kgCO2e/passenger.km',
  'DEFRA 2025',
  'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
  2025,
  'UK',
  'Scope 3',
  'WTT - Business Travel - Air',
  'Long-haul'
) ON CONFLICT DO NOTHING;

-- =====================================================
-- VERIFICATION COMMENTS
-- =====================================================

COMMENT ON COLUMN emissions_factors.material_type IS 'Material classification for Scope 3 materials (e.g., Glass, Paper, Textiles, Plastic)';
COMMENT ON COLUMN emissions_factors.travel_class IS 'Flight classification for business travel (e.g., Domestic, Short-haul, Long-haul)';

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================

-- Query to verify all new factors are loaded
DO $$
DECLARE
  materials_count int;
  travel_count int;
  wtt_count int;
BEGIN
  SELECT COUNT(*) INTO materials_count
  FROM emissions_factors
  WHERE source = 'DEFRA 2025'
    AND category = 'Scope 3'
    AND type = 'Materials';

  SELECT COUNT(*) INTO travel_count
  FROM emissions_factors
  WHERE source = 'DEFRA 2025'
    AND category = 'Scope 3'
    AND type = 'Business Travel - Air';

  SELECT COUNT(*) INTO wtt_count
  FROM emissions_factors
  WHERE source = 'DEFRA 2025'
    AND category = 'Scope 3'
    AND type = 'WTT - Business Travel - Air';

  RAISE NOTICE 'DEFRA 2025 Scope 3 Factors Loaded:';
  RAISE NOTICE '  Materials: % factors', materials_count;
  RAISE NOTICE '  Business Travel - Air: % factors', travel_count;
  RAISE NOTICE '  WTT Business Travel - Air: % factors', wtt_count;
  RAISE NOTICE '  Total: % factors', materials_count + travel_count + wtt_count;

  IF materials_count + travel_count + wtt_count = 10 THEN
    RAISE NOTICE '✅ All 10 Scope 3 factors loaded successfully!';
  ELSE
    RAISE WARNING '⚠ Expected 10 factors but loaded %', materials_count + travel_count + wtt_count;
  END IF;
END $$;
