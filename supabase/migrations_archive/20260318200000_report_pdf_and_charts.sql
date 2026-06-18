-- Add PDF output format and generating_charts status to generated_reports
-- Supports Phase 2 sustainability report improvements

-- Update output_format constraint to include 'pdf'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'generated_reports_output_format_check'
  ) THEN
    ALTER TABLE generated_reports DROP CONSTRAINT generated_reports_output_format_check;
  END IF;
END $$;

ALTER TABLE generated_reports ADD CONSTRAINT generated_reports_output_format_check
  CHECK (output_format = ANY(ARRAY['docx', 'xlsx', 'pptx', 'pdf']));

-- Update status constraint to include 'generating_charts'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'generated_reports_status_check'
  ) THEN
    ALTER TABLE generated_reports DROP CONSTRAINT generated_reports_status_check;
  END IF;
END $$;

ALTER TABLE generated_reports ADD CONSTRAINT generated_reports_status_check
  CHECK (status = ANY(ARRAY[
    'pending', 'aggregating_data', 'building_content',
    'generating_charts', 'generating_document', 'completed', 'failed'
  ]));
