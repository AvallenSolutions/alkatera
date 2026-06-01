-- #5: single auth-bootstrap RPC.
--
-- Collapses the client-side boot waterfall (organization_members + roles join →
-- organizations details → get_organization_usage → is_alkatera_admin →
-- get_pending_approval_count) into ONE round-trip. The client tries this and
-- FALLS BACK to its existing per-query path on any error, so a bug here can
-- never lock anyone out — it is purely additive (nothing depends on it until
-- the client ships, and dropping the function instantly reverts to legacy).
--
-- Design: COMPOSE the existing hardened SECURITY DEFINER functions rather than
-- re-implement them, so behaviour can never drift:
--   * get_organization_usage(org)      → subscription/usage/features (verbatim)
--   * is_alkatera_admin()              → global admin flag (verbatim)
--   * get_pending_approval_count()     → pending badge (verbatim — same JWT-claim
--                                        basis the Sidebar uses today, so zero
--                                        behavioural change)
-- auth.uid() and get_current_organization_id() (which read request.jwt.claims)
-- are preserved across nested SECURITY DEFINER calls.
--
-- CRITICAL: this function is VOLATILE, not STABLE. get_organization_usage runs a
-- self-healing UPDATE on organizations.current_product_count/current_lca_count;
-- a STABLE wrapper would raise "UPDATE is not allowed in a non-volatile
-- function" — but ONLY when counters have drifted, i.e. an invisible,
-- production-only outage. Keep it VOLATILE.

CREATE OR REPLACE FUNCTION public.get_user_bootstrap(p_current_org_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_has_memberships boolean;
  v_supplier RECORD;
  v_org_ids uuid[];
  v_resolved_org uuid;
  v_user_role text;
  v_orgs jsonb;
  v_subscription jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;

  -- Membership wins over supplier (mirrors organizationContext.tsx precedence).
  SELECT EXISTS (
    SELECT 1 FROM organization_members WHERE user_id = v_uid
  ) INTO v_has_memberships;

  -- ── Supplier path (only when NOT an org member) ────────────────────────
  IF NOT v_has_memberships THEN
    SELECT s.id AS supplier_id,
           o.id AS organization_id,
           o.name AS organization_name,
           o.slug AS organization_slug
    INTO v_supplier
    FROM suppliers s
    LEFT JOIN organizations o ON o.id = s.organization_id
    WHERE s.user_id = v_uid
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'kind', 'supplier',
        'user_role', 'supplier',
        'organizations', CASE
          WHEN v_supplier.organization_id IS NOT NULL THEN
            jsonb_build_array(jsonb_build_object(
              'id', v_supplier.organization_id,
              'name', v_supplier.organization_name,
              'slug', v_supplier.organization_slug,
              'created_at', ''
            ))
          ELSE '[]'::jsonb
        END,
        'current_organization_id', v_supplier.organization_id,
        'subscription', NULL,
        'is_alkatera_admin', false,
        'pending_approval_count', 0
      );
    END IF;

    -- No supplier row and no memberships → let the client fall back to its
    -- legacy path (which handles the is_supplier-metadata edge case and the
    -- create-organization redirect). We still surface the admin flag.
    RETURN jsonb_build_object(
      'kind', 'none',
      'user_role', NULL,
      'organizations', '[]'::jsonb,
      'current_organization_id', NULL,
      'subscription', NULL,
      'is_alkatera_admin', public.is_alkatera_admin(),
      'pending_approval_count', 0
    );
  END IF;

  -- ── Member / advisor path ──────────────────────────────────────────────
  -- Union of member orgs + active advisor orgs.
  SELECT array_agg(DISTINCT oid) INTO v_org_ids
  FROM (
    SELECT organization_id AS oid FROM organization_members WHERE user_id = v_uid
    UNION
    SELECT organization_id AS oid FROM advisor_organization_access
      WHERE advisor_user_id = v_uid AND is_active = true
  ) t;

  IF v_org_ids IS NULL OR array_length(v_org_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'kind', 'member',
      'user_role', NULL,
      'organizations', '[]'::jsonb,
      'current_organization_id', NULL,
      'subscription', NULL,
      'is_alkatera_admin', public.is_alkatera_admin(),
      'pending_approval_count', 0
    );
  END IF;

  -- Resolve current org: trust the caller's claim only if it's actually one of
  -- the user's orgs; otherwise default to the first (matches client fallback).
  IF p_current_org_id IS NOT NULL AND p_current_org_id = ANY (v_org_ids) THEN
    v_resolved_org := p_current_org_id;
  ELSE
    v_resolved_org := v_org_ids[1];
  END IF;

  -- All visible orgs as full rows (superset of the client Organization
  -- interface — identical to today's organizations.select('*')).
  SELECT jsonb_agg(to_jsonb(o)) INTO v_orgs
  FROM organizations o
  WHERE o.id = ANY (v_org_ids);

  -- Role for the resolved org: membership role → advisor → null.
  SELECT r.name INTO v_user_role
  FROM organization_members om
  JOIN roles r ON r.id = om.role_id
  WHERE om.user_id = v_uid AND om.organization_id = v_resolved_org
  LIMIT 1;

  IF v_user_role IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM advisor_organization_access
      WHERE advisor_user_id = v_uid
        AND organization_id = v_resolved_org
        AND is_active = true
    ) THEN
      v_user_role := 'advisor';
    END IF;
  END IF;

  -- Subscription/usage for the resolved org (reused verbatim).
  v_subscription := public.get_organization_usage(v_resolved_org);

  RETURN jsonb_build_object(
    'kind', 'member',
    'user_role', v_user_role,
    'organizations', COALESCE(v_orgs, '[]'::jsonb),
    'current_organization_id', v_resolved_org,
    'subscription', v_subscription,
    'is_alkatera_admin', public.is_alkatera_admin(),
    -- get_pending_approval_count() reads the JWT-claim org via
    -- get_current_organization_id() — same basis the Sidebar uses today, so
    -- this is behaviourally identical to the current separate call.
    'pending_approval_count', public.get_pending_approval_count()
  );

EXCEPTION
  -- Any failure returns a soft error so the CLIENT FALLS BACK to its legacy
  -- per-query path instead of seeing a thrown auth error. Login is never broken
  -- by this function.
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', 'bootstrap_failed', 'detail', SQLERRM);
END;
$$;

ALTER FUNCTION public.get_user_bootstrap(uuid) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.get_user_bootstrap(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_user_bootstrap(uuid) IS
  'Single-round-trip auth bootstrap: returns {kind, user_role, organizations, current_organization_id, subscription, is_alkatera_admin, pending_approval_count} by composing get_organization_usage + is_alkatera_admin + get_pending_approval_count. VOLATILE (get_organization_usage self-heals via UPDATE). Client falls back to per-query path on any error.';

NOTIFY pgrst, 'reload schema';
