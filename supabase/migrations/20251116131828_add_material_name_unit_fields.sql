/*
  # Add Direct Material Fields to Product LCA Materials

  1. Changes to `product_lca_materials`
    - Add `name` (text, nullable) - Material/ingredient name entered by user
    - Add `unit` (text, nullable) - Unit of measurement (kg, L, kWh, etc.)
    - Make `material_id` nullable - To support direct entry workflow
    - Make `material_type` nullable - To support direct entry workflow

  2. Notes
    - Supports two workflows:
      a) Direct entry: User types name, quantity, unit (name/unit populated, material_id null)
      b) Lookup: User selects from predefined list (material_id populated, name/unit derived)
    - For ingredients wizard, we use direct entry workflow
    - lca_sub_stage_id remains required for stage classification
*/

-- ============================================================================
-- STEP 1: Add New Columns
-- ============================================================================

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

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_lca_materials'
      AND column_name = 'unit'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN unit TEXT;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Make Existing Columns Nullable
-- ============================================================================

ALTER TABLE public.product_lca_materials
  ALTER COLUMN material_id DROP NOT NULL;

ALTER TABLE public.product_lca_materials
  ALTER COLUMN material_type DROP NOT NULL;

-- ============================================================================
-- STEP 3: Add Check Constraint
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'material_data_present'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD CONSTRAINT material_data_present
      CHECK (
        (material_id IS NOT NULL AND material_type IS NOT NULL) OR
        (name IS NOT NULL)
      );
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Add Comments
-- ============================================================================

COMMENT ON COLUMN public.product_lca_materials.name IS 'Material/ingredient name entered directly by user. Used when material_id is null (direct entry workflow).';
COMMENT ON COLUMN public.product_lca_materials.unit IS 'Unit of measurement (kg, L, kWh, units, etc.). Used with direct entry workflow.';
COMMENT ON CONSTRAINT material_data_present ON public.product_lca_materials IS 'Ensures either material_id+type (lookup) OR name (direct entry) is provided.';
