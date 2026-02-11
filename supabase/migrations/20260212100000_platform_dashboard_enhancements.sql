-- ============================================================================
-- Platform Dashboard Enhancements
-- ============================================================================
-- Adds 4 new RPC functions and enhances get_platform_organizations() to
-- power the improved admin platform dashboard with growth trends,
-- onboarding analytics, AI/data quality insights, and actionable alerts.
--
-- All functions use SECURITY DEFINER + SET search_path = public.
-- ============================================================================

-- ============================================================================
-- 1. get_platform_growth_trends(p_days) — Weekly growth time-series
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
    SELECT date_trunc('week', created_at)::date AS week_start,
           COUNT(*) AS cnt
    FROM organizations
    WHERE created_at >= v_start_date AND slug != 'alkatera'
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

COMMENT ON FUNCTION public.get_platform_growth_trends(INTEGER)
IS 'Returns weekly growth trends for users, organizations, LCAs, and products over the specified number of days.';

-- ============================================================================
-- 2. get_onboarding_analytics() — Onboarding funnel and conversion metrics
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

  -- Total non-alkatera orgs
  SELECT COUNT(*) INTO v_total_orgs
  FROM organizations WHERE slug != 'alkatera';

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
  WHERE subscription_status = 'trial' AND slug != 'alkatera';

  SELECT COUNT(*) INTO v_paid_count
  FROM organizations
  WHERE subscription_status = 'active'
    AND stripe_subscription_id IS NOT NULL
    AND slug != 'alkatera';

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

COMMENT ON FUNCTION public.get_onboarding_analytics()
IS 'Returns onboarding funnel analytics: completion rates, phase drop-off, trial-to-paid conversion, and average completion time.';

-- ============================================================================
-- 3. get_platform_insights() — AI usage, data quality, supplier engagement
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_platform_insights()
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
    'ai_usage', jsonb_build_object(
      'total_conversations', (SELECT COUNT(*) FROM gaia_conversations),
      'active_this_week', (SELECT COUNT(*) FROM gaia_conversations
        WHERE last_message_at >= NOW() - INTERVAL '7 days'
          AND is_archived = false),
      'avg_messages_per_conversation', COALESCE((
        SELECT ROUND(AVG(message_count)::numeric, 1)
        FROM gaia_conversations
        WHERE message_count > 0
      ), 0),
      'total_messages', (SELECT COALESCE(SUM(message_count), 0) FROM gaia_conversations),
      'organizations_using', (SELECT COUNT(DISTINCT organization_id) FROM gaia_conversations)
    ),
    'data_quality', jsonb_build_object(
      'total_documents', (SELECT COUNT(*) FROM data_provenance_trail),
      'verified', (SELECT COUNT(*) FROM data_provenance_trail
        WHERE verification_status = 'verified'),
      'unverified', (SELECT COUNT(*) FROM data_provenance_trail
        WHERE verification_status = 'unverified'),
      'rejected', (SELECT COUNT(*) FROM data_provenance_trail
        WHERE verification_status = 'rejected'),
      'verification_rate', (
        SELECT CASE WHEN COUNT(*) > 0
          THEN ROUND(
            COUNT(*) FILTER (WHERE verification_status = 'verified')::numeric
            / COUNT(*) * 100, 1
          )
          ELSE 0 END
        FROM data_provenance_trail
      )
    ),
    'supplier_engagement', jsonb_build_object(
      'total_org_suppliers', (SELECT COUNT(*) FROM suppliers),
      'organizations_with_suppliers', (SELECT COUNT(DISTINCT organization_id) FROM suppliers),
      'platform_suppliers_total', (SELECT COUNT(*) FROM platform_suppliers),
      'platform_suppliers_verified', (SELECT COUNT(*) FROM platform_suppliers WHERE is_verified = true)
    )
  ) INTO result;

  RETURN result;
END;
$$;

ALTER FUNCTION public.get_platform_insights() OWNER TO postgres;

COMMENT ON FUNCTION public.get_platform_insights()
IS 'Returns platform insights: Gaia AI usage metrics, data quality/provenance statistics, and supplier engagement summary.';

-- ============================================================================
-- 4. get_platform_alerts() — Actionable alerts for platform admins
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
        AND o.slug != 'alkatera'
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
      WHERE o.slug != 'alkatera'
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
        SELECT MAX(activity_timestamp) AS last_activity
        FROM platform_activity_log pal
        WHERE pal.organization_id = o.id
      ) sub ON true
      WHERE o.slug != 'alkatera'
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

COMMENT ON FUNCTION public.get_platform_alerts()
IS 'Returns actionable alerts: expiring trials, orgs approaching usage limits, inactive orgs, and verification backlog.';

-- ============================================================================
-- 5. Enhanced get_platform_organizations() — Add new fields
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
        'last_activity_at', (
          SELECT MAX(pal.activity_timestamp)
          FROM platform_activity_log pal WHERE pal.organization_id = o.id
        )
      ) AS org_data
      FROM organizations o
      WHERE o.slug != 'alkatera'
      ORDER BY o.created_at DESC
    ) sub
  );
END;
$$;

ALTER FUNCTION public.get_platform_organizations() OWNER TO postgres;
