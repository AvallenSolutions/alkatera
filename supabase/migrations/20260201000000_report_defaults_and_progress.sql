-- Add report_defaults jsonb column to organizations table
-- This stores persistent branding/configuration defaults for the report builder
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS report_defaults jsonb DEFAULT '{}';

-- Comment for documentation
COMMENT ON COLUMN organizations.report_defaults IS 'Persistent report builder defaults: branding (logo, colors), default audience, default standards';

-- Update generated_reports status constraint to include granular progress statuses
-- Drop existing constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'generated_reports_status_check'
  ) THEN
    ALTER TABLE generated_reports DROP CONSTRAINT generated_reports_status_check;
  END IF;
END $$;

-- Update old 'generating' status to 'generating_document' before adding constraint
UPDATE generated_reports SET status = 'generating_document' WHERE status = 'generating';

ALTER TABLE generated_reports ADD CONSTRAINT generated_reports_status_check
  CHECK (status = ANY(ARRAY[
    'pending', 'aggregating_data', 'building_content',
    'generating_document', 'completed', 'failed'
  ]));
