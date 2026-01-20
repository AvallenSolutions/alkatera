/*
  # Create Advisor User System

  ## Overview
  This migration creates a comprehensive advisor system that allows AlkaTera-accredited
  sustainability consultants to work with multiple client organizations on the platform.

  ## Key Features
  1. Advisors can access multiple organizations (unlike regular users)
  2. Organizations invite advisors via secure invitation links
  3. Organization admins can remove advisors at any time
  4. Advisors get full read/write access to data, LCA, and reports
  5. Advisors cannot manage users or organization settings
  6. AlkaTera platform admins manage the accredited advisor registry

  ## New Tables
  - `accredited_advisors` - Registry of AlkaTera-accredited advisors
  - `advisor_invitations` - Invitations from organizations to advisors
  - `advisor_organization_access` - Active advisor-organization relationships

  ## New Role
  - `advisor` role with specific permissions

  ## Security
  - RLS policies ensure advisors only see organizations they're invited to
  - Organization admins have full control over advisor access
  - AlkaTera admins manage the accredited advisor registry
*/

-- ============================================================================
-- STEP 1: Add 'advisor' to organization_role ENUM
-- ============================================================================

-- Add advisor to the organization_role enum
ALTER TYPE organization_role ADD VALUE IF NOT EXISTS 'advisor';

-- ============================================================================
-- STEP 2: Create 'advisor' role in roles table
-- ============================================================================

INSERT INTO roles (name, description)
VALUES (
  'advisor',
  'AlkaTera-accredited sustainability advisor with access to client organizations'
)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- STEP 3: Create accredited_advisors table (AlkaTera-managed registry)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.accredited_advisors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Advisor profile information
  company_name TEXT,
  advisor_bio TEXT,
  expertise_areas TEXT[] DEFAULT '{}',
  certifications TEXT[] DEFAULT '{}',
  website_url TEXT,
  linkedin_url TEXT,

  -- Accreditation status
  is_active BOOLEAN NOT NULL DEFAULT true,
  accredited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accredited_by UUID REFERENCES auth.users(id),
  accreditation_expires_at TIMESTAMPTZ,

  -- Training and compliance
  training_completed_at TIMESTAMPTZ,
  last_compliance_check_at TIMESTAMPTZ,
  compliance_notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure one entry per user
  CONSTRAINT unique_advisor_user UNIQUE (user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_accredited_advisors_user_id
  ON public.accredited_advisors(user_id);
CREATE INDEX IF NOT EXISTS idx_accredited_advisors_is_active
  ON public.accredited_advisors(is_active);

-- Add comments
COMMENT ON TABLE public.accredited_advisors IS
  'Registry of AlkaTera-accredited sustainability advisors who can work with client organizations';
COMMENT ON COLUMN public.accredited_advisors.expertise_areas IS
  'Areas of sustainability expertise (e.g., LCA, carbon accounting, supply chain)';
COMMENT ON COLUMN public.accredited_advisors.certifications IS
  'Professional certifications held (e.g., ISO 14064, GHG Protocol)';

-- ============================================================================
-- STEP 4: Create advisor_invitations table
-- ============================================================================

-- Create invitation status enum
DO $$ BEGIN
  CREATE TYPE advisor_invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired', 'revoked');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.advisor_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization sending the invitation
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Invitation details
  advisor_email TEXT NOT NULL,
  advisor_user_id UUID REFERENCES auth.users(id), -- Set when advisor accepts

  -- Invitation token for secure acceptance
  invitation_token UUID NOT NULL DEFAULT gen_random_uuid(),

  -- Status tracking
  status advisor_invitation_status NOT NULL DEFAULT 'pending',

  -- Invitation metadata
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),

  -- Response tracking
  responded_at TIMESTAMPTZ,
  response_notes TEXT,

  -- Access configuration (what the advisor can access)
  access_notes TEXT, -- Optional notes about what the advisor should work on

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure unique pending invitation per org/email combination
  CONSTRAINT unique_pending_advisor_invitation
    UNIQUE (organization_id, advisor_email, status)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_advisor_invitations_org_id
  ON public.advisor_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_advisor_invitations_email
  ON public.advisor_invitations(advisor_email);
CREATE INDEX IF NOT EXISTS idx_advisor_invitations_token
  ON public.advisor_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_advisor_invitations_status
  ON public.advisor_invitations(status);
CREATE INDEX IF NOT EXISTS idx_advisor_invitations_advisor_user
  ON public.advisor_invitations(advisor_user_id);

-- Add comments
COMMENT ON TABLE public.advisor_invitations IS
  'Invitations from organizations to advisors for platform access';
COMMENT ON COLUMN public.advisor_invitations.invitation_token IS
  'Secure token used to accept the invitation';
COMMENT ON COLUMN public.advisor_invitations.access_notes IS
  'Optional notes from org admin about what work the advisor should perform';

-- ============================================================================
-- STEP 5: Create advisor_organization_access table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.advisor_organization_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The advisor and organization
  advisor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Link to the original invitation
  invitation_id UUID REFERENCES public.advisor_invitations(id) ON DELETE SET NULL,

  -- Access status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID NOT NULL REFERENCES auth.users(id),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  revocation_reason TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure one active access record per advisor/org combination
  CONSTRAINT unique_active_advisor_access
    UNIQUE (advisor_user_id, organization_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_advisor_org_access_advisor
  ON public.advisor_organization_access(advisor_user_id);
CREATE INDEX IF NOT EXISTS idx_advisor_org_access_org
  ON public.advisor_organization_access(organization_id);
CREATE INDEX IF NOT EXISTS idx_advisor_org_access_active
  ON public.advisor_organization_access(is_active);

-- Add comments
COMMENT ON TABLE public.advisor_organization_access IS
  'Active access relationships between advisors and organizations';
COMMENT ON COLUMN public.advisor_organization_access.is_active IS
  'Whether the advisor currently has access (false = revoked)';

-- ============================================================================
-- STEP 6: Define advisor permissions
-- ============================================================================

-- Advisors get data, reports, and LCA permissions but NOT admin permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT
  (SELECT id FROM roles WHERE name = 'advisor'),
  id
FROM permissions
WHERE name IN (
  -- Data permissions (full access)
  'data.submit',
  'data.submit_direct',
  'data.approve',
  'data.view',
  'data.export',
  -- Report permissions (full access)
  'reports.create',
  'reports.download',
  'reports.publish',
  -- LCA permissions (full access)
  'lca.create',
  'lca.edit',
  'lca.run_calculations',
  'lca.finalize',
  'lca.view',
  -- Limited admin (can view audit log to support client)
  'admin.view_audit_log'
  -- NOTE: Advisors do NOT get:
  -- 'admin.manage_users' - cannot add/remove users
  -- 'admin.edit_organization' - cannot edit org profile
  -- 'admin.manage_settings' - cannot change settings
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================================
-- STEP 7: Create helper functions for advisor system
-- ============================================================================

-- Function to check if a user is an accredited advisor
CREATE OR REPLACE FUNCTION is_accredited_advisor(user_uuid UUID DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  target_user_id := COALESCE(user_uuid, auth.uid());

  RETURN EXISTS (
    SELECT 1
    FROM accredited_advisors
    WHERE user_id = target_user_id
      AND is_active = true
      AND (accreditation_expires_at IS NULL OR accreditation_expires_at > now())
  );
END;
$$;

COMMENT ON FUNCTION is_accredited_advisor(UUID) IS
  'Check if a user is an active AlkaTera-accredited advisor';

-- Function to check if current user has advisor access to an organization
CREATE OR REPLACE FUNCTION has_advisor_access(org_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM advisor_organization_access
    WHERE advisor_user_id = auth.uid()
      AND organization_id = org_id
      AND is_active = true
  );
END;
$$;

COMMENT ON FUNCTION has_advisor_access(UUID) IS
  'Check if the current user has active advisor access to an organization';

-- Function to get all organizations the current user has advisor access to
CREATE OR REPLACE FUNCTION get_advisor_organizations()
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  granted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    aoa.organization_id,
    o.name,
    aoa.granted_at
  FROM advisor_organization_access aoa
  JOIN organizations o ON aoa.organization_id = o.id
  WHERE aoa.advisor_user_id = auth.uid()
    AND aoa.is_active = true
  ORDER BY o.name;
END;
$$;

COMMENT ON FUNCTION get_advisor_organizations() IS
  'Get all organizations the current advisor has access to';

-- Function to validate and accept an advisor invitation
CREATE OR REPLACE FUNCTION accept_advisor_invitation(token UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_record advisor_invitations%ROWTYPE;
  current_user_email TEXT;
  result jsonb;
BEGIN
  -- Get current user's email
  SELECT email INTO current_user_email
  FROM auth.users
  WHERE id = auth.uid();

  IF current_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  -- Find the invitation
  SELECT * INTO invitation_record
  FROM advisor_invitations
  WHERE invitation_token = token;

  IF invitation_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invitation token');
  END IF;

  -- Check if invitation is still pending
  IF invitation_record.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation is no longer pending');
  END IF;

  -- Check if invitation has expired
  IF invitation_record.expires_at < now() THEN
    -- Update status to expired
    UPDATE advisor_invitations
    SET status = 'expired', updated_at = now()
    WHERE id = invitation_record.id;

    RETURN jsonb_build_object('success', false, 'error', 'Invitation has expired');
  END IF;

  -- Check if email matches (case-insensitive)
  IF lower(invitation_record.advisor_email) != lower(current_user_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation was sent to a different email address');
  END IF;

  -- Accept the invitation
  UPDATE advisor_invitations
  SET
    status = 'accepted',
    advisor_user_id = auth.uid(),
    responded_at = now(),
    updated_at = now()
  WHERE id = invitation_record.id;

  -- Create the access record
  INSERT INTO advisor_organization_access (
    advisor_user_id,
    organization_id,
    invitation_id,
    granted_by,
    is_active
  )
  VALUES (
    auth.uid(),
    invitation_record.organization_id,
    invitation_record.id,
    invitation_record.invited_by,
    true
  )
  ON CONFLICT (advisor_user_id, organization_id)
  DO UPDATE SET
    is_active = true,
    invitation_id = EXCLUDED.invitation_id,
    granted_at = now(),
    granted_by = EXCLUDED.granted_by,
    revoked_at = NULL,
    revoked_by = NULL,
    revocation_reason = NULL,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', invitation_record.organization_id,
    'message', 'Invitation accepted successfully'
  );
END;
$$;

COMMENT ON FUNCTION accept_advisor_invitation(UUID) IS
  'Accept an advisor invitation using the secure token';

-- Function for org admins to revoke advisor access
CREATE OR REPLACE FUNCTION revoke_advisor_access(
  p_advisor_user_id UUID,
  p_organization_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if current user is admin of the organization
  IF NOT is_organization_admin(p_organization_id) THEN
    RAISE EXCEPTION 'Only organization admins can revoke advisor access';
  END IF;

  -- Revoke the access
  UPDATE advisor_organization_access
  SET
    is_active = false,
    revoked_at = now(),
    revoked_by = auth.uid(),
    revocation_reason = p_reason,
    updated_at = now()
  WHERE advisor_user_id = p_advisor_user_id
    AND organization_id = p_organization_id;

  -- Also revoke any pending invitations
  UPDATE advisor_invitations
  SET
    status = 'revoked',
    updated_at = now()
  WHERE advisor_user_id = p_advisor_user_id
    AND organization_id = p_organization_id
    AND status = 'pending';

  RETURN true;
END;
$$;

COMMENT ON FUNCTION revoke_advisor_access(UUID, UUID, TEXT) IS
  'Revoke an advisor''s access to an organization (admin only)';

-- ============================================================================
-- STEP 8: Update get_my_organization_role to handle advisors
-- ============================================================================

CREATE OR REPLACE FUNCTION get_my_organization_role(org_id uuid)
RETURNS organization_role
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  role_name text;
  org_role organization_role;
BEGIN
  -- First check if user is a member of the organization
  SELECT r.name INTO role_name
  FROM organization_members om
  JOIN roles r ON om.role_id = r.id
  WHERE om.organization_id = org_id
    AND om.user_id = auth.uid();

  -- Map the role name to organization_role ENUM
  IF role_name IN ('owner', 'admin') THEN
    org_role := 'company_admin';
  ELSIF role_name IN ('member', 'viewer') THEN
    org_role := 'company_user';
  ELSIF role_name = 'advisor' THEN
    org_role := 'advisor';
  ELSE
    -- Check if user has advisor access to this organization
    IF has_advisor_access(org_id) THEN
      org_role := 'advisor';
    ELSE
      org_role := NULL;
    END IF;
  END IF;

  RETURN org_role;
END;
$$;

-- ============================================================================
-- STEP 9: Update has_permission to check advisor access
-- ============================================================================

CREATE OR REPLACE FUNCTION has_permission(permission_name text, org_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  target_org_id uuid;
BEGIN
  -- Use provided org_id or get from user metadata
  IF org_id IS NOT NULL THEN
    target_org_id := org_id;
  ELSE
    target_org_id := get_current_organization_id();
  END IF;

  -- If no organization context, deny permission
  IF target_org_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if user has the permission as a regular organization member
  IF EXISTS (
    SELECT 1
    FROM organization_members om
    JOIN role_permissions rp ON om.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE om.user_id = auth.uid()
      AND om.organization_id = target_org_id
      AND p.name = permission_name
  ) THEN
    RETURN true;
  END IF;

  -- Check if user has the permission as an advisor
  IF has_advisor_access(target_org_id) THEN
    RETURN EXISTS (
      SELECT 1
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      JOIN roles r ON rp.role_id = r.id
      WHERE r.name = 'advisor'
        AND p.name = permission_name
    );
  END IF;

  RETURN false;
END;
$$;

-- ============================================================================
-- STEP 10: Update get_user_permissions to include advisor permissions
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_permissions(org_id uuid DEFAULT NULL)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  target_org_id uuid;
  permission_list text[];
BEGIN
  -- Use provided org_id or get from user metadata
  IF org_id IS NOT NULL THEN
    target_org_id := org_id;
  ELSE
    target_org_id := get_current_organization_id();
  END IF;

  -- If no organization context, return empty array
  IF target_org_id IS NULL THEN
    RETURN ARRAY[]::text[];
  END IF;

  -- Get permissions as organization member
  SELECT ARRAY_AGG(DISTINCT p.name)
  INTO permission_list
  FROM organization_members om
  JOIN role_permissions rp ON om.role_id = rp.role_id
  JOIN permissions p ON rp.permission_id = p.id
  WHERE om.user_id = auth.uid()
    AND om.organization_id = target_org_id;

  -- If user is an advisor with access, get advisor permissions
  IF (permission_list IS NULL OR array_length(permission_list, 1) IS NULL)
     AND has_advisor_access(target_org_id) THEN
    SELECT ARRAY_AGG(DISTINCT p.name)
    INTO permission_list
    FROM role_permissions rp
    JOIN permissions p ON rp.permission_id = p.id
    JOIN roles r ON rp.role_id = r.id
    WHERE r.name = 'advisor';
  END IF;

  RETURN COALESCE(permission_list, ARRAY[]::text[]);
END;
$$;

-- ============================================================================
-- STEP 11: Enable RLS and create policies
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.accredited_advisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_organization_access ENABLE ROW LEVEL SECURITY;

-- Accredited advisors policies
-- AlkaTera admins can manage the registry
CREATE POLICY "AlkaTera admins can manage accredited advisors"
  ON public.accredited_advisors
  FOR ALL
  TO authenticated
  USING (is_alkatera_admin())
  WITH CHECK (is_alkatera_admin());

-- Users can view their own advisor record
CREATE POLICY "Users can view own advisor record"
  ON public.accredited_advisors
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Org admins can view accredited advisors (to invite them)
CREATE POLICY "Org admins can view accredited advisors"
  ON public.accredited_advisors
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.user_id = auth.uid()
        AND r.name IN ('owner', 'admin')
    )
  );

-- Advisor invitations policies
-- Org admins can manage invitations for their organization
CREATE POLICY "Org admins can manage advisor invitations"
  ON public.advisor_invitations
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.user_id = auth.uid()
        AND r.name IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.user_id = auth.uid()
        AND r.name IN ('owner', 'admin')
    )
  );

-- Advisors can view invitations sent to their email
CREATE POLICY "Advisors can view their invitations"
  ON public.advisor_invitations
  FOR SELECT
  TO authenticated
  USING (
    lower(advisor_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  );

-- Advisor organization access policies
-- Users can view their own access records
CREATE POLICY "Users can view own advisor access"
  ON public.advisor_organization_access
  FOR SELECT
  TO authenticated
  USING (advisor_user_id = auth.uid());

-- Org admins can view and manage access for their organization
CREATE POLICY "Org admins can manage advisor access"
  ON public.advisor_organization_access
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.user_id = auth.uid()
        AND r.name IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.user_id = auth.uid()
        AND r.name IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- STEP 12: Create function to list advisors for an organization
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
STABLE
AS $$
BEGIN
  -- Check if current user is admin of the organization
  IF NOT is_organization_admin(p_org_id) THEN
    RAISE EXCEPTION 'Only organization admins can view advisor list';
  END IF;

  RETURN QUERY
  SELECT
    aoa.advisor_user_id,
    u.email,
    p.full_name,
    aa.company_name,
    aa.expertise_areas,
    aoa.granted_at,
    aoa.is_active
  FROM advisor_organization_access aoa
  JOIN auth.users u ON aoa.advisor_user_id = u.id
  LEFT JOIN profiles p ON p.id = u.id
  LEFT JOIN accredited_advisors aa ON aa.user_id = u.id
  WHERE aoa.organization_id = p_org_id
  ORDER BY aoa.is_active DESC, aoa.granted_at DESC;
END;
$$;

COMMENT ON FUNCTION get_organization_advisors(UUID) IS
  'Get all advisors (active and revoked) for an organization';

-- ============================================================================
-- STEP 13: Grant execute permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION is_accredited_advisor(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION has_advisor_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_advisor_organizations() TO authenticated;
GRANT EXECUTE ON FUNCTION accept_advisor_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_advisor_access(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_organization_advisors(UUID) TO authenticated;

-- ============================================================================
-- STEP 14: Create updated_at triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_accredited_advisors_updated_at
  BEFORE UPDATE ON public.accredited_advisors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_advisor_invitations_updated_at
  BEFORE UPDATE ON public.advisor_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_advisor_org_access_updated_at
  BEFORE UPDATE ON public.advisor_organization_access
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
