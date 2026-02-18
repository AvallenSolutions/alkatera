-- Fix facilities RLS policies to allow all organization members and advisors
-- to create, update, and delete facilities.
--
-- Previously, INSERT/UPDATE/DELETE were restricted to users with 'owner' or
-- 'admin' roles in the roles table.  This caused "new row violates row-level
-- security policy" errors for:
--   (a) regular members (role = 'member')
--   (b) advisors (who have advisor_organization_access but no organization_members row)
--
-- The fix uses the existing user_has_organization_access() function which
-- checks both organization_members and advisor_organization_access.

-- ── INSERT ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Organization admins can create facilities" ON "public"."facilities";

CREATE POLICY "Organization members can create facilities"
  ON "public"."facilities"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (
    "public"."user_has_organization_access"("organization_id")
  );

-- ── UPDATE ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Organization admins can update facilities" ON "public"."facilities";

CREATE POLICY "Organization members can update facilities"
  ON "public"."facilities"
  FOR UPDATE
  TO "authenticated"
  USING (
    "public"."user_has_organization_access"("organization_id")
  )
  WITH CHECK (
    "public"."user_has_organization_access"("organization_id")
  );

-- ── DELETE ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Organization admins can delete facilities" ON "public"."facilities";

CREATE POLICY "Organization members can delete facilities"
  ON "public"."facilities"
  FOR DELETE
  TO "authenticated"
  USING (
    "public"."user_has_organization_access"("organization_id")
  );
