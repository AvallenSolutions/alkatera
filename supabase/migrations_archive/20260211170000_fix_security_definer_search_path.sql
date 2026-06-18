-- ============================================================================
-- Fix SECURITY DEFINER functions: add SET search_path = public
-- ============================================================================
-- Problem: SECURITY DEFINER functions run with the function owner's
-- search_path (the 'postgres' role in Supabase). In Supabase's hosted
-- environment, the postgres role's search_path may not resolve 'public'
-- schema tables correctly, causing:
--
--   ERROR: 42P01: relation "public.organization_members" does not exist
--
-- The tables DO exist (verified via REST API), but the function context
-- cannot find them.
--
-- Fix: Add SET search_path = public to all platform dashboard functions.
-- Also fixes get_platform_organizations ORDER BY grouping error (42803).
-- ============================================================================

-- ============================================================================
-- 1. Fix is_alkatera_admin() — add search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."is_alkatera_admin"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
BEGIN
  -- Check 1: Organization membership in the 'alkatera' platform org
  IF EXISTS (
    SELECT 1
    FROM organization_members om
    JOIN organizations o ON o.id = om.organization_id
    JOIN roles r ON r.id = om.role_id
    WHERE om.user_id = auth.uid()
      AND o.slug = 'alkatera'
      AND o.is_platform_admin = true
      AND r.name IN ('owner', 'admin')
  ) THEN
    RETURN true;
  END IF;

  -- Check 2: Fallback to profiles.is_alkatera_admin flag
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND is_alkatera_admin = true
  );
END;
$$;

ALTER FUNCTION "public"."is_alkatera_admin"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."is_alkatera_admin"() IS 'Returns true if current user is an Alkatera platform administrator. Checks both organization membership in the alkatera platform org and the profiles.is_alkatera_admin flag.';

-- ============================================================================
-- 2. Fix get_platform_organizations() — add search_path + fix ORDER BY
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."get_platform_organizations"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
BEGIN
  IF NOT is_alkatera_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(org_data), '[]'::jsonb)
    FROM (
      SELECT jsonb_build_object(
        'id', o.id,
        'name', o.name,
        'slug', o.slug,
        'created_at', o.created_at,
        'member_count', (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id),
        'product_count', (SELECT COUNT(*) FROM products WHERE organization_id = o.id),
        'facility_count', (SELECT COUNT(*) FROM facilities WHERE organization_id = o.id),
        'subscription_tier', o.subscription_tier,
        'subscription_status', o.subscription_status,
        'subscription_started_at', o.subscription_started_at
      ) AS org_data
      FROM organizations o
      WHERE o.slug != 'alkatera'
      ORDER BY o.created_at DESC
    ) sub
  );
END;
$$;

ALTER FUNCTION "public"."get_platform_organizations"() OWNER TO "postgres";

-- ============================================================================
-- 3. Fix get_platform_statistics() — add search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."get_platform_statistics"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT is_alkatera_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT jsonb_build_object(
    'users', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM profiles),
      'new_this_month', (SELECT COUNT(*) FROM profiles
        WHERE created_at >= date_trunc('month', CURRENT_DATE)),
      'new_this_week', (SELECT COUNT(*) FROM profiles
        WHERE created_at >= date_trunc('week', CURRENT_DATE))
    ),
    'organizations', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM organizations WHERE slug != 'alkatera'),
      'new_this_month', (SELECT COUNT(*) FROM organizations
        WHERE created_at >= date_trunc('month', CURRENT_DATE) AND slug != 'alkatera'),
      'with_products', (SELECT COUNT(DISTINCT organization_id) FROM products),
      'with_facilities', (SELECT COUNT(DISTINCT organization_id) FROM facilities)
    ),
    'content', jsonb_build_object(
      'total_products', (SELECT COUNT(*) FROM products),
      'total_facilities', (SELECT COUNT(*) FROM facilities),
      'total_suppliers', (SELECT COUNT(*) FROM suppliers),
      'total_lcas', (SELECT COUNT(*) FROM product_lcas)
    ),
    'subscriptions', jsonb_build_object(
      'by_tier', jsonb_build_object(
        'seed', (SELECT COUNT(*) FROM organizations
          WHERE subscription_tier = 'seed' AND slug != 'alkatera'),
        'blossom', (SELECT COUNT(*) FROM organizations
          WHERE subscription_tier = 'blossom' AND slug != 'alkatera'),
        'canopy', (SELECT COUNT(*) FROM organizations
          WHERE subscription_tier = 'canopy' AND slug != 'alkatera'),
        'none', (SELECT COUNT(*) FROM organizations
          WHERE subscription_tier IS NULL AND slug != 'alkatera')
      ),
      'by_status', jsonb_build_object(
        'active', (SELECT COUNT(*) FROM organizations
          WHERE subscription_status = 'active' AND slug != 'alkatera'),
        'trial', (SELECT COUNT(*) FROM organizations
          WHERE subscription_status = 'trial' AND slug != 'alkatera'),
        'pending', (SELECT COUNT(*) FROM organizations
          WHERE subscription_status = 'pending' AND slug != 'alkatera'),
        'suspended', (SELECT COUNT(*) FROM organizations
          WHERE subscription_status = 'suspended' AND slug != 'alkatera'),
        'cancelled', (SELECT COUNT(*) FROM organizations
          WHERE subscription_status = 'cancelled' AND slug != 'alkatera')
      ),
      'with_stripe', (SELECT COUNT(*) FROM organizations
        WHERE stripe_customer_id IS NOT NULL AND slug != 'alkatera'),
      'recent_signups_7d', (SELECT COUNT(*) FROM organizations
        WHERE created_at >= NOW() - INTERVAL '7 days' AND slug != 'alkatera')
    ),
    'pending_approvals', jsonb_build_object(
      'activity_data', (SELECT COUNT(*) FROM pending_activity_data WHERE approval_status = 'pending'),
      'facilities', (SELECT COUNT(*) FROM pending_facilities WHERE approval_status = 'pending'),
      'products', (SELECT COUNT(*) FROM pending_products WHERE approval_status = 'pending'),
      'suppliers', (SELECT COUNT(*) FROM pending_suppliers WHERE approval_status = 'pending')
    ),
    'verification', jsonb_build_object(
      'unverified_supplier_products', (SELECT COUNT(*) FROM supplier_products WHERE is_verified = false AND is_active = true)
    ),
    'generated_at', now()
  ) INTO result;

  RETURN result;
END;
$$;

ALTER FUNCTION "public"."get_platform_statistics"() OWNER TO "postgres";

-- ============================================================================
-- 4. Fix get_feature_adoption() — add search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."get_feature_adoption"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
  result JSONB;
  total_orgs INTEGER;
BEGIN
  IF NOT is_alkatera_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT COUNT(*) INTO total_orgs FROM organizations;

  SELECT jsonb_build_object(
    'products_module', jsonb_build_object(
      'organizations_using', (SELECT COUNT(DISTINCT organization_id) FROM products),
      'adoption_rate', ROUND((SELECT COUNT(DISTINCT organization_id)::numeric FROM products) / GREATEST(total_orgs, 1) * 100, 1)
    ),
    'facilities_module', jsonb_build_object(
      'organizations_using', (SELECT COUNT(DISTINCT organization_id) FROM facilities),
      'adoption_rate', ROUND((SELECT COUNT(DISTINCT organization_id)::numeric FROM facilities) / GREATEST(total_orgs, 1) * 100, 1)
    ),
    'suppliers_module', jsonb_build_object(
      'organizations_using', (SELECT COUNT(DISTINCT organization_id) FROM suppliers),
      'adoption_rate', ROUND((SELECT COUNT(DISTINCT organization_id)::numeric FROM suppliers) / GREATEST(total_orgs, 1) * 100, 1)
    ),
    'lca_module', jsonb_build_object(
      'organizations_using', (SELECT COUNT(DISTINCT p.organization_id) FROM product_lcas pl JOIN products p ON pl.product_id = p.id),
      'adoption_rate', ROUND((SELECT COUNT(DISTINCT p.organization_id)::numeric FROM product_lcas pl JOIN products p ON pl.product_id = p.id) / GREATEST(total_orgs, 1) * 100, 1)
    ),
    'total_organizations', total_orgs
  ) INTO result;

  RETURN result;
END;
$$;

ALTER FUNCTION "public"."get_feature_adoption"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."get_feature_adoption"() IS 'Get feature adoption rates across the platform';
