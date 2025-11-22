/*
  # Add Packaging Categories to Product LCA Materials

  ## Overview
  This migration extends the product_lca_materials table to support packaging materials
  with four distinct categories: Container, Label, Closure, and Secondary Packaging.

  ## Changes to `product_lca_materials` table

  ### New Columns Added:
  - `packaging_category` (text, nullable) - Category for packaging materials only
    - Options: 'container', 'label', 'closure', 'secondary'
    - NULL for ingredient materials (backwards compatible)
  - `label_printing_type` (text, nullable) - Printing method for label materials
    - Examples: 'digital', 'offset', 'flexographic', 'gravure', 'screen'
    - Only relevant when packaging_category = 'label'

  ## Data Integrity
  - Check constraint ensures packaging_category is one of four valid options or NULL
  - Check constraint ensures label_printing_type is only set for label category
  - Existing ingredient data remains unaffected (category stays NULL)
  - Backwards compatible with existing material entries

  ## Performance
  - Index on packaging_category for filtering by category
  - Partial index for efficient label printing type queries

  ## Security
  - RLS policies continue to work as expected
  - No changes needed to existing policies
*/

-- ============================================================================
-- STEP 1: Add packaging_category column
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'packaging_category'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN packaging_category TEXT;

    COMMENT ON COLUMN public.product_lca_materials.packaging_category IS
      'Category for packaging materials: "container" (bottles, cans, packs), "label" (labels and printing), "closure" (caps, corks, seals), "secondary" (gift packs, delivery boxes). NULL for ingredient materials.';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Add label_printing_type column
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'label_printing_type'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN label_printing_type TEXT;

    COMMENT ON COLUMN public.product_lca_materials.label_printing_type IS
      'Printing method for label materials (e.g., digital, offset, flexographic, gravure, screen). Only applicable when packaging_category = "label".';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Add check constraint for valid packaging_category values
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_packaging_category'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD CONSTRAINT valid_packaging_category
      CHECK (
        packaging_category IS NULL OR
        packaging_category IN ('container', 'label', 'closure', 'secondary')
      );
  END IF;
END $$;

COMMENT ON CONSTRAINT valid_packaging_category ON public.product_lca_materials IS
  'Ensures packaging_category is either "container", "label", "closure", "secondary", or NULL for ingredients';

-- ============================================================================
-- STEP 4: Add check constraint for label_printing_type integrity
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'label_printing_type_integrity'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD CONSTRAINT label_printing_type_integrity
      CHECK (
        label_printing_type IS NULL OR
        (packaging_category = 'label' AND label_printing_type IS NOT NULL)
      );
  END IF;
END $$;

COMMENT ON CONSTRAINT label_printing_type_integrity ON public.product_lca_materials IS
  'Ensures label_printing_type is only set when packaging_category is "label"';

-- ============================================================================
-- STEP 5: Create indexes for performance
-- ============================================================================

-- Index on packaging_category for filtering by category
CREATE INDEX IF NOT EXISTS idx_product_lca_materials_packaging_category
  ON public.product_lca_materials(packaging_category)
  WHERE packaging_category IS NOT NULL;

-- Partial index on label_printing_type for label-specific queries
CREATE INDEX IF NOT EXISTS idx_product_lca_materials_label_printing_type
  ON public.product_lca_materials(label_printing_type)
  WHERE label_printing_type IS NOT NULL;

-- Composite index for packaging queries (category + lca)
CREATE INDEX IF NOT EXISTS idx_product_lca_materials_packaging_composite
  ON public.product_lca_materials(product_lca_id, packaging_category)
  WHERE packaging_category IS NOT NULL;
