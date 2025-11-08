/*
  # AlkaTera - Complete Database Schema with Row Level Security
  
  ## Overview
  This migration creates the complete database schema for the AlkaTera application,
  including user profiles, organizations, role-based access control, and comprehensive
  Row Level Security policies.
  
  ## Tables Created
  
  ### 1. Core Tables
    - `profiles` - Extended user profile information linked to auth.users
    - `organizations` - Organization/tenant information
    - `organization_members` - Links users to organizations with roles
    - `roles` - Defines available roles in the system
    - `permissions` - Defines available permissions
    - `role_permissions` - Links roles to their permissions
  
  ## Security Implementation
    - All tables have RLS enabled
    - Users can only access their own profile data
    - Organization data is restricted to organization members
    - Role-based permissions enforced through policies
  
  ## Notes
    - Uses auth.uid() for user identification
    - Foreign key constraints ensure data integrity
    - Timestamps track creation and modification
    - Default roles and permissions are seeded
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ROLES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PERMISSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text UNIQUE NOT NULL,
  description text,
  resource text NOT NULL,
  action text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- ROLE_PERMISSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- ORGANIZATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  logo_url text,
  website text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PROFILES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- ORGANIZATION_MEMBERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS organization_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  invited_by uuid REFERENCES profiles(id),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SEED DEFAULT ROLES
-- =====================================================
INSERT INTO roles (name, description) VALUES
  ('owner', 'Full access to all organization resources and settings')
ON CONFLICT (name) DO NOTHING;

INSERT INTO roles (name, description) VALUES
  ('admin', 'Administrative access with ability to manage users and settings')
ON CONFLICT (name) DO NOTHING;

INSERT INTO roles (name, description) VALUES
  ('member', 'Standard user access with limited permissions')
ON CONFLICT (name) DO NOTHING;

INSERT INTO roles (name, description) VALUES
  ('viewer', 'Read-only access to organization resources')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- SEED DEFAULT PERMISSIONS
-- =====================================================
INSERT INTO permissions (name, description, resource, action) VALUES
  ('organization.read', 'View organization details', 'organization', 'read')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, resource, action) VALUES
  ('organization.update', 'Update organization details', 'organization', 'update')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, resource, action) VALUES
  ('organization.delete', 'Delete organization', 'organization', 'delete')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, resource, action) VALUES
  ('members.read', 'View organization members', 'members', 'read')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, resource, action) VALUES
  ('members.invite', 'Invite new members to organization', 'members', 'invite')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, resource, action) VALUES
  ('members.remove', 'Remove members from organization', 'members', 'remove')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, resource, action) VALUES
  ('members.update_role', 'Update member roles', 'members', 'update_role')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- LINK ROLES TO PERMISSIONS
-- =====================================================

-- Owner has all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'owner'),
  id
FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Admin has most permissions except organization deletion
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'admin'),
  id
FROM permissions
WHERE name IN (
  'organization.read',
  'organization.update',
  'members.read',
  'members.invite',
  'members.remove',
  'members.update_role'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Member has basic permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'member'),
  id
FROM permissions
WHERE name IN (
  'organization.read',
  'members.read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Viewer has read-only permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'viewer'),
  id
FROM permissions
WHERE name IN (
  'organization.read',
  'members.read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- ============ PROFILES POLICIES ============

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============ ORGANIZATIONS POLICIES ============

CREATE POLICY "Organization members can view their organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Organization owners can update their organization"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Organization owners can delete their organization"
  ON organizations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
      AND r.name = 'owner'
    )
  );

-- ============ ORGANIZATION_MEMBERS POLICIES ============

CREATE POLICY "Members can view organization members"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can add members to organization"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update member roles"
  ON organization_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can remove members"
  ON organization_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

-- ============ ROLES POLICIES ============

CREATE POLICY "Authenticated users can view roles"
  ON roles FOR SELECT
  TO authenticated
  USING (true);

-- ============ PERMISSIONS POLICIES ============

CREATE POLICY "Authenticated users can view permissions"
  ON permissions FOR SELECT
  TO authenticated
  USING (true);

-- ============ ROLE_PERMISSIONS POLICIES ============

CREATE POLICY "Authenticated users can view role permissions"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call handle_new_user on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- HELPER FUNCTIONS FOR PERMISSIONS
-- =====================================================

-- Function to check if user has specific permission in organization
CREATE OR REPLACE FUNCTION user_has_permission(
  user_id uuid,
  org_id uuid,
  permission_name text
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM organization_members om
    JOIN role_permissions rp ON om.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE om.user_id = user_has_permission.user_id
    AND om.organization_id = user_has_permission.org_id
    AND p.name = user_has_permission.permission_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's role in organization
CREATE OR REPLACE FUNCTION get_user_role(
  user_id uuid,
  org_id uuid
)
RETURNS text AS $$
DECLARE
  role_name text;
BEGIN
  SELECT r.name INTO role_name
  FROM organization_members om
  JOIN roles r ON om.role_id = r.id
  WHERE om.user_id = get_user_role.user_id
  AND om.organization_id = get_user_role.org_id;
  
  RETURN role_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;