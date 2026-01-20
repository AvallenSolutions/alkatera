/*
  # Fix organizations RLS policy to allow advisor access

  ## Issue
  The current organizations RLS policy only allows users to view organizations
  where they are members (in organization_members table). Advisors are stored
  in advisor_organization_access table instead, so they cannot read the
  organizations they have access to.

  ## Solution
  Update the "Allow members to view their organizations" policy to also check
  for advisor access via the advisor_organization_access table.
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Allow members to view their organizations" ON organizations;

-- Create the updated policy that includes advisor access
CREATE POLICY "Allow members to view their organizations"
  ON organizations
  FOR SELECT
  TO public
  USING (
    -- Regular organization members
    EXISTS (
      SELECT 1
      FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
    )
    OR
    -- Advisors with active access
    EXISTS (
      SELECT 1
      FROM advisor_organization_access
      WHERE advisor_organization_access.organization_id = organizations.id
      AND advisor_organization_access.advisor_user_id = auth.uid()
      AND advisor_organization_access.is_active = true
    )
  );
