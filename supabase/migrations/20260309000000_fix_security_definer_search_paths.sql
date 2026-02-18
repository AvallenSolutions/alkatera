-- Fix SECURITY DEFINER functions missing SET search_path = public
--
-- Multiple SECURITY DEFINER functions lacked SET search_path = public,
-- which can cause them to fail in Supabase's hosted environment where
-- the postgres role's default search_path may not resolve public schema
-- tables correctly.
--
-- This was identified as a potential cause of:
--   (a) invite-member edge function failing ("need to be a member")
--       because get_current_organization_id() couldn't find tables
--   (b) admin panel not showing organisations if is_alkatera_admin()
--       or related functions couldn't resolve tables
--
-- Functions fixed:
--   - user_has_organization_access(uuid)
--   - get_current_organization_id()
--   - get_my_organization_role(uuid)
--   - get_my_organization_role_id(uuid)
--   - get_user_org_ids(uuid)

-- ── user_has_organization_access ────────────────────────────────────

CREATE OR REPLACE FUNCTION "public"."user_has_organization_access"("org_id" "uuid")
RETURNS boolean
LANGUAGE "plpgsql" STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check regular membership
  IF EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id AND user_id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check advisor access
  IF EXISTS (
    SELECT 1 FROM advisor_organization_access
    WHERE organization_id = org_id
      AND advisor_user_id = auth.uid()
      AND is_active = true
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- ── get_current_organization_id ─────────────────────────────────────

CREATE OR REPLACE FUNCTION "public"."get_current_organization_id"()
RETURNS "uuid"
LANGUAGE "plpgsql" STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT nullif(
      current_setting('request.jwt.claims', true)::jsonb
        -> 'user_metadata' ->> 'current_organization_id',
      ''
    )::uuid
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- ── get_my_organization_role ────────────────────────────────────────

CREATE OR REPLACE FUNCTION "public"."get_my_organization_role"("org_id" "uuid")
RETURNS "public"."organization_role"
LANGUAGE "plpgsql" STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_name text;
  org_role organization_role;
BEGIN
  SELECT r.name INTO role_name
  FROM organization_members om
  JOIN roles r ON om.role_id = r.id
  WHERE om.organization_id = org_id
    AND om.user_id = auth.uid();

  IF role_name IN ('owner', 'admin') THEN
    org_role := 'company_admin';
  ELSIF role_name IN ('member', 'viewer') THEN
    org_role := 'company_user';
  ELSE
    org_role := NULL;
  END IF;

  RETURN org_role;
END;
$$;

-- ── get_my_organization_role_id ─────────────────────────────────────

CREATE OR REPLACE FUNCTION "public"."get_my_organization_role_id"("org_id" "uuid")
RETURNS "uuid"
LANGUAGE "plpgsql" STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_uuid uuid;
BEGIN
  SELECT om.role_id INTO role_uuid
  FROM organization_members om
  WHERE om.organization_id = org_id
    AND om.user_id = auth.uid();

  RETURN role_uuid;
END;
$$;

-- ── get_user_org_ids ────────────────────────────────────────────────
-- This was already defined with SET search_path = public in an earlier
-- migration, but we recreate it here for completeness / safety.

CREATE OR REPLACE FUNCTION get_user_org_ids(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id FROM organization_members WHERE user_id = uid;
$$;
