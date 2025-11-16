/*
  # Add Product LCA Wizard Fields

  1. Changes to `product_lcas` table
    - Add `product_id` (uuid, nullable) - Foreign key to products table
    - Add `sourcing_methodology` (text, nullable) - Values: 'GROWN' or 'PURCHASED'
    - Add index on product_id for performance

  2. Notes
    - product_id links LCA to specific product
    - sourcing_methodology captures first wizard step
    - Fields are nullable to support legacy data and draft state
*/

-- ============================================================================
-- STEP 1: Add New Columns
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_lcas'
      AND column_name = 'product_id'
  ) THEN
    ALTER TABLE public.product_lcas
      ADD COLUMN product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_lcas'
      AND column_name = 'sourcing_methodology'
  ) THEN
    ALTER TABLE public.product_lcas
      ADD COLUMN sourcing_methodology TEXT;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Add Check Constraint
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_sourcing_methodology'
  ) THEN
    ALTER TABLE public.product_lcas
      ADD CONSTRAINT valid_sourcing_methodology
      CHECK (sourcing_methodology IS NULL OR sourcing_methodology IN ('GROWN', 'PURCHASED'));
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Add Index
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_product_lcas_product_id
  ON public.product_lcas(product_id)
  WHERE product_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Add Comments
-- ============================================================================

COMMENT ON COLUMN public.product_lcas.product_id IS 'Foreign key linking LCA to specific product in products table';
COMMENT ON COLUMN public.product_lcas.sourcing_methodology IS 'Sourcing methodology: GROWN (primary producer) or PURCHASED (third-party suppliers)';
