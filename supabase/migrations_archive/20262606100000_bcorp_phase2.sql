-- B Corp 2026 Phase 2: Platform Data Integration
--
-- Auto-evidence suggestions sourced from existing alkatera modules.
-- The verification_status 'needs_review' value was already permitted by the
-- Phase 1 check constraint, so no constraint change is needed here.
--
-- Idempotent and forward-only. No down section.

CREATE TABLE IF NOT EXISTS "public"."certification_auto_evidence" (
  "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
  "certification_id" "uuid" REFERENCES "public"."organization_certifications"("id") ON DELETE CASCADE,
  "organization_id" "uuid" NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
  "requirement_id" "uuid" NOT NULL REFERENCES "public"."certification_framework_requirements"("id") ON DELETE CASCADE,
  "source_module" "text",
  "source_record_id" "uuid",
  "source_label" "text",
  "source_summary" "text",
  "completeness_flag" "text",
  "completeness_note" "text",
  "status" "text" DEFAULT 'suggested' CHECK ("status" IN ('suggested','accepted','dismissed')),
  "created_at" timestamp with time zone DEFAULT "now"(),
  "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE INDEX IF NOT EXISTS "idx_certification_auto_evidence_org_req"
  ON "public"."certification_auto_evidence" ("organization_id", "requirement_id");

-- A record key for upsert/dedupe. source_record_id is text-cast so the
-- 'aggregate' sentinel used by some module queries is allowed.
CREATE UNIQUE INDEX IF NOT EXISTS "certification_auto_evidence_unique_key"
  ON "public"."certification_auto_evidence" (
    "organization_id", "requirement_id", "source_module",
    COALESCE("source_record_id"::text, '')
  );

ALTER TABLE "public"."certification_auto_evidence" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'certification_auto_evidence'
      AND policyname = 'Org members can view auto evidence'
  ) THEN
    CREATE POLICY "Org members can view auto evidence"
      ON "public"."certification_auto_evidence" FOR SELECT TO "authenticated"
      USING ("public"."user_has_organization_access"("organization_id"));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'certification_auto_evidence'
      AND policyname = 'Org members can manage auto evidence'
  ) THEN
    CREATE POLICY "Org members can manage auto evidence"
      ON "public"."certification_auto_evidence" FOR ALL TO "authenticated"
      USING ("public"."user_has_organization_access"("organization_id"))
      WITH CHECK ("public"."user_has_organization_access"("organization_id"));
  END IF;
END $$;
