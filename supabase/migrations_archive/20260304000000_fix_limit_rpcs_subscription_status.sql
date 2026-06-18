-- Migration: Fix limit-check RPCs to accept 'pending' and 'past_due' subscription statuses
-- Previously, only 'active' and 'trial' were allowed, which blocked new users (pending)
-- and users in payment grace period (past_due) from creating facilities, suppliers, etc.

-- ============================================================================
-- 1. Fix check_facility_limit
-- ============================================================================

CREATE OR REPLACE FUNCTION check_facility_limit(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier text;
  v_status text;
  v_max_facilities int;
  v_current_count int;
BEGIN
  -- Get org tier and status
  SELECT subscription_tier, subscription_status
  INTO v_tier, v_status
  FROM organizations
  WHERE id = p_organization_id;

  IF v_tier IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Organisation not found',
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
      'reason', 'Subscription is not active',
      'current_count', 0,
      'max_count', 0,
      'tier', v_tier,
      'is_unlimited', false
    );
  END IF;

  -- Get limit
  SELECT max_facilities INTO v_max_facilities
  FROM subscription_tier_limits
  WHERE tier_name = v_tier AND is_active = true;

  -- Count current facilities
  SELECT count(*) INTO v_current_count
  FROM facilities
  WHERE organization_id = p_organization_id;

  -- Unlimited check
  IF v_max_facilities IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', NULL,
      'current_count', v_current_count,
      'max_count', NULL,
      'tier', v_tier,
      'is_unlimited', true
    );
  END IF;

  -- Limit check
  IF v_current_count >= v_max_facilities THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('Facility limit reached (%s/%s). Upgrade to add more facilities.', v_current_count, v_max_facilities),
      'current_count', v_current_count,
      'max_count', v_max_facilities,
      'tier', v_tier,
      'is_unlimited', false
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', NULL,
    'current_count', v_current_count,
    'max_count', v_max_facilities,
    'tier', v_tier,
    'is_unlimited', false
  );
END;
$$;

-- ============================================================================
-- 2. Fix check_supplier_limit
-- ============================================================================

CREATE OR REPLACE FUNCTION check_supplier_limit(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier text;
  v_status text;
  v_max_suppliers int;
  v_current_count int;
BEGIN
  SELECT subscription_tier, subscription_status
  INTO v_tier, v_status
  FROM organizations
  WHERE id = p_organization_id;

  IF v_tier IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Organisation not found',
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
      'reason', 'Subscription is not active',
      'current_count', 0,
      'max_count', 0,
      'tier', v_tier,
      'is_unlimited', false
    );
  END IF;

  SELECT max_suppliers INTO v_max_suppliers
  FROM subscription_tier_limits
  WHERE tier_name = v_tier AND is_active = true;

  SELECT count(*) INTO v_current_count
  FROM suppliers
  WHERE organization_id = p_organization_id;

  IF v_max_suppliers IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', NULL,
      'current_count', v_current_count,
      'max_count', NULL,
      'tier', v_tier,
      'is_unlimited', true
    );
  END IF;

  IF v_current_count >= v_max_suppliers THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('Supplier limit reached (%s/%s). Upgrade to add more suppliers.', v_current_count, v_max_suppliers),
      'current_count', v_current_count,
      'max_count', v_max_suppliers,
      'tier', v_tier,
      'is_unlimited', false
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', NULL,
    'current_count', v_current_count,
    'max_count', v_max_suppliers,
    'tier', v_tier,
    'is_unlimited', false
  );
END;
$$;

-- ============================================================================
-- 3. Fix check_team_member_limit
-- ============================================================================

CREATE OR REPLACE FUNCTION check_team_member_limit(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier text;
  v_status text;
  v_max_members int;
  v_current_count int;
BEGIN
  SELECT subscription_tier, subscription_status
  INTO v_tier, v_status
  FROM organizations
  WHERE id = p_organization_id;

  IF v_tier IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Organisation not found',
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
      'reason', 'Subscription is not active',
      'current_count', 0,
      'max_count', 0,
      'tier', v_tier,
      'is_unlimited', false
    );
  END IF;

  SELECT max_team_members INTO v_max_members
  FROM subscription_tier_limits
  WHERE tier_name = v_tier AND is_active = true;

  SELECT count(*) INTO v_current_count
  FROM organization_members
  WHERE organization_id = p_organization_id;

  IF v_max_members IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', NULL,
      'current_count', v_current_count,
      'max_count', NULL,
      'tier', v_tier,
      'is_unlimited', true
    );
  END IF;

  IF v_current_count >= v_max_members THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('Team member limit reached (%s/%s). Upgrade to add more members.', v_current_count, v_max_members),
      'current_count', v_current_count,
      'max_count', v_max_members,
      'tier', v_tier,
      'is_unlimited', false
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', NULL,
    'current_count', v_current_count,
    'max_count', v_max_members,
    'tier', v_tier,
    'is_unlimited', false
  );
END;
$$;

-- ============================================================================
-- 4. Fix check_product_limit
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

  -- Allow active, trial, pending (new onboarding), and past_due (grace period)
  IF v_status NOT IN ('active', 'trial', 'pending', 'past_due') THEN
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
-- 5. Fix check_lca_limit
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

  -- Allow active, trial, pending (new onboarding), and past_due (grace period)
  IF v_status NOT IN ('active', 'trial', 'pending', 'past_due') THEN
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
$$;

-- ============================================================================
-- 6. Fix check_report_limit
-- ============================================================================

CREATE OR REPLACE FUNCTION check_report_limit(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier text;
  v_status text;
  v_current_count integer;
  v_max_count integer;
  v_reset_at timestamptz;
  v_can_generate boolean;
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

  IF v_reset_at IS NULL OR v_reset_at < date_trunc('month', now()) THEN
    UPDATE public.organizations
    SET current_report_count_monthly = 0,
        report_count_reset_at = date_trunc('month', now())
    WHERE id = p_organization_id;
    v_current_count := 0;
  END IF;

  -- Allow active, trial, pending (new onboarding), and past_due (grace period)
  IF v_status NOT IN ('active', 'trial', 'pending', 'past_due') THEN
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
$$;

-- ============================================================================
-- 7. Fix check_methodology_access
-- ============================================================================

CREATE OR REPLACE FUNCTION check_methodology_access(p_organization_id uuid, p_methodology text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_tier text;
  v_status text;
  v_has_access boolean;
BEGIN
  SELECT subscription_tier, subscription_status
  INTO v_tier, v_status
  FROM public.organizations
  WHERE id = p_organization_id;

  IF v_tier IS NULL THEN
    RETURN false;
  END IF;

  -- Allow active, trial, pending (new onboarding), and past_due (grace period)
  IF v_status NOT IN ('active', 'trial', 'pending', 'past_due') THEN
    RETURN false;
  END IF;

  SELECT enabled INTO v_has_access
  FROM public.subscription_tier_features
  WHERE tier_name = v_tier
  AND feature_code = p_methodology;

  RETURN COALESCE(v_has_access, false);
END;
$$;
