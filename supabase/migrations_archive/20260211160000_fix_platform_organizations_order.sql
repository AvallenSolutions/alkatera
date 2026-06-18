-- ============================================================================
-- Fix get_platform_organizations() grouping error (PostgreSQL error 42803)
-- ============================================================================
-- Problem: ORDER BY o.created_at DESC is outside the jsonb_agg() call,
-- causing a PostgreSQL grouping error because the outer SELECT only returns
-- one aggregated row and cannot ORDER BY a non-aggregated column.
--
-- Fix: Move the ORDER BY inside the jsonb_agg() using a subquery.
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."get_platform_organizations"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
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
      FROM public.organizations o
      WHERE o.slug != 'alkatera'
      ORDER BY o.created_at DESC
    ) sub
  );
END;
$$;
