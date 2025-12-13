/*
  # Remove Specific Features from Subscription Tiers

  ## Changes
  
  ### Seed Tier - Remove:
  - Multi-product comparison (product_comparison)
  - ReCiPe 2016 Midpoint (recipe_2016)

  ### Blossom Tier - Remove:
  - API Access (api_access)
  - PEF Compliance Reports (pef_reports)

  ### Canopy Tier - Remove:
  - API Access (api_access)
  - Custom Weighting Sets (custom_weighting)
  - Email Support (email_support)
*/

-- ============================================================================
-- STEP 1: Remove features from subscription_tier_features table
-- ============================================================================

DELETE FROM public.subscription_tier_features 
WHERE (tier_name = 'seed' AND feature_code IN ('product_comparison', 'recipe_2016'))
   OR (tier_name = 'blossom' AND feature_code IN ('api_access', 'pef_reports'))
   OR (tier_name = 'canopy' AND feature_code IN ('api_access', 'custom_weighting', 'email_support'));

-- ============================================================================
-- STEP 2: Update features_enabled JSONB in subscription_tier_limits
-- ============================================================================

UPDATE public.subscription_tier_limits
SET features_enabled = '["ghg_emissions", "live_passport", "automated_verification"]'::jsonb
WHERE tier_name = 'seed';

UPDATE public.subscription_tier_limits
SET features_enabled = '["recipe_2016", "ef_31", "ghg_emissions", "water_footprint", "waste_circularity", "monthly_analytics", "product_comparison", "automated_verification"]'::jsonb
WHERE tier_name = 'blossom';

UPDATE public.subscription_tier_limits
SET features_enabled = '["recipe_2016", "ef_31", "ef_31_single_score", "ghg_emissions", "water_footprint", "waste_circularity", "biodiversity_tracking", "b_corp_assessment", "sandbox_analytics", "priority_chat", "verified_data", "pef_reports", "product_comparison", "white_label"]'::jsonb
WHERE tier_name = 'canopy';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_seed_features JSONB;
  v_blossom_features JSONB;
  v_canopy_features JSONB;
BEGIN
  SELECT features_enabled INTO v_seed_features FROM public.subscription_tier_limits WHERE tier_name = 'seed';
  SELECT features_enabled INTO v_blossom_features FROM public.subscription_tier_limits WHERE tier_name = 'blossom';
  SELECT features_enabled INTO v_canopy_features FROM public.subscription_tier_limits WHERE tier_name = 'canopy';

  RAISE NOTICE 'Subscription Tier Features Refinement Complete:';
  RAISE NOTICE '  Seed features: %', v_seed_features;
  RAISE NOTICE '  Blossom features: %', v_blossom_features;
  RAISE NOTICE '  Canopy features: %', v_canopy_features;
END $$;
