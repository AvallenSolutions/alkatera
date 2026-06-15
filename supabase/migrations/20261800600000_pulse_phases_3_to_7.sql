-- Pulse Phases 3-7 — schema bundle
--
-- One migration for the four new tables and one view that power AI insights,
-- target trajectories, anomaly alerts, live grid-carbon overlays, and peer
-- benchmarking. Bundled so it's one paste into the SQL editor.

-- ─────────────────────────────────────────────────────────────────────────
-- Phase 3 — dashboard_insights
-- Cached Claude-generated narratives. Generated nightly + on demand.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dashboard_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  generated_at timestamptz NOT NULL DEFAULT now(),
  period text NOT NULL DEFAULT 'daily',
  headline text NOT NULL,
  narrative_md text NOT NULL,
  supporting_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric,
  model text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_dashboard_insights_org_generated
  ON public.dashboard_insights (organization_id, generated_at DESC);

ALTER TABLE public.dashboard_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboard_insights_member_read"
  ON public.dashboard_insights FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Phase 4 — sustainability_targets
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sustainability_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  baseline_value numeric NOT NULL,
  baseline_date date NOT NULL,
  target_value numeric NOT NULL,
  target_date date NOT NULL,
  scope text,
  status text NOT NULL DEFAULT 'active',
  methodology text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sustainability_targets_org_metric
  ON public.sustainability_targets (organization_id, metric_key);

ALTER TABLE public.sustainability_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sustainability_targets_member_read"
  ON public.sustainability_targets FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "sustainability_targets_admin_write"
  ON public.sustainability_targets FOR ALL
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      JOIN public.roles r ON r.id = om.role_id
      WHERE om.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      JOIN public.roles r ON r.id = om.role_id
      WHERE om.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Phase 5 — dashboard_anomalies
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dashboard_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  observed numeric NOT NULL,
  expected numeric NOT NULL,
  z_score numeric NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'dismissed')),
  acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at timestamptz,
  dismissed_at timestamptz,
  notes text,

  -- One anomaly per (org, metric, day) — re-runs of the detector are idempotent.
  CONSTRAINT dashboard_anomalies_unique_daily
    UNIQUE (organization_id, metric_key, detected_at)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_anomalies_open
  ON public.dashboard_anomalies (organization_id, status, detected_at DESC);

ALTER TABLE public.dashboard_anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboard_anomalies_member_read"
  ON public.dashboard_anomalies FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "dashboard_anomalies_member_update"
  ON public.dashboard_anomalies FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Phase 6 — grid_carbon_readings
-- Free, public UK grid carbon-intensity API readings (and ElectricityMaps
-- for non-UK in a future iteration).
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.grid_carbon_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_code text NOT NULL,           -- e.g. 'GB-NATIONAL', 'GB-LON'
  recorded_at timestamptz NOT NULL,
  intensity_g_per_kwh numeric NOT NULL,
  forecast_g_per_kwh numeric,
  source text NOT NULL DEFAULT 'uk_carbon_intensity',
  fetched_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT grid_carbon_readings_unique
    UNIQUE (region_code, recorded_at, source)
);

CREATE INDEX IF NOT EXISTS idx_grid_carbon_region_recorded
  ON public.grid_carbon_readings (region_code, recorded_at DESC);

-- Public, anonymous read: grid carbon data is non-PII reference data.
-- No org filtering; the Pulse widget filters by region client-side.
ALTER TABLE public.grid_carbon_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grid_carbon_anonymous_read"
  ON public.grid_carbon_readings FOR SELECT
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────
-- Phase 7 — peer_benchmark_view
-- Anonymised cross-org percentiles. K-anonymity: only return rows where
-- at least 5 distinct orgs contributed to the bucket.
-- Implemented as a regular view over metric_snapshots (not materialised) —
-- snapshot volume is small enough that on-demand evaluation is fine for v1.
-- ─────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.peer_benchmark_view;

CREATE VIEW public.peer_benchmark_view AS
WITH latest_per_org AS (
  -- Most recent snapshot per (org, metric_key) within the trailing 90 days.
  SELECT DISTINCT ON (organization_id, metric_key)
    organization_id,
    metric_key,
    value,
    snapshot_date
  FROM public.metric_snapshots
  WHERE snapshot_date >= (current_date - INTERVAL '90 days')
  ORDER BY organization_id, metric_key, snapshot_date DESC
)
SELECT
  metric_key,
  count(*) AS sample_size,
  percentile_cont(0.25) WITHIN GROUP (ORDER BY value) AS p25,
  percentile_cont(0.5)  WITHIN GROUP (ORDER BY value) AS p50,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY value) AS p75,
  min(value) AS min_value,
  max(value) AS max_value,
  avg(value) AS mean_value
FROM latest_per_org
GROUP BY metric_key
HAVING count(*) >= 5;

GRANT SELECT ON public.peer_benchmark_view TO authenticated;

COMMENT ON VIEW public.peer_benchmark_view IS
  'Pulse: anonymised cross-org metric percentiles (k-anonymity ≥ 5). Read by /api/pulse/peer-benchmark.';
