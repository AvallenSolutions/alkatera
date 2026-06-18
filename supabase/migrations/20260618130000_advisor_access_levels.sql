-- Advisor access levels: read-only vs read-write
--
-- Org owners/admins choose, per advisor, whether the advisor may only view their
-- data (read_only) or also modify it (read_write). Default is read_write so every
-- existing advisor keeps today's behaviour. Read-only blocks data mutations but
-- still allows generating reports and messaging.
--
-- Enforcement is defence-in-depth:
--   * RLS restrictive policies below (covers direct/browser writes)
--   * a mirrored server-side guard for service-role API/edge writes that bypass RLS
--     (lib/auth/advisor-access.ts)

-- 1. Enum -------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.advisor_access_level AS ENUM ('read_only', 'read_write');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Columns (default read_write preserves existing grants) ------------------
ALTER TABLE public.advisor_invitations
  ADD COLUMN IF NOT EXISTS access_level public.advisor_access_level NOT NULL DEFAULT 'read_write';

ALTER TABLE public.advisor_organization_access
  ADD COLUMN IF NOT EXISTS access_level public.advisor_access_level NOT NULL DEFAULT 'read_write';

-- 3. Predicate: is the current user a READ-ONLY advisor for this org? --------
--    True only for an active read_only advisor who is NOT also a member
--    (members always retain full write access).
CREATE OR REPLACE FUNCTION public.is_readonly_advisor(org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM advisor_organization_access aoa
      WHERE aoa.organization_id = org_id
        AND aoa.advisor_user_id = auth.uid()
        AND aoa.is_active = true
        AND aoa.access_level = 'read_only'
    )
    AND NOT EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = org_id
        AND om.user_id = auth.uid()
    );
$$;

ALTER FUNCTION public.is_readonly_advisor(uuid) OWNER TO postgres;
GRANT ALL ON FUNCTION public.is_readonly_advisor(uuid) TO anon;
GRANT ALL ON FUNCTION public.is_readonly_advisor(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_readonly_advisor(uuid) TO service_role;

COMMENT ON FUNCTION public.is_readonly_advisor(uuid) IS
  'True when the current user is an active read_only advisor for org_id and not also a member. Used by restrictive RLS policies to block writes.';

-- 4. Restrictive write policies on the 17 org data tables --------------------
--    generated_reports is intentionally excluded (reports stay allowed).
--    Restrictive policies are AND'd with the existing permissive policies, so a
--    read-only advisor is blocked from writes regardless of which permissive
--    policy would otherwise grant them.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'activity_data',
    'agent_exceptions',
    'calculated_emissions',
    'emissions_calculation_context',
    'facilities',
    'facility_activity_entries',
    'facility_emissions_aggregated',
    'historical_imports',
    'integration_requests',
    'operational_change_events',
    'product_carbon_footprint_production_sites',
    'product_carbon_footprints',
    'products',
    'vineyard_growing_profiles',
    'vineyard_soil_carbon_evidence',
    'vineyards',
    'xero_sync_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'advisor_ro_no_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'advisor_ro_no_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'advisor_ro_no_delete', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated '
      || 'WITH CHECK (NOT public.is_readonly_advisor(organization_id))',
      'advisor_ro_no_insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated '
      || 'USING (NOT public.is_readonly_advisor(organization_id))',
      'advisor_ro_no_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated '
      || 'USING (NOT public.is_readonly_advisor(organization_id))',
      'advisor_ro_no_delete', t);
  END LOOP;
END $$;

-- 5. RPCs -------------------------------------------------------------------

-- 5a. accept_advisor_invitation: carry the invitation's access_level onto the grant
CREATE OR REPLACE FUNCTION public.accept_advisor_invitation(token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invitation RECORD;
  v_user_id UUID;
  v_user_email TEXT;
  v_advisor_record RECORD;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must be logged in to accept an invitation');
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  SELECT
    ai.id,
    ai.organization_id,
    ai.advisor_email,
    ai.status,
    ai.expires_at,
    ai.access_level,
    o.name as organization_name
  INTO v_invitation
  FROM advisor_invitations ai
  JOIN organizations o ON o.id = ai.organization_id
  WHERE ai.invitation_token = token::UUID;

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invitation token');
  END IF;

  IF v_invitation.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has already been ' || v_invitation.status);
  END IF;

  IF v_invitation.expires_at < NOW() THEN
    UPDATE advisor_invitations SET status = 'expired' WHERE id = v_invitation.id;
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has expired');
  END IF;

  IF LOWER(v_user_email) != LOWER(v_invitation.advisor_email) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This invitation was sent to ' || v_invitation.advisor_email || '. Please sign in with that account.'
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM advisor_organization_access
    WHERE advisor_user_id = v_user_id
    AND organization_id = v_invitation.organization_id
    AND is_active = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have advisor access to this organization');
  END IF;

  SELECT * INTO v_advisor_record FROM accredited_advisors WHERE user_id = v_user_id;

  IF v_advisor_record IS NULL THEN
    INSERT INTO accredited_advisors (user_id, is_active, accredited_at)
    VALUES (v_user_id, true, NOW());
  END IF;

  INSERT INTO advisor_organization_access (
    advisor_user_id,
    organization_id,
    invitation_id,
    granted_by,
    granted_at,
    is_active,
    access_level
  ) VALUES (
    v_user_id,
    v_invitation.organization_id,
    v_invitation.id,
    (SELECT invited_by FROM advisor_invitations WHERE id = v_invitation.id),
    NOW(),
    true,
    v_invitation.access_level
  )
  ON CONFLICT (advisor_user_id, organization_id)
  DO UPDATE SET
    is_active = true,
    granted_at = NOW(),
    revoked_at = NULL,
    revoked_by = NULL,
    revocation_reason = NULL,
    access_level = EXCLUDED.access_level;

  UPDATE advisor_invitations
  SET
    status = 'accepted',
    accepted_at = NOW()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_invitation.organization_id,
    'organization_name', v_invitation.organization_name,
    'access_level', v_invitation.access_level
  );
END;
$$;

-- 5b. get_organization_advisors: expose access_level (return signature changes → drop first)
DROP FUNCTION IF EXISTS public.get_organization_advisors(uuid);
CREATE FUNCTION public.get_organization_advisors(p_org_id uuid)
RETURNS TABLE(
  advisor_user_id uuid,
  advisor_email text,
  advisor_name text,
  company_name text,
  expertise_areas text[],
  granted_at timestamp with time zone,
  is_active boolean,
  access_level public.advisor_access_level
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM organization_members om
    JOIN roles r ON r.id = om.role_id
    WHERE om.organization_id = p_org_id
    AND om.user_id = auth.uid()
    AND r.name IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: You must be an owner or admin of this organization';
  END IF;

  RETURN QUERY
  SELECT
    aoa.advisor_user_id,
    u.email::TEXT as advisor_email,
    p.full_name::TEXT as advisor_name,
    aa.company_name::TEXT,
    aa.expertise_areas,
    aoa.granted_at,
    aoa.is_active,
    aoa.access_level
  FROM advisor_organization_access aoa
  JOIN auth.users u ON u.id = aoa.advisor_user_id
  LEFT JOIN profiles p ON p.id = aoa.advisor_user_id
  LEFT JOIN accredited_advisors aa ON aa.user_id = aoa.advisor_user_id
  WHERE aoa.organization_id = p_org_id
  ORDER BY aoa.is_active DESC, aoa.granted_at DESC;
END;
$$;

ALTER FUNCTION public.get_organization_advisors(uuid) OWNER TO postgres;
GRANT ALL ON FUNCTION public.get_organization_advisors(uuid) TO anon;
GRANT ALL ON FUNCTION public.get_organization_advisors(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_organization_advisors(uuid) TO service_role;

-- 5c. get_advisor_invitation_by_token: expose access_level (no signature change)
CREATE OR REPLACE FUNCTION public.get_advisor_invitation_by_token(p_token uuid)
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'id', ai.id,
    'advisor_email', ai.advisor_email,
    'access_notes', ai.access_notes,
    'invited_at', ai.invited_at,
    'expires_at', ai.expires_at,
    'status', ai.status,
    'access_level', ai.access_level,
    'organization_name', o.name
  )
  FROM advisor_invitations ai
  JOIN organizations o ON o.id = ai.organization_id
  WHERE ai.invitation_token = p_token;
$$;

-- 5d. set_advisor_access_level: owner/admin changes an advisor's level ("change later")
CREATE OR REPLACE FUNCTION public.set_advisor_access_level(
  p_advisor_user_id uuid,
  p_organization_id uuid,
  p_level public.advisor_access_level
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must be logged in');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organization_members om
    JOIN roles r ON r.id = om.role_id
    WHERE om.organization_id = p_organization_id
    AND om.user_id = v_user_id
    AND r.name IN ('owner', 'admin')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied: You must be an owner or admin of this organization');
  END IF;

  UPDATE advisor_organization_access
  SET access_level = p_level
  WHERE advisor_user_id = p_advisor_user_id
  AND organization_id = p_organization_id
  AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active advisor access not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'access_level', p_level);
END;
$$;

ALTER FUNCTION public.set_advisor_access_level(uuid, uuid, public.advisor_access_level) OWNER TO postgres;
GRANT ALL ON FUNCTION public.set_advisor_access_level(uuid, uuid, public.advisor_access_level) TO anon;
GRANT ALL ON FUNCTION public.set_advisor_access_level(uuid, uuid, public.advisor_access_level) TO authenticated;
GRANT ALL ON FUNCTION public.set_advisor_access_level(uuid, uuid, public.advisor_access_level) TO service_role;

COMMENT ON FUNCTION public.set_advisor_access_level(uuid, uuid, public.advisor_access_level) IS
  'Owner/admin changes an active advisor''s access level (read_only / read_write).';
