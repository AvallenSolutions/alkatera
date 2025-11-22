/*
  # Create Ingredient Selection Audit Table
  
  ## Overview
  This migration creates the ingredient_selection_audit table to maintain a complete,
  immutable audit trail of every ingredient data source selection. This is critical
  for ISO 14044 compliance and defending against challenges that users "didn't know"
  they were using generic data when supplier-specific data was available.
  
  ## New Table: `ingredient_selection_audit`
  
  ### Purpose
  Creates "glass box" provenance for every ingredient added to an LCA, recording:
  - WHAT ingredient was selected
  - WHICH data source was chosen (OpenLCA generic, Supplier, or Primary)
  - WHAT alternatives were available but NOT chosen
  - WHO made the decision (user_id)
  - WHEN the decision was made (timestamp)
  - WHICH organization owns this decision (organization_id)
  
  ### Columns
  - `id` (uuid, primary key) - Unique identifier
  - `organization_id` (uuid, FK to organizations, required) - Multi-tenant isolation
  - `product_lca_id` (uuid, FK to product_lcas, required) - Links to parent LCA
  - `user_id` (uuid, FK to auth.users, required) - Individual accountability
  - `ingredient_name` (text, required) - Name of ingredient selected
  - `data_source` (text, required) - 'openlca', 'supplier', or 'primary'
  - `source_identifier` (text, nullable) - OpenLCA process ID or supplier product ID
  - `source_name` (text, nullable) - Supplier name or "Generic Database"
  - `alternatives_shown` (jsonb, default []) - Other options presented to user
  - `confirmation_timestamp` (timestamptz, required) - Exact moment of confirmation
  - `session_metadata` (jsonb, default {}) - Browser info, search query, etc.
  - `created_at` (timestamptz, required) - Record creation timestamp
  
  ## Security (RLS)
  - Organization-scoped access via organization_id
  - Users can view audit logs for their organization's LCAs
  - Users can insert audit logs for their organization's LCAs
  - No UPDATE or DELETE policies - audit logs are immutable once created
  
  ## Performance
  - Index on organization_id for tenant filtering
  - Index on product_lca_id for LCA-specific queries
  - Index on user_id for user activity reports
  - Index on confirmation_timestamp for chronological reports
  - Index on data_source for provenance analytics
  
  ## Data Integrity
  - Foreign key to organizations with CASCADE delete
  - Foreign key to product_lcas with CASCADE delete
  - Foreign key to auth.users (user cannot be deleted if audit logs exist)
  - Check constraint ensures data_source is valid enum value
  - Non-null constraints on critical audit fields
  
  ## Notes
  - Audit logs are append-only (no updates or deletes by users)
  - Provides defensible proof of conscious data source selection
  - Supports ISO 14044 data quality documentation requirements
  - Enables organization-wide data quality analytics
*/

-- ============================================================================
-- STEP 1: Create ingredient_selection_audit table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ingredient_selection_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_lca_id UUID NOT NULL REFERENCES public.product_lcas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  ingredient_name TEXT NOT NULL,
  data_source TEXT NOT NULL,
  source_identifier TEXT,
  source_name TEXT,
  alternatives_shown JSONB DEFAULT '[]'::jsonb,
  confirmation_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT valid_data_source CHECK (data_source IN ('openlca', 'supplier', 'primary')),
  CONSTRAINT non_empty_ingredient_name CHECK (length(trim(ingredient_name)) > 0)
);

-- ============================================================================
-- STEP 2: Add table and column comments
-- ============================================================================

COMMENT ON TABLE public.ingredient_selection_audit IS 
  'Immutable audit trail of ingredient data source selections. Provides glass box provenance for ISO 14044 compliance.';

COMMENT ON COLUMN public.ingredient_selection_audit.organization_id IS 
  'Organization that owns this audit record - enables multi-tenant data isolation';

COMMENT ON COLUMN public.ingredient_selection_audit.product_lca_id IS 
  'Foreign key to product LCA being built when this selection was made';

COMMENT ON COLUMN public.ingredient_selection_audit.user_id IS 
  'User who consciously selected this data source - individual accountability';

COMMENT ON COLUMN public.ingredient_selection_audit.ingredient_name IS 
  'Name of ingredient that was selected (denormalized for reporting)';

COMMENT ON COLUMN public.ingredient_selection_audit.data_source IS 
  'Type of data source: "openlca" (generic), "supplier" (primary from supplier), or "primary" (self-entered)';

COMMENT ON COLUMN public.ingredient_selection_audit.source_identifier IS 
  'External identifier - OpenLCA process UUID or supplier_product UUID';

COMMENT ON COLUMN public.ingredient_selection_audit.source_name IS 
  'Human-readable source name - supplier name or "Generic Database"';

COMMENT ON COLUMN public.ingredient_selection_audit.alternatives_shown IS 
  'Array of alternative options that were presented but not selected - proves informed choice';

COMMENT ON COLUMN public.ingredient_selection_audit.confirmation_timestamp IS 
  'Precise timestamp when user clicked confirmation button - legal audit timestamp';

COMMENT ON COLUMN public.ingredient_selection_audit.session_metadata IS 
  'Additional context: user agent, search query, screen size, etc.';

-- ============================================================================
-- STEP 3: Create performance indexes
-- ============================================================================

-- Primary tenant filtering index
CREATE INDEX IF NOT EXISTS idx_ingredient_audit_organization
  ON public.ingredient_selection_audit(organization_id);

-- LCA-specific audit trail queries
CREATE INDEX IF NOT EXISTS idx_ingredient_audit_lca
  ON public.ingredient_selection_audit(product_lca_id);

-- User activity tracking
CREATE INDEX IF NOT EXISTS idx_ingredient_audit_user
  ON public.ingredient_selection_audit(user_id);

-- Chronological reporting
CREATE INDEX IF NOT EXISTS idx_ingredient_audit_timestamp
  ON public.ingredient_selection_audit(confirmation_timestamp DESC);

-- Data quality analytics (e.g., "show all generic selections")
CREATE INDEX IF NOT EXISTS idx_ingredient_audit_data_source
  ON public.ingredient_selection_audit(data_source);

-- Composite index for org + LCA queries (most common pattern)
CREATE INDEX IF NOT EXISTS idx_ingredient_audit_org_lca
  ON public.ingredient_selection_audit(organization_id, product_lca_id);

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.ingredient_selection_audit ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS policies
-- ============================================================================

-- SELECT: Users can view audit logs for their organization
CREATE POLICY "Users can view audit logs for their organization"
  ON public.ingredient_selection_audit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members
      WHERE organization_members.organization_id = ingredient_selection_audit.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

-- INSERT: Users can create audit logs for their organization's LCAs
CREATE POLICY "Users can insert audit logs for their organization"
  ON public.ingredient_selection_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members
      WHERE organization_members.organization_id = ingredient_selection_audit.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

-- NOTE: No UPDATE or DELETE policies - audit logs are immutable

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT SELECT, INSERT ON public.ingredient_selection_audit TO authenticated;

-- ============================================================================
-- STEP 7: Create helper function for compliance reports
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_ingredient_audit_summary(p_lca_id UUID)
RETURNS TABLE (
  total_decisions BIGINT,
  openlca_count BIGINT,
  supplier_count BIGINT,
  primary_count BIGINT,
  unique_users BIGINT,
  data_quality_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_decisions,
    COUNT(*) FILTER (WHERE data_source = 'openlca')::BIGINT AS openlca_count,
    COUNT(*) FILTER (WHERE data_source = 'supplier')::BIGINT AS supplier_count,
    COUNT(*) FILTER (WHERE data_source = 'primary')::BIGINT AS primary_count,
    COUNT(DISTINCT user_id)::BIGINT AS unique_users,
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE (
        (COUNT(*) FILTER (WHERE data_source = 'primary') * 100.0) +
        (COUNT(*) FILTER (WHERE data_source = 'supplier') * 75.0) +
        (COUNT(*) FILTER (WHERE data_source = 'openlca') * 25.0)
      ) / COUNT(*)
    END AS data_quality_score
  FROM public.ingredient_selection_audit
  WHERE product_lca_id = p_lca_id;
END;
$$;

COMMENT ON FUNCTION public.get_ingredient_audit_summary IS 
  'Calculates data quality metrics for an LCA based on ingredient selections';

GRANT EXECUTE ON FUNCTION public.get_ingredient_audit_summary TO authenticated;
