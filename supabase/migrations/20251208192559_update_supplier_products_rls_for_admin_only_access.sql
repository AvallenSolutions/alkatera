/*
  # Update Supplier Products RLS for Admin-Only Access

  ## Overview
  Updates RLS policies on supplier_products table to restrict create and delete
  operations to organization administrators and Alkatera platform administrators only.
  
  Update operations are split:
  - Verification fields can only be updated by Alkatera admins (existing policy)
  - All other fields can be updated by organization admins or Alkatera admins

  ## Changes
  1. Replace INSERT policy - Only admins and Alkatera admins can create products
  2. Replace UPDATE policy - Only admins and Alkatera admins can update product data
  3. Replace DELETE policy - Only admins and Alkatera admins can delete products
  4. Keep SELECT policies unchanged - All organization members and Alkatera admins can view
  5. Keep verification policy unchanged - Alkatera admins can verify products

  ## Security Model
  - Organization admins (owner/admin roles) can manage products for their suppliers
  - Alkatera platform admins can manage products across all organizations
  - Alkatera admins can also update verification fields (existing policy)
  - Regular members (member/viewer roles) have read-only access

  ## Existing Policies (Unchanged)
  - "Alkatera admins can verify supplier products" - Allows verification field updates
  - "Alkatera admins can view all supplier products" - Cross-organization viewing for admins
*/

-- ============================================================================
-- STEP 1: Drop existing write policies for regular users
-- ============================================================================

DROP POLICY IF EXISTS "Users can create supplier products in their organization" ON public.supplier_products;
DROP POLICY IF EXISTS "Users can update supplier products from their organization" ON public.supplier_products;
DROP POLICY IF EXISTS "Users can delete supplier products from their organization" ON public.supplier_products;

-- ============================================================================
-- STEP 2: Create new admin-only INSERT policy
-- ============================================================================

CREATE POLICY "Admins can create supplier products in their organization"
  ON public.supplier_products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_current_organization_id() AND
    (is_organization_admin(get_current_organization_id()) OR is_alkatera_admin())
  );

COMMENT ON POLICY "Admins can create supplier products in their organization"
  ON public.supplier_products IS
  'Only organization administrators and Alkatera platform admins can create new supplier products';

-- ============================================================================
-- STEP 3: Create new admin-only UPDATE policy (for non-verification fields)
-- ============================================================================

CREATE POLICY "Admins can update supplier products from their organization"
  ON public.supplier_products
  FOR UPDATE
  TO authenticated
  USING (
    organization_id = get_current_organization_id() AND
    (is_organization_admin(get_current_organization_id()) OR is_alkatera_admin())
  )
  WITH CHECK (
    organization_id = get_current_organization_id() AND
    (is_organization_admin(get_current_organization_id()) OR is_alkatera_admin())
  );

COMMENT ON POLICY "Admins can update supplier products from their organization"
  ON public.supplier_products IS
  'Only organization administrators and Alkatera platform admins can update supplier products. Note: Alkatera admins can also update verification fields via separate policy.';

-- ============================================================================
-- STEP 4: Create new admin-only DELETE policy
-- ============================================================================

CREATE POLICY "Admins can delete supplier products from their organization"
  ON public.supplier_products
  FOR DELETE
  TO authenticated
  USING (
    organization_id = get_current_organization_id() AND
    (is_organization_admin(get_current_organization_id()) OR is_alkatera_admin())
  );

COMMENT ON POLICY "Admins can delete supplier products from their organization"
  ON public.supplier_products IS
  'Only organization administrators and Alkatera platform admins can delete supplier products';

-- ============================================================================
-- NOTE: Existing policies remain unchanged
-- ============================================================================
-- 
-- These policies continue to work as before:
--
-- 1. "Users can view supplier products from their organization"
--    - All authenticated organization members can SELECT their products
--
-- 2. "Alkatera admins can view all supplier products"
--    - Alkatera admins can SELECT across all organizations
--
-- 3. "Alkatera admins can verify supplier products"
--    - Alkatera admins can UPDATE verification fields across all organizations
--
-- The new admin-only policies work alongside these existing policies.