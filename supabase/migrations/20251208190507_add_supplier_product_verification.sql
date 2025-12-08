/*
  # Add Supplier Product Verification System

  ## Overview
  This migration adds verification fields to supplier_products table to ensure
  only Alkatera-verified supplier data appears in material search results.
  This maintains data quality and trust in primary supplier data.

  ## Changes to `supplier_products` Table

  ### New Columns:
  - `is_verified` (boolean, default false) - Whether product data has been verified by Alkatera
  - `verified_by` (uuid, nullable) - References profiles.id of Alkatera admin who verified
  - `verified_at` (timestamptz, nullable) - Timestamp of verification
  - `verification_notes` (text, nullable) - Admin notes about verification process

  ## New Helper Function
  - `is_alkatera_admin()` - Returns true if current user is an Alkatera platform administrator

  ## Security (RLS)
  - New policy allows Alkatera admins to verify products across all organizations
  - Verification fields can only be modified by Alkatera admins
  - Regular users can view verification status but cannot modify it

  ## Performance
  - Composite index on (organization_id, is_active, is_verified) for fast verified product searches
  - Index on verified_by for audit trails

  ## Data Integrity
  - Check constraint ensures verified_by is set when is_verified is true
  - Check constraint ensures verified_at is set when is_verified is true
  - Foreign key constraint links verified_by to profiles table
*/

-- ============================================================================
-- STEP 1: Add verification columns to supplier_products
-- ============================================================================

DO $$
BEGIN
  -- Add is_verified column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'is_verified'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN is_verified BOOLEAN DEFAULT false NOT NULL;
  END IF;

  -- Add verified_by column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'verified_by'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  -- Add verified_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'verified_at'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN verified_at TIMESTAMPTZ;
  END IF;

  -- Add verification_notes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'verification_notes'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN verification_notes TEXT;
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.is_verified IS
  'Whether this product has been verified by Alkatera. Only verified products appear in material search.';

COMMENT ON COLUMN public.supplier_products.verified_by IS
  'Alkatera admin who verified this product data. Required when is_verified is true.';

COMMENT ON COLUMN public.supplier_products.verified_at IS
  'Timestamp when product was verified. Required when is_verified is true.';

COMMENT ON COLUMN public.supplier_products.verification_notes IS
  'Admin notes about verification process, data quality checks performed, or issues found.';

-- ============================================================================
-- STEP 2: Add check constraints for data integrity
-- ============================================================================

-- Ensure verified_by is set when product is verified
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'verified_by_required_when_verified'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD CONSTRAINT verified_by_required_when_verified
      CHECK (
        (is_verified = false) OR
        (is_verified = true AND verified_by IS NOT NULL)
      );
  END IF;
END $$;

-- Ensure verified_at is set when product is verified
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'verified_at_required_when_verified'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD CONSTRAINT verified_at_required_when_verified
      CHECK (
        (is_verified = false) OR
        (is_verified = true AND verified_at IS NOT NULL)
      );
  END IF;
END $$;

COMMENT ON CONSTRAINT verified_by_required_when_verified
  ON public.supplier_products IS
  'Ensures verified_by is populated when product is marked as verified';

COMMENT ON CONSTRAINT verified_at_required_when_verified
  ON public.supplier_products IS
  'Ensures verified_at timestamp is populated when product is marked as verified';

-- ============================================================================
-- STEP 3: Create performance indexes
-- ============================================================================

-- Composite index for verified active products by organization (primary search query)
CREATE INDEX IF NOT EXISTS idx_supplier_products_org_active_verified
  ON public.supplier_products(organization_id, is_active, is_verified)
  WHERE is_active = true AND is_verified = true;

COMMENT ON INDEX idx_supplier_products_org_active_verified IS
  'Optimizes material search queries for verified active products by organization';

-- Index for audit trails and admin dashboard
CREATE INDEX IF NOT EXISTS idx_supplier_products_verified_by
  ON public.supplier_products(verified_by)
  WHERE verified_by IS NOT NULL;

COMMENT ON INDEX idx_supplier_products_verified_by IS
  'Optimizes queries for verification audit trails and admin activity tracking';

-- Index for unverified products (admin dashboard)
CREATE INDEX IF NOT EXISTS idx_supplier_products_unverified
  ON public.supplier_products(created_at DESC)
  WHERE is_verified = false;

COMMENT ON INDEX idx_supplier_products_unverified IS
  'Optimizes admin dashboard queries for unverified products pending approval';

-- ============================================================================
-- STEP 4: Create helper function to check Alkatera admin status
-- ============================================================================

CREATE OR REPLACE FUNCTION is_alkatera_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Check if current user is admin of Alkatera organization (slug: 'alkatera')
  -- This identifies platform super-admins who can verify supplier products
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    JOIN public.roles r ON r.id = om.role_id
    WHERE om.user_id = auth.uid()
      AND o.slug = 'alkatera'
      AND r.name IN ('owner', 'admin')
  );
END;
$$;

COMMENT ON FUNCTION is_alkatera_admin() IS
  'Returns true if current user is an Alkatera platform administrator. Used to control supplier product verification access.';

-- ============================================================================
-- STEP 5: Update RLS policies for verification
-- ============================================================================

-- Policy: Alkatera admins can update verification status on any supplier product
DROP POLICY IF EXISTS "Alkatera admins can verify supplier products" ON public.supplier_products;

CREATE POLICY "Alkatera admins can verify supplier products"
  ON public.supplier_products
  FOR UPDATE
  TO authenticated
  USING (is_alkatera_admin())
  WITH CHECK (is_alkatera_admin());

COMMENT ON POLICY "Alkatera admins can verify supplier products"
  ON public.supplier_products IS
  'Allows Alkatera platform administrators to verify supplier products across all organizations';

-- Policy: Alkatera admins can view all supplier products (for verification dashboard)
DROP POLICY IF EXISTS "Alkatera admins can view all supplier products" ON public.supplier_products;

CREATE POLICY "Alkatera admins can view all supplier products"
  ON public.supplier_products
  FOR SELECT
  TO authenticated
  USING (is_alkatera_admin());

COMMENT ON POLICY "Alkatera admins can view all supplier products"
  ON public.supplier_products IS
  'Allows Alkatera administrators to view supplier products from all organizations for verification purposes';

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

-- Existing authenticated users can already SELECT supplier_products via existing RLS
-- New policies extend access for Alkatera admins
-- No additional grants needed as policies handle access control
