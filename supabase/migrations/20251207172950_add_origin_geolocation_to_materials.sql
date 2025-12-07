/*
  # Add Origin Geolocation to Materials

  1. Changes to Tables
    - Add origin geolocation fields to `product_lca_materials` table
      - `origin_address` (text) - Full formatted address from Google Places
      - `origin_lat` (float8) - Latitude coordinate for origin location
      - `origin_lng` (float8) - Longitude coordinate for origin location
      - `origin_country_code` (text) - ISO country code (e.g., "GB", "DE", "FR")

    - Add origin geolocation fields to `supplier_products` table
      - Same fields as above for supplier-level default locations

  2. Performance
    - Indexes on lat/lng for spatial queries and distance calculations
    - Enable efficient geospatial filtering and transport calculations

  3. Notes
    - All new fields are nullable for backward compatibility
    - Coordinates enable automated distance calculations
    - Address provides human-readable location for reports
    - Country code supports compliance reporting and filtering
*/

-- ============================================================================
-- STEP 1: Add origin geolocation fields to product_lca_materials
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'origin_address'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN origin_address TEXT;

    COMMENT ON COLUMN public.product_lca_materials.origin_address IS
      'Full formatted address from Google Places (e.g., "Munich, Bavaria, Germany"). Human-readable location for reports.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'origin_lat'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN origin_lat FLOAT8;

    COMMENT ON COLUMN public.product_lca_materials.origin_lat IS
      'Latitude coordinate for origin location (required for automated distance calculations). Range: -90 to 90.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'origin_lng'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN origin_lng FLOAT8;

    COMMENT ON COLUMN public.product_lca_materials.origin_lng IS
      'Longitude coordinate for origin location (required for automated distance calculations). Range: -180 to 180.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'origin_country_code'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN origin_country_code TEXT;

    COMMENT ON COLUMN public.product_lca_materials.origin_country_code IS
      'ISO country code (e.g., "GB", "DE", "FR") for filtering and compliance reporting.';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Add origin geolocation fields to supplier_products
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'supplier_products'
    AND column_name = 'origin_address'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN origin_address TEXT;

    COMMENT ON COLUMN public.supplier_products.origin_address IS
      'Default origin address for this supplier product. Can be overridden at material level.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'supplier_products'
    AND column_name = 'origin_lat'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN origin_lat FLOAT8;

    COMMENT ON COLUMN public.supplier_products.origin_lat IS
      'Default latitude for this supplier product origin.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'supplier_products'
    AND column_name = 'origin_lng'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN origin_lng FLOAT8;

    COMMENT ON COLUMN public.supplier_products.origin_lng IS
      'Default longitude for this supplier product origin.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'supplier_products'
    AND column_name = 'origin_country_code'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN origin_country_code TEXT;

    COMMENT ON COLUMN public.supplier_products.origin_country_code IS
      'Default ISO country code for this supplier product.';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Create indexes for spatial queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_product_lca_materials_origin_location
  ON public.product_lca_materials(origin_lat, origin_lng)
  WHERE origin_lat IS NOT NULL AND origin_lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_products_origin_location
  ON public.supplier_products(origin_lat, origin_lng)
  WHERE origin_lat IS NOT NULL AND origin_lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_lca_materials_origin_country_code
  ON public.product_lca_materials(origin_country_code)
  WHERE origin_country_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_products_origin_country_code
  ON public.supplier_products(origin_country_code)
  WHERE origin_country_code IS NOT NULL;

-- ============================================================================
-- STEP 4: Add validation constraints
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'valid_origin_lat'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD CONSTRAINT valid_origin_lat
      CHECK (origin_lat IS NULL OR (origin_lat >= -90 AND origin_lat <= 90));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'valid_origin_lng'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD CONSTRAINT valid_origin_lng
      CHECK (origin_lng IS NULL OR (origin_lng >= -180 AND origin_lng <= 180));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_supplier_origin_lat'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD CONSTRAINT valid_supplier_origin_lat
      CHECK (origin_lat IS NULL OR (origin_lat >= -90 AND origin_lat <= 90));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_supplier_origin_lng'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD CONSTRAINT valid_supplier_origin_lng
      CHECK (origin_lng IS NULL OR (origin_lng >= -180 AND origin_lng <= 180));
  END IF;
END $$;
