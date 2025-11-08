/*
  # Finalize RLS Hardening with Security Helper Function

  ## Overview
  This migration completes the RLS hardening process by replacing the subquery-based
  policy on the organizations table with a dedicated SECURITY DEFINER helper function.
  This eliminates the final potential RLS recursion loop and creates a consistent,
  robust multi-tenancy architecture.

  ## Problem Being Solved
  The current organizations SELECT policy uses a subquery:
    `id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())`
  
  This can cause RLS recursion if organization_members RLS policies become complex,
  because checking organizations triggers a query to organization_members, which may
  need to check organizations again.

  ## Solution
  Create a dedicated SECURITY DEFINER function that bypasses RLS when checking
  organization membership. This breaks the recursion cycle.

  ## 1. New Security Helper Function
    ### is_member_of_organization(organization_id_to_check uuid)
      - Returns: boolean
      - Purpose: Check if the authenticated user is a member of a specific organization
      - Implementation: Direct EXISTS query on organization_members
      - Security: SECURITY DEFINER bypasses RLS to prevent recursion
      - Language: SQL (more efficient than plpgsql for simple queries)

  ## 2. Updated organizations RLS Policy
    ### SELECT Policy
      - Name: "Allow members to view their own organization"
      - Simplified USING clause: is_member_of_organization(id)
      - No more subqueries in RLS policies
      - Clean, maintainable, and performant

  ## 3. Architecture Benefits
    - **No RLS Recursion**: SECURITY DEFINER breaks recursion cycles
    - **Consistent Pattern**: All tables now use helper functions
    - **Performance**: PostgreSQL can inline and cache SQL functions
    - **Maintainability**: Single source of truth for membership checks
    - **Auditable**: Clear security logic in one place

  ## 4. Security Helper Functions Summary
    After this migration, we have two security helper functions:
    - `is_in_same_organization(user_id)`: Check if two users share an organization
    - `is_member_of_organization(org_id)`: Check if user is member of specific org

  ## 5. Complete RLS Coverage
    All critical tables now use SECURITY DEFINER functions:
    - profiles: uses is_in_same_organization()
    - organization_members: uses is_in_same_organization()
    - organizations: uses is_member_of_organization()
*/

-- =====================================================
-- PART 1: CREATE SECURITY HELPER FUNCTION
-- =====================================================

-- Create the new security helper function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION is_member_of_organization(organization_id_to_check uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_id = organization_id_to_check
      AND user_id = auth.uid()
  );
$$;

-- Add comment for documentation
COMMENT ON FUNCTION is_member_of_organization(uuid) IS 
  'Checks if the authenticated user is a member of the specified organization. Uses SECURITY DEFINER to prevent RLS recursion. Returns true if user is a member, false otherwise.';

-- =====================================================
-- PART 2: REPLACE ORGANIZATIONS SELECT POLICY
-- =====================================================

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Allow members to view their own organization" ON organizations;

-- Create new simplified SELECT policy using helper function
CREATE POLICY "Allow members to view their own organization"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (
    is_member_of_organization(id)
  );

-- Add policy comment for documentation
COMMENT ON POLICY "Allow members to view their own organization" ON organizations IS 
  'Users can only view organizations where they are members. Uses is_member_of_organization() helper to prevent RLS recursion.';

-- =====================================================
-- VERIFICATION: Ensure RLS is properly configured
-- =====================================================

-- Ensure RLS is enabled and forced on organizations table
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
