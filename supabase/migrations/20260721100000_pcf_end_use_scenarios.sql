-- End-use scenarios: one product, one core LCA, many journeys
--
-- Until now a product sold into two channels needed two complete LCAs. Same
-- liquid, same bottle, same recipe, same facility: only the journey to the
-- customer, the use phase and the bin differ. Everything upstream was entered
-- and maintained twice, both copies burned a quota slot, and the moment one was
-- recalculated the same product had two conflicting cradle-to-gate numbers.
--
-- This table holds the downstream assumptions that make one channel differ from
-- another. Footprint per scenario = the PCF's shared core + that scenario's
-- distribution, use phase and end of life. That is the EN 15804 / ISO 14067
-- modular model: downstream stages are scenario-modelled and documented, not
-- measured, which is why one core study can legitimately serve several.
--
-- See tasks/lca-end-use-scenarios-plan.md.
--
-- Deliberately NOT counted against max_lcas: the quota function counts
-- product_carbon_footprints rows, and scenarios live here instead, so the
-- exemption is structural rather than a rule someone has to remember. A
-- scenario is not a new study; charging for one would recreate exactly the
-- duplication incentive this removes.

CREATE TABLE IF NOT EXISTS "public"."pcf_end_use_scenarios" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "pcf_id" uuid NOT NULL
    REFERENCES "public"."product_carbon_footprints"("id") ON DELETE CASCADE,
  "organization_id" uuid NOT NULL
    REFERENCES "public"."organizations"("id") ON DELETE CASCADE,

  -- What the user calls this route to market, e.g. "Retail (off-trade)".
  "name" text NOT NULL,
  "channel" text NOT NULL DEFAULT 'custom'
    CHECK ("channel" IN ('on_trade', 'off_trade_retail', 'dtc', 'export', 'custom')),

  -- Exactly one primary per PCF: the fallback headline until channel shares are
  -- known, and the scenario the legacy PCF columns mirror.
  "is_primary" boolean NOT NULL DEFAULT false,

  -- Share of annual volume going through this channel. Null until the user
  -- answers the channel-split ask; once set across scenarios, the product's
  -- headline number becomes the volume-weighted mix.
  "share_pct" numeric CHECK ("share_pct" >= 0 AND "share_pct" <= 100),

  -- The downstream configs. Same shapes as the columns of the same name on
  -- product_carbon_footprints, so the calculator needs no new vocabulary.
  -- product_loss_config lives here too because losses are a downstream
  -- phenomenon even though they scale upstream emissions (ISO 14044): a bar
  -- and a supermarket lose different fractions of the same pallet.
  "distribution_config" jsonb,
  "use_phase_config" jsonb,
  "eol_config" jsonb,
  "product_loss_config" jsonb,

  -- Computed downstream impacts plus the scenario's adjusted totals, written by
  -- the recalculation. Null until first computed.
  "stage_results" jsonb,
  "computed_at" timestamptz,

  -- Per-section provenance (estimated / confirmed), same vocabulary as the rest
  -- of the data revolution. A preset seeds every value as estimated; the asks
  -- flip them as the user confirms.
  "provenance" jsonb NOT NULL DEFAULT '{}'::jsonb,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),

  UNIQUE ("pcf_id", "name")
);

CREATE INDEX IF NOT EXISTS "pcf_end_use_scenarios_pcf_idx"
  ON "public"."pcf_end_use_scenarios" ("pcf_id");

CREATE INDEX IF NOT EXISTS "pcf_end_use_scenarios_org_idx"
  ON "public"."pcf_end_use_scenarios" ("organization_id");

-- One primary per PCF. Without this, "which number leads?" has no answer and
-- the poster would pick arbitrarily.
CREATE UNIQUE INDEX IF NOT EXISTS "pcf_end_use_scenarios_one_primary"
  ON "public"."pcf_end_use_scenarios" ("pcf_id")
  WHERE "is_primary" = true;

ALTER TABLE "public"."pcf_end_use_scenarios" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pcf_end_use_scenarios_member_read" ON "public"."pcf_end_use_scenarios"
  FOR SELECT USING (("organization_id" IN (
    SELECT "om"."organization_id" FROM "public"."organization_members" "om"
    WHERE ("om"."user_id" = "auth"."uid"())
  )));

CREATE POLICY "pcf_end_use_scenarios_member_insert" ON "public"."pcf_end_use_scenarios"
  FOR INSERT WITH CHECK (("organization_id" IN (
    SELECT "om"."organization_id" FROM "public"."organization_members" "om"
    WHERE ("om"."user_id" = "auth"."uid"())
  )));

CREATE POLICY "pcf_end_use_scenarios_member_update" ON "public"."pcf_end_use_scenarios"
  FOR UPDATE USING (("organization_id" IN (
    SELECT "om"."organization_id" FROM "public"."organization_members" "om"
    WHERE ("om"."user_id" = "auth"."uid"())
  )))
  WITH CHECK (("organization_id" IN (
    SELECT "om"."organization_id" FROM "public"."organization_members" "om"
    WHERE ("om"."user_id" = "auth"."uid"())
  )));

CREATE POLICY "pcf_end_use_scenarios_member_delete" ON "public"."pcf_end_use_scenarios"
  FOR DELETE USING (("organization_id" IN (
    SELECT "om"."organization_id" FROM "public"."organization_members" "om"
    WHERE ("om"."user_id" = "auth"."uid"())
  )));

-- Keep updated_at honest.
CREATE OR REPLACE FUNCTION "public"."touch_pcf_end_use_scenarios"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "pcf_end_use_scenarios_touch" ON "public"."pcf_end_use_scenarios";
CREATE TRIGGER "pcf_end_use_scenarios_touch"
  BEFORE UPDATE ON "public"."pcf_end_use_scenarios"
  FOR EACH ROW EXECUTE FUNCTION "public"."touch_pcf_end_use_scenarios"();

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: every PCF that already reaches past the gate gets a primary
-- scenario carrying its current configs.
--
-- This is what makes the change invisible to existing customers: their one
-- configured journey becomes their primary scenario, the legacy columns keep
-- mirroring it, and nothing they look at moves. Cradle-to-gate PCFs get no
-- scenario at all, because there is no downstream to vary.
--
-- Boundary values are stored with underscores in the DB and hyphens in the app
-- (see lib/system-boundaries.ts), so match both rather than assuming either.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "public"."pcf_end_use_scenarios" (
  "pcf_id", "organization_id", "name", "channel", "is_primary",
  "distribution_config", "use_phase_config", "eol_config", "product_loss_config",
  "provenance"
)
SELECT
  "p"."id",
  "p"."organization_id",
  'Primary route to market',
  'custom',
  true,
  "p"."distribution_config",
  "p"."use_phase_config",
  "p"."eol_config",
  "p"."product_loss_config",
  -- Lifted from an existing study, so whatever the user already confirmed in
  -- the wizard stays confirmed. Marked as migrated so the dossier can tell a
  -- lifted scenario from a preset-seeded one.
  jsonb_build_object('source', 'migrated_from_pcf')
FROM "public"."product_carbon_footprints" "p"
WHERE
  COALESCE("p"."system_boundary", "p"."lca_scope_type", 'cradle-to-gate')
    NOT IN ('cradle-to-gate', 'cradle_to_gate')
  AND NOT EXISTS (
    SELECT 1 FROM "public"."pcf_end_use_scenarios" "s" WHERE "s"."pcf_id" = "p"."id"
  );

COMMENT ON TABLE "public"."pcf_end_use_scenarios" IS
  'End-use scenarios for one PCF: the downstream assumptions (distribution, use phase, end of life, product loss) that vary by where a product is sold. Footprint per scenario = the PCF core + these stages. Never counted against max_lcas — a scenario is not a study.';

COMMENT ON COLUMN "public"."pcf_end_use_scenarios"."is_primary" IS
  'Exactly one per PCF. The fallback headline before channel shares are known, and the scenario the legacy product_carbon_footprints.*_config columns mirror for backwards compatibility.';

COMMENT ON COLUMN "public"."pcf_end_use_scenarios"."share_pct" IS
  'Share of annual volume through this channel. When set across a PCF''s scenarios, the headline footprint becomes the volume-weighted mix; null until the channel-split ask is answered.';

COMMENT ON COLUMN "public"."pcf_end_use_scenarios"."stage_results" IS
  'Computed downstream impacts and the scenario-adjusted totals, written by the recalculation. Shape mirrors DownstreamStageResults in lib/lca/downstream-stages.ts.';
