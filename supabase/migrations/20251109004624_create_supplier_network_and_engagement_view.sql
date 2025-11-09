/*
  # Create Supplier Network and Engagement View

  ## Overview
  This migration creates the supplier network management system for tracking
  supplier engagement in carbon footprint reporting. It establishes the data model
  for suppliers, their status, and provides an aggregated engagement view for
  dashboard display.

  ## Problem Being Solved
  Organizations need to:
  - Manage their supplier network for Scope 3 emissions tracking
  - Track supplier engagement status (invited, active, data provided)
  - Monitor data collection progress from supply chain
  - View engagement metrics at a glance
  - Ensure multi-tenant data isolation

  ## Solution Architecture

  ### Part 1: Supplier Tables
  Creates two core tables:
  1. `suppliers` - Stores supplier information and metadata
  2. `supplier_engagements` - Tracks engagement status and data submission

  ### Part 2: Supplier Engagement View
  Creates `supplier_engagement_view` that:
  - Aggregates suppliers by status for each organization
  - Counts suppliers in each engagement category
  - Calculates engagement percentages
  - Inherits RLS from base tables
  - Optimized for dashboard display

  ### Part 3: Security (RLS)
  - All tables use organization_id for tenant isolation
  - Policies use get_current_organization_id() as single source of truth
  - View inherits security automatically via security_invoker
  - Users only see their organization's suppliers

  ## Supplier Engagement Lifecycle

  ### Status Flow:
  1. **invited** - Supplier has been invited to provide data
  2. **active** - Supplier has accepted and is engaged
  3. **data_provided** - Supplier has submitted emissions data
  4. **inactive** - Supplier relationship paused or ended

  ## Tables Created

  ### 1. suppliers
  Stores supplier information
  
  Columns:
  - id (uuid, PK): Unique identifier
  - organization_id (uuid, FK): Which organization owns this supplier
  - name (text): Supplier company name
  - contact_email (text): Primary contact email
  - contact_name (text): Contact person name
  - industry_sector (text): Supplier's industry
  - country (text): Supplier's country
  - annual_spend (numeric): Estimated annual spend with supplier
  - spend_currency (text): Currency for spend amount
  - notes (text): Additional information
  - created_at (timestamptz): When supplier was added
  - updated_at (timestamptz): When supplier was last modified

  ### 2. supplier_engagements
  Tracks engagement status and data submission
  
  Columns:
  - id (uuid, PK): Unique identifier
  - supplier_id (uuid, FK): Which supplier this engagement is for
  - status (text): Current engagement status
  - invited_date (date): When invitation was sent
  - accepted_date (date): When supplier accepted
  - data_submitted_date (date): When data was provided
  - last_contact_date (date): Most recent contact
  - data_quality_score (numeric): Quality rating (0-100)
  - notes (text): Engagement notes
  - created_at (timestamptz): When engagement was created
  - updated_at (timestamptz): When engagement was last modified
  - created_by (uuid, FK): Who created the engagement

  ### 3. supplier_engagement_view (VIEW)
  Aggregated engagement metrics by status
  
  Columns:
  - organization_id (uuid): Organization identifier
  - status (text): Engagement status category
  - supplier_count (bigint): Number of suppliers in this status
  - percentage (numeric): Percentage of total suppliers
  - total_suppliers (bigint): Total supplier count for organization

  ## Security Model

  ### RLS Policies Created

  **suppliers table:**
  1. SELECT: Users can view suppliers from their organization
  2. INSERT: Authenticated users can create suppliers in their organization
  3. UPDATE: Users can update suppliers from their organization
  4. DELETE: Users can delete suppliers from their organization

  **supplier_engagements table:**
  1. SELECT: Users can view engagements for their organization's suppliers
  2. INSERT: Authenticated users can create engagements
  3. UPDATE: Users can update engagements for their organization's suppliers
  4. DELETE: Users can delete engagements for their organization's suppliers

  **supplier_engagement_view:**
  - Uses security_invoker = true
  - Inherits RLS from suppliers table automatically
  - No additional policies needed

  ## Performance Considerations
  - Index on organization_id for fast tenant filtering
  - Index on supplier_id for efficient joins
  - Index on status for aggregation queries
  - Composite indexes for common query patterns
*/

-- =====================================================
-- PART 1: CREATE SUPPLIER ENUM TYPE
-- =====================================================

-- Create enum type for engagement status
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'supplier_engagement_status') THEN
    CREATE TYPE supplier_engagement_status AS ENUM (
      'invited',
      'active', 
      'data_provided',
      'inactive'
    );
  END IF;
END $$;

COMMENT ON TYPE supplier_engagement_status IS 
  'Engagement status for suppliers: invited, active, data_provided, or inactive';

-- =====================================================
-- PART 2: CREATE SUPPLIERS TABLE
-- =====================================================

-- Table: suppliers
-- Stores supplier information for each organization
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_email text,
  contact_name text,
  industry_sector text,
  country text,
  annual_spend numeric,
  spend_currency text DEFAULT 'GBP',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_email CHECK (contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR contact_email IS NULL),
  CONSTRAINT positive_spend CHECK (annual_spend >= 0 OR annual_spend IS NULL)
);

COMMENT ON TABLE public.suppliers IS 
  'Stores supplier information for organizations. Used to track supply chain and Scope 3 emissions.';

COMMENT ON COLUMN public.suppliers.organization_id IS 
  'Foreign key to organizations table. Enables multi-tenant data isolation.';

COMMENT ON COLUMN public.suppliers.annual_spend IS 
  'Estimated annual spend with this supplier. Used for emissions allocation.';

COMMENT ON COLUMN public.suppliers.industry_sector IS 
  'Supplier industry sector. Helps with emissions estimation and benchmarking.';

-- =====================================================
-- PART 3: CREATE SUPPLIER ENGAGEMENTS TABLE
-- =====================================================

-- Table: supplier_engagements
-- Tracks engagement status and data submission for suppliers
CREATE TABLE IF NOT EXISTS public.supplier_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  status supplier_engagement_status NOT NULL DEFAULT 'invited',
  invited_date date,
  accepted_date date,
  data_submitted_date date,
  last_contact_date date,
  data_quality_score numeric CHECK (data_quality_score >= 0 AND data_quality_score <= 100),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  
  CONSTRAINT logical_dates CHECK (
    (accepted_date IS NULL OR invited_date IS NULL OR accepted_date >= invited_date) AND
    (data_submitted_date IS NULL OR accepted_date IS NULL OR data_submitted_date >= accepted_date)
  )
);

COMMENT ON TABLE public.supplier_engagements IS 
  'Tracks supplier engagement lifecycle from invitation to data submission. One engagement record per supplier.';

COMMENT ON COLUMN public.supplier_engagements.status IS 
  'Current engagement status: invited, active, data_provided, or inactive';

COMMENT ON COLUMN public.supplier_engagements.data_quality_score IS 
  'Quality rating of submitted data from 0-100. NULL if no data submitted.';

COMMENT ON COLUMN public.supplier_engagements.last_contact_date IS 
  'Most recent contact or interaction date. Used for follow-up tracking.';

-- =====================================================
-- PART 4: CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for fast organization filtering on suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_organization_id 
  ON public.suppliers(organization_id);

-- Index for supplier lookups on engagements
CREATE INDEX IF NOT EXISTS idx_supplier_engagements_supplier_id 
  ON public.supplier_engagements(supplier_id);

-- Index for status-based queries
CREATE INDEX IF NOT EXISTS idx_supplier_engagements_status 
  ON public.supplier_engagements(status);

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_supplier_engagements_invited_date 
  ON public.supplier_engagements(invited_date DESC);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_suppliers_org_name 
  ON public.suppliers(organization_id, name);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_suppliers_contact_email 
  ON public.suppliers(contact_email) WHERE contact_email IS NOT NULL;

-- =====================================================
-- PART 5: ENABLE ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on both tables
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_engagements ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 6: CREATE RLS POLICIES FOR SUPPLIERS TABLE
-- =====================================================

-- SELECT policy: Users can view suppliers from their organization
CREATE POLICY "Users can view suppliers from their organization"
  ON public.suppliers
  FOR SELECT
  TO authenticated
  USING (organization_id = get_current_organization_id());

-- INSERT policy: Users can create suppliers in their organization
CREATE POLICY "Users can create suppliers in their organization"
  ON public.suppliers
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_current_organization_id());

-- UPDATE policy: Users can update suppliers from their organization
CREATE POLICY "Users can update suppliers from their organization"
  ON public.suppliers
  FOR UPDATE
  TO authenticated
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

-- DELETE policy: Users can delete suppliers from their organization
CREATE POLICY "Users can delete suppliers from their organization"
  ON public.suppliers
  FOR DELETE
  TO authenticated
  USING (organization_id = get_current_organization_id());

-- =====================================================
-- PART 7: CREATE RLS POLICIES FOR SUPPLIER_ENGAGEMENTS
-- =====================================================

-- SELECT policy: Users can view engagements for their organization's suppliers
CREATE POLICY "Users can view engagements from their organization"
  ON public.supplier_engagements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.suppliers
      WHERE suppliers.id = supplier_engagements.supplier_id
      AND suppliers.organization_id = get_current_organization_id()
    )
  );

-- INSERT policy: Users can create engagements for their organization's suppliers
CREATE POLICY "Users can create engagements for their organization"
  ON public.supplier_engagements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.suppliers
      WHERE suppliers.id = supplier_engagements.supplier_id
      AND suppliers.organization_id = get_current_organization_id()
    )
  );

-- UPDATE policy: Users can update engagements for their organization's suppliers
CREATE POLICY "Users can update engagements from their organization"
  ON public.supplier_engagements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.suppliers
      WHERE suppliers.id = supplier_engagements.supplier_id
      AND suppliers.organization_id = get_current_organization_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.suppliers
      WHERE suppliers.id = supplier_engagements.supplier_id
      AND suppliers.organization_id = get_current_organization_id()
    )
  );

-- DELETE policy: Users can delete engagements for their organization's suppliers
CREATE POLICY "Users can delete engagements from their organization"
  ON public.supplier_engagements
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.suppliers
      WHERE suppliers.id = supplier_engagements.supplier_id
      AND suppliers.organization_id = get_current_organization_id()
    )
  );

-- =====================================================
-- PART 8: CREATE SUPPLIER ENGAGEMENT VIEW
-- =====================================================

-- Drop the view if it exists (for idempotency)
DROP VIEW IF EXISTS public.supplier_engagement_view CASCADE;

-- Create the optimized engagement view
-- Shows aggregated supplier counts by status
CREATE VIEW public.supplier_engagement_view
WITH (security_invoker = true)
AS
WITH org_totals AS (
  SELECT 
    s.organization_id,
    COUNT(DISTINCT s.id) as total_suppliers
  FROM public.suppliers s
  GROUP BY s.organization_id
)
SELECT 
  s.organization_id,
  COALESCE(se.status::text, 'no_engagement') as status,
  COUNT(DISTINCT s.id) as supplier_count,
  ROUND(
    (COUNT(DISTINCT s.id)::numeric / NULLIF(ot.total_suppliers, 0) * 100), 
    1
  ) as percentage,
  ot.total_suppliers
FROM public.suppliers s
LEFT JOIN public.supplier_engagements se ON s.id = se.supplier_id
INNER JOIN org_totals ot ON s.organization_id = ot.organization_id
GROUP BY s.organization_id, se.status, ot.total_suppliers
ORDER BY 
  CASE COALESCE(se.status::text, 'no_engagement')
    WHEN 'data_provided' THEN 1
    WHEN 'active' THEN 2
    WHEN 'invited' THEN 3
    WHEN 'inactive' THEN 4
    ELSE 5
  END;

COMMENT ON VIEW public.supplier_engagement_view IS 
  'Aggregated view of supplier engagement by status. Shows counts and percentages per organization. Uses security_invoker=true to inherit RLS from suppliers table.';

-- =====================================================
-- PART 9: GRANT PERMISSIONS
-- =====================================================

-- Grant permissions on tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_engagements TO authenticated;

-- Grant SELECT permission on view
GRANT SELECT ON public.supplier_engagement_view TO authenticated;

-- =====================================================
-- PART 10: CREATE HELPER FUNCTION FOR UPDATING TIMESTAMPS
-- =====================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_supplier_engagements_updated_at ON public.supplier_engagements;
CREATE TRIGGER update_supplier_engagements_updated_at
  BEFORE UPDATE ON public.supplier_engagements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON FUNCTION public.update_updated_at_column() IS 
  'Automatically updates the updated_at timestamp on row modification';
