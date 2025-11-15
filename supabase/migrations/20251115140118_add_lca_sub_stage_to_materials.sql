/*
  # Add LCA Sub-Stage Classification to Product LCA Materials

  1. Changes to `product_lca_materials`
    - Add `lca_sub_stage_id` (integer, nullable initially for backwards compatibility)
    - Add foreign key constraint to lca_sub_stages table
    - Add index for query performance

  2. Notes
    - Field is nullable to support existing records
    - For new records, this should be considered required by application logic
    - Links materials to specific life cycle assessment sub-stages
*/

-- ============================================================================
-- STEP 1: Add lca_sub_stage_id Column
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_lca_materials'
      AND column_name = 'lca_sub_stage_id'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN lca_sub_stage_id INTEGER;
  END IF;
END $$;

COMMENT ON COLUMN public.product_lca_materials.lca_sub_stage_id IS 'Foreign key to lca_sub_stages table. Classifies the material within a specific life cycle assessment stage (e.g., Raw Material Acquisition, Manufacturing).';

-- ============================================================================
-- STEP 2: Add Foreign Key Constraint
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'product_lca_materials'
      AND constraint_name = 'fk_product_lca_materials_lca_sub_stage'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD CONSTRAINT fk_product_lca_materials_lca_sub_stage
      FOREIGN KEY (lca_sub_stage_id)
      REFERENCES public.lca_sub_stages(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Create Index
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_product_lca_materials_lca_sub_stage_id
  ON public.product_lca_materials(lca_sub_stage_id);
