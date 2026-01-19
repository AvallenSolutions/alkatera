/*
  # Fix Products Table RLS Policies

  ## Problem
  The products table RLS policies use EXISTS subqueries that check organization_members directly.
  This causes a 403 Forbidden error on INSERT because:
  1. The EXISTS check triggers RLS on organization_members
  2. The organization_members RLS can cause recursion or permission issues
  3. Users get 403 errors even when they are legitimate members

  ## Solution
  Update all products table RLS policies to use `get_current_organization_id()` which is
  the single source of truth for multi-tenancy checks. This function:
  - Uses SECURITY DEFINER to bypass RLS (no recursion)
  - Returns the current user's organization_id
  - Is already used by other tables in the codebase

  ## Changes
  1. Drop existing products RLS policies
  2. Recreate policies using get_current_organization_id()
*/

-- =====================================================
-- DROP EXISTING POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view products in their organization" ON public.products;
DROP POLICY IF EXISTS "Users can insert products in their organization" ON public.products;
DROP POLICY IF EXISTS "Users can update products in their organization" ON public.products;
DROP POLICY IF EXISTS "Users can delete products in their organization" ON public.products;

-- =====================================================
-- CREATE NEW POLICIES USING get_current_organization_id()
-- =====================================================

-- SELECT policy: Users can view products in their organization
CREATE POLICY "Users can view products in their organization"
ON public.products
FOR SELECT
TO authenticated
USING (
  organization_id = get_current_organization_id()
);

-- INSERT policy: Users can create products in their organization
CREATE POLICY "Users can insert products in their organization"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_current_organization_id()
);

-- UPDATE policy: Users can update products in their organization
CREATE POLICY "Users can update products in their organization"
ON public.products
FOR UPDATE
TO authenticated
USING (
  organization_id = get_current_organization_id()
)
WITH CHECK (
  organization_id = get_current_organization_id()
);

-- DELETE policy: Users can delete products in their organization
CREATE POLICY "Users can delete products in their organization"
ON public.products
FOR DELETE
TO authenticated
USING (
  organization_id = get_current_organization_id()
);

-- =====================================================
-- ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON POLICY "Users can view products in their organization" ON public.products IS
  'Users can view products that belong to their organization. Uses get_current_organization_id() as single source of truth.';

COMMENT ON POLICY "Users can insert products in their organization" ON public.products IS
  'Users can create products in their organization. Uses get_current_organization_id() to prevent RLS recursion.';

COMMENT ON POLICY "Users can update products in their organization" ON public.products IS
  'Users can update products in their organization. Uses get_current_organization_id() as single source of truth.';

COMMENT ON POLICY "Users can delete products in their organization" ON public.products IS
  'Users can delete products in their organization. Uses get_current_organization_id() as single source of truth.';
