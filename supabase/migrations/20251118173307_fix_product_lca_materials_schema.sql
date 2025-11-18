/*
  # Fix product_lca_materials Table Schema

  1. Problem
    - Table has `lca_id` but should have `product_lca_id` (more descriptive)
    - Missing `unit` column
    - Missing `updated_at` column
    - Missing additional fields added in later migrations

  2. Changes to `product_lca_materials` table
    - Rename `lca_id` to `product_lca_id` for clarity and consistency
    - Add `unit` column (text, required)
    - Add `updated_at` column (timestamptz)
    - Add other fields that may be missing

  3. Data Integrity
    - Rename preserves all data and foreign key relationships
    - Update indexes and constraints accordingly

  4. Security
    - RLS policies automatically work with renamed column
    - No changes needed to policies

  5. Notes
    - Safe migration - just renames and adds missing columns
    - Idempotent - checks before making changes
*/

-- Rename lca_id to product_lca_id for consistency
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'lca_id'
  ) THEN
    ALTER TABLE public.product_lca_materials
      RENAME COLUMN lca_id TO product_lca_id;
  END IF;
END $$;

-- Ensure unit column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'unit'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN unit TEXT NOT NULL DEFAULT 'kg';
    
    -- Remove default after adding (we want it required for new inserts)
    ALTER TABLE public.product_lca_materials
      ALTER COLUMN unit DROP DEFAULT;
  END IF;
END $$;

-- Ensure updated_at column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- Add material_name column for display (from later migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'material_name'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN material_name TEXT;
  END IF;
END $$;

-- Add unit_name column for display (from later migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'unit_name'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN unit_name TEXT;
  END IF;
END $$;

-- Recreate index with correct column name if needed
DROP INDEX IF EXISTS idx_product_lca_materials_lca_id;
CREATE INDEX IF NOT EXISTS idx_product_lca_materials_product_lca_id
  ON public.product_lca_materials(product_lca_id);

-- Ensure trigger exists for updated_at
DROP TRIGGER IF EXISTS update_product_lca_materials_updated_at ON public.product_lca_materials;
CREATE TRIGGER update_product_lca_materials_updated_at
  BEFORE UPDATE ON public.product_lca_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update comments
COMMENT ON COLUMN public.product_lca_materials.product_lca_id IS 'Foreign key linking to the parent product LCA.';
COMMENT ON COLUMN public.product_lca_materials.unit IS 'Unit of measurement for the quantity (kg, L, g, ml, etc).';
COMMENT ON COLUMN public.product_lca_materials.material_name IS 'Cached display name of the material (denormalized for performance).';
COMMENT ON COLUMN public.product_lca_materials.unit_name IS 'Cached display name of the unit (denormalized for performance).';