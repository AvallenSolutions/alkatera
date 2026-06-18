-- Sync B Corp 2026 requirements into framework_requirements table
--
-- The gap_analyses FK points to framework_requirements, but B Corp 2026
-- seed data was inserted into certification_framework_requirements.
-- This migration copies them across with the same UUIDs so both tables
-- have the data and all FK constraints are satisfied.

INSERT INTO "public"."framework_requirements" (
  "id",
  "framework_id",
  "requirement_code",
  "requirement_name",
  "requirement_category",
  "section",
  "subsection",
  "order_index",
  "description",
  "guidance",
  "max_points",
  "is_mandatory",
  "is_conditional",
  "required_data_sources",
  "evidence_requirements",
  "applicable_from_year",
  "size_threshold",
  "topic_area",
  "created_at",
  "updated_at"
)
SELECT
  cfr."id",
  cfr."framework_id",
  cfr."requirement_code",
  cfr."requirement_name",
  cfr."requirement_category",
  cfr."section",
  cfr."subsection",
  cfr."order_index",
  cfr."description",
  cfr."guidance",
  cfr."max_points",
  cfr."is_mandatory",
  cfr."is_conditional",
  cfr."required_data_sources",
  cfr."evidence_requirements",
  cfr."applicable_from_year",
  cfr."size_threshold",
  cfr."topic_area",
  cfr."created_at",
  cfr."updated_at"
FROM "public"."certification_framework_requirements" cfr
WHERE cfr."framework_id" = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND NOT EXISTS (
    SELECT 1 FROM "public"."framework_requirements" fr
    WHERE fr."id" = cfr."id"
  );
