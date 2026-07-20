-- Did a person choose this boundary, or did we?
--
-- How far a footprint follows a product is the single most consequential
-- choice in an LCA: it decides whether sales-out transport, the use phase and
-- disposal are counted at all. The wizard made a founder pick it from four
-- ISO terms at step three, before they had any way to know what the words
-- meant.
--
-- The dossier proposes a boundary from the product category instead, and asks
-- for confirmation in plain language. That only works if we can tell the two
-- apart: a boundary somebody deliberately picked must not generate a question,
-- and one we assumed must not pass silently into a signed report.
--
-- Existing rows default to 'chosen' because every footprint calculated to date
-- came through the wizard, where the boundary was a required field. Backfilling
-- them as 'defaulted' would put a question in front of every customer about a
-- decision they already made.

ALTER TABLE "public"."product_carbon_footprints"
  ADD COLUMN IF NOT EXISTS "boundary_source" text NOT NULL DEFAULT 'chosen'
    CHECK ("boundary_source" IN ('chosen', 'defaulted'));

COMMENT ON COLUMN "public"."product_carbon_footprints"."boundary_source" IS
  'Whether system_boundary was picked by a person (chosen) or proposed by the platform from the product category (defaulted). A defaulted boundary raises a confirmation ask and cannot be treated as confirmed data.';

-- Finding the footprints still resting on an assumed boundary is a sweep the
-- ask generator runs per organisation, so index for that shape.
CREATE INDEX IF NOT EXISTS "product_carbon_footprints_boundary_source_idx"
  ON "public"."product_carbon_footprints" ("organization_id", "boundary_source")
  WHERE "boundary_source" = 'defaulted';
