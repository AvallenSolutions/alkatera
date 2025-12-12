/*
  # Add Granular Permissions for Three-Tier Role System

  ## Overview
  This migration adds comprehensive granular permissions to support the three-tier
  user role system: Alkatera Admin, Organisation Admin, and Organisation User.

  ## 1. New Permissions Added
    ### Data Permissions
      - `data.submit` - Submit data for approval
      - `data.submit_direct` - Submit data directly (without approval)
      - `data.approve` - Approve/reject pending data submissions
      - `data.view` - View organisation data
      - `data.export` - Export data to CSV/Excel

    ### Report Permissions
      - `reports.create` - Create sustainability reports
      - `reports.download` - Download generated reports
      - `reports.publish` - Publish reports externally

    ### LCA Permissions
      - `lca.create` - Create new LCA assessments
      - `lca.edit` - Edit LCA data
      - `lca.run_calculations` - Execute LCA calculations
      - `lca.finalize` - Finalize and lock LCA results
      - `lca.view` - View LCA data and results

    ### Admin Permissions
      - `admin.manage_users` - Invite, remove, update user roles
      - `admin.edit_organization` - Edit organisation profile and settings
      - `admin.manage_settings` - Manage organisation-wide settings
      - `admin.view_audit_log` - View audit and activity logs

    ### Platform Permissions (Alkatera Admin Only)
      - `platform.view_analytics` - View platform-wide analytics
      - `platform.manage_organizations` - View organisation list (not data)
      - `platform.verify_data` - Verify supplier products across platform

  ## 2. Role-Permission Mappings
    - Owner: All permissions
    - Admin: All except organisation deletion and platform permissions
    - Member: Data submit, view, LCA create/edit/view, reports create/download
    - Viewer: View-only permissions

  ## 3. Security Notes
    - Permissions are reference data, readable by all authenticated users
    - Role assignments are controlled through organisation_members table
    - RLS policies will use these permissions for access control
*/

-- ============================================================================
-- STEP 1: Add new granular permissions
-- ============================================================================

-- Data permissions
INSERT INTO permissions (name, description, resource, action) VALUES
  ('data.submit', 'Submit data for approval by admin', 'data', 'submit'),
  ('data.submit_direct', 'Submit data directly without approval', 'data', 'submit_direct'),
  ('data.approve', 'Approve or reject pending data submissions', 'data', 'approve'),
  ('data.view', 'View organisation data', 'data', 'view'),
  ('data.export', 'Export data to CSV/Excel formats', 'data', 'export')
ON CONFLICT (name) DO NOTHING;

-- Report permissions
INSERT INTO permissions (name, description, resource, action) VALUES
  ('reports.create', 'Create sustainability reports', 'reports', 'create'),
  ('reports.download', 'Download generated reports', 'reports', 'download'),
  ('reports.publish', 'Publish reports externally', 'reports', 'publish')
ON CONFLICT (name) DO NOTHING;

-- LCA permissions
INSERT INTO permissions (name, description, resource, action) VALUES
  ('lca.create', 'Create new LCA assessments', 'lca', 'create'),
  ('lca.edit', 'Edit LCA data and materials', 'lca', 'edit'),
  ('lca.run_calculations', 'Execute LCA calculations', 'lca', 'run_calculations'),
  ('lca.finalize', 'Finalize and lock LCA results', 'lca', 'finalize'),
  ('lca.view', 'View LCA data and results', 'lca', 'view')
ON CONFLICT (name) DO NOTHING;

-- Admin permissions
INSERT INTO permissions (name, description, resource, action) VALUES
  ('admin.manage_users', 'Invite, remove, and update user roles', 'admin', 'manage_users'),
  ('admin.edit_organization', 'Edit organisation profile and settings', 'admin', 'edit_organization'),
  ('admin.manage_settings', 'Manage organisation-wide settings', 'admin', 'manage_settings'),
  ('admin.view_audit_log', 'View audit and activity logs', 'admin', 'view_audit_log')
ON CONFLICT (name) DO NOTHING;

-- Platform permissions (Alkatera Admin only)
INSERT INTO permissions (name, description, resource, action) VALUES
  ('platform.view_analytics', 'View platform-wide usage analytics', 'platform', 'view_analytics'),
  ('platform.manage_organizations', 'View organisation list without private data', 'platform', 'manage_organizations'),
  ('platform.verify_data', 'Verify supplier products across all organisations', 'platform', 'verify_data')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- STEP 2: Map permissions to Owner role (all permissions)
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'owner'),
  id
FROM permissions
WHERE name IN (
  'data.submit', 'data.submit_direct', 'data.approve', 'data.view', 'data.export',
  'reports.create', 'reports.download', 'reports.publish',
  'lca.create', 'lca.edit', 'lca.run_calculations', 'lca.finalize', 'lca.view',
  'admin.manage_users', 'admin.edit_organization', 'admin.manage_settings', 'admin.view_audit_log'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================================
-- STEP 3: Map permissions to Admin role (most permissions, no org deletion)
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'admin'),
  id
FROM permissions
WHERE name IN (
  'data.submit', 'data.submit_direct', 'data.approve', 'data.view', 'data.export',
  'reports.create', 'reports.download', 'reports.publish',
  'lca.create', 'lca.edit', 'lca.run_calculations', 'lca.finalize', 'lca.view',
  'admin.manage_users', 'admin.edit_organization', 'admin.manage_settings', 'admin.view_audit_log'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================================
-- STEP 4: Map permissions to Member role (data entry, view, basic reports)
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'member'),
  id
FROM permissions
WHERE name IN (
  'data.submit', 'data.view', 'data.export',
  'reports.create', 'reports.download',
  'lca.create', 'lca.edit', 'lca.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================================
-- STEP 5: Map permissions to Viewer role (read-only)
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'viewer'),
  id
FROM permissions
WHERE name IN (
  'data.view',
  'reports.download',
  'lca.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================================
-- STEP 6: Create helper function to check if user has specific permission
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

  -- Check if user has the permission in the organisation
  RETURN EXISTS (
    SELECT 1
    FROM organization_members om
    JOIN role_permissions rp ON om.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE om.user_id = auth.uid()
      AND om.organization_id = target_org_id
      AND p.name = permission_name
  );
END;
$$;

COMMENT ON FUNCTION has_permission(text, uuid) IS 
  'Check if the current user has a specific permission in the given or current organisation';

-- ============================================================================
-- STEP 7: Create helper function to check if user can submit directly
-- ============================================================================

CREATE OR REPLACE FUNCTION can_submit_directly(org_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN has_permission('data.submit_direct', org_id);
END;
$$;

COMMENT ON FUNCTION can_submit_directly(uuid) IS 
  'Check if user can submit data directly without approval (admins) or needs approval (members)';

-- ============================================================================
-- STEP 8: Create helper function to check if user can approve data
-- ============================================================================

CREATE OR REPLACE FUNCTION can_approve_data(org_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN has_permission('data.approve', org_id);
END;
$$;

COMMENT ON FUNCTION can_approve_data(uuid) IS 
  'Check if user can approve or reject pending data submissions';

-- ============================================================================
-- STEP 9: Create function to get all user permissions for an organisation
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

  -- Get all permissions for the user in this organisation
  SELECT ARRAY_AGG(p.name)
  INTO permission_list
  FROM organization_members om
  JOIN role_permissions rp ON om.role_id = rp.role_id
  JOIN permissions p ON rp.permission_id = p.id
  WHERE om.user_id = auth.uid()
    AND om.organization_id = target_org_id;

  RETURN COALESCE(permission_list, ARRAY[]::text[]);
END;
$$;

COMMENT ON FUNCTION get_user_permissions(uuid) IS 
  'Get array of all permission names the current user has in the specified organisation';
