-- Migration: Add grace period support and 'past_due' subscription status
-- Implements 7-day grace period before full suspension on payment failure

-- Step 1: Add grace period columns
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS grace_period_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS grace_period_started_at TIMESTAMPTZ;

COMMENT ON COLUMN public.organizations.grace_period_end IS 'When the 7-day grace period expires after a failed payment';
COMMENT ON COLUMN public.organizations.grace_period_started_at IS 'When the grace period started (first payment failure)';

-- Step 2: Update subscription status constraint to include 'past_due'
ALTER TABLE public.organizations
DROP CONSTRAINT IF EXISTS valid_subscription_status;

ALTER TABLE public.organizations
ADD CONSTRAINT valid_subscription_status
CHECK (subscription_status = ANY (ARRAY['active'::text, 'trial'::text, 'suspended'::text, 'cancelled'::text, 'pending'::text, 'past_due'::text]));

COMMENT ON COLUMN public.organizations.subscription_status IS 'Subscription status: "active" (paid), "trial" (free trial), "pending" (awaiting payment), "past_due" (payment failed, in grace period), "suspended" (grace period expired), "cancelled" (subscription ended).';

-- Step 3: Update the update_subscription_from_stripe function to map past_due correctly
CREATE OR REPLACE FUNCTION "public"."update_subscription_from_stripe"("p_organization_id" "uuid", "p_stripe_customer_id" "text", "p_stripe_subscription_id" "text", "p_price_id" "text", "p_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_tier TEXT;
  v_subscription_status TEXT;
BEGIN
  -- Map Stripe price IDs to tiers
  v_tier := CASE p_price_id
    -- Production Monthly prices
    WHEN 'price_1SjQkLS6ESxgnZl2F62rcpVd' THEN 'seed'
    WHEN 'price_1SjQlgS6ESxgnZl2c9QYw7QI' THEN 'blossom'
    WHEN 'price_1SjQmXS6ESxgnZl2SWd2nHga' THEN 'canopy'
    -- Production Annual prices
    WHEN 'price_1SmfD6S6ESxgnZl2D3ELCThW' THEN 'seed'
    WHEN 'price_1SmfE0S6ESxgnZl2rW18ZxV7' THEN 'blossom'
    WHEN 'price_1SmfEqS6ESxgnZl2FugLcZSr' THEN 'canopy'
    -- Test Monthly prices
    WHEN 'price_1SmfgF28UK4Vxpt37j13gfue' THEN 'seed'
    WHEN 'price_1SmfhK28UK4Vxpt3mAfxrggp' THEN 'blossom'
    WHEN 'price_1Smfhv28UK4Vxpt3SU2pZVrt' THEN 'canopy'
    -- Test Annual prices
    WHEN 'price_1SmfiY28UK4Vxpt3uLpyVX5H' THEN 'seed'
    WHEN 'price_1Smfj928UK4Vxpt393quRGXO' THEN 'blossom'
    WHEN 'price_1Smfjf28UK4Vxpt3gB2qvW1b' THEN 'canopy'
    -- Production v2 prices
    WHEN 'price_1SwKOlS6ESxgnZl2csSxr8kG' THEN 'seed'
    WHEN 'price_1SwKPkS6ESxgnZl2OtMzqMQy' THEN 'seed'
    WHEN 'price_1SrEIMS6ESxgnZl2catiRMIW' THEN 'blossom'
    WHEN 'price_1SrEItS6ESxgnZl2W1Tm2nBN' THEN 'canopy'
    -- Test v2 prices
    WHEN 'price_1SwKOlS6ESxgnZl2csSxr8kG' THEN 'seed'
    ELSE 'seed' -- Default to seed if unknown
  END;

  -- Map Stripe status to our status
  v_subscription_status := CASE p_status
    WHEN 'active' THEN 'active'
    WHEN 'trialing' THEN 'trial'
    WHEN 'past_due' THEN 'past_due'
    WHEN 'canceled' THEN 'cancelled'
    WHEN 'unpaid' THEN 'suspended'
    ELSE 'suspended'
  END;

  -- Update organization
  UPDATE public.organizations
  SET
    stripe_customer_id = p_stripe_customer_id,
    stripe_subscription_id = p_stripe_subscription_id,
    subscription_tier = v_tier,
    subscription_status = v_subscription_status,
    subscription_started_at = CASE
      WHEN subscription_started_at IS NULL THEN now()
      ELSE subscription_started_at
    END,
    -- Clear grace period when subscription becomes active
    grace_period_end = CASE
      WHEN v_subscription_status = 'active' THEN NULL
      ELSE grace_period_end
    END,
    grace_period_started_at = CASE
      WHEN v_subscription_status = 'active' THEN NULL
      ELSE grace_period_started_at
    END,
    updated_at = now()
  WHERE id = p_organization_id;

  RAISE NOTICE 'Updated organization % to tier % with status %', p_organization_id, v_tier, v_subscription_status;
END;
$$;

-- Step 4: Update check_feature_access to allow 'past_due' (grace period users can still access)
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

  RETURN jsonb_build_object(
    'allowed', v_has_feature,
    'reason', CASE WHEN v_has_feature THEN 'Feature available' ELSE 'Feature not available on ' || v_tier || ' tier' END,
    'tier', v_tier,
    'feature', p_feature_code
  );
END;
$$;
