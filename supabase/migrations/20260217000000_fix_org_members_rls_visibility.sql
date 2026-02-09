-- Fix: Allow organisation members to see all other members in their organisation.
--
-- Previously only two SELECT policies existed on organization_members:
--   1. "Allow individual user to read their own membership"  (auth.uid() = user_id)
--   2. "Users can view their own memberships"                (user_id = auth.uid())
--
-- Both restricted users to seeing ONLY their own row, which meant the
-- member_profiles view (security_invoker=true) also returned only the
-- querying user's row. The Team page therefore showed only the current
-- user instead of all team members.
--
-- IMPORTANT: RLS policies on organization_members cannot directly
-- reference the same table in a subquery — this causes infinite recursion
-- (ERROR 42P17). To break the cycle we use a SECURITY DEFINER helper
-- function that bypasses RLS when looking up org IDs for a user.
--
-- This migration:
-- 1. Creates a SECURITY DEFINER helper function `get_user_org_ids(uid)`
-- 2. Adds a policy on organization_members using that function
-- 3. Replaces the profiles SELECT policy (which depended on the unreliable
--    get_current_organization_id() JWT function) with one using the helper

-- Helper: returns org IDs for a given user, bypassing RLS on organization_members
CREATE OR REPLACE FUNCTION get_user_org_ids(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id FROM organization_members WHERE user_id = uid;
$$;

-- 1. organization_members: let members see fellow members
CREATE POLICY "Organisation members can view fellow members"
  ON organization_members
  FOR SELECT
  USING (
    organization_id IN (SELECT get_user_org_ids(auth.uid()))
  );

-- 2. profiles: replace the unreliable get_current_organization_id()-based policy
DROP POLICY IF EXISTS "Allow users to view profiles of members in their own organizati" ON profiles;

CREATE POLICY "Users can view profiles of fellow org members"
  ON profiles
  FOR SELECT
  USING (
    auth.uid() = id
    OR id IN (
      SELECT om.user_id
      FROM organization_members om
      WHERE om.organization_id IN (SELECT get_user_org_ids(auth.uid()))
    )
  );
