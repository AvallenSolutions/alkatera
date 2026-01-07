/*
  # Fix organizations RLS policy to use public role

  1. Issue
    - Previous migration changed the policy from `public` to `authenticated` role
    - This breaks the login flow as the client uses the public role initially
    
  2. Solution
    - Update the policy to use `public` role instead of `authenticated`
    - This matches the original policy configuration
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Allow members to view their organizations" ON organizations;

-- Create the policy with public role (matching original)
CREATE POLICY "Allow members to view their organizations"
  ON organizations
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
    )
  );
