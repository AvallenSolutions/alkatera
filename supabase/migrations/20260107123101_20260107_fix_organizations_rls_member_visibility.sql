/*
  # Fix organizations RLS policy for member visibility

  1. Issue
    - The `is_member_of()` function uses `SECURITY DEFINER` which can cause auth context issues
    - When fetching organizations after login, users get no results despite having memberships
    - This causes the app to redirect to 'Create Your Company Account'

  2. Solution
    - Replace the RLS policy with direct membership check instead of using the problematic function
    - Use the existing policy logic but inline it for better auth context handling

  3. Changes
    - Update "Allow members to view their organizations" policy
    - Replace `is_member_of(id)` with direct join check
*/

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Allow members to view their organizations" ON organizations;

-- Create a new policy with direct membership check
CREATE POLICY "Allow members to view their organizations"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
    )
  );
