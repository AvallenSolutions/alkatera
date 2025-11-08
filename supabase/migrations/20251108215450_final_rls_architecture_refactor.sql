/*
  # Final RLS Architecture Refactor - Single Source of Truth

  ## Overview
  This migration completely refactors the RLS security architecture to use a single
  "getter" function as the source of truth for all multi-tenancy checks. This design:
  - Eliminates ALL RLS recursion by using a non-recursive base function
  - Simplifies the security model with one function to maintain
  - Resolves "Failed to load team members" errors caused by recursion
  - Creates a clear, auditable security architecture

  ## Problem Being Solved
  Previous architecture had multiple helper functions calling each other:
  - is_in_same_organization() checked organization_members
  - is_member_of_organization() checked organization_members
  - Both could trigger RLS on organization_members, causing recursion
  - Complex web of dependencies made debugging difficult

  ## New Architecture
  Single source of truth: get_current_organization_id()
  - Returns the organization_id for the current user
  - No RLS checks needed (SECURITY DEFINER bypasses RLS)
  - All policies compare against this single value
  - No recursion possible - it's a simple getter

  ## Migration Steps

  ### Part 1: Remove Old Functions
    - Drop is_in_same_organization(uuid)
    - Drop is_member_of_organization(uuid)

  ### Part 2: Create New Single Source of Truth
    - Create get_current_organization_id()
    - Returns uuid of user's organization
    - SECURITY DEFINER bypasses RLS
    - SET search_path for security

  ### Part 3: Rebuild All RLS Policies
    #### organizations table
      - Policy: "Allow members to view their own organization"
      - Logic: id = get_current_organization_id()
      - Simple equality check against user's org

    #### organization_members table
      - Policy: "Allow users to view members of their own organization"
      - Logic: organization_id = get_current_organization_id()
      - Shows all members in user's org

    #### profiles table
      - Policy: "Allow users to view profiles of members in their own organization"
      - Logic: id IN (SELECT user_id FROM organization_members WHERE organization_id = get_current_organization_id())
      - Shows profiles of all users in the same org

  ## Security Guarantees
    - No RLS recursion possible
    - Multi-tenant isolation strictly enforced
    - Users see only their organization's data
    - Performance optimized with simple comparisons
    - Single function to audit and maintain

  ## Testing Checklist
    - [ ] User can view their own organization
    - [ ] User can view members in their organization
    - [ ] User can view profiles of members in their organization
    - [ ] User cannot view other organizations
    - [ ] User cannot view members of other organizations
    - [ ] User cannot view profiles of users in other organizations
    - [ ] No 500 errors from RLS recursion
*/

-- =====================================================
-- PART 1: REMOVE OLD HELPER FUNCTIONS
-- =====================================================

-- Drop existing policies that depend on these functions first
DROP POLICY IF EXISTS "Allow users to view members of their own organization" ON organization_members;
DROP POLICY IF EXISTS "Allow members to view their own organization" ON organizations;
DROP POLICY IF EXISTS "Allow users to view profiles of members in their own organizati" ON profiles;
DROP POLICY IF EXISTS "Allow users to view profiles of members in their own organization" ON profiles;

-- Now drop the old functions with CASCADE to handle any remaining dependencies
DROP FUNCTION IF EXISTS public.is_in_same_organization(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_member_of_organization(uuid) CASCADE;

-- =====================================================
-- PART 2: CREATE NEW SINGLE SOURCE OF TRUTH FUNCTION
-- =====================================================

-- Create the function in the public schema
-- This is the ONLY function that queries organization_members for RLS purposes
-- All RLS policies will use this function, creating a single source of truth
CREATE OR REPLACE FUNCTION public.get_current_organization_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- Add comprehensive documentation
COMMENT ON FUNCTION public.get_current_organization_id() IS 
  'Returns the organization_id for the currently authenticated user. This is the single source of truth for all multi-tenancy RLS checks. Uses SECURITY DEFINER to bypass RLS and prevent recursion. Returns NULL if user is not a member of any organization.';

-- =====================================================
-- PART 3: REBUILD ORGANIZATIONS TABLE RLS POLICY
-- =====================================================

-- Create new simplified SELECT policy for organizations
CREATE POLICY "Allow members to view their own organization"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (
    id = get_current_organization_id()
  );

COMMENT ON POLICY "Allow members to view their own organization" ON organizations IS 
  'Users can only view the organization they belong to. Uses get_current_organization_id() as single source of truth.';

-- =====================================================
-- PART 4: REBUILD ORGANIZATION_MEMBERS TABLE RLS POLICY
-- =====================================================

-- Create new simplified SELECT policy for organization_members
CREATE POLICY "Allow users to view members of their own organization"
  ON organization_members
  FOR SELECT
  TO authenticated
  USING (
    organization_id = get_current_organization_id()
  );

COMMENT ON POLICY "Allow users to view members of their own organization" ON organization_members IS 
  'Users can view all members in their organization. Uses get_current_organization_id() as single source of truth.';

-- =====================================================
-- PART 5: REBUILD PROFILES TABLE RLS POLICY
-- =====================================================

-- Create new SELECT policy for profiles
-- Users can view their own profile OR profiles of members in their organization
CREATE POLICY "Allow users to view profiles of members in their own organization"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id 
    OR id IN (
      SELECT user_id 
      FROM organization_members 
      WHERE organization_id = get_current_organization_id()
    )
  );

COMMENT ON POLICY "Allow users to view profiles of members in their own organization" ON profiles IS 
  'Users can view their own profile and profiles of all members in their organization. Uses get_current_organization_id() as single source of truth.';

-- =====================================================
-- VERIFICATION: Ensure RLS is properly enabled
-- =====================================================

-- Ensure RLS is enabled on all critical tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Force RLS (no superuser bypass) for maximum security
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;
