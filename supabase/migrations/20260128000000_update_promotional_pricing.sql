/*
  # Update Subscription Tier Pricing for Promotional Launch

  ## Overview
  Updates the monthly and annual pricing in subscription_tier_limits
  to reflect promotional launch pricing.

  ## Changes
  - Seed: £149/month → £99/month, £1490/year → £990/year
  - Blossom: £399/month → £249/month, £3990/year → £2490/year
  - Canopy: £899/month → £599/month, £8990/year → £5990/year
*/

UPDATE public.subscription_tier_limits
SET monthly_price_gbp = 99.00, annual_price_gbp = 990.00, updated_at = now()
WHERE tier_name = 'seed';

UPDATE public.subscription_tier_limits
SET monthly_price_gbp = 249.00, annual_price_gbp = 2490.00, updated_at = now()
WHERE tier_name = 'blossom';

UPDATE public.subscription_tier_limits
SET monthly_price_gbp = 599.00, annual_price_gbp = 5990.00, updated_at = now()
WHERE tier_name = 'canopy';
