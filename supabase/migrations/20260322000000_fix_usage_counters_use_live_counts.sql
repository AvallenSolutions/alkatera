-- Migration: Fix usage counters to use live COUNT(*) instead of denormalized counters
--
-- Problem: get_organization_usage, check_product_limit, check_lca_limit, and
-- check_report_limit read from denormalized counter columns on the organizations
-- table. These counters drift out of sync when code paths insert/delete rows
-- without calling the increment/decrement RPCs.
--
-- Fix: Update all functions to use live COUNT(*) from the actual tables.
-- Products: COUNT(*) from products table
-- LCAs: COUNT(*) from product_carbon_footprints table
-- Reports (Monthly): COUNT(*) from product_carbon_footprints + generated_reports created this month
-- (Team members, facilities, suppliers already used live COUNT(*) and are unchanged)

-- ============================================================================
-- 1. Fix get_organization_usage — use live counts for products, LCAs, and reports
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
    'features', v_limits.features_enabled
  );
END;
$$;

-- ============================================================================
-- 2. Fix check_product_limit — use live COUNT(*) from products table
-- ============================================================================

CREATE OR REPLACE FUNCTION check_product_limit(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_tier text;
  v_status text;
  v_current_count integer;
  v_max_count integer;
  v_can_create boolean;
BEGIN
  SELECT subscription_tier, subscription_status
  INTO v_tier, v_status
  FROM public.organizations
  WHERE id = p_organization_id;

  IF v_tier IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Organization not found',
      'current_count', 0,
      'max_count', 0,
      'tier', 'seed',
      'is_unlimited', false
    );
  END IF;

  -- Allow active, trial, pending (new onboarding), and past_due (grace period)
  IF v_status NOT IN ('active', 'trial', 'pending', 'past_due') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Subscription is ' || v_status,
      'current_count', 0,
      'max_count', 0,
      'tier', v_tier,
      'is_unlimited', false
    );
  END IF;

  -- Live count from actual products table
  SELECT COUNT(*) INTO v_current_count
  FROM public.products
  WHERE organization_id = p_organization_id;

  SELECT max_products INTO v_max_count
  FROM public.subscription_tier_limits
  WHERE tier_name = v_tier;

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
$$;

-- ============================================================================
-- 3. Fix check_lca_limit — use live COUNT(*) from product_carbon_footprints
-- ============================================================================

CREATE OR REPLACE FUNCTION check_lca_limit(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_tier text;
  v_status text;
  v_current_count integer;
  v_max_count integer;
  v_can_create boolean;
BEGIN
  SELECT subscription_tier, subscription_status
  INTO v_tier, v_status
  FROM public.organizations
  WHERE id = p_organization_id;

  IF v_tier IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Organization not found',
      'current_count', 0,
      'max_count', 0,
      'tier', 'seed',
      'is_unlimited', false
    );
  END IF;

  -- Allow active, trial, pending (new onboarding), and past_due (grace period)
  IF v_status NOT IN ('active', 'trial', 'pending', 'past_due') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Subscription is ' || v_status,
      'current_count', 0,
      'max_count', 0,
      'tier', v_tier,
      'is_unlimited', false
    );
  END IF;

  -- Live count from actual LCAs table
  SELECT COUNT(*) INTO v_current_count
  FROM public.product_carbon_footprints
  WHERE organization_id = p_organization_id;

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
$$;

-- ============================================================================
-- 4. Fix check_report_limit — use live COUNT(*) from product_carbon_footprints + generated_reports
-- ============================================================================

CREATE OR REPLACE FUNCTION check_report_limit(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_tier text;
  v_status text;
  v_current_count integer;
  v_max_count integer;
  v_can_generate boolean;
BEGIN
  SELECT subscription_tier, subscription_status
  INTO v_tier, v_status
  FROM public.organizations
  WHERE id = p_organization_id;

  IF v_tier IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Organization not found',
      'current_count', 0,
      'max_count', 0,
      'tier', 'seed',
      'is_unlimited', false
    );
  END IF;

  IF v_status NOT IN ('active', 'trial', 'pending', 'past_due') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Subscription is ' || v_status,
      'current_count', 0,
      'max_count', 0,
      'tier', v_tier,
      'is_unlimited', false
    );
  END IF;

  -- Live count from product_carbon_footprints + generated_reports created this month
  SELECT
    (SELECT COUNT(*) FROM public.product_carbon_footprints
     WHERE organization_id = p_organization_id
       AND created_at >= date_trunc('month', now()))
    +
    (SELECT COUNT(*) FROM public.generated_reports
     WHERE organization_id = p_organization_id
       AND created_at >= date_trunc('month', now()))
  INTO v_current_count;

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
$$;

-- ============================================================================
-- 5. Fix increment_report_count — use live count, keep usage logging
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_report_count(p_organization_id uuid, p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_check JSONB;
  v_actual_count INTEGER;
BEGIN
  v_check := public.check_report_limit(p_organization_id);

  -- Live count for logging
  SELECT
    (SELECT COUNT(*) FROM public.product_carbon_footprints
     WHERE organization_id = p_organization_id
       AND created_at >= date_trunc('month', now()))
    +
    (SELECT COUNT(*) FROM public.generated_reports
     WHERE organization_id = p_organization_id
       AND created_at >= date_trunc('month', now()))
  INTO v_actual_count;

  IF (v_check->>'allowed')::boolean THEN
    INSERT INTO public.organization_usage_log (
      organization_id, user_id, event_type, resource_type,
      limit_checked, current_usage, was_allowed
    ) VALUES (
      p_organization_id, p_user_id, 'generate', 'report',
      (v_check->>'max_count')::integer,
      v_actual_count,
      true
    );
  ELSE
    INSERT INTO public.organization_usage_log (
      organization_id, user_id, event_type, resource_type,
      limit_checked, current_usage, was_allowed, denial_reason
    ) VALUES (
      p_organization_id, p_user_id, 'generate_blocked', 'report',
      (v_check->>'max_count')::integer,
      v_actual_count,
      false,
      v_check->>'reason'
    );
  END IF;

  RETURN v_check;
END;
$$;

-- ============================================================================
-- 6. Fix increment_product_count — sync denormalized counter with reality
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_product_count(p_organization_id uuid, p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_check JSONB;
  v_actual_count INTEGER;
BEGIN
  v_check := public.check_product_limit(p_organization_id);

  -- Sync denormalized counter to actual count
  SELECT COUNT(*) INTO v_actual_count
  FROM public.products
  WHERE organization_id = p_organization_id;

  UPDATE public.organizations
  SET current_product_count = v_actual_count
  WHERE id = p_organization_id;

  IF (v_check->>'allowed')::boolean THEN
    INSERT INTO public.organization_usage_log (
      organization_id, user_id, event_type, resource_type,
      limit_checked, current_usage, was_allowed
    ) VALUES (
      p_organization_id, p_user_id, 'create', 'product',
      (v_check->>'max_count')::integer,
      v_actual_count,
      true
    );
  ELSE
    INSERT INTO public.organization_usage_log (
      organization_id, user_id, event_type, resource_type,
      limit_checked, current_usage, was_allowed, denial_reason
    ) VALUES (
      p_organization_id, p_user_id, 'create_blocked', 'product',
      (v_check->>'max_count')::integer,
      v_actual_count,
      false,
      v_check->>'reason'
    );
  END IF;

  RETURN v_check;
END;
$$;

-- ============================================================================
-- 7. Fix increment_lca_count — sync denormalized counter with reality
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_lca_count(p_organization_id uuid, p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_check JSONB;
  v_actual_count INTEGER;
BEGIN
  v_check := public.check_lca_limit(p_organization_id);

  -- Sync denormalized counter to actual count
  SELECT COUNT(*) INTO v_actual_count
  FROM public.product_carbon_footprints
  WHERE organization_id = p_organization_id;

  UPDATE public.organizations
  SET current_lca_count = v_actual_count
  WHERE id = p_organization_id;

  IF (v_check->>'allowed')::boolean THEN
    INSERT INTO public.organization_usage_log (
      organization_id, user_id, event_type, resource_type,
      limit_checked, current_usage, was_allowed
    ) VALUES (
      p_organization_id, p_user_id, 'create', 'lca',
      (v_check->>'max_count')::integer,
      v_actual_count,
      true
    );
  ELSE
    INSERT INTO public.organization_usage_log (
      organization_id, user_id, event_type, resource_type,
      limit_checked, current_usage, was_allowed, denial_reason
    ) VALUES (
      p_organization_id, p_user_id, 'create_blocked', 'lca',
      (v_check->>'max_count')::integer,
      v_actual_count,
      false,
      v_check->>'reason'
    );
  END IF;

  RETURN v_check;
END;
$$;

-- ============================================================================
-- 8. Drop unused lca_reports table and dependencies
--
-- The lca_reports table duplicates data already in product_carbon_footprints.
-- The LCA Reports page, usage counters, and all app code use
-- product_carbon_footprints exclusively. lca_reports has zero TypeScript
-- references and can be safely removed along with its child table
-- (lca_social_indicators), enum type, and trigger function.
-- ============================================================================

-- Drop child table first (has FK to lca_reports)
DROP TABLE IF EXISTS public.lca_social_indicators CASCADE;

-- Drop parent table
DROP TABLE IF EXISTS public.lca_reports CASCADE;

-- Drop the trigger function (no longer needed)
DROP FUNCTION IF EXISTS public.update_lca_reports_updated_at() CASCADE;

-- Drop the enum type (only used by lca_reports.status)
DROP TYPE IF EXISTS public.lca_report_status CASCADE;

-- ============================================================================
-- 9. Drop dead denormalized report counter columns from organizations
--
-- These columns were used by the old check_report_limit / increment_report_count
-- functions. Now that reports use live COUNT(*) from product_carbon_footprints
-- + generated_reports, these columns are no longer read or written by any code.
-- ============================================================================

ALTER TABLE public.organizations DROP COLUMN IF EXISTS current_report_count_monthly;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS report_count_reset_at;
