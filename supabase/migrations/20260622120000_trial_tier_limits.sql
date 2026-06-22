-- Free trial: custom, tightly-scoped caps for orgs on a 30-day trial.
--
-- Trial orgs keep subscription_tier = 'seed' (so feature/nav VISIBILITY matches Seed),
-- but subscription_status = 'trial'. We squeeze the QUANTITY caps to focus the prospect
-- on the core journey: 1 facility, 3 products, 1 LCA, no reports/suppliers, 1 team member.
--
-- Mechanism: a dedicated 'trial' row in subscription_tier_limits, plus a one-line
-- "effective tier" change in each check_*_limit RPC so limits resolve to the 'trial' row
-- when status = 'trial'. check_feature_access is deliberately left untouched (reads by the
-- real 'seed' tier), so only counts are constrained, not which features are visible.

-- 1. Allow 'trial' as a tier_name in subscription_tier_limits (org.subscription_tier keeps
--    its seed/blossom/canopy CHECK untouched — trial orgs are still tier 'seed').
ALTER TABLE "public"."subscription_tier_limits"
  DROP CONSTRAINT IF EXISTS "valid_tier_name";
ALTER TABLE "public"."subscription_tier_limits"
  ADD CONSTRAINT "valid_tier_name"
  CHECK (("tier_name" = ANY (ARRAY['trial'::text, 'seed'::text, 'blossom'::text, 'canopy'::text])));

-- tier_level is UNIQUE, and seed/blossom/canopy occupy 1/2/3. Give 'trial' level 0
-- (below the paid tiers) and relax the 1..3 CHECK to allow it.
ALTER TABLE "public"."subscription_tier_limits"
  DROP CONSTRAINT IF EXISTS "valid_tier_level";
ALTER TABLE "public"."subscription_tier_limits"
  ADD CONSTRAINT "valid_tier_level"
  CHECK ((("tier_level" >= 0) AND ("tier_level" <= 3)));

-- 2. Upsert the trial limits row. features_enabled mirrors Seed so trial users see the
--    same features as Seed (just fewer of each resource). tier_level = 1 to satisfy the
--    valid_tier_level CHECK (1..3); it is never used for inheritance since trial orgs
--    carry subscription_tier = 'seed'.
INSERT INTO "public"."subscription_tier_limits" (
  tier_name, tier_level, display_name,
  max_products, max_lcas, max_facilities,
  max_reports_per_month, max_suppliers, max_team_members,
  features_enabled, monthly_price_gbp, annual_price_gbp, description, is_active
)
VALUES (
  'trial', 0, 'Free Trial',
  3, 1, 1,
  0, 0, 1,
  COALESCE((SELECT features_enabled FROM "public"."subscription_tier_limits" WHERE tier_name = 'seed'), '[]'::jsonb),
  NULL, NULL, '30-day free trial — explore the core journey, then subscribe.', true
)
ON CONFLICT (tier_name) DO UPDATE SET
  tier_level = EXCLUDED.tier_level,
  display_name = EXCLUDED.display_name,
  max_products = EXCLUDED.max_products,
  max_lcas = EXCLUDED.max_lcas,
  max_facilities = EXCLUDED.max_facilities,
  max_reports_per_month = EXCLUDED.max_reports_per_month,
  max_suppliers = EXCLUDED.max_suppliers,
  max_team_members = EXCLUDED.max_team_members,
  features_enabled = EXCLUDED.features_enabled,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = now();

-- 3. Patch the limit RPCs: resolve limits against the 'trial' row when status = 'trial'.
--    Bodies are identical to the baseline except the limits lookup line.

CREATE OR REPLACE FUNCTION "public"."check_facility_limit"("p_organization_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_tier text;
  v_status text;
  v_max_facilities int;
  v_current_count int;
BEGIN
  SELECT subscription_tier, subscription_status
  INTO v_tier, v_status
  FROM organizations
  WHERE id = p_organization_id;

  IF v_tier IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Organisation not found', 'current_count', 0, 'max_count', 0, 'tier', 'seed', 'is_unlimited', false);
  END IF;

  IF v_status NOT IN ('active', 'trial', 'pending', 'past_due') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Subscription is not active', 'current_count', 0, 'max_count', 0, 'tier', v_tier, 'is_unlimited', false);
  END IF;

  SELECT max_facilities INTO v_max_facilities
  FROM subscription_tier_limits
  WHERE tier_name = (CASE WHEN v_status = 'trial' THEN 'trial' ELSE v_tier END) AND is_active = true;

  SELECT count(*) INTO v_current_count
  FROM facilities
  WHERE organization_id = p_organization_id;

  IF v_max_facilities IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'reason', NULL, 'current_count', v_current_count, 'max_count', NULL, 'tier', v_tier, 'is_unlimited', true);
  END IF;

  IF v_current_count >= v_max_facilities THEN
    RETURN jsonb_build_object('allowed', false, 'reason', format('Facility limit reached (%s/%s). Upgrade to add more facilities.', v_current_count, v_max_facilities), 'current_count', v_current_count, 'max_count', v_max_facilities, 'tier', v_tier, 'is_unlimited', false);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'reason', NULL, 'current_count', v_current_count, 'max_count', v_max_facilities, 'tier', v_tier, 'is_unlimited', false);
END;
$$;

CREATE OR REPLACE FUNCTION "public"."check_lca_limit"("p_organization_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_tier text;
  v_status text;
  v_current_count integer;
  v_max_count integer;
  v_can_create boolean;
BEGIN
  SELECT subscription_tier, subscription_status
  INTO v_tier, v_status
  FROM public.organizations
  WHERE id = p_organization_id;

  IF v_tier IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Organization not found', 'current_count', 0, 'max_count', 0, 'tier', 'seed', 'is_unlimited', false);
  END IF;

  IF v_status NOT IN ('active', 'trial', 'pending', 'past_due') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Subscription is ' || v_status, 'current_count', 0, 'max_count', 0, 'tier', v_tier, 'is_unlimited', false);
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM public.product_carbon_footprints
  WHERE organization_id = p_organization_id;

  SELECT max_lcas INTO v_max_count
  FROM public.subscription_tier_limits
  WHERE tier_name = (CASE WHEN v_status = 'trial' THEN 'trial' ELSE v_tier END);

  v_can_create := v_max_count IS NULL OR v_current_count < v_max_count;

  RETURN jsonb_build_object(
    'allowed', v_can_create,
    'reason', CASE WHEN v_can_create THEN null ELSE 'LCA limit reached (' || v_current_count || '/' || v_max_count || '). Upgrade to create more LCAs.' END,
    'current_count', v_current_count,
    'max_count', v_max_count,
    'tier', v_tier,
    'is_unlimited', v_max_count IS NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION "public"."check_product_limit"("p_organization_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_tier text;
  v_status text;
  v_current_count integer;
  v_max_count integer;
  v_can_create boolean;
BEGIN
  SELECT subscription_tier, subscription_status
  INTO v_tier, v_status
  FROM public.organizations
  WHERE id = p_organization_id;

  IF v_tier IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Organization not found', 'current_count', 0, 'max_count', 0, 'tier', 'seed', 'is_unlimited', false);
  END IF;

  IF v_status NOT IN ('active', 'trial', 'pending', 'past_due') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Subscription is ' || v_status, 'current_count', 0, 'max_count', 0, 'tier', v_tier, 'is_unlimited', false);
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM public.products
  WHERE organization_id = p_organization_id;

  SELECT max_products INTO v_max_count
  FROM public.subscription_tier_limits
  WHERE tier_name = (CASE WHEN v_status = 'trial' THEN 'trial' ELSE v_tier END);

  v_can_create := v_max_count IS NULL OR v_current_count < v_max_count;

  RETURN jsonb_build_object(
    'allowed', v_can_create,
    'reason', CASE WHEN v_can_create THEN null ELSE 'Product limit reached (' || v_current_count || '/' || v_max_count || '). Upgrade to create more products.' END,
    'current_count', v_current_count,
    'max_count', v_max_count,
    'tier', v_tier,
    'is_unlimited', v_max_count IS NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION "public"."check_report_limit"("p_organization_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_tier text;
  v_status text;
  v_current_count integer;
  v_max_count integer;
  v_can_generate boolean;
BEGIN
  SELECT subscription_tier, subscription_status
  INTO v_tier, v_status
  FROM public.organizations
  WHERE id = p_organization_id;

  IF v_tier IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Organization not found', 'current_count', 0, 'max_count', 0, 'tier', 'seed', 'is_unlimited', false);
  END IF;

  IF v_status NOT IN ('active', 'trial', 'pending', 'past_due') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Subscription is ' || v_status, 'current_count', 0, 'max_count', 0, 'tier', v_tier, 'is_unlimited', false);
  END IF;

  SELECT
    (SELECT COUNT(*) FROM public.product_carbon_footprints WHERE organization_id = p_organization_id AND created_at >= date_trunc('month', now()))
    +
    (SELECT COUNT(*) FROM public.generated_reports WHERE organization_id = p_organization_id AND created_at >= date_trunc('month', now()))
  INTO v_current_count;

  SELECT max_reports_per_month INTO v_max_count
  FROM public.subscription_tier_limits
  WHERE tier_name = (CASE WHEN v_status = 'trial' THEN 'trial' ELSE v_tier END);

  v_can_generate := v_max_count IS NULL OR v_current_count < v_max_count;

  RETURN jsonb_build_object(
    'allowed', v_can_generate,
    'reason', CASE WHEN v_can_generate THEN null ELSE 'Monthly report limit reached (' || v_current_count || '/' || v_max_count || '). Upgrade for more reports.' END,
    'current_count', v_current_count,
    'max_count', v_max_count,
    'tier', v_tier,
    'is_unlimited', v_max_count IS NULL,
    'resets_at', date_trunc('month', now()) + interval '1 month'
  );
END;
$$;

CREATE OR REPLACE FUNCTION "public"."check_supplier_limit"("p_organization_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
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
    RETURN jsonb_build_object('allowed', false, 'reason', 'Organisation not found', 'current_count', 0, 'max_count', 0, 'tier', 'seed', 'is_unlimited', false);
  END IF;

  IF v_status NOT IN ('active', 'trial', 'pending', 'past_due') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Subscription is not active', 'current_count', 0, 'max_count', 0, 'tier', v_tier, 'is_unlimited', false);
  END IF;

  SELECT max_suppliers INTO v_max_suppliers
  FROM subscription_tier_limits
  WHERE tier_name = (CASE WHEN v_status = 'trial' THEN 'trial' ELSE v_tier END) AND is_active = true;

  SELECT count(*) INTO v_current_count
  FROM suppliers
  WHERE organization_id = p_organization_id;

  IF v_max_suppliers IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'reason', NULL, 'current_count', v_current_count, 'max_count', NULL, 'tier', v_tier, 'is_unlimited', true);
  END IF;

  IF v_current_count >= v_max_suppliers THEN
    RETURN jsonb_build_object('allowed', false, 'reason', format('Supplier limit reached (%s/%s). Upgrade to add more suppliers.', v_current_count, v_max_suppliers), 'current_count', v_current_count, 'max_count', v_max_suppliers, 'tier', v_tier, 'is_unlimited', false);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'reason', NULL, 'current_count', v_current_count, 'max_count', v_max_suppliers, 'tier', v_tier, 'is_unlimited', false);
END;
$$;

CREATE OR REPLACE FUNCTION "public"."check_team_member_limit"("p_organization_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
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
    RETURN jsonb_build_object('allowed', false, 'reason', 'Organisation not found', 'current_count', 0, 'max_count', 0, 'tier', 'seed', 'is_unlimited', false);
  END IF;

  IF v_status NOT IN ('active', 'trial', 'pending', 'past_due') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Subscription is not active', 'current_count', 0, 'max_count', 0, 'tier', v_tier, 'is_unlimited', false);
  END IF;

  SELECT max_team_members INTO v_max_members
  FROM subscription_tier_limits
  WHERE tier_name = (CASE WHEN v_status = 'trial' THEN 'trial' ELSE v_tier END) AND is_active = true;

  SELECT count(*) INTO v_current_count
  FROM organization_members
  WHERE organization_id = p_organization_id;

  IF v_max_members IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'reason', NULL, 'current_count', v_current_count, 'max_count', NULL, 'tier', v_tier, 'is_unlimited', true);
  END IF;

  IF v_current_count >= v_max_members THEN
    RETURN jsonb_build_object('allowed', false, 'reason', format('Team member limit reached (%s/%s). Upgrade to add more members.', v_current_count, v_max_members), 'current_count', v_current_count, 'max_count', v_max_members, 'tier', v_tier, 'is_unlimited', false);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'reason', NULL, 'current_count', v_current_count, 'max_count', v_max_members, 'tier', v_tier, 'is_unlimited', false);
END;
$$;

-- 4. Trigger backstop for trial caps.
--    Facilities and products are created CLIENT-SIDE (direct Supabase insert), so the
--    app-layer middleware never sees them. These BEFORE INSERT triggers enforce the trial
--    caps at the data layer. They are deliberately scoped to status = 'trial' only, so
--    non-trial orgs behave exactly as before (limits stay advisory for paid tiers).

CREATE OR REPLACE FUNCTION "public"."enforce_trial_facility_limit"() RETURNS trigger
    LANGUAGE "plpgsql" SECURITY DEFINER AS $$
DECLARE
  v_status text;
  v_check jsonb;
BEGIN
  SELECT subscription_status INTO v_status FROM public.organizations WHERE id = NEW.organization_id;
  IF v_status = 'trial' THEN
    v_check := public.check_facility_limit(NEW.organization_id);
    IF NOT (v_check->>'allowed')::boolean THEN
      RAISE EXCEPTION 'TRIAL_LIMIT_REACHED: %', COALESCE(v_check->>'reason', 'Trial facility limit reached')
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."enforce_trial_product_limit"() RETURNS trigger
    LANGUAGE "plpgsql" SECURITY DEFINER AS $$
DECLARE
  v_status text;
  v_check jsonb;
BEGIN
  SELECT subscription_status INTO v_status FROM public.organizations WHERE id = NEW.organization_id;
  IF v_status = 'trial' THEN
    v_check := public.check_product_limit(NEW.organization_id);
    IF NOT (v_check->>'allowed')::boolean THEN
      RAISE EXCEPTION 'TRIAL_LIMIT_REACHED: %', COALESCE(v_check->>'reason', 'Trial product limit reached')
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."enforce_trial_lca_limit"() RETURNS trigger
    LANGUAGE "plpgsql" SECURITY DEFINER AS $$
DECLARE
  v_status text;
  v_check jsonb;
BEGIN
  SELECT subscription_status INTO v_status FROM public.organizations WHERE id = NEW.organization_id;
  IF v_status = 'trial' THEN
    v_check := public.check_lca_limit(NEW.organization_id);
    IF NOT (v_check->>'allowed')::boolean THEN
      RAISE EXCEPTION 'TRIAL_LIMIT_REACHED: %', COALESCE(v_check->>'reason', 'Trial LCA limit reached')
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_enforce_trial_facility_limit" ON "public"."facilities";
CREATE TRIGGER "trg_enforce_trial_facility_limit"
  BEFORE INSERT ON "public"."facilities"
  FOR EACH ROW EXECUTE FUNCTION "public"."enforce_trial_facility_limit"();

DROP TRIGGER IF EXISTS "trg_enforce_trial_product_limit" ON "public"."products";
CREATE TRIGGER "trg_enforce_trial_product_limit"
  BEFORE INSERT ON "public"."products"
  FOR EACH ROW EXECUTE FUNCTION "public"."enforce_trial_product_limit"();

DROP TRIGGER IF EXISTS "trg_enforce_trial_lca_limit" ON "public"."product_carbon_footprints";
CREATE TRIGGER "trg_enforce_trial_lca_limit"
  BEFORE INSERT ON "public"."product_carbon_footprints"
  FOR EACH ROW EXECUTE FUNCTION "public"."enforce_trial_lca_limit"();

-- 5. Usage summary: report the EFFECTIVE (trial) caps so the usage meters match what
--    the RPCs/triggers actually enforce. Tier name/level/display and feature visibility
--    stay on the real 'seed' tier; only the max_* quantities follow the trial pseudo-tier.
--    Body identical to the baseline except the added v_limits_eff lookup and its use.
CREATE OR REPLACE FUNCTION "public"."get_organization_usage"("p_organization_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_org RECORD;
  v_limits RECORD;
  v_limits_eff RECORD;
  v_product_count INTEGER;
  v_lca_count INTEGER;
  v_report_count INTEGER;
  v_team_count INTEGER;
  v_facility_count INTEGER;
  v_supplier_count INTEGER;
BEGIN
  SELECT * INTO v_org
  FROM public.organizations
  WHERE id = p_organization_id;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('error', 'Organization not found');
  END IF;

  -- Tier display + feature visibility come from the real tier (seed for trials).
  SELECT * INTO v_limits
  FROM public.subscription_tier_limits
  WHERE tier_name = v_org.subscription_tier;

  -- Quantity caps come from the effective tier ('trial' while status = 'trial').
  SELECT * INTO v_limits_eff
  FROM public.subscription_tier_limits
  WHERE tier_name = (CASE WHEN v_org.subscription_status = 'trial' THEN 'trial' ELSE v_org.subscription_tier END);

  SELECT COUNT(*) INTO v_product_count
  FROM public.products
  WHERE organization_id = p_organization_id;

  SELECT COUNT(*) INTO v_lca_count
  FROM public.product_carbon_footprints
  WHERE organization_id = p_organization_id;

  SELECT COUNT(*) INTO v_team_count
  FROM public.organization_members
  WHERE organization_id = p_organization_id;

  SELECT COUNT(*) INTO v_facility_count
  FROM public.facilities
  WHERE organization_id = p_organization_id;

  SELECT COUNT(*) INTO v_supplier_count
  FROM public.suppliers
  WHERE organization_id = p_organization_id;

  SELECT
    (SELECT COUNT(*) FROM public.product_carbon_footprints
     WHERE organization_id = p_organization_id
       AND created_at >= date_trunc('month', now()))
    +
    (SELECT COUNT(*) FROM public.generated_reports
     WHERE organization_id = p_organization_id
       AND created_at >= date_trunc('month', now()))
  INTO v_report_count;

  IF v_org.current_product_count != v_product_count
     OR v_org.current_lca_count != v_lca_count THEN
    UPDATE public.organizations
    SET current_product_count = v_product_count,
        current_lca_count = v_lca_count
    WHERE id = p_organization_id;
  END IF;

  RETURN jsonb_build_object(
    'tier', jsonb_build_object(
      'name', v_org.subscription_tier,
      'level', v_limits.tier_level,
      'display_name', v_limits.display_name,
      'status', v_org.subscription_status
    ),
    'usage', jsonb_build_object(
      'products', jsonb_build_object(
        'current', v_product_count,
        'max', v_limits_eff.max_products,
        'is_unlimited', v_limits_eff.max_products IS NULL
      ),
      'reports_monthly', jsonb_build_object(
        'current', v_report_count,
        'max', v_limits_eff.max_reports_per_month,
        'is_unlimited', v_limits_eff.max_reports_per_month IS NULL,
        'resets_at', date_trunc('month', now()) + interval '1 month'
      ),
      'lcas', jsonb_build_object(
        'current', v_lca_count,
        'max', v_limits_eff.max_lcas,
        'is_unlimited', v_limits_eff.max_lcas IS NULL
      ),
      'team_members', jsonb_build_object(
        'current', v_team_count,
        'max', v_limits_eff.max_team_members,
        'is_unlimited', v_limits_eff.max_team_members IS NULL
      ),
      'facilities', jsonb_build_object(
        'current', v_facility_count,
        'max', v_limits_eff.max_facilities,
        'is_unlimited', v_limits_eff.max_facilities IS NULL
      ),
      'suppliers', jsonb_build_object(
        'current', v_supplier_count,
        'max', v_limits_eff.max_suppliers,
        'is_unlimited', v_limits_eff.max_suppliers IS NULL
      )
    ),
    'features', (
      SELECT COALESCE(jsonb_agg(DISTINCT f.code), '[]'::jsonb)
      FROM (
        SELECT jsonb_array_elements_text(COALESCE(v_limits.features_enabled, '[]'::jsonb)) AS code
        UNION
        SELECT key AS code
        FROM jsonb_each_text(COALESCE(v_org.feature_flags, '{}'::jsonb))
        WHERE value = 'true'
      ) f
    )
  );
END;
$$;
