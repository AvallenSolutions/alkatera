/*
  # Fix lca_sub_stage_id Type Mismatch

  ## Problem
  The `lca_sub_stages.id` column is UUID, but `product_lca_materials.lca_sub_stage_id`
  was created as INTEGER, causing a type mismatch.

  ## Changes
  1. Drop the existing foreign key constraint
  2. Drop the existing index
  3. Alter the column type from INTEGER to UUID
  4. Recreate the foreign key constraint
  5. Recreate the index

  ## Impact
  - This migration will fail if there is existing data in product_lca_materials
  - For fresh databases, this will run cleanly
  - The column is nullable so this is safe
*/

-- Drop the existing foreign key constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'product_lca_materials'
      AND constraint_name = 'fk_product_lca_materials_lca_sub_stage'
  ) THEN
    ALTER TABLE public.product_lca_materials
      DROP CONSTRAINT fk_product_lca_materials_lca_sub_stage;
  END IF;
END $$;

-- Drop the existing index
DROP INDEX IF EXISTS public.idx_product_lca_materials_lca_sub_stage_id;

-- Alter the column type from INTEGER to UUID
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_lca_materials'
      AND column_name = 'lca_sub_stage_id'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ALTER COLUMN lca_sub_stage_id TYPE UUID USING NULL;
  END IF;
END $$;

-- Recreate the foreign key constraint with correct type
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

-- Recreate the index
CREATE INDEX IF NOT EXISTS idx_product_lca_materials_lca_sub_stage_id
  ON public.product_lca_materials(lca_sub_stage_id);

-- Update the column comment
COMMENT ON COLUMN public.product_lca_materials.lca_sub_stage_id IS
  'Foreign key (UUID) to lca_sub_stages table. Classifies the material within a specific life cycle assessment sub-stage.';
