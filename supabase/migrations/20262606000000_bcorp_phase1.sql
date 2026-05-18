-- B Corp 2026 Phase 1: Core Completion
--
-- Closes the certification_evidence_links schema drift (API/UI read & write
-- columns the base schema never defined), adds journey/ECGT columns to
-- organization_certifications, creates organization_risk_profiles, seeds the
-- Risk Tool Foundation requirement (FR-R-000), and adds a unique index so
-- certification_score_history can be upserted once per day.
--
-- Idempotent and forward-only (repo convention). No down section.

-- 1. certification_evidence_links: add columns the app already uses
ALTER TABLE "public"."certification_evidence_links"
  ADD COLUMN IF NOT EXISTS "framework_id" "uuid";
ALTER TABLE "public"."certification_evidence_links"
  ADD COLUMN IF NOT EXISTS "document_url" "text";
ALTER TABLE "public"."certification_evidence_links"
  ADD COLUMN IF NOT EXISTS "verification_status" character varying(20) DEFAULT 'pending';
ALTER TABLE "public"."certification_evidence_links"
  ADD COLUMN IF NOT EXISTS "verification_date" timestamp with time zone;
ALTER TABLE "public"."certification_evidence_links"
  ADD COLUMN IF NOT EXISTS "notes" "text";
ALTER TABLE "public"."certification_evidence_links"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT "now"();

-- verification_status check (includes needs_review now so Phase 2 needs no
-- constraint change). Guarded so re-running is a no-op.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'certification_evidence_links_verification_status_check'
  ) THEN
    ALTER TABLE "public"."certification_evidence_links"
      ADD CONSTRAINT "certification_evidence_links_verification_status_check"
      CHECK ("verification_status" IN ('pending','verified','rejected','needs_review'));
  END IF;
END $$;

-- Manual and auto-suggested evidence has no platform source record.
ALTER TABLE "public"."certification_evidence_links"
  ALTER COLUMN "source_module" DROP NOT NULL;
ALTER TABLE "public"."certification_evidence_links"
  ALTER COLUMN "source_table" DROP NOT NULL;
ALTER TABLE "public"."certification_evidence_links"
  ALTER COLUMN "source_record_id" DROP NOT NULL;

-- Backfill verification_status from the legacy verified_date column.
UPDATE "public"."certification_evidence_links"
SET "verification_status" = CASE
  WHEN "verified_date" IS NOT NULL THEN 'verified'
  ELSE 'pending'
END
WHERE "verification_status" IS NULL;

-- Backfill framework_id from the requirement's framework.
UPDATE "public"."certification_evidence_links" cel
SET "framework_id" = cfr."framework_id"
FROM "public"."certification_framework_requirements" cfr
WHERE cel."requirement_id" = cfr."id"
  AND cel."framework_id" IS NULL;

UPDATE "public"."certification_evidence_links" cel
SET "framework_id" = fr."framework_id"
FROM "public"."framework_requirements" fr
WHERE cel."requirement_id" = fr."id"
  AND cel."framework_id" IS NULL;

-- 2. organization_certifications: journey + ECGT columns
ALTER TABLE "public"."organization_certifications"
  ADD COLUMN IF NOT EXISTS "certification_start_date" "date";
ALTER TABLE "public"."organization_certifications"
  ADD COLUMN IF NOT EXISTS "certification_type" "text";
ALTER TABLE "public"."organization_certifications"
  ADD COLUMN IF NOT EXISTS "ecgt_applicable" boolean DEFAULT false;
ALTER TABLE "public"."organization_certifications"
  ADD COLUMN IF NOT EXISTS "previous_bia_score" numeric(6,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_certifications_certification_type_check'
  ) THEN
    ALTER TABLE "public"."organization_certifications"
      ADD CONSTRAINT "organization_certifications_certification_type_check"
      CHECK ("certification_type" IS NULL OR "certification_type" IN ('new','recertification'));
  END IF;
END $$;

COMMENT ON COLUMN "public"."organization_certifications"."certification_start_date" IS 'Start of the certification cycle; year band (0/3/5) is derived from this';
COMMENT ON COLUMN "public"."organization_certifications"."certification_type" IS 'new (first-time certifier) or recertification (existing B Corp)';
COMMENT ON COLUMN "public"."organization_certifications"."ecgt_applicable" IS 'EU org using B Corp in consumer-facing marketing; drives ECGT deadline banner';

-- 3. certification_score_history: one row per cert per day (for upsert)
WITH ranked AS (
  SELECT "id",
    ROW_NUMBER() OVER (
      PARTITION BY "organization_id", "framework_id", "score_date"
      ORDER BY "created_at" DESC
    ) AS rn
  FROM "public"."certification_score_history"
)
DELETE FROM "public"."certification_score_history"
WHERE "id" IN (SELECT "id" FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS "certification_score_history_org_fw_date_key"
  ON "public"."certification_score_history" ("organization_id", "framework_id", "score_date");

-- 4. organization_risk_profiles
CREATE TABLE IF NOT EXISTS "public"."organization_risk_profiles" (
  "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
  "organization_id" "uuid" NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
  "certification_id" "uuid" REFERENCES "public"."organization_certifications"("id") ON DELETE CASCADE,
  "responses" "jsonb",
  "risk_profile" "jsonb",
  "triggered_requirements" "text"[],
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE INDEX IF NOT EXISTS "idx_organization_risk_profiles_org"
  ON "public"."organization_risk_profiles" ("organization_id", "created_at" DESC);

ALTER TABLE "public"."organization_risk_profiles" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organization_risk_profiles'
      AND policyname = 'Org members can view risk profiles'
  ) THEN
    CREATE POLICY "Org members can view risk profiles"
      ON "public"."organization_risk_profiles" FOR SELECT TO "authenticated"
      USING ("public"."user_has_organization_access"("organization_id"));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organization_risk_profiles'
      AND policyname = 'Org members can manage risk profiles'
  ) THEN
    CREATE POLICY "Org members can manage risk profiles"
      ON "public"."organization_risk_profiles" FOR ALL TO "authenticated"
      USING ("public"."user_has_organization_access"("organization_id"))
      WITH CHECK ("public"."user_has_organization_access"("organization_id"));
  END IF;
END $$;

-- 5. Seed the Risk Tool Foundation requirement (FR-R-000)
INSERT INTO "public"."certification_framework_requirements" (
  "id", "framework_id", "requirement_code", "requirement_name", "requirement_category",
  "section", "description", "max_points", "is_mandatory", "order_index",
  "applicable_from_year", "size_threshold", "topic_area",
  "points_available", "is_required"
)
SELECT
  'b0000000-0000-4000-8000-000000000001',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'FR-R-000',
  'Risk Tool Assessment',
  'Foundation Requirements',
  'Risk Management',
  'Complete the B Lab Risk Tool covering sector, geographic, supply chain and workforce risk. Determines which additional sub-requirements apply.',
  1, true, 9, 0, 'all', 'foundation', 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."certification_framework_requirements"
  WHERE "framework_id" = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    AND "requirement_code" = 'FR-R-000'
);

-- Mirror into framework_requirements with the same UUID (same pattern as
-- 20260220300000_sync_bcorp2026_to_framework_requirements.sql).
INSERT INTO "public"."framework_requirements" (
  "id", "framework_id", "requirement_code", "requirement_name", "requirement_category",
  "section", "subsection", "order_index", "description", "guidance",
  "max_points", "is_mandatory", "is_conditional", "required_data_sources",
  "evidence_requirements", "applicable_from_year", "size_threshold", "topic_area",
  "created_at", "updated_at"
)
SELECT
  cfr."id", cfr."framework_id", cfr."requirement_code", cfr."requirement_name",
  cfr."requirement_category", cfr."section", cfr."subsection", cfr."order_index",
  cfr."description", cfr."guidance", cfr."max_points", cfr."is_mandatory",
  cfr."is_conditional", cfr."required_data_sources", cfr."evidence_requirements",
  cfr."applicable_from_year", cfr."size_threshold", cfr."topic_area",
  cfr."created_at", cfr."updated_at"
FROM "public"."certification_framework_requirements" cfr
WHERE cfr."requirement_code" = 'FR-R-000'
  AND cfr."framework_id" = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND NOT EXISTS (
    SELECT 1 FROM "public"."framework_requirements" fr WHERE fr."id" = cfr."id"
  );
