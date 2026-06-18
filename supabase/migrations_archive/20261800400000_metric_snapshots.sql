-- Pulse Phase 1 — Time-Series Spine
--
-- metric_snapshots stores daily rolled-up org-level KPIs so the Pulse
-- dashboard can render sparklines and period-over-period deltas without
-- recomputing heavy aggregations on every page load.
--
-- Snapshots are written by:
--   - /api/cron/generate-snapshots (nightly, all orgs)
--   - scripts/backfill-snapshots.ts (one-off historical backfill)
--
-- The unique constraint is (organization_id, metric_key, snapshot_date)
-- so reruns cleanly upsert. `scope` and `dimensions` are optional extension
-- columns reserved for future per-scope / per-facility breakdowns; they
-- default to NULL and an empty object respectively and are NOT part of the
-- uniqueness key in Phase 1.

CREATE TABLE IF NOT EXISTS public.metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  snapshot_date date NOT NULL,
  value numeric NOT NULL,
  unit text NOT NULL,
  scope text,
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT metric_snapshots_unique UNIQUE (organization_id, metric_key, snapshot_date)
);

-- Primary read path: latest N days of one metric for one org.
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_org_metric_date
  ON public.metric_snapshots (organization_id, metric_key, snapshot_date DESC);

-- Cross-org read path used by Phase 7 peer benchmarks.
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_metric_date
  ON public.metric_snapshots (metric_key, snapshot_date DESC);

-- RLS: members can read snapshots for any org they belong to.
ALTER TABLE public.metric_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metric_snapshots_member_read"
  ON public.metric_snapshots
  FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policy is defined: writes happen exclusively via
-- the service role (cron + backfill script), which bypasses RLS. This
-- prevents tampering with historical metric values from the client.

COMMENT ON TABLE public.metric_snapshots IS
  'Pulse: daily rolled-up org KPIs powering sparklines, deltas, anomaly detection, and peer benchmarks.';
COMMENT ON COLUMN public.metric_snapshots.metric_key IS
  'Stable identifier from lib/pulse/metric-keys.ts (e.g. total_co2e, water_consumption, products_assessed).';
COMMENT ON COLUMN public.metric_snapshots.snapshot_date IS
  'The date the snapshot represents (NOT the time it was computed). Trailing-window aggregations use this as the right edge.';
COMMENT ON COLUMN public.metric_snapshots.scope IS
  'Optional scope filter (e.g. "1", "2", "3" for emissions). NULL = org total.';
COMMENT ON COLUMN public.metric_snapshots.dimensions IS
  'Optional free-form breakdown dimensions for future use (e.g. {"facility_id": "..."}). NOT included in uniqueness key.';
