-- Fix platform dashboard inactivity detection and org exclusion
--
-- Two core issues:
-- 1. platform_activity_log is never populated by application code, so
--    get_platform_alerts() and get_platform_organizations() always report
--    orgs as inactive (falling back to created_at date). Fix: use real
--    activity signals from products, facilities, activity_log, and
--    gaia_conversations tables.
--
-- 2. All dashboard functions used `slug != 'alkatera'` to exclude the
--    platform admin org, but this missed 'alkatera Demo' (slug='test-mi1vwwby')
--    which also has is_platform_admin=true. Fix: filter by
--    `is_platform_admin != true` instead.
--
-- Functions updated:
--   - get_platform_alerts()
--   - get_platform_organizations()
--   - get_platform_statistics()
--   - get_platform_growth_trends()
--   - get_onboarding_analytics()
--   - get_feature_adoption()

-- ============================================================================
-- 1. Fix get_platform_alerts() — real activity sources + is_platform_admin
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_platform_alerts()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT is_alkatera_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT jsonb_build_object(
    'expiring_trials', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'org_id', o.id,
        'org_name', o.name,
        'expires_at', o.subscription_expires_at,
        'days_remaining', EXTRACT(DAY FROM (o.subscription_expires_at - NOW()))::integer
      ) ORDER BY o.subscription_expires_at)
      FROM organizations o
      WHERE o.subscription_status = 'trial'
        AND o.subscription_expires_at IS NOT NULL
        AND o.subscription_expires_at <= NOW() + INTERVAL '7 days'
        AND o.subscription_expires_at > NOW()
        AND o.is_platform_admin != true
    ), '[]'::jsonb),

    'approaching_limits', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'org_id', o.id,
        'org_name', o.name,
        'tier', o.subscription_tier,
        'current_products', o.current_product_count,
        'max_products', stl.max_products,
        'usage_pct', ROUND(o.current_product_count::numeric / GREATEST(stl.max_products, 1) * 100, 0)
      ) ORDER BY o.current_product_count::numeric / GREATEST(stl.max_products, 1) DESC)
      FROM organizations o
      JOIN subscription_tier_limits stl ON stl.tier_name = o.subscription_tier
      WHERE o.is_platform_admin != true
        AND stl.max_products > 0
        AND o.current_product_count >= (stl.max_products * 0.8)
    ), '[]'::jsonb),

    'inactive_orgs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'org_id', o.id,
        'org_name', o.name,
        'last_activity', sub.last_activity,
        'days_inactive', CASE
          WHEN sub.last_activity IS NULL THEN
            EXTRACT(DAY FROM (NOW() - o.created_at))::integer
          ELSE
            EXTRACT(DAY FROM (NOW() - sub.last_activity))::integer
          END
      ) ORDER BY sub.last_activity NULLS FIRST)
      FROM organizations o
      LEFT JOIN LATERAL (
        SELECT GREATEST(
          o.updated_at,
          (SELECT MAX(p.updated_at) FROM products p WHERE p.organization_id = o.id),
          (SELECT MAX(f.updated_at) FROM facilities f WHERE f.organization_id = o.id),
          (SELECT MAX(al.created_at) FROM activity_log al WHERE al.organization_id = o.id),
          (SELECT MAX(gc.created_at) FROM gaia_conversations gc WHERE gc.organization_id = o.id)
        ) AS last_activity
      ) sub ON true
      WHERE o.is_platform_admin != true
        AND o.subscription_status IN ('active', 'trial')
        AND (sub.last_activity IS NULL OR sub.last_activity < NOW() - INTERVAL '14 days')
    ), '[]'::jsonb),

    'verification_backlog', (
      SELECT COUNT(*) FROM supplier_products
      WHERE is_verified = false AND is_active = true
    )
  ) INTO result;

  RETURN result;
END;
$$;

ALTER FUNCTION public.get_platform_alerts() OWNER TO postgres;

-- ============================================================================
-- 2. Fix get_platform_organizations() — real activity + is_platform_admin
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_platform_organizations()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
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
        'subscription_started_at', o.subscription_started_at,
        'subscription_expires_at', o.subscription_expires_at,
        'lca_count', (SELECT COUNT(*) FROM product_carbon_footprints WHERE organization_id = o.id),
        'supplier_count', (SELECT COUNT(*) FROM suppliers WHERE organization_id = o.id),
        'onboarding_completed', COALESCE((
          SELECT (os.state->>'completed')::boolean
          FROM onboarding_state os WHERE os.organization_id = o.id
        ), false),
        'onboarding_current_step', (
          SELECT os.state->>'currentStep'
          FROM onboarding_state os WHERE os.organization_id = o.id
        ),
        'last_activity_at', GREATEST(
          o.updated_at,
          (SELECT MAX(p.updated_at) FROM products p WHERE p.organization_id = o.id),
          (SELECT MAX(f.updated_at) FROM facilities f WHERE f.organization_id = o.id),
          (SELECT MAX(al.created_at) FROM activity_log al WHERE al.organization_id = o.id),
          (SELECT MAX(gc.created_at) FROM gaia_conversations gc WHERE gc.organization_id = o.id)
        )
      ) AS org_data
      FROM organizations o
      WHERE o.is_platform_admin != true
      ORDER BY o.created_at DESC
    ) sub
  );
END;
$$;

ALTER FUNCTION public.get_platform_organizations() OWNER TO postgres;

-- ============================================================================
-- 3. Fix get_platform_statistics() — is_platform_admin filter
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_platform_statistics()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
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
      'total', (SELECT COUNT(*) FROM public.profiles),
      'new_this_month', (SELECT COUNT(*) FROM public.profiles
        WHERE created_at >= date_trunc('month', CURRENT_DATE)),
      'new_this_week', (SELECT COUNT(*) FROM public.profiles
        WHERE created_at >= date_trunc('week', CURRENT_DATE))
    ),
    'organizations', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM public.organizations WHERE is_platform_admin != true),
      'new_this_month', (SELECT COUNT(*) FROM public.organizations
        WHERE created_at >= date_trunc('month', CURRENT_DATE) AND is_platform_admin != true),
      'with_products', (SELECT COUNT(DISTINCT organization_id) FROM public.products),
      'with_facilities', (SELECT COUNT(DISTINCT organization_id) FROM public.facilities)
    ),
    'content', jsonb_build_object(
      'total_products', (SELECT COUNT(*) FROM public.products),
      'total_facilities', (SELECT COUNT(*) FROM public.facilities),
      'total_suppliers', (SELECT COUNT(*) FROM public.suppliers),
      'total_lcas', (SELECT COUNT(*) FROM public.product_lcas)
    ),
    'subscriptions', jsonb_build_object(
      'by_tier', jsonb_build_object(
        'seed', (SELECT COUNT(*) FROM public.organizations
          WHERE subscription_tier = 'seed' AND is_platform_admin != true),
        'blossom', (SELECT COUNT(*) FROM public.organizations
          WHERE subscription_tier = 'blossom' AND is_platform_admin != true),
        'canopy', (SELECT COUNT(*) FROM public.organizations
          WHERE subscription_tier = 'canopy' AND is_platform_admin != true),
        'none', (SELECT COUNT(*) FROM public.organizations
          WHERE subscription_tier IS NULL AND is_platform_admin != true)
      ),
      'by_status', jsonb_build_object(
        'active', (SELECT COUNT(*) FROM public.organizations
          WHERE subscription_status = 'active' AND is_platform_admin != true),
        'trial', (SELECT COUNT(*) FROM public.organizations
          WHERE subscription_status = 'trial' AND is_platform_admin != true),
        'pending', (SELECT COUNT(*) FROM public.organizations
          WHERE subscription_status = 'pending' AND is_platform_admin != true),
        'suspended', (SELECT COUNT(*) FROM public.organizations
          WHERE subscription_status = 'suspended' AND is_platform_admin != true),
        'cancelled', (SELECT COUNT(*) FROM public.organizations
          WHERE subscription_status = 'cancelled' AND is_platform_admin != true)
      ),
      'with_stripe', (SELECT COUNT(*) FROM public.organizations
        WHERE stripe_customer_id IS NOT NULL AND is_platform_admin != true),
      'recent_signups_7d', (SELECT COUNT(*) FROM public.organizations
        WHERE created_at >= NOW() - INTERVAL '7 days' AND is_platform_admin != true)
    ),
    'pending_approvals', jsonb_build_object(
      'activity_data', (SELECT COUNT(*) FROM public.pending_activity_data WHERE approval_status = 'pending'),
      'facilities', (SELECT COUNT(*) FROM public.pending_facilities WHERE approval_status = 'pending'),
      'products', (SELECT COUNT(*) FROM public.pending_products WHERE approval_status = 'pending'),
      'suppliers', (SELECT COUNT(*) FROM public.pending_suppliers WHERE approval_status = 'pending')
    ),
    'verification', jsonb_build_object(
      'unverified_supplier_products', (SELECT COUNT(*) FROM public.supplier_products WHERE is_verified = false AND is_active = true)
    ),
    'generated_at', now()
  ) INTO result;

  RETURN result;
END;
$$;

ALTER FUNCTION public.get_platform_statistics() OWNER TO postgres;

-- ============================================================================
-- 4. Fix get_platform_growth_trends() — is_platform_admin filter
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_platform_growth_trends(p_days INTEGER DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  v_start_date DATE;
BEGIN
  IF NOT is_alkatera_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  v_start_date := CURRENT_DATE - p_days;

  WITH weeks AS (
    SELECT generate_series(
      date_trunc('week', v_start_date::timestamp),
      date_trunc('week', CURRENT_DATE::timestamp),
      '1 week'::interval
    )::date AS week_start
  ),
  user_counts AS (
    SELECT date_trunc('week', created_at)::date AS week_start,
           COUNT(*) AS cnt
    FROM profiles
    WHERE created_at >= v_start_date
    GROUP BY 1
  ),
  org_counts AS (
    SELECT date_trunc('week', o.created_at)::date AS week_start,
           COUNT(*) AS cnt
    FROM organizations o
    WHERE o.created_at >= v_start_date AND o.is_platform_admin != true
    GROUP BY 1
  ),
  lca_counts AS (
    SELECT date_trunc('week', created_at)::date AS week_start,
           COUNT(*) AS cnt
    FROM product_carbon_footprints
    WHERE created_at >= v_start_date
    GROUP BY 1
  ),
  product_counts AS (
    SELECT date_trunc('week', created_at)::date AS week_start,
           COUNT(*) AS cnt
    FROM products
    WHERE created_at >= v_start_date
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'trends', COALESCE((
      SELECT jsonb_agg(row_data ORDER BY w.week_start)
      FROM weeks w
      LEFT JOIN user_counts u ON u.week_start = w.week_start
      LEFT JOIN org_counts o ON o.week_start = w.week_start
      LEFT JOIN lca_counts l ON l.week_start = w.week_start
      LEFT JOIN product_counts p ON p.week_start = w.week_start,
      LATERAL (
        SELECT jsonb_build_object(
          'week', w.week_start,
          'users', COALESCE(u.cnt, 0),
          'organizations', COALESCE(o.cnt, 0),
          'lcas', COALESCE(l.cnt, 0),
          'products', COALESCE(p.cnt, 0)
        ) AS row_data
      ) sub
    ), '[]'::jsonb),
    'period_days', p_days
  ) INTO result;

  RETURN result;
END;
$$;

ALTER FUNCTION public.get_platform_growth_trends(INTEGER) OWNER TO postgres;

-- ============================================================================
-- 5. Fix get_onboarding_analytics() — is_platform_admin filter
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_onboarding_analytics()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  v_total_orgs INTEGER;
  v_with_onboarding INTEGER;
  v_completed INTEGER;
  v_dismissed INTEGER;
  v_in_progress INTEGER;
  v_trial_count INTEGER;
  v_paid_count INTEGER;
BEGIN
  IF NOT is_alkatera_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  -- Total non-platform-admin orgs
  SELECT COUNT(*) INTO v_total_orgs
  FROM organizations WHERE is_platform_admin != true;

  -- Orgs with onboarding records
  SELECT COUNT(*) INTO v_with_onboarding
  FROM onboarding_state;

  -- Completed
  SELECT COUNT(*) INTO v_completed
  FROM onboarding_state
  WHERE (state->>'completed')::boolean = true;

  -- Dismissed (not completed)
  SELECT COUNT(*) INTO v_dismissed
  FROM onboarding_state
  WHERE (state->>'dismissed')::boolean = true
    AND ((state->>'completed')::boolean IS NULL OR (state->>'completed')::boolean = false);

  -- In progress
  v_in_progress := GREATEST(v_with_onboarding - v_completed - v_dismissed, 0);

  -- Trial vs paid conversion
  SELECT COUNT(*) INTO v_trial_count
  FROM organizations
  WHERE subscription_status = 'trial' AND is_platform_admin != true;

  SELECT COUNT(*) INTO v_paid_count
  FROM organizations
  WHERE subscription_status = 'active'
    AND stripe_subscription_id IS NOT NULL
    AND is_platform_admin != true;

  SELECT jsonb_build_object(
    'total_orgs', v_total_orgs,
    'with_onboarding', v_with_onboarding,
    'completed', v_completed,
    'dismissed', v_dismissed,
    'in_progress', v_in_progress,
    'completion_rate', CASE WHEN v_with_onboarding > 0
      THEN ROUND(v_completed::numeric / v_with_onboarding * 100, 1)
      ELSE 0 END,
    'phases', jsonb_build_object(
      'welcome', (SELECT COUNT(*) FROM onboarding_state
        WHERE state->'completedSteps' ? 'welcome-screen'),
      'quick_wins', (SELECT COUNT(*) FROM onboarding_state
        WHERE state->'completedSteps' ? 'roadmap'),
      'core_setup', (SELECT COUNT(*) FROM onboarding_state
        WHERE state->'completedSteps' ? 'facilities-setup'),
      'first_insights', (SELECT COUNT(*) FROM onboarding_state
        WHERE state->'completedSteps' ? 'foundation-complete'),
      'power_features', (SELECT COUNT(*) FROM onboarding_state
        WHERE state->'completedSteps' ? 'feature-showcase')
    ),
    'conversion', jsonb_build_object(
      'trial_count', v_trial_count,
      'paid_count', v_paid_count,
      'conversion_rate', CASE WHEN (v_trial_count + v_paid_count) > 0
        THEN ROUND(v_paid_count::numeric / (v_trial_count + v_paid_count) * 100, 1)
        ELSE 0 END
    ),
    'avg_completion_days', (
      SELECT ROUND(AVG(
        EXTRACT(EPOCH FROM (
          (state->>'completedAt')::timestamptz - (state->>'startedAt')::timestamptz
        )) / 86400
      )::numeric, 1)
      FROM onboarding_state
      WHERE (state->>'completed')::boolean = true
        AND state->>'completedAt' IS NOT NULL
        AND state->>'startedAt' IS NOT NULL
    )
  ) INTO result;

  RETURN result;
END;
$$;

ALTER FUNCTION public.get_onboarding_analytics() OWNER TO postgres;

-- ============================================================================
-- 6. Fix get_feature_adoption() — is_platform_admin filter
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_feature_adoption()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  total_orgs INTEGER;
BEGIN
  IF NOT is_alkatera_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT COUNT(*) INTO total_orgs FROM organizations WHERE is_platform_admin != true;

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

ALTER FUNCTION public.get_feature_adoption() OWNER TO postgres;
