-- Harden get_current_organization_id() against forged tenant context
--
-- SECURITY FIX (CRIT-1, security review 2026-05-29)
--
-- get_current_organization_id() previously returned the organisation id
-- straight from request.jwt.claims -> user_metadata ->> current_organization_id.
-- user_metadata is CLIENT-WRITABLE (supabase.auth.updateUser is callable by
-- the user themselves), so any authenticated user could set their
-- current_organization_id to ANOTHER organisation's UUID. Every table whose
-- RLS policy is scoped solely by this function (activity_data,
-- calculated_emissions, ghg_emissions, kpis, activity_log, suppliers,
-- supplier_products, supplier_invitations, and others) would then expose that
-- organisation's rows for read AND write, directly from the browser using the
-- public anon key.
--
-- Fix: only honour the claimed organisation if the caller genuinely has
-- access to it (active member or active advisor), reusing the existing,
-- membership-verified user_has_organization_access(). This closes the bypass
-- everywhere the function is used, with no change to legitimate access:
-- a user's real current org still resolves normally, a forged/stale org now
-- resolves to NULL (so `organization_id = NULL` matches no rows).
--
-- SECURITY DEFINER + the called helper being SECURITY DEFINER means the
-- membership lookup bypasses RLS, so there is no policy recursion.
--
-- This is the root-cause containment for CRIT-1. Per-policy membership
-- scoping and moving current_organization_id into (server-only) app_metadata
-- remain as defence-in-depth follow-ups (see SECURITY_REVIEW.md P1/P2).

CREATE OR REPLACE FUNCTION "public"."get_current_organization_id"()
RETURNS "uuid"
LANGUAGE "plpgsql" STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed uuid;
BEGIN
  claimed := nullif(
    current_setting('request.jwt.claims', true)::jsonb
      -> 'user_metadata' ->> 'current_organization_id',
    ''
  )::uuid;

  IF claimed IS NULL THEN
    RETURN NULL;
  END IF;

  -- Only trust the claimed organisation if the caller actually has access to
  -- it. user_has_organization_access() checks organization_members and active
  -- advisor_organization_access against auth.uid().
  IF public.user_has_organization_access(claimed) THEN
    RETURN claimed;
  END IF;

  RETURN NULL;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;
