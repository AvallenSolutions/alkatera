/*
  # Add Core Operations Data to Products
  
  1. New Columns
    - `core_operations_data` (jsonb) - Stores allocated facility impacts
    - `core_operations_facility_id` (uuid) - Reference to allocated facility
    - `core_operations_provenance` (text) - Provenance note for transparency
  
  2. Changes
    - Add core_operations_data JSONB column for storing allocated impacts
    - Add facility reference for traceability
    - Add provenance text for compliance documentation
  
  3. Notes
    - Structure: { 
        co2e_per_unit: number, 
        water_per_unit: number, 
        waste_per_unit: number,
        allocation_ratio: number,
        total_production_volume: number,
        product_production_volume: number
      }
*/

-- Add core_operations_data JSONB column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'core_operations_data'
  ) THEN
    ALTER TABLE products ADD COLUMN core_operations_data JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add facility reference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'core_operations_facility_id'
  ) THEN
    ALTER TABLE products ADD COLUMN core_operations_facility_id UUID REFERENCES facilities(id);
  END IF;
END $$;

-- Add provenance note
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'core_operations_provenance'
  ) THEN
    ALTER TABLE products ADD COLUMN core_operations_provenance TEXT;
  END IF;
END $$;
