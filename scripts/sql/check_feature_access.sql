-- Repair check_feature_access: column is tier_name (not tier), and
-- features_enabled is jsonb so membership uses the `?` operator.
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

  -- Check if feature is enabled for this tier (features_enabled is a jsonb array;
  -- `?` tests element membership)
  SELECT EXISTS(
    SELECT 1 FROM public.subscription_tier_limits
    WHERE tier_name = v_tier
    AND features_enabled ? p_feature_code
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
