-- ============================================================================
-- Fix Alkatera Admin Access
-- ============================================================================
-- Problem: The is_alkatera_admin() RPC function only checks organization
-- membership in the 'alkatera' org, but does NOT check the
-- profiles.is_alkatera_admin flag. This means users with the flag set to
-- true but who are not members of the AlkaTera Platform organization are
-- not recognized as admins.
--
-- The AlkaTera Platform organization does not exist in production, so the
-- org-membership check always fails. The profiles flag is the authoritative
-- source of truth for platform admin status.
--
-- Fix: Update is_alkatera_admin() to check BOTH:
--   1. Organization membership (original check, kept for compatibility)
--   2. profiles.is_alkatera_admin flag (new fallback — primary in production)
--
-- Also ensure both admin accounts are members of the alkatera Demo org
-- and have the profiles flag set.
-- ============================================================================

-- ============================================================================
-- 1. Update the is_alkatera_admin() function to also check profiles flag
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."is_alkatera_admin"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  -- Check 1: Organization membership in the 'alkatera' platform org
  IF EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    JOIN public.roles r ON r.id = om.role_id
    WHERE om.user_id = auth.uid()
      AND o.slug = 'alkatera'
      AND o.is_platform_admin = true
      AND r.name IN ('owner', 'admin')
  ) THEN
    RETURN true;
  END IF;

  -- Check 2: Fallback to profiles.is_alkatera_admin flag
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_alkatera_admin = true
  );
END;
$$;

COMMENT ON FUNCTION "public"."is_alkatera_admin"() IS 'Returns true if current user is an Alkatera platform administrator. Checks both organization membership in the alkatera platform org and the profiles.is_alkatera_admin flag.';

-- ============================================================================
-- 2. Ensure tim@alkatera.com is a member of alkatera Demo org
-- ============================================================================
-- alkatera Demo org: 2d86de84-e24e-458b-84b9-fd4057998bda
-- admin role: 458a6f53-7416-47b9-9658-03c4ffd2eb4b

INSERT INTO "public"."organization_members" ("organization_id", "user_id", "role_id", "joined_at")
SELECT
  '2d86de84-e24e-458b-84b9-fd4057998bda',
  'daf8f6c7-e8e0-4346-b9d7-a52ddf8ec5f3',
  '458a6f53-7416-47b9-9658-03c4ffd2eb4b',
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."organization_members"
  WHERE organization_id = '2d86de84-e24e-458b-84b9-fd4057998bda'
    AND user_id = 'daf8f6c7-e8e0-4346-b9d7-a52ddf8ec5f3'
);

-- ============================================================================
-- 3. Ensure hello@alkatera.com is a member of alkatera Demo org
-- ============================================================================

INSERT INTO "public"."organization_members" ("organization_id", "user_id", "role_id", "joined_at")
SELECT
  '2d86de84-e24e-458b-84b9-fd4057998bda',
  '27ea31a3-949c-4107-bcd1-e1b1eff818d1',
  '458a6f53-7416-47b9-9658-03c4ffd2eb4b',
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."organization_members"
  WHERE organization_id = '2d86de84-e24e-458b-84b9-fd4057998bda'
    AND user_id = '27ea31a3-949c-4107-bcd1-e1b1eff818d1'
);

-- ============================================================================
-- 4. Ensure both profiles have is_alkatera_admin = true
-- ============================================================================

UPDATE "public"."profiles"
SET is_alkatera_admin = true
WHERE email IN ('tim@alkatera.com', 'hello@alkatera.com')
  AND is_alkatera_admin = false;
