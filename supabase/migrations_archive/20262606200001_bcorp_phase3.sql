-- B Corp 2026 Phase 3: Audit & Submission Workflow
--
-- Pre-audit checklist + ECGT submission date on the cert; export/audit-stage
-- columns on audit packages; clarification request tracking.
--
-- Idempotent and forward-only. No down section.

ALTER TABLE "public"."organization_certifications"
  ADD COLUMN IF NOT EXISTS "pre_audit_checklist" "jsonb";
ALTER TABLE "public"."organization_certifications"
  ADD COLUMN IF NOT EXISTS "ecgt_submission_date" "date";

ALTER TABLE "public"."certification_audit_packages"
  ADD COLUMN IF NOT EXISTS "exported_at" timestamp with time zone;
ALTER TABLE "public"."certification_audit_packages"
  ADD COLUMN IF NOT EXISTS "export_url" "text";
ALTER TABLE "public"."certification_audit_packages"
  ADD COLUMN IF NOT EXISTS "audit_stage" "text";
ALTER TABLE "public"."certification_audit_packages"
  ADD COLUMN IF NOT EXISTS "audit_scheduled_date" "date";
ALTER TABLE "public"."certification_audit_packages"
  ADD COLUMN IF NOT EXISTS "auditor_name" "text";

CREATE TABLE IF NOT EXISTS "public"."certification_clarification_requests" (
  "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
  "certification_id" "uuid" REFERENCES "public"."organization_certifications"("id") ON DELETE CASCADE,
  "organization_id" "uuid" NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
  "audit_package_id" "uuid" REFERENCES "public"."certification_audit_packages"("id") ON DELETE SET NULL,
  "requirement_id" "uuid" REFERENCES "public"."certification_framework_requirements"("id") ON DELETE SET NULL,
  "description" "text" NOT NULL,
  "raised_by" "text",
  "raised_at" timestamp with time zone,
  "response" "text",
  "responded_at" timestamp with time zone,
  "status" "text" DEFAULT 'open' CHECK ("status" IN ('open','responded','resolved')),
  "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE INDEX IF NOT EXISTS "idx_clarification_requests_org"
  ON "public"."certification_clarification_requests" ("organization_id", "status");

ALTER TABLE "public"."certification_clarification_requests"
  ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'certification_clarification_requests'
      AND policyname = 'Org members can view clarification requests'
  ) THEN
    CREATE POLICY "Org members can view clarification requests"
      ON "public"."certification_clarification_requests"
      FOR SELECT TO "authenticated"
      USING ("public"."user_has_organization_access"("organization_id"));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'certification_clarification_requests'
      AND policyname = 'Org members can manage clarification requests'
  ) THEN
    CREATE POLICY "Org members can manage clarification requests"
      ON "public"."certification_clarification_requests"
      FOR ALL TO "authenticated"
      USING ("public"."user_has_organization_access"("organization_id"))
      WITH CHECK ("public"."user_has_organization_access"("organization_id"));
  END IF;
END $$;
