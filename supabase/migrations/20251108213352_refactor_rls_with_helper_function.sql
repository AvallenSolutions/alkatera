/*
  # Refactor RLS Policies with Helper Function

  ## Overview
  This migration refactors the Row Level Security policies to use a single, reusable
  helper function instead of complex nested subqueries. This approach:
  - Eliminates RLS recursion issues that cause 500 errors
  - Improves query performance through function result caching
  - Makes policies more maintainable and easier to understand
  - Provides a single source of truth for organization membership checks

  ## 1. Security Helper Function
    ### is_in_same_organization(user_id_to_check uuid)
      - Returns: boolean
      - Purpose: Check if the authenticated user shares an organization with another user
      - Implementation: Uses a self-join on organization_members table
      - Security: SECURITY DEFINER prevents RLS recursion
      - Performance: PostgreSQL can cache results within a query

  ## 2. Updated RLS Policies
    ### organization_members Table
      - Policy: "Allow users to view members of their own organization"
      - Simplified USING clause: is_in_same_organization(user_id)

    ### profiles Table
      - Policy: "Allow users to view profiles of members in their own organization"
      - Simplified USING clause: auth.uid() = id OR is_in_same_organization(id)

  ## 3. Key Benefits
    - No more 500 Internal Server Errors from RLS recursion
    - Consistent security logic across all tables
    - Better query performance and planning
    - Easier to audit and maintain security rules

  ## 4. Security Notes
    - SECURITY DEFINER is essential - it runs with creator's privileges
    - This bypasses RLS on organization_members during the function execution
    - Without SECURITY DEFINER, the function would trigger RLS recursion
    - The function only checks membership, not data access
*/

-- =====================================================
-- PART 1: DROP EXISTING POLICIES THAT USE THE FUNCTION
-- =====================================================

-- Drop policies that depend on the function
DROP POLICY IF EXISTS "Users can view own profile and organisation members" ON profiles;
DROP POLICY IF EXISTS "Allow users to view members of their own organization" ON organization_members;

-- =====================================================
-- PART 2: RECREATE SECURITY HELPER FUNCTION
-- =====================================================

-- Drop existing function with CASCADE to handle any remaining dependencies
DROP FUNCTION IF EXISTS is_in_same_organization(uuid) CASCADE;

-- Create the security helper function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION is_in_same_organization(user_id_to_check uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Return true if the authenticated user and the checked user
  -- share at least one common organization
  RETURN EXISTS (
    SELECT 1
    FROM organization_members om1
    JOIN organization_members om2 
      ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
      AND om2.user_id = user_id_to_check
  );
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION is_in_same_organization(uuid) IS 
  'Checks if the authenticated user shares at least one organization with the specified user. Uses SECURITY DEFINER to prevent RLS recursion.';

-- =====================================================
-- PART 3: CREATE ORGANIZATION_MEMBERS SELECT POLICY
-- =====================================================

-- Create simplified policy using helper function
CREATE POLICY "Allow users to view members of their own organization"
  ON organization_members
  FOR SELECT
  TO authenticated
  USING (
    is_in_same_organization(user_id)
  );

-- =====================================================
-- PART 4: CREATE PROFILES SELECT POLICY
-- =====================================================

-- Create simplified policy using helper function
-- Note: Users can view their own profile OR profiles in same organization
CREATE POLICY "Allow users to view profiles of members in their own organization"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id 
    OR is_in_same_organization(id)
  );
