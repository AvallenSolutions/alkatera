-- Reset the Pulse alerts inbox after the anomaly-detector fix.
--
-- The old detector flagged near-flat metrics every hour with broken z-scores
-- (e.g. z = 6e12) and stored one row per DAY, flooding the inbox. The fixed
-- detector (lib/pulse/anomaly.ts) gates on a material 5% move, bounds the
-- z-score, and stores one row per metric per MONTH. Those new rows use a
-- month-granular detected_at, so they will NOT dedupe against the old daily
-- rows already in the table. Clear the old ones once; the detector refills
-- cleanly on its next hourly run.
--
-- Paste into the Supabase SQL editor and run.

-- 1. See what is there first (optional sanity check).
SELECT
  metric_key,
  severity,
  count(*)                              AS rows,
  min(detected_at)                      AS earliest,
  max(detected_at)                      AS latest,
  round(min(z_score)::numeric, 1)       AS min_z,
  round(max(z_score)::numeric, 1)       AS max_z
FROM public.dashboard_anomalies
WHERE status = 'open'
GROUP BY metric_key, severity
ORDER BY rows DESC;

-- 2. Delete the open backlog. Acknowledged/dismissed rows are left untouched
--    so any history the user has actioned is preserved. Genuinely anomalous
--    metrics will be re-flagged (once, this month) on the next detector run.
DELETE FROM public.dashboard_anomalies
WHERE status = 'open';
