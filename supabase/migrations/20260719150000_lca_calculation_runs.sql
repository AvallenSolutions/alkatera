-- LCA calculation runs
--
-- Until now an LCA could only be calculated inside a signed-in browser tab:
-- the user pressed Calculate and watched a blocking overlay for 5 to 10
-- seconds, and navigating away lost the run. That is why every surface needs
-- a "recalculate" button and a staleness banner.
--
-- This table is the status record for a calculation running server-side under
-- Inngest, so a footprint can refresh because a recipe changed rather than
-- because somebody clicked. The UI polls a row rather than holding a promise.
--
-- Modelled on pulse_refresh_runs (20260622140000). The difference is the
-- progress shape: the calculator reports a single linear (step, percent)
-- rather than a map of parallel jobs, so this carries phase_message + percent
-- instead of jobs jsonb.

CREATE TABLE IF NOT EXISTS "public"."lca_calculation_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
  "product_id" bigint NOT NULL REFERENCES "public"."products"("id") ON DELETE CASCADE,
  -- Who the resulting footprint is attributed to. Server runs have no session,
  -- so the dispatcher records the user on their behalf.
  "requested_by" uuid REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  -- What caused this run. Distinguishes a deliberate recalculation from an
  -- automatic one so the dossier can say why a number moved.
  "trigger" text NOT NULL DEFAULT 'manual'
    CHECK ("trigger" IN ('manual', 'recipe_changed', 'packaging_library', 'factor_set', 'ask_answered', 'first_recipe')),
  "status" text NOT NULL DEFAULT 'queued'
    CHECK ("status" IN ('queued', 'running', 'completed', 'failed')),
  "percent" integer NOT NULL DEFAULT 0 CHECK ("percent" BETWEEN 0 AND 100),
  "phase_message" text,
  -- The PCF this run produced, once it has one.
  "pcf_id" uuid REFERENCES "public"."product_carbon_footprints"("id") ON DELETE SET NULL,
  -- Downgrades away from the ideal factor source, carried so the dossier can
  -- show honestly where a number came from rather than only that it exists.
  "fallback_events" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "error" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "lca_calculation_runs_product_idx"
  ON "public"."lca_calculation_runs" ("product_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "lca_calculation_runs_org_idx"
  ON "public"."lca_calculation_runs" ("organization_id", "created_at" DESC);

-- Only one run in flight per product: a recipe save while a calculation is
-- already running should join that run, not start a competing one that races
-- to write the same PCF.
CREATE UNIQUE INDEX IF NOT EXISTS "lca_calculation_runs_one_active_per_product"
  ON "public"."lca_calculation_runs" ("product_id")
  WHERE "status" IN ('queued', 'running');

ALTER TABLE "public"."lca_calculation_runs" ENABLE ROW LEVEL SECURITY;

-- No policies, deliberately: server-side service-role access only, exactly as
-- pulse_refresh_runs does. Reads reach the browser through the status route,
-- which authorises the caller against the organisation first.

COMMENT ON TABLE "public"."lca_calculation_runs" IS
  'Status record for an LCA calculation running server-side under Inngest. Polled by the UI; no RLS policies, service-role access only.';
