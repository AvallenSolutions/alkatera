-- Migration: Enable org-level feature flags for admin-controlled beta access
--
-- The organizations.feature_flags JSONB column already exists (DEFAULT '{}').
-- This migration updates get_organization_usage and check_feature_access to
-- merge admin-granted org-level feature flags into the features list, so that
-- hasFeature() on the client and check_feature_access on the server both
-- respect per-organisation overrides.

-- ============================================================================
-- 1. Update get_organization_usage — merge org feature_flags into features
-- ============================================================================

CREATE OR REPLACE FUNCTION get_organization_usage(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
AS $$
DECLARE
  v_org RECORD;
  v_limits RECORD;
  v_product_count INTEGER;
  v_lca_count INTEGER;
  v_report_count INTEGER;
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

  -- Live counts from actual tables (not denormalized counters)
  SELECT COUNT(*) INTO v_product_count
  FROM public.products
  WHERE organization_id = p_organization_id;

  SELECT COUNT(*) INTO v_lca_count
  FROM public.product_carbon_footprints
  WHERE organization_id = p_organization_id;

  SELECT COUNT(*) INTO v_team_count
  FROM public.organization_members
  WHERE organization_id = p_organization_id;

  SELECT COUNT(*) INTO v_facility_count
  FROM public.facilities
  WHERE organization_id = p_organization_id;

  SELECT COUNT(*) INTO v_supplier_count
  FROM public.suppliers
  WHERE organization_id = p_organization_id;

  -- Reports: live count from product_carbon_footprints + generated_reports created this month
  SELECT
    (SELECT COUNT(*) FROM public.product_carbon_footprints
     WHERE organization_id = p_organization_id
       AND created_at >= date_trunc('month', now()))
    +
    (SELECT COUNT(*) FROM public.generated_reports
     WHERE organization_id = p_organization_id
       AND created_at >= date_trunc('month', now()))
  INTO v_report_count;

  -- Sync denormalized counters to match reality (self-healing)
  IF v_org.current_product_count != v_product_count
     OR v_org.current_lca_count != v_lca_count THEN
    UPDATE public.organizations
    SET current_product_count = v_product_count,
        current_lca_count = v_lca_count
    WHERE id = p_organization_id;
  END IF;

  RETURN jsonb_build_object(
    'tier', jsonb_build_object(
      'name', v_org.subscription_tier,
      'level', v_limits.tier_level,
      'display_name', v_limits.display_name,
      'status', v_org.subscription_status
    ),
    'usage', jsonb_build_object(
      'products', jsonb_build_object(
        'current', v_product_count,
        'max', v_limits.max_products,
        'is_unlimited', v_limits.max_products IS NULL
      ),
      'reports_monthly', jsonb_build_object(
        'current', v_report_count,
        'max', v_limits.max_reports_per_month,
        'is_unlimited', v_limits.max_reports_per_month IS NULL,
        'resets_at', date_trunc('month', now()) + interval '1 month'
      ),
      'lcas', jsonb_build_object(
        'current', v_lca_count,
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
    -- Merge tier features with org-level admin-granted feature flags
    'features', (
      SELECT COALESCE(jsonb_agg(DISTINCT f.code), '[]'::jsonb)
      FROM (
        -- Tier-level features
        SELECT jsonb_array_elements_text(COALESCE(v_limits.features_enabled, '[]'::jsonb)) AS code
        UNION
        -- Org-level admin-granted feature flags (keys where value is 'true')
        SELECT key AS code
        FROM jsonb_each_text(COALESCE(v_org.feature_flags, '{}'::jsonb))
        WHERE value = 'true'
      ) f
    )
  );
END;
$$;

-- ============================================================================
-- 2. Update check_feature_access — also check org-level feature flags
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."check_feature_access"("p_organization_id" "uuid", "p_feature_code" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_tier TEXT;
  v_status TEXT;
  v_has_feature BOOLEAN;
BEGIN
  -- Get organization tier and status
  SELECT subscription_tier, subscription_status
  INTO v_tier, v_status
  FROM public.organizations
  WHERE id = p_organization_id;

  IF v_tier IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Organization not found'
    );
  END IF;

  -- Check subscription status - allow active, trial, AND past_due (grace period)
  IF v_status NOT IN ('active', 'trial', 'past_due') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Subscription is ' || v_status,
      'tier', v_tier
    );
  END IF;

  -- Check if feature is enabled for this tier
  SELECT EXISTS(
    SELECT 1 FROM public.subscription_tier_limits
    WHERE tier = v_tier
    AND p_feature_code = ANY(features_enabled)
  ) INTO v_has_feature;

  -- Also check org-level feature flags (admin overrides)
  IF NOT v_has_feature THEN
    SELECT COALESCE(
      (feature_flags->>p_feature_code)::boolean,
      false
    )
    INTO v_has_feature
    FROM public.organizations
    WHERE id = p_organization_id;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_has_feature,
    'reason', CASE WHEN v_has_feature THEN 'Feature available' ELSE 'Feature not available on ' || v_tier || ' tier' END,
    'tier', v_tier,
    'feature', p_feature_code
  );
END;
$$;
