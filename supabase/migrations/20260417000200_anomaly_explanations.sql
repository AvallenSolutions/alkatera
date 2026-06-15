-- Pulse: cache Rosa's anomaly root-cause explanations on the anomaly row.
--
-- A single jsonb column is enough; we store:
--   { headline, bullets: [...], tools_called: [...], generated_at, model }
-- An index on (organization_id, has_explanation) is unnecessary because the
-- anomaly row is already retrieved by id when displaying the explanation.

ALTER TABLE public.dashboard_anomalies
  ADD COLUMN IF NOT EXISTS explanation jsonb,
  ADD COLUMN IF NOT EXISTS explanation_generated_at timestamptz;

COMMENT ON COLUMN public.dashboard_anomalies.explanation IS
  'Rosa-generated root-cause explanation. Shape: { headline, bullets[], tools_called[], model }. Cached so the user can reopen without re-running the tool loop.';
