/*
  # Update Profile Visibility RLS Policy

  ## Overview
  This migration updates the Row Level Security policy on the profiles table to allow
  users to view profiles of other members within the same organisation.

  ## 1. Helper Function
    - `is_in_same_organization(profile_user_id uuid)`: Returns boolean
      - Checks if the current user shares at least one organisation with the specified user
      - Returns true if they're in the same organisation, false otherwise

  ## 2. Updated RLS Policy
    ### profiles Table - SELECT Policy
      - Updated: Users can now view their own profile OR profiles of users in the same organisation
      - Old: `auth.uid() = id` (only own profile)
      - New: `(auth.uid() = id) OR (is_in_same_organization(id) = true)`

  ## 3. Security Considerations
    - Users can only see profiles of members in organisations they belong to
    - No cross-organisation profile visibility
    - Maintains data privacy whilst enabling team collaboration
*/

-- Create helper function to check if users share an organisation
CREATE OR REPLACE FUNCTION is_in_same_organization(profile_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM organization_members om1
    JOIN organization_members om2 
      ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
      AND om2.user_id = profile_user_id
  );
END;
$$;

-- Drop the existing SELECT policy on profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Create updated SELECT policy allowing organisation-wide visibility
CREATE POLICY "Users can view own profile and organisation members"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id 
    OR is_in_same_organization(id) = true
  );