/*
  # Update Suppliers RLS for Admin-Only Access

  ## Overview
  Updates RLS policies on the suppliers table to restrict create, update, and delete
  operations to organization administrators and Alkatera platform administrators only.

  ## Changes
  1. Replace INSERT policy - Only admins and Alkatera admins can create suppliers
  2. Replace UPDATE policy - Only admins and Alkatera admins can update suppliers
  3. Replace DELETE policy - Only admins and Alkatera admins can delete suppliers
  4. Keep SELECT policy unchanged - All organization members can view suppliers

  ## Security Model
  - Organization admins (owner/admin roles) can manage suppliers in their organization
  - Alkatera platform admins can manage suppliers across all organizations
  - Regular members (member/viewer roles) have read-only access
  - Uses existing helper functions: is_organization_admin() and is_alkatera_admin()

  ## Backward Compatibility
  - SELECT access remains unchanged for all organization members
  - Only write operations are now restricted to admins
*/

-- ============================================================================
-- STEP 1: Drop existing write policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can create suppliers in their organization" ON public.suppliers;
DROP POLICY IF EXISTS "Users can update suppliers from their organization" ON public.suppliers;
DROP POLICY IF EXISTS "Users can delete suppliers from their organization" ON public.suppliers;

-- ============================================================================
-- STEP 2: Create new admin-only INSERT policy
-- ============================================================================

CREATE POLICY "Admins can create suppliers in their organization"
  ON public.suppliers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = get_current_organization_id() AND
    (is_organization_admin(get_current_organization_id()) OR is_alkatera_admin())
  );

COMMENT ON POLICY "Admins can create suppliers in their organization"
  ON public.suppliers IS
  'Only organization administrators and Alkatera platform admins can create new suppliers';

-- ============================================================================
-- STEP 3: Create new admin-only UPDATE policy
-- ============================================================================

CREATE POLICY "Admins can update suppliers from their organization"
  ON public.suppliers
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

COMMENT ON POLICY "Admins can update suppliers from their organization"
  ON public.suppliers IS
  'Only organization administrators and Alkatera platform admins can update suppliers';

-- ============================================================================
-- STEP 4: Create new admin-only DELETE policy
-- ============================================================================

CREATE POLICY "Admins can delete suppliers from their organization"
  ON public.suppliers
  FOR DELETE
  TO authenticated
  USING (
    organization_id = get_current_organization_id() AND
    (is_organization_admin(get_current_organization_id()) OR is_alkatera_admin())
  );

COMMENT ON POLICY "Admins can delete suppliers from their organization"
  ON public.suppliers IS
  'Only organization administrators and Alkatera platform admins can delete suppliers';