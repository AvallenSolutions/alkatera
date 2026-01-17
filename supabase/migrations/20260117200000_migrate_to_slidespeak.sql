-- Migration: Skywork to SlideSpeak
-- This migration updates the sustainability reports system to use SlideSpeak API

-- 1. Rename skywork_query column to api_request_payload
ALTER TABLE generated_reports
RENAME COLUMN skywork_query TO api_request_payload;

-- 2. Update output_format constraint to only allow pptx
-- First drop the existing constraint
ALTER TABLE generated_reports
DROP CONSTRAINT IF EXISTS generated_reports_output_format_check;

-- Add new constraint for pptx only
ALTER TABLE generated_reports
ADD CONSTRAINT generated_reports_output_format_check
CHECK (output_format = 'pptx');

-- Update any existing non-pptx records to pptx
UPDATE generated_reports
SET output_format = 'pptx'
WHERE output_format != 'pptx';

-- 3. Add is_multi_year and report_years columns if they don't exist
ALTER TABLE generated_reports
ADD COLUMN IF NOT EXISTS is_multi_year BOOLEAN DEFAULT false;

ALTER TABLE generated_reports
ADD COLUMN IF NOT EXISTS report_years INTEGER[] DEFAULT '{}';

-- 4. Add slidespeak_template_id to organizations for branded templates
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS slidespeak_template_id TEXT;

-- 5. Update table comments
COMMENT ON TABLE generated_reports IS 'Stores configuration and metadata for AI-generated sustainability reports using SlideSpeak API';
COMMENT ON COLUMN generated_reports.api_request_payload IS 'JSON payload sent to SlideSpeak API for reproducibility and debugging';
COMMENT ON COLUMN generated_reports.is_multi_year IS 'Whether this report includes multi-year trend analysis';
COMMENT ON COLUMN generated_reports.report_years IS 'Array of years included in multi-year reports';
COMMENT ON COLUMN organizations.slidespeak_template_id IS 'SlideSpeak branded template ID for this organization';

-- 6. Update the report_statistics view to remove docx/xlsx counts
CREATE OR REPLACE VIEW report_statistics AS
SELECT
  organization_id,
  COUNT(*) as total_reports,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_reports,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_reports,
  COUNT(*) FILTER (WHERE status = 'generating') as generating_reports,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_reports,
  COUNT(*) FILTER (WHERE is_multi_year = true) as multi_year_reports,
  MAX(created_at) as last_report_created_at
FROM generated_reports
GROUP BY organization_id;

-- Grant access to the view
GRANT SELECT ON report_statistics TO authenticated;
