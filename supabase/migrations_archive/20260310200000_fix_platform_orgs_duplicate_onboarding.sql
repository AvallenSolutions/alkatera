-- Fix get_platform_organizations() crash when org has multiple onboarding_state rows
--
-- Root cause: onboarding_state can have one row per user per org. When an org
-- has multiple users (e.g. after team invites), the scalar subqueries
--   SELECT (os.state->>'completed')::boolean FROM onboarding_state WHERE org_id = ...
-- return multiple rows, causing:
--   "more than one row returned by a subquery used as an expression"
--
-- Fix: Add LIMIT 1 to the onboarding subqueries, preferring the most recently
-- updated row (which is most likely the org owner's state).
--
-- Also add a unique constraint on (organization_id, user_id) to prevent
-- future duplicates for the same user.

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
          FROM onboarding_state os
          WHERE os.organization_id = o.id
          ORDER BY os.created_at DESC
          LIMIT 1
        ), false),
        'onboarding_current_step', (
          SELECT os.state->>'currentStep'
          FROM onboarding_state os
          WHERE os.organization_id = o.id
          ORDER BY os.created_at DESC
          LIMIT 1
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

-- Add unique constraint to prevent duplicate onboarding_state rows per user/org
-- First, clean up existing duplicates (keep the most recent per user/org pair)
DELETE FROM onboarding_state
WHERE id NOT IN (
  SELECT DISTINCT ON (organization_id, user_id) id
  FROM onboarding_state
  ORDER BY organization_id, user_id, created_at DESC
);

-- Add the unique constraint (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_state_org_user_unique'
  ) THEN
    ALTER TABLE onboarding_state
      ADD CONSTRAINT onboarding_state_org_user_unique
      UNIQUE (organization_id, user_id);
  END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
