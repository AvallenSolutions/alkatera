/*
  # Create Sustainability Reports System

  1. New Tables
    - `generated_reports` - Stores sustainability report configurations and metadata
      - Uses organization_members table for RLS (not active_organization_id)

  2. Security
    - Enable RLS on generated_reports table
    - Users can only access reports for organizations they're members of
    - Created_by field tracks report creator

  3. Features
    - Tracks report configuration (audience, format, standards, sections)
    - Stores branding (logo, colors)
    - Tracks generation status (pending, generating, completed, failed)
    - Stores Skywork API query and document URL
    - Data snapshot for audit trail
*/

-- Main reports table
CREATE TABLE IF NOT EXISTS generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),

  -- Report metadata
  report_name TEXT NOT NULL,
  report_year INTEGER NOT NULL,
  reporting_period_start DATE NOT NULL,
  reporting_period_end DATE NOT NULL,

  -- Configuration
  config JSONB NOT NULL DEFAULT '{}',
  audience TEXT NOT NULL CHECK (audience IN (
    'investors',
    'regulators',
    'customers',
    'internal',
    'supply-chain',
    'technical'
  )),
  output_format TEXT NOT NULL DEFAULT 'pptx' CHECK (output_format IN ('docx', 'xlsx', 'pptx')),
  standards TEXT[] NOT NULL DEFAULT ARRAY['csrd', 'iso-14067'],
  sections TEXT[] NOT NULL DEFAULT '{}',

  -- Branding
  logo_url TEXT,
  primary_color TEXT DEFAULT '#2563eb',
  secondary_color TEXT DEFAULT '#10b981',

  -- Generation status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  skywork_query TEXT,
  document_url TEXT,
  error_message TEXT,

  -- Data snapshot (for audit trail)
  data_snapshot JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_at TIMESTAMPTZ,
  downloaded_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_generated_reports_org_id ON generated_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_org_year ON generated_reports(organization_id, report_year DESC);
CREATE INDEX IF NOT EXISTS idx_generated_reports_status ON generated_reports(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_generated_reports_created_by ON generated_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_generated_reports_created_at ON generated_reports(created_at DESC);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_generated_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_generated_reports_updated_at
  BEFORE UPDATE ON generated_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_generated_reports_updated_at();

-- Row Level Security (RLS)
ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;

-- Users can view reports from organizations they belong to
CREATE POLICY "Users can view their organization's reports"
  ON generated_reports FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Users can create reports for organizations they belong to
CREATE POLICY "Users can create reports for their organization"
  ON generated_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Users can update reports from their organizations
CREATE POLICY "Users can update their organization's reports"
  ON generated_reports FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Users can delete reports from their organizations
CREATE POLICY "Users can delete their organization's reports"
  ON generated_reports FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Create a view for report statistics
CREATE OR REPLACE VIEW report_statistics AS
SELECT
  organization_id,
  COUNT(*) as total_reports,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_reports,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_reports,
  COUNT(*) FILTER (WHERE status = 'generating') as generating_reports,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_reports,
  COUNT(*) FILTER (WHERE output_format = 'pptx') as pptx_count,
  COUNT(*) FILTER (WHERE output_format = 'docx') as docx_count,
  COUNT(*) FILTER (WHERE output_format = 'xlsx') as xlsx_count,
  MAX(created_at) as last_report_created_at
FROM generated_reports
GROUP BY organization_id;

-- Grant access to the view
GRANT SELECT ON report_statistics TO authenticated;

-- Add helpful comments
COMMENT ON TABLE generated_reports IS 'Stores configuration and metadata for AI-generated sustainability reports using Skywork API';
COMMENT ON COLUMN generated_reports.data_snapshot IS 'Complete snapshot of data used in report generation for audit trail and CSRD compliance';
COMMENT ON COLUMN generated_reports.skywork_query IS 'Exact query sent to Skywork API for reproducibility and debugging';
