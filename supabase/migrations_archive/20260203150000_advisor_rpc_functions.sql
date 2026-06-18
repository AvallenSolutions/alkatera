-- Migration: Advisor RPC Functions
-- Creates the advisor_invitations table and RPC functions for the advisor invitation flow

-- ============================================================================
-- TABLE: advisor_invitations
-- Stores pending and processed advisor invitations
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."advisor_invitations" (
    "id" UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "organization_id" UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    "advisor_email" TEXT NOT NULL,
    "invitation_token" UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
    "status" TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'revoked')),
    "access_notes" TEXT,
    "invited_by" UUID NOT NULL REFERENCES auth.users(id),
    "invited_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    "expires_at" TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days') NOT NULL,
    "accepted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(organization_id, advisor_email)
);

-- Add RLS policies for advisor_invitations
ALTER TABLE "public"."advisor_invitations" ENABLE ROW LEVEL SECURITY;

-- Policy: Org owners/admins can view invitations for their org
CREATE POLICY "Org admins can view advisor invitations" ON "public"."advisor_invitations"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            JOIN roles r ON r.id = om.role_id
            WHERE om.organization_id = advisor_invitations.organization_id
            AND om.user_id = auth.uid()
            AND r.name IN ('owner', 'admin')
        )
    );

-- Policy: Org owners/admins can insert invitations for their org
CREATE POLICY "Org admins can create advisor invitations" ON "public"."advisor_invitations"
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM organization_members om
            JOIN roles r ON r.id = om.role_id
            WHERE om.organization_id = advisor_invitations.organization_id
            AND om.user_id = auth.uid()
            AND r.name IN ('owner', 'admin')
        )
    );

-- Policy: Org owners/admins can update invitations for their org
CREATE POLICY "Org admins can update advisor invitations" ON "public"."advisor_invitations"
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            JOIN roles r ON r.id = om.role_id
            WHERE om.organization_id = advisor_invitations.organization_id
            AND om.user_id = auth.uid()
            AND r.name IN ('owner', 'admin')
        )
    );

-- ============================================================================
-- FUNCTION: get_organization_advisors
-- Gets all advisors (active and revoked) for an organization
-- ============================================================================
CREATE OR REPLACE FUNCTION get_organization_advisors(p_org_id UUID)
RETURNS TABLE (
  advisor_user_id UUID,
  advisor_email TEXT,
  advisor_name TEXT,
  company_name TEXT,
  expertise_areas TEXT[],
  granted_at TIMESTAMPTZ,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller has access to this organization
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
    aoa.is_active
  FROM advisor_organization_access aoa
  JOIN auth.users u ON u.id = aoa.advisor_user_id
  LEFT JOIN profiles p ON p.id = aoa.advisor_user_id
  LEFT JOIN accredited_advisors aa ON aa.user_id = aoa.advisor_user_id
  WHERE aoa.organization_id = p_org_id
  ORDER BY aoa.is_active DESC, aoa.granted_at DESC;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_organization_advisors(UUID) TO authenticated;

-- ============================================================================
-- FUNCTION: accept_advisor_invitation
-- Accepts an advisor invitation using the invitation token
-- ============================================================================
CREATE OR REPLACE FUNCTION accept_advisor_invitation(token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_user_id UUID;
  v_user_email TEXT;
  v_advisor_record RECORD;
BEGIN
  -- Get the current user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must be logged in to accept an invitation');
  END IF;

  -- Get user email
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- Find the invitation
  SELECT
    ai.id,
    ai.organization_id,
    ai.advisor_email,
    ai.status,
    ai.expires_at,
    o.name as organization_name
  INTO v_invitation
  FROM advisor_invitations ai
  JOIN organizations o ON o.id = ai.organization_id
  WHERE ai.invitation_token = token::UUID;

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invitation token');
  END IF;

  -- Check if invitation is still pending
  IF v_invitation.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has already been ' || v_invitation.status);
  END IF;

  -- Check if invitation has expired
  IF v_invitation.expires_at < NOW() THEN
    -- Update status to expired
    UPDATE advisor_invitations SET status = 'expired' WHERE id = v_invitation.id;
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has expired');
  END IF;

  -- Check if the logged-in user's email matches the invitation
  IF LOWER(v_user_email) != LOWER(v_invitation.advisor_email) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This invitation was sent to ' || v_invitation.advisor_email || '. Please sign in with that account.'
    );
  END IF;

  -- Check if advisor already has access to this organization
  IF EXISTS (
    SELECT 1 FROM advisor_organization_access
    WHERE advisor_user_id = v_user_id
    AND organization_id = v_invitation.organization_id
    AND is_active = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have advisor access to this organization');
  END IF;

  -- Check if user is already in accredited_advisors, if not add them
  SELECT * INTO v_advisor_record FROM accredited_advisors WHERE user_id = v_user_id;

  IF v_advisor_record IS NULL THEN
    INSERT INTO accredited_advisors (user_id, is_active, accredited_at)
    VALUES (v_user_id, true, NOW());
  END IF;

  -- Grant advisor access to the organization
  INSERT INTO advisor_organization_access (
    advisor_user_id,
    organization_id,
    invitation_id,
    granted_by,
    granted_at,
    is_active
  ) VALUES (
    v_user_id,
    v_invitation.organization_id,
    v_invitation.id,
    (SELECT invited_by FROM advisor_invitations WHERE id = v_invitation.id),
    NOW(),
    true
  )
  ON CONFLICT (advisor_user_id, organization_id)
  DO UPDATE SET
    is_active = true,
    granted_at = NOW(),
    revoked_at = NULL,
    revoked_by = NULL,
    revocation_reason = NULL;

  -- Update the invitation status
  UPDATE advisor_invitations
  SET
    status = 'accepted',
    accepted_at = NOW()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_invitation.organization_id,
    'organization_name', v_invitation.organization_name
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION accept_advisor_invitation(TEXT) TO authenticated;

-- ============================================================================
-- FUNCTION: revoke_advisor_access
-- Revokes an advisor's access to an organization
-- ============================================================================
CREATE OR REPLACE FUNCTION revoke_advisor_access(
  p_advisor_user_id UUID,
  p_organization_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must be logged in');
  END IF;

  -- Check if caller has admin access to this organization
  IF NOT EXISTS (
    SELECT 1 FROM organization_members om
    JOIN roles r ON r.id = om.role_id
    WHERE om.organization_id = p_organization_id
    AND om.user_id = v_user_id
    AND r.name IN ('owner', 'admin')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied: You must be an owner or admin of this organization');
  END IF;

  -- Check if the advisor access exists
  IF NOT EXISTS (
    SELECT 1 FROM advisor_organization_access
    WHERE advisor_user_id = p_advisor_user_id
    AND organization_id = p_organization_id
    AND is_active = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Advisor access not found or already revoked');
  END IF;

  -- Revoke the access
  UPDATE advisor_organization_access
  SET
    is_active = false,
    revoked_at = NOW(),
    revoked_by = v_user_id,
    revocation_reason = p_reason
  WHERE advisor_user_id = p_advisor_user_id
  AND organization_id = p_organization_id;

  -- Also update any pending invitations for this advisor to this org
  UPDATE advisor_invitations
  SET status = 'revoked'
  WHERE advisor_email = (SELECT email FROM auth.users WHERE id = p_advisor_user_id)
  AND organization_id = p_organization_id
  AND status = 'pending';

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION revoke_advisor_access(UUID, UUID, TEXT) TO authenticated;
