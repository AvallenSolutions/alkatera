/*
  # Add Stripe Integration Fields to Organizations Table

  ## Overview
  Adds Stripe customer and subscription ID fields to enable payment processing
  and subscription management through Stripe.

  ## Changes
  1. Add `stripe_customer_id` column to store Stripe customer ID
  2. Add `stripe_subscription_id` column to store Stripe subscription ID
  3. Add index on stripe_customer_id for faster lookups
  4. Add helper function to get organization by Stripe customer ID

  ## Security
  - All existing RLS policies remain intact
  - No changes to data access patterns
*/

-- ============================================================================
-- STEP 1: Add Stripe fields to organizations table
-- ============================================================================

DO $$
BEGIN
  -- Add stripe_customer_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'organizations'
    AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE public.organizations
      ADD COLUMN stripe_customer_id TEXT DEFAULT NULL UNIQUE;

    COMMENT ON COLUMN public.organizations.stripe_customer_id IS
      'Stripe customer ID for billing and subscription management';
  END IF;

  -- Add stripe_subscription_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'organizations'
    AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE public.organizations
      ADD COLUMN stripe_subscription_id TEXT DEFAULT NULL;

    COMMENT ON COLUMN public.organizations.stripe_subscription_id IS
      'Stripe subscription ID for the current active subscription';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer_id
  ON public.organizations(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_stripe_subscription_id
  ON public.organizations(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- ============================================================================
-- STEP 3: Create helper function to find organization by Stripe customer ID
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_organization_by_stripe_customer(
  p_stripe_customer_id TEXT
)
RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE stripe_customer_id = p_stripe_customer_id;

  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_organization_by_stripe_customer IS
  'Retrieves organization ID by Stripe customer ID for webhook processing';

-- ============================================================================
-- STEP 4: Create helper function to update subscription from Stripe data
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_subscription_from_stripe(
  p_organization_id UUID,
  p_stripe_customer_id TEXT,
  p_stripe_subscription_id TEXT,
  p_price_id TEXT,
  p_status TEXT
)
RETURNS VOID AS $$
DECLARE
  v_tier TEXT;
  v_subscription_status TEXT;
BEGIN
  -- Map Stripe price IDs to tiers
  v_tier := CASE p_price_id
    -- Monthly prices
    WHEN 'price_1SjQkLS6ESxgnZl2F62rcpVd' THEN 'seed'
    WHEN 'price_1SjQlgS6ESxgnZl2c9QYw7QI' THEN 'blossom'
    WHEN 'price_1SjQmXS6ESxgnZl2SWd2nHga' THEN 'canopy'
    -- Annual prices (to be added when created in Stripe)
    -- WHEN 'price_ANNUAL_SEED' THEN 'seed'
    -- WHEN 'price_ANNUAL_BLOSSOM' THEN 'blossom'
    -- WHEN 'price_ANNUAL_CANOPY' THEN 'canopy'
    ELSE 'seed' -- Default to seed if unknown
  END;

  -- Map Stripe status to our status
  v_subscription_status := CASE p_status
    WHEN 'active' THEN 'active'
    WHEN 'trialing' THEN 'trial'
    WHEN 'past_due' THEN 'suspended'
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
    updated_at = now()
  WHERE id = p_organization_id;

  RAISE NOTICE 'Updated organization % to tier % with status %', p_organization_id, v_tier, v_subscription_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.update_subscription_from_stripe IS
  'Updates organization subscription details from Stripe webhook data';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_columns_added INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_columns_added
  FROM information_schema.columns
  WHERE table_schema = 'public'
  AND table_name = 'organizations'
  AND column_name IN ('stripe_customer_id', 'stripe_subscription_id');

  RAISE NOTICE 'Stripe Integration Migration Summary:';
  RAISE NOTICE '  Columns added to organizations: % (expected 2)', v_columns_added;
  RAISE NOTICE '  Helper functions: get_organization_by_stripe_customer, update_subscription_from_stripe';
  RAISE NOTICE '  Migration completed successfully';
END $$;
