/*
  # Add Multi-Year Support to Generated Reports

  1. Changes
    - Add `is_multi_year` boolean field to track multi-year reports
    - Add `report_years` integer array to store years covered in report
    - Add `parent_report_id` for versioning support
    - Add `version` and `is_latest` for version control
    - Add `changelog` for version notes

  2. Defaults
    - is_multi_year defaults to false (single year reports)
    - report_years defaults to empty array
    - version defaults to 1
    - is_latest defaults to true
*/

-- Add multi-year tracking fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generated_reports' AND column_name = 'is_multi_year'
  ) THEN
    ALTER TABLE generated_reports ADD COLUMN is_multi_year BOOLEAN DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generated_reports' AND column_name = 'report_years'
  ) THEN
    ALTER TABLE generated_reports ADD COLUMN report_years INTEGER[] DEFAULT '{}';
  END IF;
END $$;

-- Add versioning fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generated_reports' AND column_name = 'parent_report_id'
  ) THEN
    ALTER TABLE generated_reports ADD COLUMN parent_report_id UUID REFERENCES generated_reports(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generated_reports' AND column_name = 'version'
  ) THEN
    ALTER TABLE generated_reports ADD COLUMN version INTEGER DEFAULT 1;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generated_reports' AND column_name = 'is_latest'
  ) THEN
    ALTER TABLE generated_reports ADD COLUMN is_latest BOOLEAN DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generated_reports' AND column_name = 'changelog'
  ) THEN
    ALTER TABLE generated_reports ADD COLUMN changelog TEXT;
  END IF;
END $$;

-- Create index for versioning queries
CREATE INDEX IF NOT EXISTS idx_generated_reports_parent_version 
  ON generated_reports(parent_report_id, version DESC) 
  WHERE parent_report_id IS NOT NULL;

-- Create index for latest versions
CREATE INDEX IF NOT EXISTS idx_generated_reports_latest 
  ON generated_reports(is_latest) 
  WHERE is_latest = true;
