-- Rosa AI query counting & tier-based limiting
-- Uses max_api_calls_per_month in subscription_tier_limits for Rosa query caps

-- Add monthly query tracking columns to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS current_rosa_query_count_monthly integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rosa_query_count_reset_at timestamptz;

-- Set Rosa query limits per tier (Seed: 25, Blossom: 100, Canopy: unlimited/null)
UPDATE public.subscription_tier_limits
SET max_api_calls_per_month = 25
WHERE tier_name = 'seed';

UPDATE public.subscription_tier_limits
SET max_api_calls_per_month = 100
WHERE tier_name = 'blossom';

UPDATE public.subscription_tier_limits
SET max_api_calls_per_month = NULL
WHERE tier_name = 'canopy';

-- Check Rosa query limit RPC
CREATE OR REPLACE FUNCTION public.check_rosa_query_limit(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_tier TEXT;
  v_status TEXT;
  v_current_count INTEGER;
  v_max_count INTEGER;
  v_reset_at TIMESTAMPTZ;
  v_allowed BOOLEAN;
BEGIN
  SELECT subscription_tier, subscription_status, current_rosa_query_count_monthly, rosa_query_count_reset_at
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

  -- Reset counter if new month
  IF v_reset_at IS NULL OR v_reset_at < date_trunc('month', now()) THEN
    UPDATE public.organizations
    SET current_rosa_query_count_monthly = 0,
        rosa_query_count_reset_at = date_trunc('month', now())
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

  SELECT max_api_calls_per_month INTO v_max_count
  FROM public.subscription_tier_limits
  WHERE tier_name = v_tier;

  v_allowed := v_max_count IS NULL OR v_current_count < v_max_count;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'reason', CASE
      WHEN v_allowed THEN null
      ELSE 'Monthly Rosa AI query limit reached (' || v_current_count || '/' || v_max_count || '). Upgrade for more queries.'
    END,
    'current_count', v_current_count,
    'max_count', v_max_count,
    'tier', v_tier,
    'is_unlimited', v_max_count IS NULL,
    'resets_at', date_trunc('month', now()) + interval '1 month'
  );
END;
$$;

-- Increment Rosa query count RPC
CREATE OR REPLACE FUNCTION public.increment_rosa_query_count(p_organization_id uuid, p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_check JSONB;
BEGIN
  v_check := public.check_rosa_query_limit(p_organization_id);

  IF (v_check->>'allowed')::boolean THEN
    UPDATE public.organizations
    SET current_rosa_query_count_monthly = current_rosa_query_count_monthly + 1
    WHERE id = p_organization_id;

    RETURN jsonb_build_object(
      'success', true,
      'current_count', (v_check->>'current_count')::integer + 1,
      'max_count', v_check->'max_count',
      'is_unlimited', (v_check->>'is_unlimited')::boolean
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'reason', v_check->>'reason',
      'current_count', (v_check->>'current_count')::integer,
      'max_count', v_check->'max_count'
    );
  END IF;
END;
$$;

-- Add to get_organization_usage if it exists (update the existing function)
-- This will be handled in the application layer via the new RPCs
