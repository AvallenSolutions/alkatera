-- B Corp 2026 Phase 4: Continuous Improvement & Intelligence
--
-- Health score history, evidence staleness, standards version tracking.
--
-- Idempotent and forward-only. No down section.

ALTER TABLE "public"."certification_score_history"
  ADD COLUMN IF NOT EXISTS "health_score" integer;

ALTER TABLE "public"."certification_evidence_links"
  ADD COLUMN IF NOT EXISTS "staleness_status" "text";

ALTER TABLE "public"."organization_certifications"
  ADD COLUMN IF NOT EXISTS "standards_version" "text";

CREATE TABLE IF NOT EXISTS "public"."certification_standards_versions" (
  "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
  "framework_id" "uuid" REFERENCES "public"."certification_frameworks"("id") ON DELETE CASCADE,
  "version_code" "text" NOT NULL,
  "released_at" "date",
  "summary" "text",
  "change_log" "jsonb",
  "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE UNIQUE INDEX IF NOT EXISTS "certification_standards_versions_fw_code_key"
  ON "public"."certification_standards_versions" ("framework_id", "version_code");

ALTER TABLE "public"."certification_standards_versions"
  ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'certification_standards_versions'
      AND policyname = 'Authenticated can read standards versions'
  ) THEN
    CREATE POLICY "Authenticated can read standards versions"
      ON "public"."certification_standards_versions"
      FOR SELECT TO "authenticated" USING (true);
  END IF;
END $$;

-- Seed V2.1 and V2.2 for the B Corp 2026 framework.
INSERT INTO "public"."certification_standards_versions" (
  "framework_id", "version_code", "released_at", "summary", "change_log"
)
SELECT
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'V2.1', '2026-01-01',
  'Initial 2026 B Corp Standards: pass/fail Foundation Requirements and 7 Impact Topics with Year 0/3/5 progression.',
  '[]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."certification_standards_versions"
  WHERE "framework_id" = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    AND "version_code" = 'V2.1'
);

INSERT INTO "public"."certification_standards_versions" (
  "framework_id", "version_code", "released_at", "summary", "change_log"
)
SELECT
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'V2.2', '2026-02-01',
  'Minor update: corrections and clarifications to requirement guidance. No new mandatory requirements.',
  '[]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."certification_standards_versions"
  WHERE "framework_id" = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    AND "version_code" = 'V2.2'
);
