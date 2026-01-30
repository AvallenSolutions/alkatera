-- Migration: Update subscription tier features and add missing limit-check RPCs
-- Aligns features_enabled with the new pricing plan feature matrix

-- ============================================================================
-- 1. Update features_enabled for each tier
-- ============================================================================

UPDATE subscription_tier_limits
SET features_enabled = jsonb_build_array(
  -- Core Platform
  'dashboard_vitality',
  'facilities_management',
  'fleet_overview',
  'supplier_directory',
  'company_emissions_current',
  -- Products & LCA
  'product_management',
  'product_passport',
  'carbon_footprint_ghg',
  'pdf_report_export',
  -- AI Tools
  'rosa_ai_25',
  'greenwash_website',
  -- Resources
  'knowledge_bank_read',
  -- Legacy codes (keep for backward compat)
  'ghg_emissions',
  'live_passport',
  'automated_verification',
  'email_support',
  'recipe_2016'
)
WHERE tier_name = 'seed';

UPDATE subscription_tier_limits
SET features_enabled = jsonb_build_array(
  -- Core Platform (all Seed features)
  'dashboard_vitality',
  'facilities_management',
  'fleet_overview',
  'supplier_directory',
  'company_emissions_current',
  'vehicle_registry',
  'supply_chain_mapping',
  'full_scope_3',
  -- Products & LCA (all Seed features)
  'product_management',
  'product_passport',
  'carbon_footprint_ghg',
  'pdf_report_export',
  'water_footprint',
  'waste_circularity',
  'land_use_impact',
  'resource_use_tracking',
  -- AI Tools
  'rosa_ai_100',
  'greenwash_website',
  'greenwash_documents',
  -- ESG Modules
  'people_fair_work',
  'people_diversity_inclusion',
  'community_charitable_giving',
  'community_volunteering',
  -- Certifications
  'bcorp_tracking',
  'cdp_tracking',
  -- Resources
  'knowledge_bank_read',
  'knowledge_bank_manage',
  -- Legacy codes
  'ghg_emissions',
  'live_passport',
  'automated_verification',
  'email_support',
  'recipe_2016',
  'ef_31',
  'monthly_analytics',
  'product_comparison',
  'fleet_reporting'
)
WHERE tier_name = 'blossom';

UPDATE subscription_tier_limits
SET features_enabled = jsonb_build_array(
  -- Core Platform (all Blossom features)
  'dashboard_vitality',
  'facilities_management',
  'fleet_overview',
  'supplier_directory',
  'company_emissions_current',
  'vehicle_registry',
  'supply_chain_mapping',
  'full_scope_3',
  -- Products & LCA (all Blossom features)
  'product_management',
  'product_passport',
  'carbon_footprint_ghg',
  'pdf_report_export',
  'water_footprint',
  'waste_circularity',
  'land_use_impact',
  'resource_use_tracking',
  'year_over_year',
  'advanced_data_quality',
  'ef_31_single_score',
  -- AI Tools
  'rosa_ai_unlimited',
  'greenwash_website',
  'greenwash_documents',
  'greenwash_unlimited',
  -- ESG Modules (all Blossom + Canopy-only)
  'people_fair_work',
  'people_diversity_inclusion',
  'people_wellbeing',
  'people_training',
  'governance_ethics',
  'community_charitable_giving',
  'community_volunteering',
  'community_local_impact',
  'community_impact_stories',
  -- Certifications (all)
  'bcorp_tracking',
  'cdp_tracking',
  'csrd_compliance',
  'gri_standards',
  'iso_14001',
  'iso_50001',
  'sbti_targets',
  'gap_analysis',
  'audit_packages',
  'third_party_verification',
  -- Resources
  'knowledge_bank_read',
  'knowledge_bank_manage',
  -- Legacy codes
  'ghg_emissions',
  'live_passport',
  'automated_verification',
  'email_support',
  'recipe_2016',
  'ef_31',
  'monthly_analytics',
  'product_comparison',
  'fleet_reporting',
  'custom_weighting',
  'white_label',
  'biodiversity_tracking',
  'b_corp_assessment',
  'sandbox_analytics',
  'priority_chat',
  'verified_data',
  'pef_reports',
  'api_access'
)
WHERE tier_name = 'canopy';

-- ============================================================================
-- 2. Add missing limit-check RPC functions (facility, supplier, team member)
-- ============================================================================

-- Check facility limit
CREATE OR REPLACE FUNCTION check_facility_limit(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier text;
  v_status text;
  v_max_facilities int;
  v_current_count int;
BEGIN
  -- Get org tier and status
  SELECT subscription_tier, subscription_status
  INTO v_tier, v_status
  FROM organizations
  WHERE id = p_organization_id;

  IF v_tier IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Organisation not found',
      'current_count', 0,
      'max_count', 0,
      'tier', 'seed',
      'is_unlimited', false
    );
  END IF;

  IF v_status NOT IN ('active', 'trial') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Subscription is not active',
      'current_count', 0,
      'max_count', 0,
      'tier', v_tier,
      'is_unlimited', false
    );
  END IF;

  -- Get limit
  SELECT max_facilities INTO v_max_facilities
  FROM subscription_tier_limits
  WHERE tier_name = v_tier AND is_active = true;

  -- Count current facilities
  SELECT count(*) INTO v_current_count
  FROM facilities
  WHERE organization_id = p_organization_id;

  -- Unlimited check
  IF v_max_facilities IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', NULL,
      'current_count', v_current_count,
      'max_count', NULL,
      'tier', v_tier,
      'is_unlimited', true
    );
  END IF;

  -- Limit check
  IF v_current_count >= v_max_facilities THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('Facility limit reached (%s/%s). Upgrade to add more facilities.', v_current_count, v_max_facilities),
      'current_count', v_current_count,
      'max_count', v_max_facilities,
      'tier', v_tier,
      'is_unlimited', false
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', NULL,
    'current_count', v_current_count,
    'max_count', v_max_facilities,
    'tier', v_tier,
    'is_unlimited', false
  );
END;
$$;

-- Check supplier limit
CREATE OR REPLACE FUNCTION check_supplier_limit(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier text;
  v_status text;
  v_max_suppliers int;
  v_current_count int;
BEGIN
  SELECT subscription_tier, subscription_status
  INTO v_tier, v_status
  FROM organizations
  WHERE id = p_organization_id;

  IF v_tier IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Organisation not found',
      'current_count', 0,
      'max_count', 0,
      'tier', 'seed',
      'is_unlimited', false
    );
  END IF;

  IF v_status NOT IN ('active', 'trial') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Subscription is not active',
      'current_count', 0,
      'max_count', 0,
      'tier', v_tier,
      'is_unlimited', false
    );
  END IF;

  SELECT max_suppliers INTO v_max_suppliers
  FROM subscription_tier_limits
  WHERE tier_name = v_tier AND is_active = true;

  SELECT count(*) INTO v_current_count
  FROM suppliers
  WHERE organization_id = p_organization_id;

  IF v_max_suppliers IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', NULL,
      'current_count', v_current_count,
      'max_count', NULL,
      'tier', v_tier,
      'is_unlimited', true
    );
  END IF;

  IF v_current_count >= v_max_suppliers THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('Supplier limit reached (%s/%s). Upgrade to add more suppliers.', v_current_count, v_max_suppliers),
      'current_count', v_current_count,
      'max_count', v_max_suppliers,
      'tier', v_tier,
      'is_unlimited', false
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', NULL,
    'current_count', v_current_count,
    'max_count', v_max_suppliers,
    'tier', v_tier,
    'is_unlimited', false
  );
END;
$$;

-- Check team member limit
CREATE OR REPLACE FUNCTION check_team_member_limit(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier text;
  v_status text;
  v_max_members int;
  v_current_count int;
BEGIN
  SELECT subscription_tier, subscription_status
  INTO v_tier, v_status
  FROM organizations
  WHERE id = p_organization_id;

  IF v_tier IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Organisation not found',
      'current_count', 0,
      'max_count', 0,
      'tier', 'seed',
      'is_unlimited', false
    );
  END IF;

  IF v_status NOT IN ('active', 'trial') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Subscription is not active',
      'current_count', 0,
      'max_count', 0,
      'tier', v_tier,
      'is_unlimited', false
    );
  END IF;

  SELECT max_team_members INTO v_max_members
  FROM subscription_tier_limits
  WHERE tier_name = v_tier AND is_active = true;

  SELECT count(*) INTO v_current_count
  FROM organization_members
  WHERE organization_id = p_organization_id;

  IF v_max_members IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', NULL,
      'current_count', v_current_count,
      'max_count', NULL,
      'tier', v_tier,
      'is_unlimited', true
    );
  END IF;

  IF v_current_count >= v_max_members THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('Team member limit reached (%s/%s). Upgrade to add more members.', v_current_count, v_max_members),
      'current_count', v_current_count,
      'max_count', v_max_members,
      'tier', v_tier,
      'is_unlimited', false
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', NULL,
    'current_count', v_current_count,
    'max_count', v_max_members,
    'tier', v_tier,
    'is_unlimited', false
  );
END;
$$;
