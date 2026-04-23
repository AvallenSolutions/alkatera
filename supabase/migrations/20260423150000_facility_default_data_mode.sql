-- =============================================================================
-- Facility-level default data collection mode
-- =============================================================================
-- Persists the data-sourcing decision on the facility itself so that every
-- downstream surface (LCA wizard, facility detail page, reports, data-entry
-- prompts) reads the same source of truth. When a user creates a third-party
-- facility and declares they cannot obtain primary data, the archetype proxy
-- choice lives here and auto-seeds every new LCA allocation for this facility.
-- =============================================================================

BEGIN;

ALTER TABLE "public"."facilities"
    ADD COLUMN IF NOT EXISTS "default_data_collection_mode" "text" NOT NULL DEFAULT 'primary',
    ADD COLUMN IF NOT EXISTS "default_archetype_id" "uuid" REFERENCES "public"."facility_archetypes"("id") ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS "default_proxy_justification" "text";

ALTER TABLE "public"."facilities"
    DROP CONSTRAINT IF EXISTS "facilities_default_data_collection_mode_check";

ALTER TABLE "public"."facilities"
    ADD CONSTRAINT "facilities_default_data_collection_mode_check"
    CHECK ("default_data_collection_mode" = ANY (ARRAY['primary'::"text", 'archetype_proxy'::"text", 'hybrid'::"text"]));

ALTER TABLE "public"."facilities"
    DROP CONSTRAINT IF EXISTS "facilities_default_archetype_required";

ALTER TABLE "public"."facilities"
    ADD CONSTRAINT "facilities_default_archetype_required"
    CHECK (
        ("default_data_collection_mode" = 'primary') OR
        ("default_archetype_id" IS NOT NULL)
    );

COMMENT ON COLUMN "public"."facilities"."default_data_collection_mode" IS 'Default data sourcing for this facility: primary (the facility supplies real data), archetype_proxy (use industry typical intensities), hybrid (archetype with user overrides). Seeds every LCA allocation for this facility.';
COMMENT ON COLUMN "public"."facilities"."default_archetype_id" IS 'FK to facility_archetypes when default mode is archetype_proxy or hybrid.';
COMMENT ON COLUMN "public"."facilities"."default_proxy_justification" IS 'User-supplied reason primary data cannot be obtained, per ISO 14044 §4.2.3.6.';

CREATE INDEX IF NOT EXISTS "idx_facilities_default_data_collection_mode"
    ON "public"."facilities" ("default_data_collection_mode");

COMMIT;
