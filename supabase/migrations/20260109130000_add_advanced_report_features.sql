-- Add advanced features to sustainability reports system
-- Features: Versioning, Reviews, Templates, Data Gaps, Multi-year trends

-- ============================================
-- 1. REPORT VERSIONING & CHANGELOG
-- ============================================

-- Add versioning fields to generated_reports
ALTER TABLE generated_reports
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_latest BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS parent_report_id UUID REFERENCES generated_reports(id),
ADD COLUMN IF NOT EXISTS changelog TEXT;

-- Create index for version queries
CREATE INDEX IF NOT EXISTS idx_generated_reports_version ON generated_reports(parent_report_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_generated_reports_latest ON generated_reports(is_latest) WHERE is_latest = true;

-- Report version history table
CREATE TABLE IF NOT EXISTS report_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES generated_reports(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  changed_by UUID NOT NULL REFERENCES profiles(id),
  changelog TEXT NOT NULL,
  config_snapshot JSONB NOT NULL,
  data_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(report_id, version)
);

CREATE INDEX idx_report_versions_report ON report_versions(report_id, version DESC);

-- ============================================
-- 2. COLLABORATIVE REVIEW WORKFLOW
-- ============================================

CREATE TABLE IF NOT EXISTS report_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES generated_reports(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id),
  reviewer_email TEXT NOT NULL,
  reviewer_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  comments TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_reviews_report ON report_reviews(report_id);
CREATE INDEX idx_report_reviews_reviewer ON report_reviews(reviewer_id);
CREATE INDEX idx_report_reviews_status ON report_reviews(status) WHERE status = 'pending';

-- Review comments (threaded)
CREATE TABLE IF NOT EXISTS report_review_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES report_reviews(id) ON DELETE CASCADE,
  commenter_id UUID NOT NULL REFERENCES profiles(id),
  section_id TEXT,
  comment_text TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT false,
  parent_comment_id UUID REFERENCES report_review_comments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_comments_review ON report_review_comments(review_id);
CREATE INDEX idx_review_comments_section ON report_review_comments(section_id);

-- ============================================
-- 3. REPORT TEMPLATES
-- ============================================

CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL CHECK (template_type IN ('system', 'organization', 'personal')),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id),
  config JSONB NOT NULL,
  is_public BOOLEAN DEFAULT false,
  download_count INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  industry TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_templates_type ON report_templates(template_type);
CREATE INDEX idx_report_templates_org ON report_templates(organization_id);
CREATE INDEX idx_report_templates_public ON report_templates(is_public) WHERE is_public = true;
CREATE INDEX idx_report_templates_tags ON report_templates USING GIN(tags);

-- ============================================
-- 4. DATA GAP TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS data_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  gap_type TEXT NOT NULL CHECK (gap_type IN ('scope_1', 'scope_2', 'scope_3', 'product_lca', 'facility', 'supplier', 'other')),
  section_id TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  impact_on_reporting TEXT,
  data_required TEXT,
  fill_url TEXT,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_data_gaps_org ON data_gaps(organization_id);
CREATE INDEX idx_data_gaps_unresolved ON data_gaps(is_resolved) WHERE is_resolved = false;
CREATE INDEX idx_data_gaps_severity ON data_gaps(severity);

-- ============================================
-- 5. MULTI-YEAR REPORTING
-- ============================================

ALTER TABLE generated_reports
ADD COLUMN IF NOT EXISTS report_years INTEGER[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_multi_year BOOLEAN DEFAULT false;

CREATE INDEX idx_generated_reports_years ON generated_reports USING GIN(report_years);

-- ============================================
-- 6. DATA QUALITY METRICS
-- ============================================

CREATE TABLE IF NOT EXISTS report_data_quality (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES generated_reports(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  data_completeness DECIMAL(5,2) NOT NULL, -- 0-100%
  data_quality_tier TEXT NOT NULL CHECK (data_quality_tier IN ('tier_1', 'tier_2', 'tier_3', 'mixed')),
  confidence_score DECIMAL(5,2), -- 0-100%
  missing_data_points TEXT[],
  recommendation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_data_quality_report ON report_data_quality(report_id);

-- ============================================
-- 7. INDUSTRY BENCHMARKS (Initial data)
-- ============================================

CREATE TABLE IF NOT EXISTS industry_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value DECIMAL(15,4) NOT NULL,
  unit TEXT NOT NULL,
  percentile TEXT NOT NULL CHECK (percentile IN ('average', 'top_quartile', 'bottom_quartile', 'median')),
  year INTEGER NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(industry, metric_name, percentile, year)
);

CREATE INDEX idx_industry_benchmarks_industry ON industry_benchmarks(industry, year);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Report versions
ALTER TABLE report_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view versions of their org's reports"
  ON report_versions FOR SELECT
  USING (
    report_id IN (
      SELECT id FROM generated_reports
      WHERE organization_id IN (
        SELECT active_organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Report reviews
ALTER TABLE report_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reviews of their org's reports"
  ON report_reviews FOR SELECT
  USING (
    report_id IN (
      SELECT id FROM generated_reports
      WHERE organization_id IN (
        SELECT active_organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create reviews"
  ON report_reviews FOR INSERT
  WITH CHECK (
    report_id IN (
      SELECT id FROM generated_reports
      WHERE organization_id IN (
        SELECT active_organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own reviews"
  ON report_reviews FOR UPDATE
  USING (reviewer_id = auth.uid());

-- Review comments
ALTER TABLE report_review_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments on their org's reviews"
  ON report_review_comments FOR SELECT
  USING (
    review_id IN (SELECT id FROM report_reviews WHERE report_id IN (
      SELECT id FROM generated_reports
      WHERE organization_id IN (
        SELECT active_organization_id FROM profiles WHERE id = auth.uid()
      )
    ))
  );

CREATE POLICY "Users can create comments"
  ON report_review_comments FOR INSERT
  WITH CHECK (commenter_id = auth.uid());

-- Templates
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view public templates"
  ON report_templates FOR SELECT
  USING (is_public = true OR template_type = 'system');

CREATE POLICY "Users can view their org's templates"
  ON report_templates FOR SELECT
  USING (
    organization_id IN (
      SELECT active_organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create org templates"
  ON report_templates FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT active_organization_id FROM profiles WHERE id = auth.uid()
    ) AND created_by = auth.uid()
  );

-- Data gaps
ALTER TABLE data_gaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's data gaps"
  ON data_gaps FOR SELECT
  USING (
    organization_id IN (
      SELECT active_organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "System can insert data gaps"
  ON data_gaps FOR INSERT
  WITH CHECK (true); -- Edge functions can insert

-- Report data quality
ALTER TABLE report_data_quality ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their report quality metrics"
  ON report_data_quality FOR SELECT
  USING (
    report_id IN (
      SELECT id FROM generated_reports
      WHERE organization_id IN (
        SELECT active_organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Industry benchmarks
ALTER TABLE industry_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view benchmarks"
  ON industry_benchmarks FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to create a new report version
CREATE OR REPLACE FUNCTION create_report_version(
  p_report_id UUID,
  p_changelog TEXT,
  p_config JSONB
)
RETURNS UUID AS $$
DECLARE
  v_new_version INTEGER;
  v_new_report_id UUID;
  v_org_id UUID;
BEGIN
  -- Get the current max version
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_new_version
  FROM generated_reports
  WHERE id = p_report_id OR parent_report_id = p_report_id;

  -- Get org_id from parent report
  SELECT organization_id INTO v_org_id
  FROM generated_reports
  WHERE id = p_report_id;

  -- Mark all previous versions as not latest
  UPDATE generated_reports
  SET is_latest = false
  WHERE id = p_report_id OR parent_report_id = p_report_id;

  -- Create new report version
  INSERT INTO generated_reports (
    organization_id,
    created_by,
    report_name,
    report_year,
    reporting_period_start,
    reporting_period_end,
    config,
    audience,
    output_format,
    standards,
    sections,
    logo_url,
    primary_color,
    secondary_color,
    version,
    is_latest,
    parent_report_id,
    changelog,
    status
  )
  SELECT
    organization_id,
    created_by,
    report_name,
    report_year,
    reporting_period_start,
    reporting_period_end,
    p_config,
    audience,
    output_format,
    standards,
    sections,
    logo_url,
    primary_color,
    secondary_color,
    v_new_version,
    true,
    p_report_id,
    p_changelog,
    'pending'
  FROM generated_reports
  WHERE id = p_report_id
  RETURNING id INTO v_new_report_id;

  RETURN v_new_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate data quality score for a section
CREATE OR REPLACE FUNCTION calculate_section_quality(
  p_org_id UUID,
  p_section_id TEXT,
  p_year INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- This is a simplified version - can be enhanced with actual data checks
  v_result := jsonb_build_object(
    'completeness', 85.0,
    'quality_tier', 'tier_2',
    'confidence', 75.0,
    'recommendation', 'Good data coverage. Consider adding primary data sources.'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments
COMMENT ON TABLE report_versions IS 'Tracks all versions of a report with full configuration snapshots';
COMMENT ON TABLE report_reviews IS 'Collaborative review workflow for reports before generation';
COMMENT ON TABLE report_templates IS 'Pre-built and saved report configurations';
COMMENT ON TABLE data_gaps IS 'Tracks missing data that impacts report completeness';
COMMENT ON TABLE report_data_quality IS 'Quality metrics for each report section';
COMMENT ON TABLE industry_benchmarks IS 'Industry average metrics for benchmarking';
