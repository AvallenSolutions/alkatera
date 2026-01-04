/*
  # Platform Admin System - Using Correct Subscription Tiers

  ## Overview
  Creates a platform admin organization that sits above the subscription tier system.
  Uses the ACTUAL AlkaTera subscription tiers: Seed, Blossom, Canopy

  ## What This Creates
  - Adds `is_platform_admin` flag to organizations table
  - Updates subscription tier constraint with correct tier values
  - Creates the 'AlkaTera' platform admin organization
  - Provides helper functions to manage admin users
*/

-- =====================================================
-- STEP 1: ADD PLATFORM ADMIN FLAG
-- =====================================================

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS is_platform_admin boolean DEFAULT false;

COMMENT ON COLUMN organizations.is_platform_admin IS
  'Marks this organization as the platform admin organization, exempt from normal subscription rules';

-- =====================================================
-- STEP 2: UPDATE SUBSCRIPTION TIER CONSTRAINT
-- =====================================================

-- Drop the existing constraint
ALTER TABLE organizations
DROP CONSTRAINT IF EXISTS valid_subscription_tier;

-- Recreate with CORRECT tier values: Seed, Blossom, Canopy
ALTER TABLE organizations
ADD CONSTRAINT valid_subscription_tier
CHECK (
  -- Platform admin orgs are exempt
  is_platform_admin = true
  OR
  -- Regular orgs must have valid tiers: Seed, Blossom, or Canopy
  subscription_tier IN ('Seed', 'Blossom', 'Canopy')
  OR
  subscription_tier IS NULL
);

-- =====================================================
-- STEP 3: CREATE PLATFORM ADMIN ORGANIZATION
-- =====================================================

-- First, mark it as platform admin if it exists
UPDATE organizations
SET is_platform_admin = true,
    subscription_status = 'active',
    updated_at = now()
WHERE slug = 'alkatera';

-- Then insert if it doesn't exist
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
  true,
  NULL,  -- Platform admin doesn't need a subscription tier
  'active',
  now(),
  now()
)
ON CONFLICT (slug) DO NOTHING;

-- Verify the platform admin org was created
SELECT
  id,
  name,
  slug,
  is_platform_admin,
  subscription_tier,
  subscription_status
FROM organizations
WHERE slug = 'alkatera';

-- =====================================================
-- STEP 4: HELPER FUNCTIONS
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

  IF v_owner_role_id IS NULL THEN
    RETURN QUERY SELECT false, 'Owner role not found', NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

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
  SELECT id INTO v_user_id FROM auth.users WHERE email = user_email;
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'User not found';
    RETURN;
  END IF;

  SELECT id INTO v_org_id FROM organizations WHERE slug = 'alkatera' AND is_platform_admin = true;

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
-- STEP 5: UPDATE is_alkatera_admin() FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION is_alkatera_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
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
-- COMMENTS & PERMISSIONS
-- =====================================================

COMMENT ON FUNCTION add_platform_admin(text) IS
  'Add a user as platform administrator by email';

COMMENT ON FUNCTION remove_platform_admin(text) IS
  'Remove platform admin privileges from a user';

COMMENT ON FUNCTION list_platform_admins() IS
  'List all current platform administrators';

GRANT EXECUTE ON FUNCTION add_platform_admin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_platform_admin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION list_platform_admins() TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Show the result
SELECT
  'Platform Admin Setup Complete!' as status,
  id,
  name,
  slug,
  is_platform_admin,
  subscription_tier
FROM organizations
WHERE slug = 'alkatera';
