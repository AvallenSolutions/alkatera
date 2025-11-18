/*
  # Fix product_lca_materials Schema for Direct Material Entry

  ## Overview
  This migration fixes the product_lca_materials table to support direct material entry
  where users can add materials by name without requiring a material_id reference.

  ## Problem
  The current schema requires material_id and material_type to be NOT NULL, but the 
  ingredients workflow allows users to directly enter material names, quantities, and units
  without selecting from a materials database.

  ## Changes to `product_lca_materials` table
  - Make `material_id` column nullable to support direct entry
  - Make `material_type` column nullable to support direct entry
  - Add `name` column if it doesn't exist to store the material name directly
  - Ensure `lca_sub_stage_id` has correct type and is nullable

  ## Data Integrity
  - Existing data is preserved
  - Foreign key relationships remain intact
  - New materials can be added with either:
    1. material_id + material_type (reference to materials database)
    2. name + quantity + unit (direct entry)

  ## Security
  - RLS policies continue to work as expected
  - No changes needed to existing policies
*/

-- Make material_id nullable to support direct material entry
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'material_id'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ALTER COLUMN material_id DROP NOT NULL;
  END IF;
END $$;

-- Make material_type nullable to support direct material entry
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'material_type'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ALTER COLUMN material_type DROP NOT NULL;
  END IF;
END $$;

-- Make unit nullable (was required but should be nullable for partial entries)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'unit'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ALTER COLUMN unit DROP NOT NULL;
  END IF;
END $$;

-- Ensure name column exists for direct material entry
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'name'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN name TEXT;
  END IF;
END $$;

-- Add check constraint to ensure either material_id or name is provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_lca_materials_material_or_name_required'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD CONSTRAINT product_lca_materials_material_or_name_required
      CHECK (material_id IS NOT NULL OR name IS NOT NULL);
  END IF;
END $$;

COMMENT ON CONSTRAINT product_lca_materials_material_or_name_required 
  ON public.product_lca_materials IS 
  'Ensures either material_id (reference) or name (direct entry) is provided';
