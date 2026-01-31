-- Greenwash Guardian document limit tracking
-- Blossom: 5 docs/month, Canopy: unlimited, Seed: website only (0 docs)

-- Add monthly document tracking columns to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS current_greenwash_doc_count_monthly integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS greenwash_doc_count_reset_at timestamptz;

-- Check Greenwash document limit RPC
CREATE OR REPLACE FUNCTION public.check_greenwash_doc_limit(p_organization_id uuid)
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
  v_features JSONB;
BEGIN
  SELECT subscription_tier, subscription_status, current_greenwash_doc_count_monthly, greenwash_doc_count_reset_at
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
    SET current_greenwash_doc_count_monthly = 0,
        greenwash_doc_count_reset_at = date_trunc('month', now())
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

  -- Check tier features for unlimited access
  SELECT features_enabled INTO v_features
  FROM public.subscription_tier_limits
  WHERE tier_name = v_tier;

  -- Canopy has greenwash_unlimited
  IF v_features @> '"greenwash_unlimited"'::jsonb THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', null,
      'current_count', v_current_count,
      'max_count', null,
      'tier', v_tier,
      'is_unlimited', true
    );
  END IF;

  -- Seed has no document access (greenwash_website only)
  IF NOT (v_features @> '"greenwash_documents"'::jsonb) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Document analysis requires a Blossom or Canopy plan. Your current plan supports website URL analysis only.',
      'current_count', v_current_count,
      'max_count', 0,
      'tier', v_tier,
      'is_unlimited', false
    );
  END IF;

  -- Blossom: 5 documents per month
  v_max_count := 5;
  v_allowed := v_current_count < v_max_count;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'reason', CASE
      WHEN v_allowed THEN null
      ELSE 'Monthly document analysis limit reached (' || v_current_count || '/' || v_max_count || '). Upgrade to Canopy for unlimited access.'
    END,
    'current_count', v_current_count,
    'max_count', v_max_count,
    'tier', v_tier,
    'is_unlimited', false,
    'resets_at', date_trunc('month', now()) + interval '1 month'
  );
END;
$$;

-- Increment Greenwash document count RPC
CREATE OR REPLACE FUNCTION public.increment_greenwash_doc_count(p_organization_id uuid, p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_check JSONB;
BEGIN
  v_check := public.check_greenwash_doc_limit(p_organization_id);

  IF (v_check->>'allowed')::boolean THEN
    -- Only increment if not unlimited
    IF NOT (v_check->>'is_unlimited')::boolean THEN
      UPDATE public.organizations
      SET current_greenwash_doc_count_monthly = current_greenwash_doc_count_monthly + 1
      WHERE id = p_organization_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'current_count', CASE WHEN (v_check->>'is_unlimited')::boolean
        THEN (v_check->>'current_count')::integer
        ELSE (v_check->>'current_count')::integer + 1
      END,
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
