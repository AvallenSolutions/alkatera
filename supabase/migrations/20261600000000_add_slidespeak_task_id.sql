-- Add slidespeak_task_id to generated_reports for webhook-based delivery
-- This allows the webhook callback to look up which report to update
ALTER TABLE generated_reports
  ADD COLUMN IF NOT EXISTS slidespeak_task_id text;

CREATE INDEX IF NOT EXISTS idx_generated_reports_slidespeak_task_id
  ON generated_reports(slidespeak_task_id)
  WHERE slidespeak_task_id IS NOT NULL;
