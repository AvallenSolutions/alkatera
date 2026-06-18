-- ISO 14044:2006 Compliance Migration
-- Adds Life Cycle Interpretation, Critical Review, and Goal & Scope enhancements

-- ============================================================================
-- 1. Goal & Scope enhancements on product_carbon_footprints
-- ============================================================================
ALTER TABLE product_carbon_footprints
  ADD COLUMN IF NOT EXISTS intended_application TEXT,
  ADD COLUMN IF NOT EXISTS reasons_for_study TEXT,
  ADD COLUMN IF NOT EXISTS intended_audience TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_comparative_assertion BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS assumptions_limitations JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS data_quality_requirements JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS critical_review_type VARCHAR(50) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS critical_review_justification TEXT;

-- ============================================================================
-- 2. Life Cycle Interpretation results
-- ============================================================================
CREATE TABLE IF NOT EXISTS lca_interpretation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_carbon_footprint_id UUID NOT NULL REFERENCES product_carbon_footprints(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,

  -- Contribution analysis
  contribution_analysis JSONB NOT NULL DEFAULT '{}',
  significant_issues TEXT[] DEFAULT '{}',

  -- Completeness check
  completeness_score DECIMAL(5,2),
  missing_data_flags JSONB DEFAULT '{}',
  data_coverage_by_stage JSONB DEFAULT '{}',

  -- Sensitivity analysis
  sensitivity_results JSONB DEFAULT '[]',
  highly_sensitive_parameters TEXT[] DEFAULT '{}',

  -- Consistency check
  consistency_issues TEXT[] DEFAULT '{}',
  methodology_consistent BOOLEAN DEFAULT TRUE,
  temporal_consistency JSONB DEFAULT '{}',
  geographic_consistency JSONB DEFAULT '{}',

  -- Conclusions
  key_findings TEXT[] DEFAULT '{}',
  limitations TEXT[] DEFAULT '{}',
  recommendations TEXT[] DEFAULT '{}',
  uncertainty_statement TEXT,

  -- Mass balance validation
  mass_balance_input_kg DECIMAL(12,6),
  mass_balance_output_kg DECIMAL(12,6),
  mass_balance_variance_pct DECIMAL(5,2),
  mass_balance_valid BOOLEAN,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lca_interpretation_pcf_id ON lca_interpretation_results(product_carbon_footprint_id);

-- ============================================================================
-- 3. Critical Review records
-- ============================================================================
CREATE TABLE IF NOT EXISTS lca_critical_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_carbon_footprint_id UUID NOT NULL REFERENCES product_carbon_footprints(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  review_type VARCHAR(50) NOT NULL CHECK (review_type IN ('internal', 'external_expert', 'external_panel')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'revision_required', 'approved', 'published')),
  review_start_date TIMESTAMPTZ,
  review_end_date TIMESTAMPTZ,
  reviewer_statement TEXT,
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lca_reviews_pcf_id ON lca_critical_reviews(product_carbon_footprint_id);

-- ============================================================================
-- 4. Critical Reviewers
-- ============================================================================
CREATE TABLE IF NOT EXISTS lca_reviewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES lca_critical_reviews(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  organisation VARCHAR(255),
  qualifications TEXT[] DEFAULT '{}',
  reviewer_type VARCHAR(50) CHECK (reviewer_type IN ('internal', 'external_expert', 'panel_chair', 'panel_member')),
  independence_declared BOOLEAN DEFAULT FALSE,
  conflict_of_interest_statement TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lca_reviewers_review_id ON lca_reviewers(review_id);

-- ============================================================================
-- 5. Review Comments
-- ============================================================================
CREATE TABLE IF NOT EXISTS lca_review_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES lca_critical_reviews(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES lca_reviewers(id) ON DELETE SET NULL,
  section VARCHAR(100) NOT NULL,
  comment TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'minor' CHECK (severity IN ('minor', 'major', 'critical')),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'addressed', 'rejected')),
  response TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lca_comments_review_id ON lca_review_comments(review_id);

-- ============================================================================
-- 6. RLS Policies
-- ============================================================================

-- lca_interpretation_results
ALTER TABLE lca_interpretation_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view interpretation results for their org"
  ON lca_interpretation_results FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert interpretation results for their org"
  ON lca_interpretation_results FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update interpretation results for their org"
  ON lca_interpretation_results FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete interpretation results for their org"
  ON lca_interpretation_results FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- lca_critical_reviews
ALTER TABLE lca_critical_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reviews for their org"
  ON lca_critical_reviews FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert reviews for their org"
  ON lca_critical_reviews FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update reviews for their org"
  ON lca_critical_reviews FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete reviews for their org"
  ON lca_critical_reviews FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- lca_reviewers
ALTER TABLE lca_reviewers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage reviewers via review org"
  ON lca_reviewers FOR ALL
  USING (review_id IN (
    SELECT id FROM lca_critical_reviews WHERE organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  ));

-- lca_review_comments
ALTER TABLE lca_review_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage comments via review org"
  ON lca_review_comments FOR ALL
  USING (review_id IN (
    SELECT id FROM lca_critical_reviews WHERE organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  ));

-- ============================================================================
-- 7. Update PCF status enum to include review states
-- ============================================================================
-- Add new status values for the review workflow
-- The existing status column is text-based, so no enum alteration needed
-- Valid statuses: draft, pending, completed, failed, ready_for_review, under_review, revision_required, approved, published
