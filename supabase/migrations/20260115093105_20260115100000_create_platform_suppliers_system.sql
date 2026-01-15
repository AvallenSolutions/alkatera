/*
  # Create Platform Suppliers System

  This migration creates a two-tier supplier system:
  1. Platform suppliers - managed by Alkatera admins, visible to all organizations
  2. Organization-supplier relationships - tracks which suppliers each organization uses (private)

  ## Changes

  1. New Tables
    - `platform_suppliers` - Master supplier directory managed by admins
    - `organization_suppliers` - Junction table linking organizations to suppliers they use

  2. Data Migration
    - Migrate existing organization-specific suppliers to platform suppliers
    - Create organization-supplier relationships for existing data

  3. Security
    - Platform suppliers: Public read, admin-only write
    - Organization suppliers: Private per organization
*/

-- =====================================================
-- PART 1: CREATE PLATFORM SUPPLIERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.platform_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  website text,
  contact_email text,
  contact_name text,
  industry_sector text,
  country text,
  description text,
  logo_url text,
  is_verified boolean DEFAULT false,
  verification_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),

  CONSTRAINT valid_email CHECK (contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR contact_email IS NULL),
  CONSTRAINT unique_supplier_name UNIQUE (name)
);

COMMENT ON TABLE public.platform_suppliers IS
  'Master supplier directory managed by Alkatera admins. Visible to all organizations.';

COMMENT ON COLUMN public.platform_suppliers.is_verified IS
  'Whether the supplier has been verified by Alkatera admins.';

COMMENT ON COLUMN public.platform_suppliers.created_by IS
  'Platform admin who added this supplier.';

-- =====================================================
-- PART 2: CREATE ORGANIZATION-SUPPLIER RELATIONSHIPS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.organization_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform_supplier_id uuid NOT NULL REFERENCES public.platform_suppliers(id) ON DELETE CASCADE,
  annual_spend numeric,
  spend_currency text DEFAULT 'GBP',
  relationship_type text,
  engagement_status text DEFAULT 'active',
  notes text,
  added_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  added_by uuid REFERENCES public.profiles(id),

  CONSTRAINT positive_spend CHECK (annual_spend >= 0 OR annual_spend IS NULL),
  CONSTRAINT unique_org_supplier UNIQUE (organization_id, platform_supplier_id)
);

COMMENT ON TABLE public.organization_suppliers IS
  'Junction table tracking which suppliers each organization uses. Private per organization.';

COMMENT ON COLUMN public.organization_suppliers.relationship_type IS
  'Type of relationship: direct, indirect, contracted, etc.';

COMMENT ON COLUMN public.organization_suppliers.engagement_status IS
  'Engagement status: active, invited, inactive, etc.';

CREATE INDEX IF NOT EXISTS idx_org_suppliers_org ON public.organization_suppliers(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_suppliers_supplier ON public.organization_suppliers(platform_supplier_id);

-- =====================================================
-- PART 3: MIGRATE EXISTING SUPPLIER DATA
-- =====================================================

-- Insert existing suppliers as platform suppliers (deduplicate by name)
INSERT INTO public.platform_suppliers (
  id,
  name,
  website,
  contact_email,
  contact_name,
  industry_sector,
  country,
  description,
  created_at,
  updated_at
)
SELECT DISTINCT ON (LOWER(TRIM(s.name)))
  gen_random_uuid(),
  TRIM(s.name),
  s.website,
  s.contact_email,
  s.contact_name,
  s.industry_sector,
  s.country,
  s.notes,
  MIN(s.created_at) OVER (PARTITION BY LOWER(TRIM(s.name))),
  now()
FROM public.suppliers s
WHERE s.name IS NOT NULL AND TRIM(s.name) != ''
ON CONFLICT (name) DO NOTHING;

-- Create organization-supplier relationships for existing suppliers
INSERT INTO public.organization_suppliers (
  organization_id,
  platform_supplier_id,
  annual_spend,
  spend_currency,
  engagement_status,
  notes,
  added_at
)
SELECT
  s.organization_id,
  ps.id,
  s.annual_spend,
  COALESCE(s.spend_currency, 'GBP'),
  'active',
  s.notes,
  s.created_at
FROM public.suppliers s
INNER JOIN public.platform_suppliers ps
  ON LOWER(TRIM(s.name)) = LOWER(TRIM(ps.name))
ON CONFLICT (organization_id, platform_supplier_id) DO NOTHING;

-- =====================================================
-- PART 4: ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on platform_suppliers
ALTER TABLE public.platform_suppliers ENABLE ROW LEVEL SECURITY;

-- Public read access to platform suppliers
CREATE POLICY "Anyone can view platform suppliers"
  ON public.platform_suppliers
  FOR SELECT
  TO authenticated
  USING (true);

-- Only platform admins can insert platform suppliers
CREATE POLICY "Platform admins can create suppliers"
  ON public.platform_suppliers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
      AND o.is_platform_admin = true
    )
  );

-- Only platform admins can update platform suppliers
CREATE POLICY "Platform admins can update suppliers"
  ON public.platform_suppliers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
      AND o.is_platform_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
      AND o.is_platform_admin = true
    )
  );

-- Only platform admins can delete platform suppliers
CREATE POLICY "Platform admins can delete suppliers"
  ON public.platform_suppliers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
      AND o.is_platform_admin = true
    )
  );

-- Enable RLS on organization_suppliers
ALTER TABLE public.organization_suppliers ENABLE ROW LEVEL SECURITY;

-- Organization members can view their organization's supplier relationships
CREATE POLICY "Organization members can view their suppliers"
  ON public.organization_suppliers
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Organization admins can add supplier relationships
CREATE POLICY "Organization admins can add suppliers"
  ON public.organization_suppliers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      JOIN public.roles r ON r.id = om.role_id
      WHERE om.user_id = auth.uid()
      AND r.name IN ('admin', 'owner')
    )
  );

-- Organization admins can update their supplier relationships
CREATE POLICY "Organization admins can update suppliers"
  ON public.organization_suppliers
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      JOIN public.roles r ON r.id = om.role_id
      WHERE om.user_id = auth.uid()
      AND r.name IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      JOIN public.roles r ON r.id = om.role_id
      WHERE om.user_id = auth.uid()
      AND r.name IN ('admin', 'owner')
    )
  );

-- Organization admins can remove supplier relationships
CREATE POLICY "Organization admins can remove suppliers"
  ON public.organization_suppliers
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      JOIN public.roles r ON r.id = om.role_id
      WHERE om.user_id = auth.uid()
      AND r.name IN ('admin', 'owner')
    )
  );

-- =====================================================
-- PART 5: CREATE HELPER VIEWS
-- =====================================================

-- View: Organization suppliers with platform supplier details
CREATE OR REPLACE VIEW public.organization_suppliers_view AS
SELECT
  os.id,
  os.organization_id,
  os.platform_supplier_id,
  ps.name as supplier_name,
  ps.website,
  ps.contact_email,
  ps.contact_name,
  ps.industry_sector,
  ps.country,
  ps.description,
  ps.logo_url,
  ps.is_verified,
  os.annual_spend,
  os.spend_currency,
  os.relationship_type,
  os.engagement_status,
  os.notes,
  os.added_at,
  os.updated_at
FROM public.organization_suppliers os
INNER JOIN public.platform_suppliers ps ON ps.id = os.platform_supplier_id;

COMMENT ON VIEW public.organization_suppliers_view IS
  'Combines organization supplier relationships with platform supplier details.';
