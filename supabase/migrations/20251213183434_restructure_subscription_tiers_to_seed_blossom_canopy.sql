/*
  # Restructure Subscription Tiers to Seed/Blossom/Canopy

  ## Overview
  This migration transforms the subscription tier system from generic naming 
  (basic/premium/enterprise) to nature-inspired naming (seed/blossom/canopy)
  that aligns with sustainability branding, with updated limits and pricing.

  ## Tier Changes

  ### Seed (formerly Basic/Starter) - £149/month
  - 5 products (was 10)
  - 1 facility (was 2)
  - 1 user (was 3)
  - GHG emissions module only
  - Live passport analytics
  - Email support
  - Automated data verification

  ### Blossom (formerly Premium/Professional) - £399/month
  - 20 products (was 100)
  - 3 facilities (was 10)
  - 5 users (was 15)
  - GHG + Water + Waste modules
  - Monthly analytics reporting
  - Email support
  - Automated data verification

  ### Canopy (formerly Enterprise) - £899/month
  - 50 products (was unlimited)
  - 8 facilities (was unlimited)
  - 10 users (was unlimited)
  - All modules: GHG, Water, Waste, Biodiversity, B Corp
  - Sandbox analytics environment
  - Priority chat support
  - Verified data verification

  ## Database Changes
  1. Update constraint on organizations.subscription_tier
  2. Update constraint on subscription_tier_limits.tier_name
  3. Update constraint on subscription_tier_features.tier_name
  4. Migrate existing tier data to new names
  5. Update tier limits and pricing
  6. Add new feature flags for modules and support levels

  ## Security
  - All existing RLS policies remain intact
  - No changes to data access patterns
*/

-- ============================================================================
-- STEP 1: Drop existing constraints that reference old tier names
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_subscription_tier') THEN
    ALTER TABLE public.organizations DROP CONSTRAINT valid_subscription_tier;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_tier_name') THEN
    ALTER TABLE public.subscription_tier_limits DROP CONSTRAINT valid_tier_name;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_tier') THEN
    ALTER TABLE public.subscription_tier_features DROP CONSTRAINT valid_tier;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Migrate existing organizations to new tier names
-- ============================================================================

UPDATE public.organizations
SET subscription_tier = CASE subscription_tier
  WHEN 'basic' THEN 'seed'
  WHEN 'premium' THEN 'blossom'
  WHEN 'enterprise' THEN 'canopy'
  ELSE 'seed'
END
WHERE subscription_tier IN ('basic', 'premium', 'enterprise');

-- ============================================================================
-- STEP 3: Add new constraints with updated tier names
-- ============================================================================

ALTER TABLE public.organizations
  ADD CONSTRAINT valid_subscription_tier
  CHECK (subscription_tier IN ('seed', 'blossom', 'canopy'));

-- ============================================================================
-- STEP 4: Update subscription_tier_limits with new tier structure
-- ============================================================================

DELETE FROM public.subscription_tier_limits WHERE tier_name IN ('basic', 'premium', 'enterprise');

INSERT INTO public.subscription_tier_limits (
  tier_name, tier_level, display_name,
  max_products, max_reports_per_month, max_team_members,
  max_facilities, max_suppliers, max_lcas,
  max_api_calls_per_month, max_storage_mb,
  features_enabled, monthly_price_gbp, annual_price_gbp, description
) VALUES
  (
    'seed', 1, 'Seed',
    5, 10, 1,
    1, 5, 5,
    NULL, 250,
    '["recipe_2016", "ghg_emissions", "live_passport", "email_support", "automated_verification"]'::jsonb,
    149.00, 1490.00,
    'Perfect for startups and small businesses beginning their sustainability journey'
  ),
  (
    'blossom', 2, 'Blossom',
    20, 50, 5,
    3, 25, 20,
    5000, 2000,
    '["recipe_2016", "ef_31", "ghg_emissions", "water_footprint", "waste_circularity", "monthly_analytics", "email_support", "automated_verification", "pef_reports", "api_access", "product_comparison"]'::jsonb,
    399.00, 3990.00,
    'For growing businesses ready to expand their environmental impact tracking'
  ),
  (
    'canopy', 3, 'Canopy',
    50, 200, 10,
    8, 100, 50,
    25000, 10000,
    '["recipe_2016", "ef_31", "ef_31_single_score", "ghg_emissions", "water_footprint", "waste_circularity", "biodiversity_tracking", "b_corp_assessment", "sandbox_analytics", "priority_chat", "verified_data", "custom_weighting", "pef_reports", "api_access", "product_comparison", "white_label"]'::jsonb,
    899.00, 8990.00,
    'Comprehensive sustainability management for established organisations'
  )
ON CONFLICT (tier_name) DO UPDATE SET
  tier_level = EXCLUDED.tier_level,
  display_name = EXCLUDED.display_name,
  max_products = EXCLUDED.max_products,
  max_reports_per_month = EXCLUDED.max_reports_per_month,
  max_team_members = EXCLUDED.max_team_members,
  max_facilities = EXCLUDED.max_facilities,
  max_suppliers = EXCLUDED.max_suppliers,
  max_lcas = EXCLUDED.max_lcas,
  max_api_calls_per_month = EXCLUDED.max_api_calls_per_month,
  max_storage_mb = EXCLUDED.max_storage_mb,
  features_enabled = EXCLUDED.features_enabled,
  monthly_price_gbp = EXCLUDED.monthly_price_gbp,
  annual_price_gbp = EXCLUDED.annual_price_gbp,
  description = EXCLUDED.description,
  updated_at = now();

ALTER TABLE public.subscription_tier_limits
  ADD CONSTRAINT valid_tier_name
  CHECK (tier_name IN ('seed', 'blossom', 'canopy'));

-- ============================================================================
-- STEP 5: Update subscription_tier_features with new tier names
-- ============================================================================

DELETE FROM public.subscription_tier_features WHERE tier_name IN ('basic', 'premium', 'enterprise');

INSERT INTO public.subscription_tier_features (tier_name, feature_code, feature_name, feature_description, enabled, usage_limit) VALUES
  -- Seed Tier Features
  ('seed', 'recipe_2016', 'ReCiPe 2016 Midpoint', '18 impact categories using ReCiPe 2016 methodology', true, NULL),
  ('seed', 'ef_31', 'EF 3.1 Methodology', '16 EF 3.1 impact categories with PEF compliance', false, NULL),
  ('seed', 'ef_31_single_score', 'EF 3.1 Single Score', 'Normalised and weighted single score calculation', false, NULL),
  ('seed', 'custom_weighting', 'Custom Weighting Sets', 'Create custom weighting sets for single score', false, NULL),
  ('seed', 'pef_reports', 'PEF Compliance Reports', 'Export PEF-compliant PDF reports', false, NULL),
  ('seed', 'api_access', 'API Access', 'Programmatic access to LCA calculations', false, NULL),
  ('seed', 'product_comparison', 'Multi-product Comparison', 'Compare LCA results across products', true, 3),
  ('seed', 'white_label', 'White-label Reports', 'Custom branding on reports', false, NULL),
  ('seed', 'ghg_emissions', 'GHG Emissions Module', 'Carbon footprint tracking and reporting', true, NULL),
  ('seed', 'water_footprint', 'Water Footprint Module', 'Water usage and impact tracking', false, NULL),
  ('seed', 'waste_circularity', 'Waste & Circularity Module', 'Waste management and circular economy metrics', false, NULL),
  ('seed', 'biodiversity_tracking', 'Biodiversity Module', 'Biodiversity impact assessment', false, NULL),
  ('seed', 'b_corp_assessment', 'B Corp Assessment', 'B Corp certification preparation tools', false, NULL),
  ('seed', 'live_passport', 'Live Passport Analytics', 'Real-time product environmental passport', true, NULL),
  ('seed', 'monthly_analytics', 'Monthly Analytics', 'Monthly sustainability reporting', false, NULL),
  ('seed', 'sandbox_analytics', 'Sandbox Environment', 'Testing and scenario planning environment', false, NULL),
  ('seed', 'email_support', 'Email Support', 'Standard email support', true, NULL),
  ('seed', 'priority_chat', 'Priority Chat Support', 'Priority live chat support', false, NULL),
  ('seed', 'automated_verification', 'Automated Verification', 'Automated data quality verification', true, NULL),
  ('seed', 'verified_data', 'Verified Data', 'Third-party verified data certification', false, NULL),

  -- Blossom Tier Features
  ('blossom', 'recipe_2016', 'ReCiPe 2016 Midpoint', '18 impact categories using ReCiPe 2016 methodology', true, NULL),
  ('blossom', 'ef_31', 'EF 3.1 Methodology', '16 EF 3.1 impact categories with PEF compliance', true, NULL),
  ('blossom', 'ef_31_single_score', 'EF 3.1 Single Score', 'Normalised and weighted single score calculation', true, NULL),
  ('blossom', 'custom_weighting', 'Custom Weighting Sets', 'Create custom weighting sets for single score', false, NULL),
  ('blossom', 'pef_reports', 'PEF Compliance Reports', 'Export PEF-compliant PDF reports', true, NULL),
  ('blossom', 'api_access', 'API Access', 'Programmatic access to LCA calculations', true, 5000),
  ('blossom', 'product_comparison', 'Multi-product Comparison', 'Compare LCA results across products', true, 20),
  ('blossom', 'white_label', 'White-label Reports', 'Custom branding on reports', false, NULL),
  ('blossom', 'ghg_emissions', 'GHG Emissions Module', 'Carbon footprint tracking and reporting', true, NULL),
  ('blossom', 'water_footprint', 'Water Footprint Module', 'Water usage and impact tracking', true, NULL),
  ('blossom', 'waste_circularity', 'Waste & Circularity Module', 'Waste management and circular economy metrics', true, NULL),
  ('blossom', 'biodiversity_tracking', 'Biodiversity Module', 'Biodiversity impact assessment', false, NULL),
  ('blossom', 'b_corp_assessment', 'B Corp Assessment', 'B Corp certification preparation tools', false, NULL),
  ('blossom', 'live_passport', 'Live Passport Analytics', 'Real-time product environmental passport', true, NULL),
  ('blossom', 'monthly_analytics', 'Monthly Analytics', 'Monthly sustainability reporting', true, NULL),
  ('blossom', 'sandbox_analytics', 'Sandbox Environment', 'Testing and scenario planning environment', false, NULL),
  ('blossom', 'email_support', 'Email Support', 'Standard email support', true, NULL),
  ('blossom', 'priority_chat', 'Priority Chat Support', 'Priority live chat support', false, NULL),
  ('blossom', 'automated_verification', 'Automated Verification', 'Automated data quality verification', true, NULL),
  ('blossom', 'verified_data', 'Verified Data', 'Third-party verified data certification', false, NULL),

  -- Canopy Tier Features
  ('canopy', 'recipe_2016', 'ReCiPe 2016 Midpoint', '18 impact categories using ReCiPe 2016 methodology', true, NULL),
  ('canopy', 'ef_31', 'EF 3.1 Methodology', '16 EF 3.1 impact categories with PEF compliance', true, NULL),
  ('canopy', 'ef_31_single_score', 'EF 3.1 Single Score', 'Normalised and weighted single score calculation', true, NULL),
  ('canopy', 'custom_weighting', 'Custom Weighting Sets', 'Create custom weighting sets for single score', true, NULL),
  ('canopy', 'pef_reports', 'PEF Compliance Reports', 'Export PEF-compliant PDF reports', true, NULL),
  ('canopy', 'api_access', 'API Access', 'Programmatic access to LCA calculations', true, NULL),
  ('canopy', 'product_comparison', 'Multi-product Comparison', 'Compare LCA results across products', true, NULL),
  ('canopy', 'white_label', 'White-label Reports', 'Custom branding on reports', true, NULL),
  ('canopy', 'ghg_emissions', 'GHG Emissions Module', 'Carbon footprint tracking and reporting', true, NULL),
  ('canopy', 'water_footprint', 'Water Footprint Module', 'Water usage and impact tracking', true, NULL),
  ('canopy', 'waste_circularity', 'Waste & Circularity Module', 'Waste management and circular economy metrics', true, NULL),
  ('canopy', 'biodiversity_tracking', 'Biodiversity Module', 'Biodiversity impact assessment', true, NULL),
  ('canopy', 'b_corp_assessment', 'B Corp Assessment', 'B Corp certification preparation tools', true, NULL),
  ('canopy', 'live_passport', 'Live Passport Analytics', 'Real-time product environmental passport', true, NULL),
  ('canopy', 'monthly_analytics', 'Monthly Analytics', 'Monthly sustainability reporting', true, NULL),
  ('canopy', 'sandbox_analytics', 'Sandbox Environment', 'Testing and scenario planning environment', true, NULL),
  ('canopy', 'email_support', 'Email Support', 'Standard email support', true, NULL),
  ('canopy', 'priority_chat', 'Priority Chat Support', 'Priority live chat support', true, NULL),
  ('canopy', 'automated_verification', 'Automated Verification', 'Automated data quality verification', true, NULL),
  ('canopy', 'verified_data', 'Verified Data', 'Third-party verified data certification', true, NULL)
ON CONFLICT (tier_name, feature_code) DO UPDATE SET
  feature_name = EXCLUDED.feature_name,
  feature_description = EXCLUDED.feature_description,
  enabled = EXCLUDED.enabled,
  usage_limit = EXCLUDED.usage_limit;

ALTER TABLE public.subscription_tier_features
  ADD CONSTRAINT valid_tier
  CHECK (tier_name IN ('seed', 'blossom', 'canopy'));

-- ============================================================================
-- STEP 6: Update helper functions to use new tier names
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_tier_level(p_tier_name TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE p_tier_name
    WHEN 'seed' THEN 1
    WHEN 'blossom' THEN 2
    WHEN 'canopy' THEN 3
    ELSE 1
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- STEP 7: Update subscription summary view
-- ============================================================================

CREATE OR REPLACE VIEW public.subscription_tiers_comparison AS
SELECT 
  tier_name,
  tier_level,
  display_name,
  COALESCE(max_products::text, 'Unlimited') AS products_limit,
  COALESCE(max_reports_per_month::text, 'Unlimited') AS reports_per_month,
  COALESCE(max_team_members::text, 'Unlimited') AS team_members,
  COALESCE(max_facilities::text, 'Unlimited') AS facilities,
  COALESCE(max_suppliers::text, 'Unlimited') AS suppliers,
  COALESCE(max_lcas::text, 'Unlimited') AS lcas,
  features_enabled,
  description,
  monthly_price_gbp,
  annual_price_gbp
FROM public.subscription_tier_limits
WHERE is_active = true
ORDER BY tier_level;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_tier_count INTEGER;
  v_feature_count INTEGER;
  v_org_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_tier_count 
  FROM public.subscription_tier_limits 
  WHERE tier_name IN ('seed', 'blossom', 'canopy');

  SELECT COUNT(*) INTO v_feature_count 
  FROM public.subscription_tier_features 
  WHERE tier_name IN ('seed', 'blossom', 'canopy');

  SELECT COUNT(*) INTO v_org_count
  FROM public.organizations
  WHERE subscription_tier IN ('seed', 'blossom', 'canopy');

  RAISE NOTICE 'Subscription Tier Restructure Migration Summary:';
  RAISE NOTICE '  New tier configurations: % (expected 3: seed, blossom, canopy)', v_tier_count;
  RAISE NOTICE '  Feature definitions: % (expected 60: 20 features x 3 tiers)', v_feature_count;
  RAISE NOTICE '  Organizations migrated to new tiers: %', v_org_count;
  RAISE NOTICE '  Migration completed successfully';
END $$;
