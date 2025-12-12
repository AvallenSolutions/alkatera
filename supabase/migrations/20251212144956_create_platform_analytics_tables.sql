/*
  # Create Platform Analytics Tables for Alkatera Admin

  ## Overview
  This migration creates tables to track platform-wide usage metrics for Alkatera
  administrators. These tables contain ONLY aggregated/anonymized data - no
  organization private materiality data is stored or accessible.

  ## 1. New Tables
    ### `platform_usage_metrics`
      - Daily aggregated platform metrics
      - Active users, organizations, calculations, etc.

    ### `platform_organization_stats`
      - Organization-level activity tracking (anonymized)
      - No private data, only activity counts

    ### `platform_feature_usage`
      - Feature adoption tracking
      - Which features are used most across platform

  ## 2. Security
    - RLS enabled on all tables
    - ONLY Alkatera admins can view these tables
    - Regular organisation users/admins have NO access
    - No private materiality data is stored

  ## 3. Important Notes
    - These tables do NOT store emission values, product data, or supplier info
    - Only counts, timestamps, and anonymized identifiers
    - Designed for platform health monitoring and business analytics
*/

-- ============================================================================
-- STEP 1: Create platform_usage_metrics table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Time period
  metric_date DATE NOT NULL,
  
  -- User metrics
  total_users INTEGER NOT NULL DEFAULT 0,
  active_users_daily INTEGER NOT NULL DEFAULT 0,
  new_users INTEGER NOT NULL DEFAULT 0,
  
  -- Organization metrics
  total_organizations INTEGER NOT NULL DEFAULT 0,
  active_organizations_daily INTEGER NOT NULL DEFAULT 0,
  new_organizations INTEGER NOT NULL DEFAULT 0,
  
  -- Activity metrics (counts only, no values)
  lca_calculations_run INTEGER NOT NULL DEFAULT 0,
  products_created INTEGER NOT NULL DEFAULT 0,
  facilities_added INTEGER NOT NULL DEFAULT 0,
  reports_generated INTEGER NOT NULL DEFAULT 0,
  data_submissions INTEGER NOT NULL DEFAULT 0,
  approvals_processed INTEGER NOT NULL DEFAULT 0,
  
  -- System metrics
  api_requests INTEGER NOT NULL DEFAULT 0,
  edge_function_invocations INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(metric_date)
);

CREATE INDEX IF NOT EXISTS idx_platform_usage_metrics_date 
  ON public.platform_usage_metrics(metric_date DESC);

ALTER TABLE public.platform_usage_metrics ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Create platform_organization_stats table (anonymized)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_organization_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Organization reference (for internal tracking, not exposed)
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Time period
  stat_date DATE NOT NULL,
  
  -- Activity counts (no values, just counts)
  member_count INTEGER NOT NULL DEFAULT 0,
  product_count INTEGER NOT NULL DEFAULT 0,
  facility_count INTEGER NOT NULL DEFAULT 0,
  lca_count INTEGER NOT NULL DEFAULT 0,
  
  -- Engagement metrics
  logins_count INTEGER NOT NULL DEFAULT 0,
  actions_count INTEGER NOT NULL DEFAULT 0,
  
  -- Feature usage flags (no values)
  uses_scope1_tracking BOOLEAN DEFAULT false,
  uses_scope2_tracking BOOLEAN DEFAULT false,
  uses_scope3_tracking BOOLEAN DEFAULT false,
  uses_lca_module BOOLEAN DEFAULT false,
  uses_supplier_module BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(organization_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_platform_org_stats_date 
  ON public.platform_organization_stats(stat_date DESC);
CREATE INDEX IF NOT EXISTS idx_platform_org_stats_org 
  ON public.platform_organization_stats(organization_id);

ALTER TABLE public.platform_organization_stats ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: Create platform_feature_usage table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Time period
  usage_date DATE NOT NULL,
  
  -- Feature identifier
  feature_name TEXT NOT NULL,
  feature_category TEXT NOT NULL,
  
  -- Usage metrics
  total_uses INTEGER NOT NULL DEFAULT 0,
  unique_users INTEGER NOT NULL DEFAULT 0,
  unique_organizations INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(usage_date, feature_name)
);

CREATE INDEX IF NOT EXISTS idx_platform_feature_usage_date 
  ON public.platform_feature_usage(usage_date DESC);
CREATE INDEX IF NOT EXISTS idx_platform_feature_usage_feature 
  ON public.platform_feature_usage(feature_name);

ALTER TABLE public.platform_feature_usage ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Create platform_activity_log table (anonymized audit trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Activity details (anonymized)
  activity_type TEXT NOT NULL,
  activity_category TEXT NOT NULL,
  
  -- Optional org reference (for aggregation, not exposed in detail)
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  
  -- No user IDs stored - privacy by design
  
  -- Timestamp
  activity_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Metadata (no private data)
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_platform_activity_log_timestamp 
  ON public.platform_activity_log(activity_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_platform_activity_log_type 
  ON public.platform_activity_log(activity_type);

ALTER TABLE public.platform_activity_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: RLS Policies - ONLY Alkatera admins can access
-- ============================================================================

-- platform_usage_metrics
CREATE POLICY "Only Alkatera admins can view platform usage metrics"
  ON public.platform_usage_metrics
  FOR SELECT
  TO authenticated
  USING (is_alkatera_admin());

CREATE POLICY "Only Alkatera admins can insert platform usage metrics"
  ON public.platform_usage_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (is_alkatera_admin());

-- platform_organization_stats
CREATE POLICY "Only Alkatera admins can view org stats"
  ON public.platform_organization_stats
  FOR SELECT
  TO authenticated
  USING (is_alkatera_admin());

CREATE POLICY "Only Alkatera admins can insert org stats"
  ON public.platform_organization_stats
  FOR INSERT
  TO authenticated
  WITH CHECK (is_alkatera_admin());

-- platform_feature_usage
CREATE POLICY "Only Alkatera admins can view feature usage"
  ON public.platform_feature_usage
  FOR SELECT
  TO authenticated
  USING (is_alkatera_admin());

CREATE POLICY "Only Alkatera admins can insert feature usage"
  ON public.platform_feature_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (is_alkatera_admin());

-- platform_activity_log
CREATE POLICY "Only Alkatera admins can view activity log"
  ON public.platform_activity_log
  FOR SELECT
  TO authenticated
  USING (is_alkatera_admin());

CREATE POLICY "System can insert activity log"
  ON public.platform_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- STEP 6: Create function to log platform activity (privacy-safe)
-- ============================================================================

CREATE OR REPLACE FUNCTION log_platform_activity(
  p_activity_type TEXT,
  p_activity_category TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.platform_activity_log (
    activity_type,
    activity_category,
    organization_id,
    metadata
  ) VALUES (
    p_activity_type,
    p_activity_category,
    get_current_organization_id(),
    p_metadata
  );
END;
$$;

COMMENT ON FUNCTION log_platform_activity(TEXT, TEXT, JSONB) IS 
  'Log platform activity for analytics without storing user-identifying information';

-- ============================================================================
-- STEP 7: Create view for Alkatera admin dashboard summary
-- ============================================================================

CREATE OR REPLACE VIEW public.platform_dashboard_summary AS
SELECT
  -- Latest metrics
  (SELECT COUNT(*) FROM public.profiles) as total_users,
  (SELECT COUNT(*) FROM public.organizations) as total_organizations,
  (SELECT COUNT(*) FROM public.products) as total_products,
  (SELECT COUNT(*) FROM public.facilities) as total_facilities,
  
  -- Today's activity (counts only)
  (SELECT COUNT(*) FROM public.platform_activity_log 
   WHERE activity_timestamp::date = CURRENT_DATE) as activities_today,
  
  -- Pending approvals across platform
  (SELECT COUNT(*) FROM public.pending_activity_data WHERE approval_status = 'pending') +
  (SELECT COUNT(*) FROM public.pending_facilities WHERE approval_status = 'pending') +
  (SELECT COUNT(*) FROM public.pending_products WHERE approval_status = 'pending') +
  (SELECT COUNT(*) FROM public.pending_suppliers WHERE approval_status = 'pending') as total_pending_approvals,
  
  -- Unverified supplier products
  (SELECT COUNT(*) FROM public.supplier_products WHERE is_verified = false) as unverified_supplier_products;

COMMENT ON VIEW public.platform_dashboard_summary IS 
  'Aggregated platform statistics for Alkatera admin dashboard - no private data exposed';

-- ============================================================================
-- STEP 8: Table comments
-- ============================================================================

COMMENT ON TABLE public.platform_usage_metrics IS 
  'Daily aggregated platform usage metrics - no private organization data';
COMMENT ON TABLE public.platform_organization_stats IS 
  'Organization activity statistics for platform analytics - counts only, no values';
COMMENT ON TABLE public.platform_feature_usage IS 
  'Feature adoption tracking across the platform';
COMMENT ON TABLE public.platform_activity_log IS 
  'Anonymized activity log for platform analytics';
