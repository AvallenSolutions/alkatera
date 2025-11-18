/*
  # Fix Infinite Recursion in organization_members RLS

  1. Problem
    - The policy "Users can view other members in their organizations" causes infinite recursion
    - It queries organization_members inside an RLS policy FOR organization_members
    - This creates a circular dependency that crashes queries

  2. Solution
    - Drop the problematic policy
    - Keep "Users can view their own memberships" which is sufficient
    - Users only need to see their own memberships to determine which organizations they belong to

  3. Security
    - Users can still view their own memberships (user_id = auth.uid())
    - This is sufficient for the application to determine organization access
*/

-- Drop the policy causing infinite recursion
DROP POLICY IF EXISTS "Users can view other members in their organizations" ON organization_members;

-- The remaining policies are sufficient:
-- 1. "Users can view their own memberships" - allows users to see which orgs they belong to
-- 2. "Allow individual user to read their own membership" - duplicate but harmless
-- 3. Admin policies for INSERT/UPDATE/DELETE - work fine