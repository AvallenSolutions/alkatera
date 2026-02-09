-- Update get_platform_statistics to include subscription breakdown
CREATE OR REPLACE FUNCTION "public"."get_platform_statistics"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
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
      'total', (SELECT COUNT(*) FROM public.organizations WHERE slug != 'alkatera'),
      'new_this_month', (SELECT COUNT(*) FROM public.organizations
        WHERE created_at >= date_trunc('month', CURRENT_DATE) AND slug != 'alkatera'),
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
          WHERE subscription_tier = 'seed' AND slug != 'alkatera'),
        'blossom', (SELECT COUNT(*) FROM public.organizations
          WHERE subscription_tier = 'blossom' AND slug != 'alkatera'),
        'canopy', (SELECT COUNT(*) FROM public.organizations
          WHERE subscription_tier = 'canopy' AND slug != 'alkatera'),
        'none', (SELECT COUNT(*) FROM public.organizations
          WHERE subscription_tier IS NULL AND slug != 'alkatera')
      ),
      'by_status', jsonb_build_object(
        'active', (SELECT COUNT(*) FROM public.organizations
          WHERE subscription_status = 'active' AND slug != 'alkatera'),
        'trial', (SELECT COUNT(*) FROM public.organizations
          WHERE subscription_status = 'trial' AND slug != 'alkatera'),
        'pending', (SELECT COUNT(*) FROM public.organizations
          WHERE subscription_status = 'pending' AND slug != 'alkatera'),
        'suspended', (SELECT COUNT(*) FROM public.organizations
          WHERE subscription_status = 'suspended' AND slug != 'alkatera'),
        'cancelled', (SELECT COUNT(*) FROM public.organizations
          WHERE subscription_status = 'cancelled' AND slug != 'alkatera')
      ),
      'with_stripe', (SELECT COUNT(*) FROM public.organizations
        WHERE stripe_customer_id IS NOT NULL AND slug != 'alkatera'),
      'recent_signups_7d', (SELECT COUNT(*) FROM public.organizations
        WHERE created_at >= NOW() - INTERVAL '7 days' AND slug != 'alkatera')
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

-- Update get_platform_organizations to include subscription data per org
CREATE OR REPLACE FUNCTION "public"."get_platform_organizations"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
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
        'facility_count', (SELECT COUNT(*) FROM facilities WHERE organization_id = o.id),
        'subscription_tier', o.subscription_tier,
        'subscription_status', o.subscription_status,
        'subscription_started_at', o.subscription_started_at
      )
    )
    FROM public.organizations o
    WHERE o.slug != 'alkatera'
    ORDER BY o.created_at DESC
  );
END;
$$;
