/*
  # Create Pending Data Tables for Approval Workflow

  ## Overview
  This migration creates tables to store data submissions from organisation users
  that require approval by organisation admins before being committed to the main tables.

  ## 1. New ENUM Type
    - `approval_status_enum` - pending, approved, rejected

  ## 2. New Tables
    ### `pending_activity_data`
      - Mirrors activity_data structure
      - Adds approval workflow fields

    ### `pending_facilities`
      - Mirrors facilities structure

    ### `pending_products`
      - Mirrors products structure (uses BIGINT for original_id)

    ### `pending_suppliers`
      - Mirrors suppliers structure

  ## 3. Security
    - RLS enabled on all tables
    - Users can only see their own submissions
    - Admins can see all pending submissions for their organisation
*/

-- ============================================================================
-- STEP 1: Create approval status enum
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE approval_status_enum AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- STEP 2: Create pending_activity_data table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pending_activity_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  activity_date DATE NOT NULL,
  facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL,
  notes TEXT,
  
  approval_status approval_status_enum NOT NULL DEFAULT 'pending',
  submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  original_id UUID REFERENCES public.activity_data(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_activity_data_org_id 
  ON public.pending_activity_data(organization_id);
CREATE INDEX IF NOT EXISTS idx_pending_activity_data_status 
  ON public.pending_activity_data(approval_status);
CREATE INDEX IF NOT EXISTS idx_pending_activity_data_submitted_by 
  ON public.pending_activity_data(submitted_by);

ALTER TABLE public.pending_activity_data ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: Create pending_facilities table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pending_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  location TEXT,
  facility_type TEXT,
  facility_type_id UUID REFERENCES public.facility_types(id),
  address TEXT,
  city TEXT,
  country TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  is_contract_manufacturer BOOLEAN DEFAULT false,
  notes TEXT,
  
  approval_status approval_status_enum NOT NULL DEFAULT 'pending',
  submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  original_id UUID REFERENCES public.facilities(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_facilities_org_id 
  ON public.pending_facilities(organization_id);
CREATE INDEX IF NOT EXISTS idx_pending_facilities_status 
  ON public.pending_facilities(approval_status);
CREATE INDEX IF NOT EXISTS idx_pending_facilities_submitted_by 
  ON public.pending_facilities(submitted_by);

ALTER TABLE public.pending_facilities ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Create pending_products table (uses BIGINT for original_id)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pending_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  product_description TEXT,
  product_image_url TEXT,
  sku TEXT,
  functional_unit_type public.functional_unit_type_enum,
  functional_unit_volume NUMERIC,
  functional_unit_measure public.functional_unit_measure_enum,
  system_boundary public.system_boundary_enum DEFAULT 'cradle-to-gate',
  product_category TEXT,
  is_draft BOOLEAN DEFAULT false,
  notes TEXT,
  
  approval_status approval_status_enum NOT NULL DEFAULT 'pending',
  submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  original_id BIGINT REFERENCES public.products(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_products_org_id 
  ON public.pending_products(organization_id);
CREATE INDEX IF NOT EXISTS idx_pending_products_status 
  ON public.pending_products(approval_status);
CREATE INDEX IF NOT EXISTS idx_pending_products_submitted_by 
  ON public.pending_products(submitted_by);

ALTER TABLE public.pending_products ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create pending_suppliers table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pending_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  contact_email TEXT,
  contact_name TEXT,
  phone TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  category TEXT,
  notes TEXT,
  
  approval_status approval_status_enum NOT NULL DEFAULT 'pending',
  submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  original_id UUID REFERENCES public.suppliers(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_suppliers_org_id 
  ON public.pending_suppliers(organization_id);
CREATE INDEX IF NOT EXISTS idx_pending_suppliers_status 
  ON public.pending_suppliers(approval_status);
CREATE INDEX IF NOT EXISTS idx_pending_suppliers_submitted_by 
  ON public.pending_suppliers(submitted_by);

ALTER TABLE public.pending_suppliers ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 6: Create updated_at triggers
-- ============================================================================

CREATE TRIGGER update_pending_activity_data_updated_at 
  BEFORE UPDATE ON public.pending_activity_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pending_facilities_updated_at 
  BEFORE UPDATE ON public.pending_facilities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pending_products_updated_at 
  BEFORE UPDATE ON public.pending_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pending_suppliers_updated_at 
  BEFORE UPDATE ON public.pending_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 7: RLS Policies for pending_activity_data
-- ============================================================================

CREATE POLICY "Users can view own pending activity data"
  ON public.pending_activity_data FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());

CREATE POLICY "Admins can view all pending activity data in org"
  ON public.pending_activity_data FOR SELECT TO authenticated
  USING (organization_id = get_current_organization_id() AND can_approve_data());

CREATE POLICY "Users can submit pending activity data"
  ON public.pending_activity_data FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_current_organization_id() AND submitted_by = auth.uid());

CREATE POLICY "Users can update own pending activity data"
  ON public.pending_activity_data FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid() AND approval_status = 'pending')
  WITH CHECK (submitted_by = auth.uid() AND approval_status = 'pending');

CREATE POLICY "Admins can review pending activity data"
  ON public.pending_activity_data FOR UPDATE TO authenticated
  USING (organization_id = get_current_organization_id() AND can_approve_data())
  WITH CHECK (organization_id = get_current_organization_id() AND can_approve_data());

CREATE POLICY "Users can delete own pending activity data"
  ON public.pending_activity_data FOR DELETE TO authenticated
  USING (submitted_by = auth.uid() AND approval_status = 'pending');

-- ============================================================================
-- STEP 8: RLS Policies for pending_facilities
-- ============================================================================

CREATE POLICY "Users can view own pending facilities"
  ON public.pending_facilities FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());

CREATE POLICY "Admins can view all pending facilities in org"
  ON public.pending_facilities FOR SELECT TO authenticated
  USING (organization_id = get_current_organization_id() AND can_approve_data());

CREATE POLICY "Users can submit pending facilities"
  ON public.pending_facilities FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_current_organization_id() AND submitted_by = auth.uid());

CREATE POLICY "Users can update own pending facilities"
  ON public.pending_facilities FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid() AND approval_status = 'pending')
  WITH CHECK (submitted_by = auth.uid() AND approval_status = 'pending');

CREATE POLICY "Admins can review pending facilities"
  ON public.pending_facilities FOR UPDATE TO authenticated
  USING (organization_id = get_current_organization_id() AND can_approve_data())
  WITH CHECK (organization_id = get_current_organization_id() AND can_approve_data());

CREATE POLICY "Users can delete own pending facilities"
  ON public.pending_facilities FOR DELETE TO authenticated
  USING (submitted_by = auth.uid() AND approval_status = 'pending');

-- ============================================================================
-- STEP 9: RLS Policies for pending_products
-- ============================================================================

CREATE POLICY "Users can view own pending products"
  ON public.pending_products FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());

CREATE POLICY "Admins can view all pending products in org"
  ON public.pending_products FOR SELECT TO authenticated
  USING (organization_id = get_current_organization_id() AND can_approve_data());

CREATE POLICY "Users can submit pending products"
  ON public.pending_products FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_current_organization_id() AND submitted_by = auth.uid());

CREATE POLICY "Users can update own pending products"
  ON public.pending_products FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid() AND approval_status = 'pending')
  WITH CHECK (submitted_by = auth.uid() AND approval_status = 'pending');

CREATE POLICY "Admins can review pending products"
  ON public.pending_products FOR UPDATE TO authenticated
  USING (organization_id = get_current_organization_id() AND can_approve_data())
  WITH CHECK (organization_id = get_current_organization_id() AND can_approve_data());

CREATE POLICY "Users can delete own pending products"
  ON public.pending_products FOR DELETE TO authenticated
  USING (submitted_by = auth.uid() AND approval_status = 'pending');

-- ============================================================================
-- STEP 10: RLS Policies for pending_suppliers
-- ============================================================================

CREATE POLICY "Users can view own pending suppliers"
  ON public.pending_suppliers FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());

CREATE POLICY "Admins can view all pending suppliers in org"
  ON public.pending_suppliers FOR SELECT TO authenticated
  USING (organization_id = get_current_organization_id() AND can_approve_data());

CREATE POLICY "Users can submit pending suppliers"
  ON public.pending_suppliers FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_current_organization_id() AND submitted_by = auth.uid());

CREATE POLICY "Users can update own pending suppliers"
  ON public.pending_suppliers FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid() AND approval_status = 'pending')
  WITH CHECK (submitted_by = auth.uid() AND approval_status = 'pending');

CREATE POLICY "Admins can review pending suppliers"
  ON public.pending_suppliers FOR UPDATE TO authenticated
  USING (organization_id = get_current_organization_id() AND can_approve_data())
  WITH CHECK (organization_id = get_current_organization_id() AND can_approve_data());

CREATE POLICY "Users can delete own pending suppliers"
  ON public.pending_suppliers FOR DELETE TO authenticated
  USING (submitted_by = auth.uid() AND approval_status = 'pending');

-- ============================================================================
-- STEP 11: Create summary view for admin dashboard
-- ============================================================================

CREATE OR REPLACE VIEW public.pending_approvals_summary AS
SELECT
  organization_id,
  'activity_data' as data_type,
  COUNT(*) FILTER (WHERE approval_status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE approval_status = 'approved') as approved_count,
  COUNT(*) FILTER (WHERE approval_status = 'rejected') as rejected_count
FROM public.pending_activity_data
GROUP BY organization_id
UNION ALL
SELECT
  organization_id, 'facilities' as data_type,
  COUNT(*) FILTER (WHERE approval_status = 'pending'),
  COUNT(*) FILTER (WHERE approval_status = 'approved'),
  COUNT(*) FILTER (WHERE approval_status = 'rejected')
FROM public.pending_facilities
GROUP BY organization_id
UNION ALL
SELECT
  organization_id, 'products' as data_type,
  COUNT(*) FILTER (WHERE approval_status = 'pending'),
  COUNT(*) FILTER (WHERE approval_status = 'approved'),
  COUNT(*) FILTER (WHERE approval_status = 'rejected')
FROM public.pending_products
GROUP BY organization_id
UNION ALL
SELECT
  organization_id, 'suppliers' as data_type,
  COUNT(*) FILTER (WHERE approval_status = 'pending'),
  COUNT(*) FILTER (WHERE approval_status = 'approved'),
  COUNT(*) FILTER (WHERE approval_status = 'rejected')
FROM public.pending_suppliers
GROUP BY organization_id;

COMMENT ON TABLE public.pending_activity_data IS 'Staging table for activity data awaiting admin approval';
COMMENT ON TABLE public.pending_facilities IS 'Staging table for facilities awaiting admin approval';
COMMENT ON TABLE public.pending_products IS 'Staging table for products awaiting admin approval';
COMMENT ON TABLE public.pending_suppliers IS 'Staging table for suppliers awaiting admin approval';
