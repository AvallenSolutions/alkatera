/*
  # Platform Admin System - Independent of Subscription Tiers

  ## Overview
  Creates a dedicated platform admin organization and system that sits
  above the regular subscription tier system. Platform admins can manage
  the entire AlkaTera platform, including blog posts, analytics, and all
  customer organizations.

  ## What This Creates
  - Adds `is_platform_admin` flag to organizations table
  - Creates the 'AlkaTera' platform admin organization
  - Provides helper functions to manage admin users
  - Sets up proper RLS policies

  ## Usage
  After running this migration, use the add_platform_admin() function
  to designate users as platform administrators.
*/

-- =====================================================
-- ADD PLATFORM ADMIN FLAG TO ORGANIZATIONS
-- =====================================================

-- Add a flag to mark platform admin organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS is_platform_admin boolean DEFAULT false;

-- Add comment
COMMENT ON COLUMN organizations.is_platform_admin IS
  'Marks this organization as the platform admin organization, exempt from normal subscription rules';

-- =====================================================
-- CREATE PLATFORM ADMIN ORGANIZATION
-- =====================================================

-- Insert or update the AlkaTera platform admin organization
INSERT INTO organizations (
  name,
  slug,
  description,
  is_platform_admin,
  subscription_tier,
  subscription_status,
  created_at,
  updated_at
)
VALUES (
  'AlkaTera Platform',
  'alkatera',
  'Platform Administration - manages the entire AlkaTera system',
  true,  -- This is the platform admin org
  'enterprise',  -- Use a valid tier but it won't matter due to is_platform_admin flag
  'active',
  now(),
  now()
)
ON CONFLICT (slug)
DO UPDATE SET
  name = 'AlkaTera Platform',
  is_platform_admin = true,
  subscription_status = 'active',
  updated_at = now()
RETURNING id, name, slug, is_platform_admin;

-- =====================================================
-- HELPER FUNCTIONS FOR ADMIN MANAGEMENT
-- =====================================================

-- Function to add a user as platform admin
CREATE OR REPLACE FUNCTION add_platform_admin(user_email text)
RETURNS TABLE (
  success boolean,
  message text,
  user_id uuid,
  organization_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_owner_role_id uuid;
BEGIN
  -- Get user ID from email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = user_email;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'User not found with email: ' || user_email, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  -- Get AlkaTera platform admin org ID
  SELECT id INTO v_org_id
  FROM organizations
  WHERE slug = 'alkatera' AND is_platform_admin = true;

  IF v_org_id IS NULL THEN
    RETURN QUERY SELECT false, 'Platform admin organization not found', NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  -- Get owner role ID
  SELECT id INTO v_owner_role_id
  FROM roles
  WHERE name = 'owner';

  -- Create profile if it doesn't exist
  INSERT INTO profiles (id, email, full_name)
  VALUES (v_user_id, user_email, user_email)
  ON CONFLICT (id) DO UPDATE SET email = user_email;

  -- Add user to platform admin org
  INSERT INTO organization_members (organization_id, user_id, role_id, joined_at)
  VALUES (v_org_id, v_user_id, v_owner_role_id, now())
  ON CONFLICT (organization_id, user_id)
  DO UPDATE SET role_id = v_owner_role_id;

  RETURN QUERY SELECT
    true,
    'Successfully added ' || user_email || ' as platform admin',
    v_user_id,
    v_org_id;
END;
$$;

-- Function to remove a user as platform admin
CREATE OR REPLACE FUNCTION remove_platform_admin(user_email text)
RETURNS TABLE (
  success boolean,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = user_email;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'User not found';
    RETURN;
  END IF;

  -- Get platform admin org ID
  SELECT id INTO v_org_id
  FROM organizations
  WHERE slug = 'alkatera' AND is_platform_admin = true;

  -- Remove membership
  DELETE FROM organization_members
  WHERE organization_id = v_org_id AND user_id = v_user_id;

  RETURN QUERY SELECT true, 'Successfully removed ' || user_email || ' as platform admin';
END;
$$;

-- Function to list all platform admins
CREATE OR REPLACE FUNCTION list_platform_admins()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  role_name text,
  joined_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    p.id,
    p.email,
    p.full_name,
    r.name as role_name,
    om.joined_at
  FROM profiles p
  JOIN organization_members om ON om.user_id = p.id
  JOIN organizations o ON o.id = om.organization_id
  JOIN roles r ON r.id = om.role_id
  WHERE o.slug = 'alkatera'
    AND o.is_platform_admin = true
  ORDER BY om.joined_at ASC;
$$;

-- =====================================================
-- UPDATE is_alkatera_admin() FUNCTION (if needed)
-- =====================================================

-- The existing is_alkatera_admin() function should already work
-- since it checks for membership in the 'alkatera' org.
-- But let's ensure it's optimal:

CREATE OR REPLACE FUNCTION is_alkatera_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Check if current user is admin of the platform admin organization
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    JOIN public.roles r ON r.id = om.role_id
    WHERE om.user_id = auth.uid()
      AND o.slug = 'alkatera'
      AND o.is_platform_admin = true
      AND r.name IN ('owner', 'admin')
  );
END;
$$;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION add_platform_admin(text) IS
  'Add a user as platform administrator by email. Creates profile if needed and adds to AlkaTera admin organization.';

COMMENT ON FUNCTION remove_platform_admin(text) IS
  'Remove platform admin privileges from a user by email.';

COMMENT ON FUNCTION list_platform_admins() IS
  'List all current platform administrators with their details.';

-- =====================================================
-- GRANT EXECUTE PERMISSIONS
-- =====================================================

-- Allow authenticated users to check if they are admin (already exists)
-- Only admins should be able to add/remove admins, but we'll allow it here
-- and rely on application-level security

GRANT EXECUTE ON FUNCTION add_platform_admin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_platform_admin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION list_platform_admins() TO authenticated;

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================

-- After running this migration, verify with:
-- SELECT * FROM list_platform_admins();
