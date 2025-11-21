/*
  # Add Product Hub Fields
  
  1. New Columns
    - `functional_unit` (text) - The functional unit for LCA calculations
    - `components` (jsonb) - Array of product components (ingredients & packaging)
    - `upstream_ingredients_complete` (boolean) - Completion status
    - `upstream_packaging_complete` (boolean) - Completion status
    - `core_operations_complete` (boolean) - Completion status
    - `downstream_distribution_complete` (boolean) - Completion status
    - `use_end_of_life_complete` (boolean) - Completion status
  
  2. Changes
    - Add functional_unit column for LCA calculations
    - Add components JSONB array for unified ingredient/packaging storage
    - Add completion tracking fields for compliance hub
  
  3. Notes
    - Components array structure: [{ id, type: 'ingredient'|'packaging', name, weight_kg, metrics: {...} }]
    - Completion fields default to false
*/

-- Add functional_unit column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'functional_unit'
  ) THEN
    ALTER TABLE products ADD COLUMN functional_unit TEXT;
  END IF;
END $$;

-- Add components JSONB column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'components'
  ) THEN
    ALTER TABLE products ADD COLUMN components JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add completion tracking fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'upstream_ingredients_complete'
  ) THEN
    ALTER TABLE products ADD COLUMN upstream_ingredients_complete BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'upstream_packaging_complete'
  ) THEN
    ALTER TABLE products ADD COLUMN upstream_packaging_complete BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'core_operations_complete'
  ) THEN
    ALTER TABLE products ADD COLUMN core_operations_complete BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'downstream_distribution_complete'
  ) THEN
    ALTER TABLE products ADD COLUMN downstream_distribution_complete BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'use_end_of_life_complete'
  ) THEN
    ALTER TABLE products ADD COLUMN use_end_of_life_complete BOOLEAN DEFAULT false;
  END IF;
END $$;
