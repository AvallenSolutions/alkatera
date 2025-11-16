/*
  # Add CRUD Fields to Products Table

  1. Changes to `products` table
    - Add `sku` (text, nullable, unique per organization) - Stock Keeping Unit
    - Add `unit_size_value` (numeric, nullable) - Product unit size value
    - Add `unit_size_unit` (text, nullable) - Unit of measurement (ml, L, g, kg)
    - Add `certifications` (jsonb, nullable) - Array of certification objects {name, evidence_url}
    - Add `awards` (jsonb, nullable) - Array of award objects {name}

  2. Indexes
    - Add index on SKU for lookups
    - Add GIN index on JSONB fields for efficient queries

  3. Notes
    - SKU uniqueness scoped to organization
    - JSONB allows flexible certification/award structures
    - All fields nullable for flexibility
*/

-- ============================================================================
-- STEP 1: Add New Columns
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'sku'
  ) THEN
    ALTER TABLE public.products ADD COLUMN sku TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'unit_size_value'
  ) THEN
    ALTER TABLE public.products ADD COLUMN unit_size_value NUMERIC;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'unit_size_unit'
  ) THEN
    ALTER TABLE public.products ADD COLUMN unit_size_unit TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'certifications'
  ) THEN
    ALTER TABLE public.products ADD COLUMN certifications JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'awards'
  ) THEN
    ALTER TABLE public.products ADD COLUMN awards JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Add Comments
-- ============================================================================

COMMENT ON COLUMN public.products.sku IS 'Stock Keeping Unit - Product identifier code';
COMMENT ON COLUMN public.products.unit_size_value IS 'Numeric value for the product unit size (e.g., 250, 1.5)';
COMMENT ON COLUMN public.products.unit_size_unit IS 'Unit of measurement for the product size (ml, L, g, kg)';
COMMENT ON COLUMN public.products.certifications IS 'Array of certification objects: [{name: string, evidence_url: string}]';
COMMENT ON COLUMN public.products.awards IS 'Array of award objects: [{name: string}]';

-- ============================================================================
-- STEP 3: Create Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_products_sku
  ON public.products(sku) WHERE sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_certifications
  ON public.products USING GIN(certifications) WHERE certifications IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_awards
  ON public.products USING GIN(awards) WHERE awards IS NOT NULL;

-- ============================================================================
-- STEP 4: Add Unique Constraint for SKU per Organization
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_organization_sku_unique'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_organization_sku_unique
      UNIQUE (organization_id, sku);
  END IF;
END $$;
