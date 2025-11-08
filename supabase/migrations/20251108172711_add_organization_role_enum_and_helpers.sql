/*
  # Add Organization Role ENUM and Helper Functions

  ## Overview
  This migration adds the organization_role ENUM type to provide a simpler role
  interface for the multi-tenant system, while maintaining compatibility with the
  existing roles table structure.

  ## 1. New Types
    - `organization_role` ENUM
      - `alkatera_admin`: Platform super-admin
      - `company_admin`: Maps to 'owner' and 'admin' roles
      - `company_user`: Maps to 'member' and 'viewer' roles

  ## 2. Helper Functions
    - `get_my_organization_role(org_id uuid)`: Returns the current user's simplified role
    - `get_my_organization_role_id(org_id uuid)`: Returns the current user's role_id

  ## 3. Important Notes
    - This provides a simplified role interface for the frontend
    - Existing RLS policies remain unchanged and functional
    - The ENUM maps to existing roles for backwards compatibility
*/

-- Create organization_role ENUM type
DO $$ BEGIN
  CREATE TYPE organization_role AS ENUM ('alkatera_admin', 'company_admin', 'company_user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Helper function to get user's simplified role in an organization
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
  -- Get the role name for the current user in this organization
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
  ELSE
    org_role := NULL;
  END IF;
  
  RETURN org_role;
END;
$$;

-- Helper function to get user's role_id in an organization
CREATE OR REPLACE FUNCTION get_my_organization_role_id(org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
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

-- Helper function to get role_id by name
CREATE OR REPLACE FUNCTION get_role_id_by_name(role_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  role_uuid uuid;
BEGIN
  SELECT id INTO role_uuid
  FROM roles
  WHERE name = role_name;
  
  RETURN role_uuid;
END;
$$;

-- Helper function to check if user is admin of an organization
CREATE OR REPLACE FUNCTION is_organization_admin(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN get_my_organization_role(org_id) = 'company_admin';
END;
$$;