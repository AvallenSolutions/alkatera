/*
  # Fix Organization Members RLS Policy

  ## Problem
  The current RLS policy on `organization_members` uses `get_current_organization_id()` which:
  1. Only returns ONE organization (LIMIT 1)
  2. Creates a circular dependency
  3. Prevents users from seeing ALL their organization memberships
  
  ## Solution
  Replace the policy with a simpler one that directly checks if the user_id matches auth.uid().
  This allows users to see ALL organizations they belong to, not just one.

  ## Changes
  1. Drop the existing problematic policy
  2. Create a new policy that checks user_id = auth.uid()
  3. This allows the OrganizationContext to fetch all user memberships correctly
*/

-- Drop the existing policy that uses get_current_organization_id()
DROP POLICY IF EXISTS "Allow users to view members of their own organization" ON organization_members;

-- Create a new policy that allows users to see their own memberships
CREATE POLICY "Users can view their own memberships"
  ON organization_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON POLICY "Users can view their own memberships" ON organization_members IS 
  'Users can view all organization memberships where they are the member. This allows fetching all organizations a user belongs to without circular dependency.';

-- Also create a policy to allow viewing other members of the same organization
CREATE POLICY "Users can view other members in their organizations"
  ON organization_members
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Users can view other members in their organizations" ON organization_members IS 
  'Users can view all members of any organization they belong to. Uses a subquery to find user organizations.';
