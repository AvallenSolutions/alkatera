/*
  # Verify Platform Admin Setup

  Run this to confirm everything is set up correctly
*/

-- Check what auth.uid() returns (will be NULL in SQL Editor)
SELECT auth.uid() as current_auth_uid;

-- Verify the AlkaTera organization was created
SELECT
  id,
  name,
  slug,
  is_platform_admin,
  subscription_tier,
  subscription_status
FROM organizations
WHERE slug = 'alkatera';

-- Verify you were added as a member
SELECT
  om.id as membership_id,
  p.email,
  p.full_name,
  r.name as role,
  o.name as organization
FROM organization_members om
JOIN profiles p ON p.id = om.user_id
JOIN roles r ON r.id = om.role_id
JOIN organizations o ON o.id = om.organization_id
WHERE o.slug = 'alkatera'
  AND p.email = 'hello@alkatera.com';

-- Manually check admin status for your specific user
SELECT EXISTS (
  SELECT 1
  FROM organization_members om
  JOIN organizations o ON o.id = om.organization_id
  JOIN roles r ON r.id = om.role_id
  JOIN profiles p ON p.id = om.user_id
  WHERE p.email = 'hello@alkatera.com'
    AND o.slug = 'alkatera'
    AND o.is_platform_admin = true
    AND r.name IN ('owner', 'admin')
) as is_admin_check;
