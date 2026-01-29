/*
  # Create LCA Reports Tables

  1. New Tables
    - `lca_reports`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `product_id` (bigint, foreign key to products) - matches products table type
      - `title` (text) - Report title (e.g., "2025 Impact Assessment")
      - `version` (text) - Report version (e.g., "1.0")
      - `status` (enum) - Draft, Published, Verified
      - `dqi_score` (float) - Data Quality Index (0-100)
      - `system_boundary` (text) - E.g., "Cradle-to-Gate"
      - `functional_unit` (text) - E.g., "1 unit of product"
      - `assessment_period_start` (date)
      - `assessment_period_end` (date)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `published_at` (timestamptz)

    - `lca_social_indicators` (Future-proofing for S-LCA)
      - `id` (uuid, primary key)
      - `report_id` (uuid, foreign key to lca_reports)
      - `indicator_name` (text) - E.g., "Labor Rights", "Fair Wage"
      - `category` (text) - E.g., "Workers", "Community", "Society"
      - `score` (float) - Normalized score
      - `risk_level` (enum) - Low, Medium, High, Critical
      - `evidence` (jsonb) - Supporting data
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their organization's reports
*/

-- Create report status enum
DO $$ BEGIN
  CREATE TYPE lca_report_status AS ENUM ('draft', 'published', 'verified');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create social indicator risk level enum
DO $$ BEGIN
  CREATE TYPE social_risk_level AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create lca_reports table
CREATE TABLE IF NOT EXISTS lca_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id bigint REFERENCES products(id) ON DELETE CASCADE,
  title text NOT NULL,
  version text NOT NULL DEFAULT '1.0',
  status lca_report_status NOT NULL DEFAULT 'draft',
  dqi_score float,
  system_boundary text DEFAULT 'Cradle-to-Gate',
  functional_unit text DEFAULT '1 unit',
  assessment_period_start date,
  assessment_period_end date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  published_at timestamptz,

  CONSTRAINT valid_dqi_score CHECK (dqi_score IS NULL OR (dqi_score >= 0 AND dqi_score <= 100))
);

-- Ensure product_id column exists (table may have been created by earlier migration without it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lca_reports'
      AND column_name = 'product_id'
  ) THEN
    ALTER TABLE lca_reports ADD COLUMN product_id uuid REFERENCES products(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure other columns exist that earlier migration may not have
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lca_reports'
      AND column_name = 'title'
  ) THEN
    ALTER TABLE lca_reports ADD COLUMN title text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lca_reports'
      AND column_name = 'version'
  ) THEN
    ALTER TABLE lca_reports ADD COLUMN version text NOT NULL DEFAULT '1.0';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lca_reports'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE lca_reports ADD COLUMN status lca_report_status NOT NULL DEFAULT 'draft';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lca_reports'
      AND column_name = 'dqi_score'
  ) THEN
    ALTER TABLE lca_reports ADD COLUMN dqi_score float;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lca_reports'
      AND column_name = 'system_boundary'
  ) THEN
    ALTER TABLE lca_reports ADD COLUMN system_boundary text DEFAULT 'Cradle-to-Gate';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lca_reports'
      AND column_name = 'functional_unit'
  ) THEN
    ALTER TABLE lca_reports ADD COLUMN functional_unit text DEFAULT '1 unit';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lca_reports'
      AND column_name = 'assessment_period_start'
  ) THEN
    ALTER TABLE lca_reports ADD COLUMN assessment_period_start date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lca_reports'
      AND column_name = 'assessment_period_end'
  ) THEN
    ALTER TABLE lca_reports ADD COLUMN assessment_period_end date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lca_reports'
      AND column_name = 'published_at'
  ) THEN
    ALTER TABLE lca_reports ADD COLUMN published_at timestamptz;
  END IF;
END $$;

-- Create index for lookups
CREATE INDEX IF NOT EXISTS idx_lca_reports_organization_id ON lca_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_lca_reports_product_id ON lca_reports(product_id);
CREATE INDEX IF NOT EXISTS idx_lca_reports_status ON lca_reports(status);

-- Create lca_social_indicators table
CREATE TABLE IF NOT EXISTS lca_social_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES lca_reports(id) ON DELETE CASCADE,
  indicator_name text NOT NULL,
  category text,
  score float,
  risk_level social_risk_level,
  evidence jsonb,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT valid_score CHECK (score IS NULL OR score >= 0)
);

-- Create index for lookups
CREATE INDEX IF NOT EXISTS idx_lca_social_indicators_report_id ON lca_social_indicators(report_id);
CREATE INDEX IF NOT EXISTS idx_lca_social_indicators_risk_level ON lca_social_indicators(risk_level);

-- Enable Row Level Security
ALTER TABLE lca_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE lca_social_indicators ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their organization's reports" ON lca_reports;
DROP POLICY IF EXISTS "Users can view published reports from any organization" ON lca_reports;
DROP POLICY IF EXISTS "Users can insert reports for their organization" ON lca_reports;
DROP POLICY IF EXISTS "Users can update their organization's reports" ON lca_reports;
DROP POLICY IF EXISTS "Users can delete their organization's reports" ON lca_reports;

-- Policies for lca_reports
CREATE POLICY "Users can view their organization's reports"
  ON lca_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = lca_reports.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view published reports from any organization"
  ON lca_reports FOR SELECT
  TO authenticated
  USING (status = 'published' OR status = 'verified');

CREATE POLICY "Users can insert reports for their organization"
  ON lca_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = lca_reports.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their organization's reports"
  ON lca_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = lca_reports.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their organization's reports"
  ON lca_reports FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = lca_reports.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Drop existing policies for social indicators if they exist
DROP POLICY IF EXISTS "Users can view social indicators for accessible reports" ON lca_social_indicators;
DROP POLICY IF EXISTS "Users can insert social indicators for their organization's reports" ON lca_social_indicators;
DROP POLICY IF EXISTS "Users can update social indicators for their organization's reports" ON lca_social_indicators;
DROP POLICY IF EXISTS "Users can delete social indicators for their organization's reports" ON lca_social_indicators;

-- Policies for lca_social_indicators
CREATE POLICY "Users can view social indicators for accessible reports"
  ON lca_social_indicators FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lca_reports
      INNER JOIN organization_members ON organization_members.organization_id = lca_reports.organization_id
      WHERE lca_reports.id = lca_social_indicators.report_id
      AND organization_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM lca_reports
      WHERE lca_reports.id = lca_social_indicators.report_id
      AND (lca_reports.status = 'published' OR lca_reports.status = 'verified')
    )
  );

CREATE POLICY "Users can insert social indicators for their organization's reports"
  ON lca_social_indicators FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lca_reports
      INNER JOIN organization_members ON organization_members.organization_id = lca_reports.organization_id
      WHERE lca_reports.id = lca_social_indicators.report_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update social indicators for their organization's reports"
  ON lca_social_indicators FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lca_reports
      INNER JOIN organization_members ON organization_members.organization_id = lca_reports.organization_id
      WHERE lca_reports.id = lca_social_indicators.report_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete social indicators for their organization's reports"
  ON lca_social_indicators FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lca_reports
      INNER JOIN organization_members ON organization_members.organization_id = lca_reports.organization_id
      WHERE lca_reports.id = lca_social_indicators.report_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Add updated_at trigger for lca_reports
CREATE OR REPLACE FUNCTION update_lca_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_lca_reports_updated_at ON lca_reports;

CREATE TRIGGER trigger_update_lca_reports_updated_at
  BEFORE UPDATE ON lca_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_lca_reports_updated_at();
