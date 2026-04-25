-- Update subscription tier limits
-- Seed:    10 products,  10 LCAs,  2 team members,  2 facilities,  10 suppliers
-- Blossom: 30 products,  30 LCAs,  5 team members,  3 facilities,  50 suppliers
-- Canopy: 100 products, 100 LCAs, 10 team members, 10 facilities, 200 suppliers
-- Reports/mo unchanged (10 / 50 / 200).

UPDATE public.subscription_tier_limits
SET max_products = 10,
    max_lcas = 10,
    max_team_members = 2,
    max_facilities = 2,
    max_suppliers = 10,
    updated_at = now()
WHERE tier_name = 'seed';

UPDATE public.subscription_tier_limits
SET max_products = 30,
    max_lcas = 30,
    max_team_members = 5,
    max_facilities = 3,
    max_suppliers = 50,
    updated_at = now()
WHERE tier_name = 'blossom';

UPDATE public.subscription_tier_limits
SET max_products = 100,
    max_lcas = 100,
    max_team_members = 10,
    max_facilities = 10,
    max_suppliers = 200,
    updated_at = now()
WHERE tier_name = 'canopy';
