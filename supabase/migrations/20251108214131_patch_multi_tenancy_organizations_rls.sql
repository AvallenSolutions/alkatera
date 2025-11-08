/*
  # Patch Multi-Tenancy Data Leak in Organizations Table

  ## Overview
  This migration closes a critical security vulnerability by ensuring the organizations
  table has a robust RLS policy that strictly prevents users from viewing organizations
  they don't belong to. This is essential for multi-tenant data isolation.

  ## Security Issue
  Without proper RLS on the organizations table, users could potentially:
  - View organization names and details of organizations they don't belong to
  - Access organization IDs that could be used in other queries
  - Leak sensitive business information across tenant boundaries

  ## 1. RLS Policy for organizations Table
    ### SELECT Policy
      - Name: "Allow members to view their own organization"
      - Rule: Users can ONLY view organizations where they are a member
      - Implementation: Uses explicit subquery pattern for maximum clarity
      - Pattern: id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())

  ## 2. Why This Pattern
    - **Explicit**: Clearly shows the membership check
    - **Direct**: No joins needed, just a simple IN clause
    - **Efficient**: PostgreSQL optimizes IN (SELECT ...) queries well
    - **Safe**: Cannot leak data from organizations user doesn't belong to

  ## 3. Security Guarantee
    After this migration:
    - Users can ONLY see organizations they are members of
    - No organization data leaks across tenant boundaries
    - Organization list queries return only user's organizations
    - Failed attempts to access other orgs return zero rows (not errors)

  ## 4. Testing Checklist
    - [ ] User A cannot see User B's organization if they don't share it
    - [ ] User can see all organizations they belong to
    - [ ] Organization queries return consistent results
    - [ ] No 500 errors from RLS recursion
*/

-- =====================================================
-- PART 1: REPLACE ORGANIZATIONS SELECT POLICY
-- =====================================================

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Organization members can view their organizations" ON organizations;

-- Create the new SELECT policy with explicit membership check
CREATE POLICY "Allow members to view their own organization"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id 
      FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Add comment for documentation
COMMENT ON POLICY "Allow members to view their own organization" ON organizations IS 
  'Ensures users can only view organizations where they are a member. Critical for multi-tenant data isolation.';

-- =====================================================
-- VERIFY RLS IS ENABLED
-- =====================================================

-- Ensure RLS is enabled on the organizations table
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Make RLS mandatory (FORCE) - no superuser bypass
-- This is optional but recommended for maximum security
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
