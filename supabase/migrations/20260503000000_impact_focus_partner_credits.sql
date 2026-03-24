-- Impact Focus Partner Credits Integration
-- Adds billing_interval tracking, partner_credits table, and KB external author columns

-- 1. Add billing_interval to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_interval TEXT
  CHECK (billing_interval IN ('monthly', 'annual'));

COMMENT ON COLUMN public.organizations.billing_interval
  IS 'Subscription billing interval derived from Stripe price ID (monthly or annual)';

-- 2. Create partner_credits table
CREATE TABLE IF NOT EXISTS public.partner_credits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  partner_name    TEXT NOT NULL DEFAULT 'impact_focus',
  credit_amount   NUMERIC(10,2) NOT NULL DEFAULT 600.00,
  currency        TEXT NOT NULL DEFAULT 'GBP',
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'available', 'redeemed', 'expired')),
  eligibility_date TIMESTAMPTZ,
  available_at    TIMESTAMPTZ,
  redeemed_at     TIMESTAMPTZ,
  expired_at      TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick lookups by org
CREATE INDEX IF NOT EXISTS idx_partner_credits_org
  ON public.partner_credits(organization_id);

-- Unique constraint: one active credit per org per partner
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_credits_unique_active
  ON public.partner_credits(organization_id, partner_name)
  WHERE status IN ('pending', 'available');

-- RLS
ALTER TABLE public.partner_credits ENABLE ROW LEVEL SECURITY;

-- Organisations can read their own credits
CREATE POLICY "partner_credits_select_own"
  ON public.partner_credits
  FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Platform admins can manage all credits
CREATE POLICY "partner_credits_admin_all"
  ON public.partner_credits
  FOR ALL
  USING (public.is_alkatera_admin())
  WITH CHECK (public.is_alkatera_admin());

-- 3. Add external author columns to knowledge_bank_items
ALTER TABLE public.knowledge_bank_items
  ADD COLUMN IF NOT EXISTS external_author_name TEXT,
  ADD COLUMN IF NOT EXISTS external_author_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS external_author_bio TEXT,
  ADD COLUMN IF NOT EXISTS partner_attribution TEXT;

COMMENT ON COLUMN public.knowledge_bank_items.partner_attribution
  IS 'Partner identifier for attributed content (e.g. impact_focus)';

-- 4. Update update_subscription_from_stripe to accept billing_interval
CREATE OR REPLACE FUNCTION public.update_subscription_from_stripe(
  p_organization_id UUID,
  p_stripe_customer_id TEXT,
  p_stripe_subscription_id TEXT,
  p_price_id TEXT,
  p_status TEXT,
  p_current_period_end TIMESTAMPTZ DEFAULT NULL,
  p_billing_interval TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_subscription_status TEXT;
BEGIN
  -- Determine tier from price_id
  v_tier := CASE p_price_id
    WHEN 'price_1SjQkLS6ESxgnZl2F62rcpVd' THEN 'seed'
    WHEN 'price_1SrEHiS6ESxgnZl20udh9QqS' THEN 'seed'
    WHEN 'price_1SjQlgS6ESxgnZl2c9QYw7QI' THEN 'blossom'
    WHEN 'price_1SrEIMS6ESxgnZl2catiRMIW' THEN 'blossom'
    WHEN 'price_1SjQmXS6ESxgnZl2SWd2nHga' THEN 'canopy'
    WHEN 'price_1SrEItS6ESxgnZl2W1Tm2nBN' THEN 'canopy'
    ELSE 'seed'
  END;

  -- Map Stripe status to our status
  v_subscription_status := CASE p_status
    WHEN 'active' THEN 'active'
    WHEN 'trialing' THEN 'trial'
    WHEN 'past_due' THEN 'past_due'
    WHEN 'canceled' THEN 'cancelled'
    WHEN 'unpaid' THEN 'suspended'
    ELSE 'pending'
  END;

  UPDATE public.organizations
  SET
    stripe_customer_id = p_stripe_customer_id,
    stripe_subscription_id = p_stripe_subscription_id,
    subscription_tier = v_tier,
    subscription_status = v_subscription_status,
    billing_interval = COALESCE(p_billing_interval, billing_interval),
    subscription_started_at = CASE
      WHEN subscription_started_at IS NULL THEN now()
      ELSE subscription_started_at
    END,
    current_period_end = COALESCE(p_current_period_end, current_period_end),
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
END;
$$;
