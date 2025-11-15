/*
  # Enhance Product LCA Tables for Full Feature Support

  1. Changes to `product_lcas`
    - Add `product_description` (text, nullable) - Product description field
    - Add `product_image_url` (text, nullable) - URL to product image in storage

  2. Changes to `product_lca_materials`
    - Add `unit` (text, nullable) - Unit of measurement for quantity
    - Add `country_of_origin` (text, nullable) - Country where material originates
    - Add `is_organic` (boolean, default false) - Whether material is organic certified
    - Add `is_regenerative` (boolean, default false) - Whether material is regenerative

  3. Notes
    - All new fields are nullable to maintain backwards compatibility
    - Boolean fields default to false
    - No breaking changes to existing data
*/

-- ============================================================================
-- STEP 1: Add New Columns to product_lcas
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_lcas'
      AND column_name = 'product_description'
  ) THEN
    ALTER TABLE public.product_lcas
      ADD COLUMN product_description TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_lcas'
      AND column_name = 'product_image_url'
  ) THEN
    ALTER TABLE public.product_lcas
      ADD COLUMN product_image_url TEXT;
  END IF;
END $$;

COMMENT ON COLUMN public.product_lcas.product_description IS 'Detailed description of the product being assessed.';
COMMENT ON COLUMN public.product_lcas.product_image_url IS 'URL to the product image stored in Supabase Storage.';

-- ============================================================================
-- STEP 2: Add New Columns to product_lca_materials
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_lca_materials'
      AND column_name = 'unit'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN unit TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_lca_materials'
      AND column_name = 'country_of_origin'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN country_of_origin TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_lca_materials'
      AND column_name = 'is_organic'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN is_organic BOOLEAN DEFAULT false NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_lca_materials'
      AND column_name = 'is_regenerative'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN is_regenerative BOOLEAN DEFAULT false NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.product_lca_materials.unit IS 'Unit of measurement for the quantity (e.g., kg, L, units, g, ml).';
COMMENT ON COLUMN public.product_lca_materials.country_of_origin IS 'Country where the material originates or is sourced from.';
COMMENT ON COLUMN public.product_lca_materials.is_organic IS 'Whether the material has organic certification.';
COMMENT ON COLUMN public.product_lca_materials.is_regenerative IS 'Whether the material is produced using regenerative practices.';
