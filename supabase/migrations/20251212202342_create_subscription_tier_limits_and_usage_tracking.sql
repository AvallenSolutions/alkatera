/*
  # Subscription Tier Limits and Usage Tracking System

  ## Overview
  This migration implements a comprehensive tier-based usage tracking system with:
  - Tier configuration table defining limits for each subscription level
  - Usage tracking columns on organizations
  - Database functions for checking and enforcing limits
  - Automatic triggers for tracking usage

  ## 1. New Table: `subscription_tier_limits`
  Defines numeric limits for each tier:
  - max_products (integer, null = unlimited)
  - max_reports_per_month (integer, null = unlimited)
  - max_team_members (integer, null = unlimited)
  - max_facilities (integer, null = unlimited)
  - max_suppliers (integer, null = unlimited)

  ## 2. New Columns on `organizations`
  - current_product_count (integer)
  - current_report_count_monthly (integer)
  - report_count_reset_at (timestamptz)

  ## 3. New Table: `organization_usage_log`
  Tracks all usage-related events for audit and analytics

  ## 4. Database Functions
  - check_product_limit() - Verifies organization can create product
  - check_report_limit() - Verifies organization can generate report
  - get_organization_usage() - Returns current usage and limits
  - increment_product_count() - Safely increments product counter
  - increment_report_count() - Safely increments report counter

  ## 5. Security
  - RLS enabled on all tables
  - Only authenticated users can view tier limits
  - Usage log restricted to organization members
*/

-- ============================================================================
-- STEP 1: Create subscription_tier_limits table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_tier_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name TEXT NOT NULL UNIQUE,
  tier_level INTEGER NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  
  -- Resource limits (NULL = unlimited)
  max_products INTEGER DEFAULT NULL,
  max_reports_per_month INTEGER DEFAULT NULL,
  max_team_members INTEGER DEFAULT NULL,
  max_facilities INTEGER DEFAULT NULL,
  max_suppliers INTEGER DEFAULT NULL,
  max_lcas INTEGER DEFAULT NULL,
  
  -- API limits
  max_api_calls_per_month INTEGER DEFAULT NULL,
  
  -- Storage limits (in MB)
  max_storage_mb INTEGER DEFAULT NULL,
  
  -- Feature flags for this tier
  features_enabled JSONB DEFAULT '[]'::jsonb,
  
  -- Pricing info (for display purposes)
  monthly_price_gbp NUMERIC(10, 2) DEFAULT NULL,
  annual_price_gbp NUMERIC(10, 2) DEFAULT NULL,
  
  -- Metadata
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_tier_name CHECK (tier_name IN ('basic', 'premium', 'enterprise')),
  CONSTRAINT valid_tier_level CHECK (tier_level BETWEEN 1 AND 3)
);

COMMENT ON TABLE public.subscription_tier_limits IS 
  'Defines resource and feature limits for each subscription tier. NULL values indicate unlimited.';

COMMENT ON COLUMN public.subscription_tier_limits.tier_level IS 
  'Internal tier level: 1=basic, 2=premium, 3=enterprise';

-- Populate tier limits
INSERT INTO public.subscription_tier_limits (
  tier_name, tier_level, display_name, 
  max_products, max_reports_per_month, max_team_members, 
  max_facilities, max_suppliers, max_lcas,
  max_api_calls_per_month, max_storage_mb,
  features_enabled, description
) VALUES 
  (
    'basic', 1, 'Starter',
    10, 5, 3,
    2, 10, 10,
    NULL, 500,
    '["recipe_2016", "product_comparison"]'::jsonb,
    'Perfect for small businesses getting started with sustainability tracking'
  ),
  (
    'premium', 2, 'Professional',
    100, 50, 15,
    10, 100, 100,
    10000, 5000,
    '["recipe_2016", "ef_31", "ef_31_single_score", "pef_reports", "api_access", "product_comparison"]'::jsonb,
    'For growing businesses with advanced sustainability needs'
  ),
  (
    'enterprise', 3, 'Enterprise',
    NULL, NULL, NULL,
    NULL, NULL, NULL,
    NULL, NULL,
    '["recipe_2016", "ef_31", "ef_31_single_score", "custom_weighting", "pef_reports", "api_access", "product_comparison", "white_label"]'::jsonb,
    'Unlimited access for large organisations with custom requirements'
  )
ON CONFLICT (tier_name) DO UPDATE SET
  tier_level = EXCLUDED.tier_level,
  display_name = EXCLUDED.display_name,
  max_products = EXCLUDED.max_products,
  max_reports_per_month = EXCLUDED.max_reports_per_month,
  max_team_members = EXCLUDED.max_team_members,
  max_facilities = EXCLUDED.max_facilities,
  max_suppliers = EXCLUDED.max_suppliers,
  max_lcas = EXCLUDED.max_lcas,
  max_api_calls_per_month = EXCLUDED.max_api_calls_per_month,
  max_storage_mb = EXCLUDED.max_storage_mb,
  features_enabled = EXCLUDED.features_enabled,
  description = EXCLUDED.description,
  updated_at = now();

-- Enable RLS
ALTER TABLE public.subscription_tier_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tier limits"
  ON public.subscription_tier_limits
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- STEP 2: Add usage tracking columns to organizations
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'organizations'
    AND column_name = 'current_product_count'
  ) THEN
    ALTER TABLE public.organizations
      ADD COLUMN current_product_count INTEGER NOT NULL DEFAULT 0;
    
    COMMENT ON COLUMN public.organizations.current_product_count IS
      'Current count of products for this organization';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'organizations'
    AND column_name = 'current_report_count_monthly'
  ) THEN
    ALTER TABLE public.organizations
      ADD COLUMN current_report_count_monthly INTEGER NOT NULL DEFAULT 0;
    
    COMMENT ON COLUMN public.organizations.current_report_count_monthly IS
      'Current count of reports generated this month';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'organizations'
    AND column_name = 'report_count_reset_at'
  ) THEN
    ALTER TABLE public.organizations
      ADD COLUMN report_count_reset_at TIMESTAMPTZ DEFAULT date_trunc('month', now());
    
    COMMENT ON COLUMN public.organizations.report_count_reset_at IS
      'Timestamp when report count was last reset (monthly)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'organizations'
    AND column_name = 'current_lca_count'
  ) THEN
    ALTER TABLE public.organizations
      ADD COLUMN current_lca_count INTEGER NOT NULL DEFAULT 0;
    
    COMMENT ON COLUMN public.organizations.current_lca_count IS
      'Current count of LCAs for this organization';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Create organization_usage_log table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.organization_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Event details
  event_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  
  -- Limit check results
  limit_checked INTEGER,
  current_usage INTEGER,
  was_allowed BOOLEAN NOT NULL DEFAULT true,
  denial_reason TEXT,
  
  -- Context
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.organization_usage_log IS
  'Audit log for all usage-related events and limit checks';

CREATE INDEX IF NOT EXISTS idx_usage_log_org_date 
  ON public.organization_usage_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_log_event_type 
  ON public.organization_usage_log(event_type);

ALTER TABLE public.organization_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization usage logs"
  ON public.organization_usage_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.roles r ON om.role_id = r.id
      WHERE om.organization_id = organization_usage_log.organization_id
      AND om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- STEP 4: Create helper functions for limit checking
-- ============================================================================

-- Function to get tier level from tier name
CREATE OR REPLACE FUNCTION public.get_tier_level(p_tier_name TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE p_tier_name
    WHEN 'basic' THEN 1
    WHEN 'premium' THEN 2
    WHEN 'enterprise' THEN 3
    ELSE 1
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if a feature is available for a tier
CREATE OR REPLACE FUNCTION public.check_feature_access(
  p_organization_id UUID,
  p_feature_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_tier TEXT;
  v_status TEXT;
  v_features JSONB;
  v_has_access BOOLEAN;
BEGIN
  SELECT subscription_tier, subscription_status
  INTO v_tier, v_status
  FROM public.organizations
  WHERE id = p_organization_id;

  IF v_tier IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Organization not found',
      'tier', null
    );
  END IF;

  IF v_status NOT IN ('active', 'trial') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Subscription is ' || v_status,
      'tier', v_tier
    );
  END IF;

  SELECT features_enabled INTO v_features
  FROM public.subscription_tier_limits
  WHERE tier_name = v_tier;

  v_has_access := v_features ? p_feature_code;

  RETURN jsonb_build_object(
    'allowed', v_has_access,
    'reason', CASE WHEN v_has_access THEN null ELSE 'Feature not available in ' || v_tier || ' tier' END,
    'tier', v_tier,
    'feature', p_feature_code
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to check product creation limit
CREATE OR REPLACE FUNCTION public.check_product_limit(
  p_organization_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_tier TEXT;
  v_status TEXT;
  v_current_count INTEGER;
  v_max_count INTEGER;
  v_can_create BOOLEAN;
BEGIN
  SELECT subscription_tier, subscription_status, current_product_count
  INTO v_tier, v_status, v_current_count
  FROM public.organizations
  WHERE id = p_organization_id;

  IF v_tier IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Organization not found',
      'current_count', 0,
      'max_count', 0
    );
  END IF;

  IF v_status NOT IN ('active', 'trial') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Subscription is ' || v_status,
      'current_count', v_current_count,
      'max_count', 0
    );
  END IF;

  SELECT max_products INTO v_max_count
  FROM public.subscription_tier_limits
  WHERE tier_name = v_tier;

  -- NULL means unlimited
  v_can_create := v_max_count IS NULL OR v_current_count < v_max_count;

  RETURN jsonb_build_object(
    'allowed', v_can_create,
    'reason', CASE 
      WHEN v_can_create THEN null 
      ELSE 'Product limit reached (' || v_current_count || '/' || v_max_count || '). Upgrade to create more products.'
    END,
    'current_count', v_current_count,
    'max_count', v_max_count,
    'tier', v_tier,
    'is_unlimited', v_max_count IS NULL
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to check report generation limit
CREATE OR REPLACE FUNCTION public.check_report_limit(
  p_organization_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_tier TEXT;
  v_status TEXT;
  v_current_count INTEGER;
  v_max_count INTEGER;
  v_reset_at TIMESTAMPTZ;
  v_can_generate BOOLEAN;
BEGIN
  SELECT subscription_tier, subscription_status, current_report_count_monthly, report_count_reset_at
  INTO v_tier, v_status, v_current_count, v_reset_at
  FROM public.organizations
  WHERE id = p_organization_id;

  IF v_tier IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Organization not found',
      'current_count', 0,
      'max_count', 0
    );
  END IF;

  -- Check if we need to reset monthly counter
  IF v_reset_at IS NULL OR v_reset_at < date_trunc('month', now()) THEN
    UPDATE public.organizations
    SET current_report_count_monthly = 0,
        report_count_reset_at = date_trunc('month', now())
    WHERE id = p_organization_id;
    v_current_count := 0;
  END IF;

  IF v_status NOT IN ('active', 'trial') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Subscription is ' || v_status,
      'current_count', v_current_count,
      'max_count', 0
    );
  END IF;

  SELECT max_reports_per_month INTO v_max_count
  FROM public.subscription_tier_limits
  WHERE tier_name = v_tier;

  v_can_generate := v_max_count IS NULL OR v_current_count < v_max_count;

  RETURN jsonb_build_object(
    'allowed', v_can_generate,
    'reason', CASE 
      WHEN v_can_generate THEN null 
      ELSE 'Monthly report limit reached (' || v_current_count || '/' || v_max_count || '). Upgrade for more reports.'
    END,
    'current_count', v_current_count,
    'max_count', v_max_count,
    'tier', v_tier,
    'is_unlimited', v_max_count IS NULL,
    'resets_at', date_trunc('month', now()) + interval '1 month'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check LCA creation limit
CREATE OR REPLACE FUNCTION public.check_lca_limit(
  p_organization_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_tier TEXT;
  v_status TEXT;
  v_current_count INTEGER;
  v_max_count INTEGER;
  v_can_create BOOLEAN;
BEGIN
  SELECT subscription_tier, subscription_status, current_lca_count
  INTO v_tier, v_status, v_current_count
  FROM public.organizations
  WHERE id = p_organization_id;

  IF v_tier IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Organization not found',
      'current_count', 0,
      'max_count', 0
    );
  END IF;

  IF v_status NOT IN ('active', 'trial') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Subscription is ' || v_status,
      'current_count', v_current_count,
      'max_count', 0
    );
  END IF;

  SELECT max_lcas INTO v_max_count
  FROM public.subscription_tier_limits
  WHERE tier_name = v_tier;

  v_can_create := v_max_count IS NULL OR v_current_count < v_max_count;

  RETURN jsonb_build_object(
    'allowed', v_can_create,
    'reason', CASE 
      WHEN v_can_create THEN null 
      ELSE 'LCA limit reached (' || v_current_count || '/' || v_max_count || '). Upgrade to create more LCAs.'
    END,
    'current_count', v_current_count,
    'max_count', v_max_count,
    'tier', v_tier,
    'is_unlimited', v_max_count IS NULL
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to get complete organization usage summary
CREATE OR REPLACE FUNCTION public.get_organization_usage(
  p_organization_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_org RECORD;
  v_limits RECORD;
  v_team_count INTEGER;
  v_facility_count INTEGER;
  v_supplier_count INTEGER;
BEGIN
  SELECT * INTO v_org
  FROM public.organizations
  WHERE id = p_organization_id;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('error', 'Organization not found');
  END IF;

  SELECT * INTO v_limits
  FROM public.subscription_tier_limits
  WHERE tier_name = v_org.subscription_tier;

  -- Get current counts
  SELECT COUNT(*) INTO v_team_count
  FROM public.organization_members
  WHERE organization_id = p_organization_id;

  SELECT COUNT(*) INTO v_facility_count
  FROM public.facilities
  WHERE organization_id = p_organization_id;

  SELECT COUNT(*) INTO v_supplier_count
  FROM public.suppliers
  WHERE organization_id = p_organization_id;

  RETURN jsonb_build_object(
    'tier', jsonb_build_object(
      'name', v_org.subscription_tier,
      'level', v_limits.tier_level,
      'display_name', v_limits.display_name,
      'status', v_org.subscription_status
    ),
    'usage', jsonb_build_object(
      'products', jsonb_build_object(
        'current', v_org.current_product_count,
        'max', v_limits.max_products,
        'is_unlimited', v_limits.max_products IS NULL
      ),
      'reports_monthly', jsonb_build_object(
        'current', v_org.current_report_count_monthly,
        'max', v_limits.max_reports_per_month,
        'is_unlimited', v_limits.max_reports_per_month IS NULL,
        'resets_at', date_trunc('month', now()) + interval '1 month'
      ),
      'lcas', jsonb_build_object(
        'current', v_org.current_lca_count,
        'max', v_limits.max_lcas,
        'is_unlimited', v_limits.max_lcas IS NULL
      ),
      'team_members', jsonb_build_object(
        'current', v_team_count,
        'max', v_limits.max_team_members,
        'is_unlimited', v_limits.max_team_members IS NULL
      ),
      'facilities', jsonb_build_object(
        'current', v_facility_count,
        'max', v_limits.max_facilities,
        'is_unlimited', v_limits.max_facilities IS NULL
      ),
      'suppliers', jsonb_build_object(
        'current', v_supplier_count,
        'max', v_limits.max_suppliers,
        'is_unlimited', v_limits.max_suppliers IS NULL
      )
    ),
    'features', v_limits.features_enabled
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- STEP 5: Create increment functions with logging
-- ============================================================================

CREATE OR REPLACE FUNCTION public.increment_product_count(
  p_organization_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_check JSONB;
BEGIN
  v_check := public.check_product_limit(p_organization_id);
  
  IF (v_check->>'allowed')::boolean THEN
    UPDATE public.organizations
    SET current_product_count = current_product_count + 1
    WHERE id = p_organization_id;
    
    INSERT INTO public.organization_usage_log (
      organization_id, user_id, event_type, resource_type,
      limit_checked, current_usage, was_allowed
    ) VALUES (
      p_organization_id, p_user_id, 'create', 'product',
      (v_check->>'max_count')::integer,
      (v_check->>'current_count')::integer + 1,
      true
    );
  ELSE
    INSERT INTO public.organization_usage_log (
      organization_id, user_id, event_type, resource_type,
      limit_checked, current_usage, was_allowed, denial_reason
    ) VALUES (
      p_organization_id, p_user_id, 'create_blocked', 'product',
      (v_check->>'max_count')::integer,
      (v_check->>'current_count')::integer,
      false,
      v_check->>'reason'
    );
  END IF;
  
  RETURN v_check;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_report_count(
  p_organization_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_check JSONB;
BEGIN
  v_check := public.check_report_limit(p_organization_id);
  
  IF (v_check->>'allowed')::boolean THEN
    UPDATE public.organizations
    SET current_report_count_monthly = current_report_count_monthly + 1
    WHERE id = p_organization_id;
    
    INSERT INTO public.organization_usage_log (
      organization_id, user_id, event_type, resource_type,
      limit_checked, current_usage, was_allowed
    ) VALUES (
      p_organization_id, p_user_id, 'generate', 'report',
      (v_check->>'max_count')::integer,
      (v_check->>'current_count')::integer + 1,
      true
    );
  ELSE
    INSERT INTO public.organization_usage_log (
      organization_id, user_id, event_type, resource_type,
      limit_checked, current_usage, was_allowed, denial_reason
    ) VALUES (
      p_organization_id, p_user_id, 'generate_blocked', 'report',
      (v_check->>'max_count')::integer,
      (v_check->>'current_count')::integer,
      false,
      v_check->>'reason'
    );
  END IF;
  
  RETURN v_check;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_lca_count(
  p_organization_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_check JSONB;
BEGIN
  v_check := public.check_lca_limit(p_organization_id);
  
  IF (v_check->>'allowed')::boolean THEN
    UPDATE public.organizations
    SET current_lca_count = current_lca_count + 1
    WHERE id = p_organization_id;
    
    INSERT INTO public.organization_usage_log (
      organization_id, user_id, event_type, resource_type,
      limit_checked, current_usage, was_allowed
    ) VALUES (
      p_organization_id, p_user_id, 'create', 'lca',
      (v_check->>'max_count')::integer,
      (v_check->>'current_count')::integer + 1,
      true
    );
  ELSE
    INSERT INTO public.organization_usage_log (
      organization_id, user_id, event_type, resource_type,
      limit_checked, current_usage, was_allowed, denial_reason
    ) VALUES (
      p_organization_id, p_user_id, 'create_blocked', 'lca',
      (v_check->>'max_count')::integer,
      (v_check->>'current_count')::integer,
      false,
      v_check->>'reason'
    );
  END IF;
  
  RETURN v_check;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 6: Backfill existing organization usage counts
-- ============================================================================

UPDATE public.organizations o
SET 
  current_product_count = COALESCE((
    SELECT COUNT(*) FROM public.products p WHERE p.organization_id = o.id
  ), 0),
  current_lca_count = COALESCE((
    SELECT COUNT(*) FROM public.product_lcas pl WHERE pl.organization_id = o.id
  ), 0),
  current_report_count_monthly = 0,
  report_count_reset_at = date_trunc('month', now());

-- ============================================================================
-- STEP 7: Create trigger to auto-decrement on delete
-- ============================================================================

CREATE OR REPLACE FUNCTION public.decrement_product_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.organizations
  SET current_product_count = GREATEST(0, current_product_count - 1)
  WHERE id = OLD.organization_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_product_delete_decrement ON public.products;
CREATE TRIGGER on_product_delete_decrement
  AFTER DELETE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_product_count();

CREATE OR REPLACE FUNCTION public.decrement_lca_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.organizations
  SET current_lca_count = GREATEST(0, current_lca_count - 1)
  WHERE id = OLD.organization_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_lca_delete_decrement ON public.product_lcas;
CREATE TRIGGER on_lca_delete_decrement
  AFTER DELETE ON public.product_lcas
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_lca_count();

-- ============================================================================
-- STEP 8: Create view for tier comparison
-- ============================================================================

CREATE OR REPLACE VIEW public.subscription_tiers_comparison AS
SELECT 
  tier_name,
  tier_level,
  display_name,
  COALESCE(max_products::text, 'Unlimited') AS products_limit,
  COALESCE(max_reports_per_month::text, 'Unlimited') AS reports_per_month,
  COALESCE(max_team_members::text, 'Unlimited') AS team_members,
  COALESCE(max_facilities::text, 'Unlimited') AS facilities,
  COALESCE(max_suppliers::text, 'Unlimited') AS suppliers,
  COALESCE(max_lcas::text, 'Unlimited') AS lcas,
  features_enabled,
  description,
  monthly_price_gbp,
  annual_price_gbp
FROM public.subscription_tier_limits
WHERE is_active = true
ORDER BY tier_level;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_tier_count INTEGER;
  v_org_columns INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_tier_count FROM public.subscription_tier_limits;
  
  SELECT COUNT(*) INTO v_org_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
  AND table_name = 'organizations'
  AND column_name IN ('current_product_count', 'current_report_count_monthly', 'current_lca_count');
  
  RAISE NOTICE 'Subscription Tier Limits Migration Summary:';
  RAISE NOTICE '  Tier configurations: % (expected 3)', v_tier_count;
  RAISE NOTICE '  Usage tracking columns: % (expected 3)', v_org_columns;
  RAISE NOTICE '  Functions created: check_product_limit, check_report_limit, check_lca_limit, get_organization_usage';
  RAISE NOTICE '  Migration completed successfully';
END $$;
