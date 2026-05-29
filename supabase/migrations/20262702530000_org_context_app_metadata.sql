-- Move tenant context to server-only app_metadata (CRIT-2 defence-in-depth)
--
-- get_current_organization_id() previously read current_organization_id from
-- user_metadata, which is CLIENT-WRITABLE. The P0 fix made it safe by
-- validating membership, but the source of truth is still better held in
-- app_metadata, which only the service role can set.
--
-- Transition-safe: read app_metadata FIRST, fall back to user_metadata. Both
-- are still validated by user_has_organization_access(), so neither can be
-- abused. New org switches write app_metadata (via /api/organizations/switch);
-- the backfill below seeds app_metadata for existing users so the coalesce
-- prefers it immediately. user_metadata.current_organization_id remains only as
-- a validated legacy fallback.

CREATE OR REPLACE FUNCTION "public"."get_current_organization_id"()
RETURNS "uuid"
LANGUAGE "plpgsql" STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  claimed uuid;
BEGIN
  claims := current_setting('request.jwt.claims', true)::jsonb;
  claimed := nullif(
    coalesce(
      claims -> 'app_metadata'  ->> 'current_organization_id',
      claims -> 'user_metadata' ->> 'current_organization_id'
    ),
    ''
  )::uuid;

  IF claimed IS NULL THEN
    RETURN NULL;
  END IF;

  -- Only trust the claimed organisation if the caller actually has access.
  IF public.user_has_organization_access(claimed) THEN
    RETURN claimed;
  END IF;

  RETURN NULL;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Backfill app_metadata from the existing user_metadata value so the coalesce
-- prefers the (now server-owned) app_metadata going forward.
UPDATE auth.users
SET raw_app_meta_data =
      coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('current_organization_id', raw_user_meta_data ->> 'current_organization_id')
WHERE coalesce(raw_user_meta_data ->> 'current_organization_id', '') <> ''
  AND (raw_app_meta_data ->> 'current_organization_id') IS DISTINCT FROM (raw_user_meta_data ->> 'current_organization_id');
