/*
  # Create Platform Analytics RPC Functions

  ## Overview
  This migration creates RPC functions for the Alkatera admin platform dashboard.
  All functions return aggregated/anonymized data only - no private organization
  materiality data is exposed.

  ## 1. Functions Created
    - `get_platform_statistics()` - Overall platform counts and metrics
    - `get_organization_growth(days)` - New organisations over time
    - `get_feature_adoption()` - Feature usage across platform
    - `get_user_activity_trend(days)` - User activity trends
    - `get_approval_statistics()` - Platform-wide approval metrics

  ## 2. Security
    - All functions check for Alkatera admin status
    - Return empty/error for non-admins
    - No private data exposed
*/

-- ============================================================================
-- STEP 1: Get platform statistics
-- ============================================================================

CREATE OR REPLACE FUNCTION get_platform_statistics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Only Alkatera admins can access
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
      'total', (SELECT COUNT(*) FROM public.organizations),
      'new_this_month', (SELECT COUNT(*) FROM public.organizations 
        WHERE created_at >= date_trunc('month', CURRENT_DATE)),
      'with_products', (SELECT COUNT(DISTINCT organization_id) FROM public.products),
      'with_facilities', (SELECT COUNT(DISTINCT organization_id) FROM public.facilities)
    ),
    'content', jsonb_build_object(
      'total_products', (SELECT COUNT(*) FROM public.products),
      'total_facilities', (SELECT COUNT(*) FROM public.facilities),
      'total_suppliers', (SELECT COUNT(*) FROM public.suppliers),
      'total_lcas', (SELECT COUNT(*) FROM public.product_lcas)
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

COMMENT ON FUNCTION get_platform_statistics() IS 
  'Get comprehensive platform statistics for Alkatera admin dashboard';

-- ============================================================================
-- STEP 2: Get organization growth trend
-- ============================================================================

CREATE OR REPLACE FUNCTION get_organization_growth(p_days INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT is_alkatera_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;
  
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', d.date,
      'new_organizations', COALESCE(o.count, 0),
      'cumulative', SUM(COALESCE(o.count, 0)) OVER (ORDER BY d.date)
    )
  )
  INTO result
  FROM (
    SELECT generate_series(
      CURRENT_DATE - (p_days || ' days')::interval,
      CURRENT_DATE,
      '1 day'::interval
    )::date as date
  ) d
  LEFT JOIN (
    SELECT created_at::date as date, COUNT(*) as count
    FROM public.organizations
    WHERE created_at >= CURRENT_DATE - (p_days || ' days')::interval
    GROUP BY created_at::date
  ) o ON d.date = o.date
  ORDER BY d.date;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION get_organization_growth(INTEGER) IS 
  'Get daily organisation growth trend for specified number of days';

-- ============================================================================
-- STEP 3: Get feature adoption statistics
-- ============================================================================

CREATE OR REPLACE FUNCTION get_feature_adoption()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result JSONB;
  total_orgs INTEGER;
BEGIN
  IF NOT is_alkatera_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;
  
  SELECT COUNT(*) INTO total_orgs FROM public.organizations;
  
  SELECT jsonb_build_object(
    'products_module', jsonb_build_object(
      'organizations_using', (SELECT COUNT(DISTINCT organization_id) FROM public.products),
      'adoption_rate', ROUND((SELECT COUNT(DISTINCT organization_id)::numeric FROM public.products) / GREATEST(total_orgs, 1) * 100, 1)
    ),
    'facilities_module', jsonb_build_object(
      'organizations_using', (SELECT COUNT(DISTINCT organization_id) FROM public.facilities),
      'adoption_rate', ROUND((SELECT COUNT(DISTINCT organization_id)::numeric FROM public.facilities) / GREATEST(total_orgs, 1) * 100, 1)
    ),
    'suppliers_module', jsonb_build_object(
      'organizations_using', (SELECT COUNT(DISTINCT organization_id) FROM public.suppliers),
      'adoption_rate', ROUND((SELECT COUNT(DISTINCT organization_id)::numeric FROM public.suppliers) / GREATEST(total_orgs, 1) * 100, 1)
    ),
    'lca_module', jsonb_build_object(
      'organizations_using', (SELECT COUNT(DISTINCT p.organization_id) FROM public.product_lcas pl JOIN public.products p ON pl.product_id = p.id),
      'adoption_rate', ROUND((SELECT COUNT(DISTINCT p.organization_id)::numeric FROM public.product_lcas pl JOIN public.products p ON pl.product_id = p.id) / GREATEST(total_orgs, 1) * 100, 1)
    ),
    'total_organizations', total_orgs
  ) INTO result;
  
  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_feature_adoption() IS 
  'Get feature adoption rates across the platform';

-- ============================================================================
-- STEP 4: Get user activity trend
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_activity_trend(p_days INTEGER DEFAULT 14)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT is_alkatera_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;
  
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', d.date,
      'activities', COALESCE(a.count, 0)
    )
  )
  INTO result
  FROM (
    SELECT generate_series(
      CURRENT_DATE - (p_days || ' days')::interval,
      CURRENT_DATE,
      '1 day'::interval
    )::date as date
  ) d
  LEFT JOIN (
    SELECT activity_timestamp::date as date, COUNT(*) as count
    FROM public.platform_activity_log
    WHERE activity_timestamp >= CURRENT_DATE - (p_days || ' days')::interval
    GROUP BY activity_timestamp::date
  ) a ON d.date = a.date
  ORDER BY d.date;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION get_user_activity_trend(INTEGER) IS 
  'Get daily platform activity trend for specified number of days';

-- ============================================================================
-- STEP 5: Get approval statistics
-- ============================================================================

CREATE OR REPLACE FUNCTION get_approval_statistics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT is_alkatera_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;
  
  SELECT jsonb_build_object(
    'activity_data', jsonb_build_object(
      'pending', (SELECT COUNT(*) FROM public.pending_activity_data WHERE approval_status = 'pending'),
      'approved', (SELECT COUNT(*) FROM public.pending_activity_data WHERE approval_status = 'approved'),
      'rejected', (SELECT COUNT(*) FROM public.pending_activity_data WHERE approval_status = 'rejected')
    ),
    'facilities', jsonb_build_object(
      'pending', (SELECT COUNT(*) FROM public.pending_facilities WHERE approval_status = 'pending'),
      'approved', (SELECT COUNT(*) FROM public.pending_facilities WHERE approval_status = 'approved'),
      'rejected', (SELECT COUNT(*) FROM public.pending_facilities WHERE approval_status = 'rejected')
    ),
    'products', jsonb_build_object(
      'pending', (SELECT COUNT(*) FROM public.pending_products WHERE approval_status = 'pending'),
      'approved', (SELECT COUNT(*) FROM public.pending_products WHERE approval_status = 'approved'),
      'rejected', (SELECT COUNT(*) FROM public.pending_products WHERE approval_status = 'rejected')
    ),
    'suppliers', jsonb_build_object(
      'pending', (SELECT COUNT(*) FROM public.pending_suppliers WHERE approval_status = 'pending'),
      'approved', (SELECT COUNT(*) FROM public.pending_suppliers WHERE approval_status = 'approved'),
      'rejected', (SELECT COUNT(*) FROM public.pending_suppliers WHERE approval_status = 'rejected')
    ),
    'totals', jsonb_build_object(
      'total_pending', (
        (SELECT COUNT(*) FROM public.pending_activity_data WHERE approval_status = 'pending') +
        (SELECT COUNT(*) FROM public.pending_facilities WHERE approval_status = 'pending') +
        (SELECT COUNT(*) FROM public.pending_products WHERE approval_status = 'pending') +
        (SELECT COUNT(*) FROM public.pending_suppliers WHERE approval_status = 'pending')
      ),
      'total_approved', (
        (SELECT COUNT(*) FROM public.pending_activity_data WHERE approval_status = 'approved') +
        (SELECT COUNT(*) FROM public.pending_facilities WHERE approval_status = 'approved') +
        (SELECT COUNT(*) FROM public.pending_products WHERE approval_status = 'approved') +
        (SELECT COUNT(*) FROM public.pending_suppliers WHERE approval_status = 'approved')
      ),
      'total_rejected', (
        (SELECT COUNT(*) FROM public.pending_activity_data WHERE approval_status = 'rejected') +
        (SELECT COUNT(*) FROM public.pending_facilities WHERE approval_status = 'rejected') +
        (SELECT COUNT(*) FROM public.pending_products WHERE approval_status = 'rejected') +
        (SELECT COUNT(*) FROM public.pending_suppliers WHERE approval_status = 'rejected')
      )
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_approval_statistics() IS 
  'Get platform-wide approval workflow statistics';

-- ============================================================================
-- STEP 6: Get organisation list for platform admin (no private data)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_platform_organizations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  IF NOT is_alkatera_admin() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;
  
  RETURN (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'name', o.name,
        'slug', o.slug,
        'created_at', o.created_at,
        'member_count', (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id),
        'product_count', (SELECT COUNT(*) FROM products WHERE organization_id = o.id),
        'facility_count', (SELECT COUNT(*) FROM facilities WHERE organization_id = o.id)
      )
    )
    FROM public.organizations o
    WHERE o.slug != 'alkatera'
    ORDER BY o.created_at DESC
  );
END;
$$;

COMMENT ON FUNCTION get_platform_organizations() IS 
  'Get list of organisations for platform admin - no private materiality data exposed';
