-- Add report_framing_statement column to generated_reports
-- Stores the editorial framing from Step 0 of the report builder wizard

ALTER TABLE generated_reports
  ADD COLUMN IF NOT EXISTS report_framing_statement TEXT;

-- Update output_format constraint to include 'html'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'generated_reports_output_format_check'
  ) THEN
    ALTER TABLE generated_reports DROP CONSTRAINT generated_reports_output_format_check;
  END IF;
END $$;

ALTER TABLE generated_reports ADD CONSTRAINT generated_reports_output_format_check
  CHECK (output_format = ANY(ARRAY['docx', 'xlsx', 'pptx', 'pdf', 'html']));

NOTIFY pgrst, 'reload schema';
