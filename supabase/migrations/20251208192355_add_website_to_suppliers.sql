/*
  # Add Website Field to Suppliers Table

  ## Overview
  Adds a website field to the suppliers table to store supplier website URLs
  for improved contact information and supplier profile completeness.

  ## Changes
  1. New Column
    - `website` (text, nullable) - Supplier company website URL
    - Optional URL validation check constraint
    - Index for search functionality

  ## Security
  - No RLS changes needed - inherits existing supplier table policies
  - Website field is optional and can be null

  ## Data Migration
  - Existing suppliers will have null website (acceptable)
  - Backward compatible with existing data
*/

-- ============================================================================
-- STEP 1: Add website column to suppliers table
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'suppliers' AND column_name = 'website'
  ) THEN
    ALTER TABLE public.suppliers
      ADD COLUMN website TEXT;
  END IF;
END $$;

COMMENT ON COLUMN public.suppliers.website IS 
  'Supplier company website URL for contact and reference';

-- ============================================================================
-- STEP 2: Add optional URL validation constraint
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'valid_website_url'
    AND table_name = 'suppliers'
  ) THEN
    ALTER TABLE public.suppliers
      ADD CONSTRAINT valid_website_url 
      CHECK (
        website IS NULL OR 
        website ~* '^https?://[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*)*(\.[a-zA-Z]{2,})(:[0-9]{1,5})?(/.*)?$' OR
        website ~* '^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*)*(\.[a-zA-Z]{2,})(:[0-9]{1,5})?(/.*)?$'
      );
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Create index for website search
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_suppliers_website
  ON public.suppliers(website)
  WHERE website IS NOT NULL;