-- Hospitality water metering.
--
-- Organisations sometimes run a separate water meter for their hospitality venue
-- (kitchen/bar/rooms) alongside the main production meter. `meter_purpose` tags a
-- facility water entry so its consumption can be attributed to hospitality and
-- reported (and included/excluded) separately, WITHOUT changing the company water
-- total: hospitality water is still operational water, just labelled.
--
-- Default 'production' ⇒ every existing row is production ⇒ all water views and
-- company totals are unchanged. The production/hospitality split is computed in
-- app code (hospitality dashboard + water hook), not in the SQL views, to keep
-- the company-total math untouched.

ALTER TABLE "public"."facility_activity_entries"
  ADD COLUMN IF NOT EXISTS "meter_purpose" "text" DEFAULT 'production' NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "pg_constraint" WHERE "conname" = 'facility_activity_entries_meter_purpose_check'
  ) THEN
    ALTER TABLE "public"."facility_activity_entries"
      ADD CONSTRAINT "facility_activity_entries_meter_purpose_check"
      CHECK (("meter_purpose" = ANY (ARRAY['production'::"text", 'hospitality'::"text"])));
  END IF;
END $$;

COMMENT ON COLUMN "public"."facility_activity_entries"."meter_purpose" IS
  'Which part of the business this meter serves: production (default) or hospitality. Splits attribution/reporting only — does not change the company total.';

CREATE INDEX IF NOT EXISTS "idx_facility_activity_entries_meter_purpose"
  ON "public"."facility_activity_entries" ("organization_id", "meter_purpose");
