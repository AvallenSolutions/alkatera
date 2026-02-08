-- Migration: Update Stripe price ID mapping with current production prices
-- Adds new Seed annual price ID and ensures all active prices are mapped

CREATE OR REPLACE FUNCTION "public"."update_subscription_from_stripe"("p_organization_id" "uuid", "p_stripe_customer_id" "text", "p_stripe_subscription_id" "text", "p_price_id" "text", "p_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_tier TEXT;
  v_subscription_status TEXT;
BEGIN
  -- Map Stripe price IDs to tiers
  v_tier := CASE p_price_id
    -- Current Production prices (active)
    WHEN 'price_1SjQkLS6ESxgnZl2F62rcpVd' THEN 'seed'      -- Seed Monthly
    WHEN 'price_1SrEHiS6ESxgnZl20udh9QqS' THEN 'seed'      -- Seed Annual
    WHEN 'price_1SjQlgS6ESxgnZl2c9QYw7QI' THEN 'blossom'   -- Blossom Monthly
    WHEN 'price_1SrEIMS6ESxgnZl2catiRMIW' THEN 'blossom'    -- Blossom Annual
    WHEN 'price_1SjQmXS6ESxgnZl2SWd2nHga' THEN 'canopy'    -- Canopy Monthly
    WHEN 'price_1SrEItS6ESxgnZl2W1Tm2nBN' THEN 'canopy'    -- Canopy Annual
    -- Legacy Production prices (keep for existing subscribers)
    WHEN 'price_1SmfD6S6ESxgnZl2D3ELCThW' THEN 'seed'
    WHEN 'price_1SmfE0S6ESxgnZl2rW18ZxV7' THEN 'blossom'
    WHEN 'price_1SmfEqS6ESxgnZl2FugLcZSr' THEN 'canopy'
    WHEN 'price_1SwKOlS6ESxgnZl2csSxr8kG' THEN 'seed'
    WHEN 'price_1SwKPkS6ESxgnZl2OtMzqMQy' THEN 'seed'
    -- Test prices
    WHEN 'price_1SmfgF28UK4Vxpt37j13gfue' THEN 'seed'
    WHEN 'price_1SmfhK28UK4Vxpt3mAfxrggp' THEN 'blossom'
    WHEN 'price_1Smfhv28UK4Vxpt3SU2pZVrt' THEN 'canopy'
    WHEN 'price_1SmfiY28UK4Vxpt3uLpyVX5H' THEN 'seed'
    WHEN 'price_1Smfj928UK4Vxpt393quRGXO' THEN 'blossom'
    WHEN 'price_1Smfjf28UK4Vxpt3gB2qvW1b' THEN 'canopy'
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
