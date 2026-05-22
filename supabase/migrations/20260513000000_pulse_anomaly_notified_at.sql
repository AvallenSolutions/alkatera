-- Pulse: dedup state for anomaly alert emails.
--
-- After sending a high-severity email for an anomaly row, we stamp
-- notified_at = NOW(). The detect-anomalies cron filters new high-sev
-- anomalies against any (org, metric_key) rows where notified_at is set
-- within the last 7 days, so we send at most one email per metric per
-- 7-day window (or per anomaly episode, whichever comes first).

ALTER TABLE public.dashboard_anomalies
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS dashboard_anomalies_notified_at_idx
  ON public.dashboard_anomalies (organization_id, metric_key, notified_at)
  WHERE notified_at IS NOT NULL;
