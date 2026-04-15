-- Fix generated_reports RLS policies to allow advisor access
--
-- The original policies only checked organization_members, blocking advisors
-- (who have advisor_organization_access but no organization_members row) from
-- creating, viewing, updating, or deleting reports.
--
-- This is the same fix applied to facilities in 20260308000000_fix_facilities_rls_policies.sql.
-- The user_has_organization_access() function checks both organization_members
-- AND advisor_organization_access.

-- ── INSERT ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can create reports for their organization" ON "public"."generated_reports";

CREATE POLICY "Users can create reports for their organization"
  ON "public"."generated_reports"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (
    "public"."user_has_organization_access"("organization_id")
    AND "created_by" = "auth"."uid"()
  );

-- ── SELECT ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view their organization's reports" ON "public"."generated_reports";

CREATE POLICY "Users can view their organization's reports"
  ON "public"."generated_reports"
  FOR SELECT
  TO "authenticated"
  USING (
    "public"."user_has_organization_access"("organization_id")
  );

-- ── UPDATE ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can update their organization's reports" ON "public"."generated_reports";

CREATE POLICY "Users can update their organization's reports"
  ON "public"."generated_reports"
  FOR UPDATE
  TO "authenticated"
  USING (
    "public"."user_has_organization_access"("organization_id")
  )
  WITH CHECK (
    "public"."user_has_organization_access"("organization_id")
  );

-- ── DELETE ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can delete their organization's reports" ON "public"."generated_reports";

CREATE POLICY "Users can delete their organization's reports"
  ON "public"."generated_reports"
  FOR DELETE
  TO "authenticated"
  USING (
    "public"."user_has_organization_access"("organization_id")
  );

NOTIFY pgrst, 'reload schema';
