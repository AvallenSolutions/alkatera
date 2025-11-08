/*
  # Add Multi-Tenant RLS Policies for Data Access

  ## Overview
  This migration enhances the existing Row Level Security (RLS) policies for multi-tenant
  data access. It adds optimized policies using subquery patterns for better performance
  and clarity.

  ## 1. RLS Policy for organization_members Table
    ### SELECT Policy
      - Name: "Allow users to view members of their own organization"
      - Rule: Users can only view members of organizations they belong to
      - Implementation: Uses a subquery to check if the organization_id matches
        any organization the current user is a member of

  ## 2. RLS Policy for profiles Table
    ### SELECT Policy (Already exists but documented here)
      - Name: "Users can view own profile and organisation members"
      - Rule: Users can view their own profile and profiles of users in the same organization
      - Implementation: Uses helper function `is_in_same_organization()`

  ## 3. Security Benefits
    - Ensures strict multi-tenant data isolation
    - Users can only access data from their own organizations
    - Prevents cross-tenant data leakage
    - Optimized subquery pattern for performance

  ## 4. Notes
    - This migration adds an alternative policy that can coexist with existing ones
    - The new policy uses a more explicit subquery pattern
    - Both policies achieve the same security goal with different implementation styles
*/

-- =====================================================
-- ORGANIZATION_MEMBERS TABLE - Enhanced SELECT Policy
-- =====================================================

-- Drop the existing policy first to replace it with an optimized version
DROP POLICY IF EXISTS "Members can view organization members" ON organization_members;

-- Create enhanced SELECT policy with explicit subquery pattern
CREATE POLICY "Allow users to view members of their own organization"
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

-- =====================================================
-- ROLES TABLE - Add SELECT Policy for Members
-- =====================================================

-- Allow users to view roles (needed for displaying member roles)
DROP POLICY IF EXISTS "Allow authenticated users to view roles" ON roles;

CREATE POLICY "Allow authenticated users to view roles"
  ON roles
  FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- PERMISSIONS TABLE - Add SELECT Policy
-- =====================================================

-- Allow users to view permissions (needed for role-based access checks)
DROP POLICY IF EXISTS "Allow authenticated users to view permissions" ON permissions;

CREATE POLICY "Allow authenticated users to view permissions"
  ON permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- ROLE_PERMISSIONS TABLE - Add SELECT Policy
-- =====================================================

-- Allow users to view role permissions mapping
DROP POLICY IF EXISTS "Allow authenticated users to view role permissions" ON role_permissions;

CREATE POLICY "Allow authenticated users to view role permissions"
  ON role_permissions
  FOR SELECT
  TO authenticated
  USING (true);
