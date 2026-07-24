-- GENERATED FILE — do not edit by hand.
-- Source of truth: lib/subscription/feature-catalog.ts (features) + lib/stripe-config.ts (limits/prices)
-- Regenerate: npx tsx scripts/gen-tier-features-sql.ts > supabase/migrations/<ts>_tier_features_single_source.sql
--
-- Upserts each tier row (idempotent) so fresh/local DBs are seeded and prod stays
-- in sync, then repairs the check_feature_access RPC to match the client gate.

-- seed: 17 features
INSERT INTO public.subscription_tier_limits
  (tier_name, tier_level, display_name, description,
   max_products, max_lcas, max_team_members, max_facilities, max_suppliers, max_reports_per_month,
   monthly_price_gbp, annual_price_gbp, features_enabled, is_active, updated_at)
VALUES
  ('seed', 1, 'Seed', 'Perfect for startups and small businesses beginning their sustainability journey',
   10, 10, 2, 2, 10, 10,
   99, 990, '["automated_verification","carbon_footprint_ghg","company_emissions_current","dashboard_vitality","email_support","facilities_management","fleet_overview","ghg_emissions","greenwash_website","knowledge_bank_read","live_passport","pdf_report_export","product_management","product_passport","recipe_2016","rosa_ai_25","supplier_directory"]'::jsonb, true, now())
ON CONFLICT (tier_name) DO UPDATE SET
  tier_level = EXCLUDED.tier_level,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  max_products = EXCLUDED.max_products,
  max_lcas = EXCLUDED.max_lcas,
  max_team_members = EXCLUDED.max_team_members,
  max_facilities = EXCLUDED.max_facilities,
  max_suppliers = EXCLUDED.max_suppliers,
  max_reports_per_month = EXCLUDED.max_reports_per_month,
  monthly_price_gbp = EXCLUDED.monthly_price_gbp,
  annual_price_gbp = EXCLUDED.annual_price_gbp,
  features_enabled = EXCLUDED.features_enabled,
  is_active = true,
  updated_at = now();

-- blossom: 38 features
INSERT INTO public.subscription_tier_limits
  (tier_name, tier_level, display_name, description,
   max_products, max_lcas, max_team_members, max_facilities, max_suppliers, max_reports_per_month,
   monthly_price_gbp, annual_price_gbp, features_enabled, is_active, updated_at)
VALUES
  ('blossom', 2, 'Blossom', 'For growing businesses ready to expand their environmental impact tracking',
   30, 30, 5, 3, 50, 50,
   249, 2490, '["automated_verification","bcorp_tracking","carbon_footprint_ghg","cdp_tracking","community_charitable_giving","community_local_impact","community_volunteering","company_emissions_current","dashboard_vitality","ef_31","email_support","facilities_management","fleet_overview","fleet_reporting","full_scope_3","ghg_emissions","greenwash_documents","greenwash_website","knowledge_bank_manage","knowledge_bank_read","land_use_impact","lca_distribution","live_passport","monthly_analytics","pdf_report_export","people_diversity_inclusion","people_fair_work","product_comparison","product_management","product_passport","recipe_2016","resource_use_tracking","rosa_ai_100","supplier_directory","supply_chain_mapping","vehicle_registry","waste_circularity","water_footprint"]'::jsonb, true, now())
ON CONFLICT (tier_name) DO UPDATE SET
  tier_level = EXCLUDED.tier_level,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  max_products = EXCLUDED.max_products,
  max_lcas = EXCLUDED.max_lcas,
  max_team_members = EXCLUDED.max_team_members,
  max_facilities = EXCLUDED.max_facilities,
  max_suppliers = EXCLUDED.max_suppliers,
  max_reports_per_month = EXCLUDED.max_reports_per_month,
  monthly_price_gbp = EXCLUDED.monthly_price_gbp,
  annual_price_gbp = EXCLUDED.annual_price_gbp,
  features_enabled = EXCLUDED.features_enabled,
  is_active = true,
  updated_at = now();

-- canopy: 69 features
INSERT INTO public.subscription_tier_limits
  (tier_name, tier_level, display_name, description,
   max_products, max_lcas, max_team_members, max_facilities, max_suppliers, max_reports_per_month,
   monthly_price_gbp, annual_price_gbp, features_enabled, is_active, updated_at)
VALUES
  ('canopy', 3, 'Canopy', 'Comprehensive sustainability management for established organisations',
   100, 100, 10, 10, 200, 200,
   599, 5990, '["advanced_data_quality","api_access","arable_fields","audit_packages","automated_verification","b_corp_assessment","bcorp_tracking","biodiversity_tracking","carbon_footprint_ghg","cdp_tracking","community_charitable_giving","community_impact_stories","community_local_impact","community_volunteering","company_emissions_current","csrd_compliance","custom_weighting","dashboard_vitality","ef_31","ef_31_single_score","email_support","facilities_management","fleet_overview","fleet_reporting","full_scope_3","gap_analysis","ghg_emissions","governance_ethics","greenwash_documents","greenwash_unlimited","greenwash_website","gri_standards","hospitality","iso_14001","iso_50001","knowledge_bank_manage","knowledge_bank_read","land_use_impact","lca_distribution","lca_end_of_life","lca_use_phase","live_passport","monthly_analytics","orchards","pdf_report_export","pef_reports","people_diversity_inclusion","people_fair_work","people_training","people_wellbeing","priority_chat","product_comparison","product_management","product_passport","recipe_2016","resource_use_tracking","rosa_ai_unlimited","sandbox_analytics","sbti_targets","supplier_directory","supply_chain_mapping","third_party_verification","vehicle_registry","verified_data","viticulture","waste_circularity","water_footprint","white_label","year_over_year"]'::jsonb, true, now())
ON CONFLICT (tier_name) DO UPDATE SET
  tier_level = EXCLUDED.tier_level,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  max_products = EXCLUDED.max_products,
  max_lcas = EXCLUDED.max_lcas,
  max_team_members = EXCLUDED.max_team_members,
  max_facilities = EXCLUDED.max_facilities,
  max_suppliers = EXCLUDED.max_suppliers,
  max_reports_per_month = EXCLUDED.max_reports_per_month,
  monthly_price_gbp = EXCLUDED.monthly_price_gbp,
  annual_price_gbp = EXCLUDED.annual_price_gbp,
  features_enabled = EXCLUDED.features_enabled,
  is_active = true,
  updated_at = now();

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
