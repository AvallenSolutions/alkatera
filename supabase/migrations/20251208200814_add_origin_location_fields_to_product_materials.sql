/*
  # Add Origin Location Fields to Product Materials

  1. Changes to Tables
    - Add location tracking fields to `product_materials` table for supply chain mapping
      - `origin_lat` (numeric) - Latitude coordinate of material origin
      - `origin_lng` (numeric) - Longitude coordinate of material origin
      - `origin_address` (text) - Full address of material origin
      - `origin_country_code` (text) - ISO 3166-1 alpha-2 country code

  2. Performance
    - Index on origin coordinates for geospatial queries
    - Enable efficient supply chain mapping and visualization

  3. Notes
    - All new fields are nullable for backward compatibility
    - Latitude must be between -90 and 90
    - Longitude must be between -180 and 180
    - Both lat/lng should be specified together for valid locations
    - Supports the Supply Chain Network Map feature
*/

-- ============================================================================
-- STEP 1: Add origin latitude field to product_materials
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_materials'
    AND column_name = 'origin_lat'
  ) THEN
    ALTER TABLE public.product_materials
      ADD COLUMN origin_lat NUMERIC CHECK (origin_lat IS NULL OR (origin_lat >= -90 AND origin_lat <= 90));

    COMMENT ON COLUMN public.product_materials.origin_lat IS
      'Latitude coordinate of material origin. Must be between -90 and 90 degrees.';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Add origin longitude field to product_materials
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_materials'
    AND column_name = 'origin_lng'
  ) THEN
    ALTER TABLE public.product_materials
      ADD COLUMN origin_lng NUMERIC CHECK (origin_lng IS NULL OR (origin_lng >= -180 AND origin_lng <= 180));

    COMMENT ON COLUMN public.product_materials.origin_lng IS
      'Longitude coordinate of material origin. Must be between -180 and 180 degrees.';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Add origin address field to product_materials
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_materials'
    AND column_name = 'origin_address'
  ) THEN
    ALTER TABLE public.product_materials
      ADD COLUMN origin_address TEXT;

    COMMENT ON COLUMN public.product_materials.origin_address IS
      'Full address of material origin location for supply chain mapping.';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Add origin country code field to product_materials
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_materials'
    AND column_name = 'origin_country_code'
  ) THEN
    ALTER TABLE public.product_materials
      ADD COLUMN origin_country_code TEXT CHECK (origin_country_code IS NULL OR LENGTH(origin_country_code) = 2);

    COMMENT ON COLUMN public.product_materials.origin_country_code IS
      'ISO 3166-1 alpha-2 country code (2 letters) for material origin country.';
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Create indexes for geospatial queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_product_materials_origin_location
  ON public.product_materials(origin_lat, origin_lng)
  WHERE origin_lat IS NOT NULL AND origin_lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_materials_origin_country
  ON public.product_materials(origin_country_code)
  WHERE origin_country_code IS NOT NULL;

-- ============================================================================
-- STEP 6: Add validation constraint for location data completeness
-- ============================================================================

-- Ensure if one coordinate is specified, both must be specified
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'origin_coordinates_completeness'
  ) THEN
    ALTER TABLE public.product_materials
      ADD CONSTRAINT origin_coordinates_completeness
      CHECK (
        (origin_lat IS NULL AND origin_lng IS NULL) OR
        (origin_lat IS NOT NULL AND origin_lng IS NOT NULL)
      );
  END IF;
END $$;

COMMENT ON CONSTRAINT origin_coordinates_completeness ON public.product_materials IS
  'Ensures origin_lat and origin_lng are either both NULL or both specified for valid geolocation data.';
