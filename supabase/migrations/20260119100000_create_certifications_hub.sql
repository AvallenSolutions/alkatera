-- ============================================================================
-- CERTIFICATIONS HUB
-- ============================================================================
-- CRITICAL: This module has READ-ONLY access to data from all other modules.
-- It NEVER modifies data in other modules.
--
-- Priority order: B Corp > CSRD > SBTi > GRI
--
-- Supports:
--   - B Corp 2.1 certification readiness
--   - CSRD ESRS compliance tracking
--   - SBTi target alignment
--   - GRI Standards reporting
-- ============================================================================

-- ============================================================================
-- CERTIFICATION FRAMEWORKS
-- Master list of supported certification frameworks
-- ============================================================================

CREATE TABLE IF NOT EXISTS certification_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Framework identification
  framework_code VARCHAR(50) NOT NULL UNIQUE, -- bcorp_21, csrd, sbti, gri
  framework_name VARCHAR(255) NOT NULL,
  framework_version VARCHAR(50),

  -- Description
  description TEXT,
  governing_body VARCHAR(255),
  website_url TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,
  effective_date DATE,

  -- Scoring
  has_scoring BOOLEAN DEFAULT true,
  passing_score DECIMAL(5,2), -- e.g., 80 for B Corp

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- FRAMEWORK REQUIREMENTS
-- Detailed requirements for each framework
-- ============================================================================

CREATE TABLE IF NOT EXISTS framework_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id UUID NOT NULL REFERENCES certification_frameworks(id) ON DELETE CASCADE,

  -- Requirement identification
  requirement_code VARCHAR(100) NOT NULL, -- e.g., "GOV-1", "ESRS-S1-1"
  requirement_name VARCHAR(255) NOT NULL,
  requirement_category VARCHAR(100), -- governance, workers, community, environment, customers

  -- Hierarchy
  parent_requirement_id UUID REFERENCES framework_requirements(id),
  section VARCHAR(100),
  subsection VARCHAR(100),
  order_index INTEGER,

  -- Description
  description TEXT,
  guidance TEXT,
  examples TEXT,

  -- Scoring
  max_points DECIMAL(5,2),
  is_mandatory BOOLEAN DEFAULT false,
  is_conditional BOOLEAN DEFAULT false,
  conditional_logic TEXT,

  -- Data requirements
  required_data_sources TEXT[], -- e.g., ['people_culture', 'governance', 'environmental']
  evidence_requirements TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(framework_id, requirement_code)
);

-- ============================================================================
-- ORGANIZATION CERTIFICATIONS
-- Track organization's certification status
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  framework_id UUID NOT NULL REFERENCES certification_frameworks(id),

  -- Certification status
  status VARCHAR(50) DEFAULT 'not_started', -- not_started, in_progress, submitted, certified, expired
  target_date DATE,

  -- Current certification (if certified)
  certification_number VARCHAR(255),
  certified_date DATE,
  expiry_date DATE,
  score_achieved DECIMAL(5,2),

  -- Progress tracking
  readiness_score DECIMAL(5,2),
  data_completeness DECIMAL(5,2),
  last_assessment_date DATE,

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(organization_id, framework_id)
);

-- ============================================================================
-- GAP ANALYSES
-- Track gap analysis results for each requirement
-- ============================================================================

CREATE TABLE IF NOT EXISTS certification_gap_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  framework_id UUID NOT NULL REFERENCES certification_frameworks(id),
  requirement_id UUID NOT NULL REFERENCES framework_requirements(id),

  -- Analysis details
  analysis_date DATE NOT NULL,
  analyzed_by VARCHAR(255),

  -- Status
  compliance_status VARCHAR(50) NOT NULL, -- compliant, partial, non_compliant, not_applicable, not_assessed
  confidence_level VARCHAR(50), -- high, medium, low

  -- Scoring
  current_score DECIMAL(5,2),
  target_score DECIMAL(5,2),
  gap_points DECIMAL(5,2),

  -- Findings
  current_state TEXT,
  required_state TEXT,
  gap_description TEXT,

  -- Actions
  remediation_actions TEXT,
  estimated_effort VARCHAR(50), -- low, medium, high
  priority VARCHAR(50), -- critical, high, medium, low
  target_completion_date DATE,
  owner VARCHAR(255),

  -- Data sources used
  data_sources_checked TEXT[],
  data_quality VARCHAR(50), -- excellent, good, fair, poor

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- EVIDENCE LINKS
-- Link evidence from other modules to requirements
-- ============================================================================

CREATE TABLE IF NOT EXISTS certification_evidence_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL REFERENCES framework_requirements(id),

  -- Source reference (READ-ONLY pointers to other modules)
  source_module VARCHAR(100) NOT NULL, -- people_culture, governance, community_impact, environmental, supply_chain
  source_table VARCHAR(100) NOT NULL,
  source_record_id UUID NOT NULL,

  -- Evidence details
  evidence_type VARCHAR(100), -- metric, policy, record, document, certification
  evidence_description TEXT,
  evidence_date DATE,

  -- Relevance
  relevance_notes TEXT,
  covers_requirement BOOLEAN DEFAULT false,

  -- Verification
  verified_by VARCHAR(255),
  verified_date DATE,
  verification_notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(organization_id, requirement_id, source_module, source_table, source_record_id)
);

-- ============================================================================
-- AUDIT PACKAGES
-- Pre-built packages for certification audits
-- ============================================================================

CREATE TABLE IF NOT EXISTS certification_audit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  framework_id UUID NOT NULL REFERENCES certification_frameworks(id),

  -- Package details
  package_name VARCHAR(255) NOT NULL,
  package_type VARCHAR(100), -- full_assessment, partial_update, annual_review
  description TEXT,

  -- Timeline
  created_date DATE NOT NULL,
  submission_deadline DATE,
  submitted_date DATE,

  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- draft, in_review, submitted, accepted, rejected
  review_notes TEXT,

  -- Content
  included_requirements UUID[], -- Array of requirement IDs
  included_evidence UUID[], -- Array of evidence link IDs
  executive_summary TEXT,
  methodology TEXT,

  -- Generated files
  generated_documents JSONB, -- Array of {name, url, generated_at}

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- CERTIFICATION SCORES HISTORY
-- Track certification readiness scores over time
-- ============================================================================

CREATE TABLE IF NOT EXISTS certification_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  framework_id UUID NOT NULL REFERENCES certification_frameworks(id),

  -- Score details
  score_date DATE NOT NULL,
  overall_score DECIMAL(5,2),

  -- Category scores
  category_scores JSONB, -- {category: score} object

  -- Progress
  requirements_met INTEGER,
  requirements_partial INTEGER,
  requirements_not_met INTEGER,
  total_requirements INTEGER,

  -- Data quality
  data_completeness DECIMAL(5,2),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_framework_requirements_framework ON framework_requirements(framework_id);
CREATE INDEX IF NOT EXISTS idx_framework_requirements_parent ON framework_requirements(parent_requirement_id);
CREATE INDEX IF NOT EXISTS idx_framework_requirements_category ON framework_requirements(requirement_category);

CREATE INDEX IF NOT EXISTS idx_org_certifications_org ON organization_certifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_certifications_framework ON organization_certifications(framework_id);
CREATE INDEX IF NOT EXISTS idx_org_certifications_status ON organization_certifications(status);

CREATE INDEX IF NOT EXISTS idx_gap_analyses_org ON certification_gap_analyses(organization_id);
CREATE INDEX IF NOT EXISTS idx_gap_analyses_framework ON certification_gap_analyses(framework_id);
CREATE INDEX IF NOT EXISTS idx_gap_analyses_requirement ON certification_gap_analyses(requirement_id);
CREATE INDEX IF NOT EXISTS idx_gap_analyses_status ON certification_gap_analyses(compliance_status);

CREATE INDEX IF NOT EXISTS idx_evidence_links_org ON certification_evidence_links(organization_id);
CREATE INDEX IF NOT EXISTS idx_evidence_links_requirement ON certification_evidence_links(requirement_id);
CREATE INDEX IF NOT EXISTS idx_evidence_links_source ON certification_evidence_links(source_module, source_table);

CREATE INDEX IF NOT EXISTS idx_audit_packages_org ON certification_audit_packages(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_packages_framework ON certification_audit_packages(framework_id);
CREATE INDEX IF NOT EXISTS idx_audit_packages_status ON certification_audit_packages(status);

CREATE INDEX IF NOT EXISTS idx_cert_score_history_org ON certification_score_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_cert_score_history_framework ON certification_score_history(framework_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE certification_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE framework_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE certification_gap_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE certification_evidence_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE certification_audit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE certification_score_history ENABLE ROW LEVEL SECURITY;

-- Frameworks and requirements are public read
CREATE POLICY "frameworks_public_read" ON certification_frameworks
  FOR SELECT USING (true);
CREATE POLICY "requirements_public_read" ON framework_requirements
  FOR SELECT USING (true);

-- Organization-specific data
CREATE POLICY "org_certifications_select" ON organization_certifications
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "org_certifications_insert" ON organization_certifications
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "org_certifications_update" ON organization_certifications
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "gap_analyses_select" ON certification_gap_analyses
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "gap_analyses_insert" ON certification_gap_analyses
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "gap_analyses_update" ON certification_gap_analyses
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "gap_analyses_delete" ON certification_gap_analyses
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "evidence_links_select" ON certification_evidence_links
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "evidence_links_insert" ON certification_evidence_links
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "evidence_links_update" ON certification_evidence_links
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "evidence_links_delete" ON certification_evidence_links
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "audit_packages_select" ON certification_audit_packages
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "audit_packages_insert" ON certification_audit_packages
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "audit_packages_update" ON certification_audit_packages
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "audit_packages_delete" ON certification_audit_packages
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "cert_score_history_select" ON certification_score_history
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "cert_score_history_insert" ON certification_score_history
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- ============================================================================
-- SEED DATA: CERTIFICATION FRAMEWORKS
-- ============================================================================

INSERT INTO certification_frameworks (framework_code, framework_name, framework_version, description, governing_body, website_url, passing_score)
VALUES
  ('bcorp_21', 'B Corp Certification', '2.1', 'B Corp certification for businesses meeting the highest standards of verified social and environmental performance, public transparency, and legal accountability.', 'B Lab', 'https://www.bcorporation.net/', 80),
  ('csrd', 'Corporate Sustainability Reporting Directive', '2024', 'EU directive requiring large companies to disclose information on sustainability matters including environmental, social, and governance topics.', 'European Commission', 'https://finance.ec.europa.eu/capital-markets-union-and-financial-markets/company-reporting-and-auditing/company-reporting/corporate-sustainability-reporting_en', NULL),
  ('sbti', 'Science Based Targets initiative', '2.0', 'Framework for setting corporate emission reduction targets in line with climate science.', 'SBTi', 'https://sciencebasedtargets.org/', NULL),
  ('gri', 'Global Reporting Initiative Standards', '2021', 'Global standards for sustainability reporting covering economic, environmental, and social impacts.', 'GRI', 'https://www.globalreporting.org/', NULL)
ON CONFLICT (framework_code) DO NOTHING;

-- ============================================================================
-- SEED DATA: B CORP REQUIREMENTS (SIMPLIFIED STRUCTURE)
-- ============================================================================

-- Get B Corp framework ID for seeding requirements
DO $$
DECLARE
  bcorp_id UUID;
BEGIN
  SELECT id INTO bcorp_id FROM certification_frameworks WHERE framework_code = 'bcorp_21';

  IF bcorp_id IS NOT NULL THEN
    -- Governance category
    INSERT INTO framework_requirements (framework_id, requirement_code, requirement_name, requirement_category, description, max_points, is_mandatory, required_data_sources)
    VALUES
      (bcorp_id, 'GOV-MISSION', 'Mission & Engagement', 'governance', 'Mission statement, stakeholder consideration in governance', 8, false, ARRAY['governance']),
      (bcorp_id, 'GOV-ETHICS', 'Ethics & Transparency', 'governance', 'Code of ethics, anti-corruption policies, financial transparency', 6, false, ARRAY['governance']),
      (bcorp_id, 'GOV-STRUCTURE', 'Corporate Structure', 'governance', 'Benefit corporation status, stakeholder governance', 4, false, ARRAY['governance'])
    ON CONFLICT (framework_id, requirement_code) DO NOTHING;

    -- Workers category
    INSERT INTO framework_requirements (framework_id, requirement_code, requirement_name, requirement_category, description, max_points, is_mandatory, required_data_sources)
    VALUES
      (bcorp_id, 'WRK-COMP', 'Compensation & Benefits', 'workers', 'Living wage, benefits, pay equity', 12, false, ARRAY['people_culture']),
      (bcorp_id, 'WRK-DEV', 'Training & Development', 'workers', 'Professional development, skills training', 8, false, ARRAY['people_culture']),
      (bcorp_id, 'WRK-ENGAGE', 'Worker Engagement', 'workers', 'Satisfaction surveys, engagement programs', 6, false, ARRAY['people_culture']),
      (bcorp_id, 'WRK-HEALTH', 'Health & Safety', 'workers', 'Workplace safety, wellness programs', 6, false, ARRAY['people_culture'])
    ON CONFLICT (framework_id, requirement_code) DO NOTHING;

    -- Community category
    INSERT INTO framework_requirements (framework_id, requirement_code, requirement_name, requirement_category, description, max_points, is_mandatory, required_data_sources)
    VALUES
      (bcorp_id, 'COM-GIVING', 'Civic Engagement & Giving', 'community', 'Charitable donations, volunteering', 10, false, ARRAY['community_impact']),
      (bcorp_id, 'COM-LOCAL', 'Local Involvement', 'community', 'Local sourcing, employment, economic impact', 8, false, ARRAY['community_impact']),
      (bcorp_id, 'COM-DIVERSITY', 'Diversity, Equity & Inclusion', 'community', 'DEI policies, diverse representation', 10, false, ARRAY['people_culture'])
    ON CONFLICT (framework_id, requirement_code) DO NOTHING;

    -- Environment category
    INSERT INTO framework_requirements (framework_id, requirement_code, requirement_name, requirement_category, description, max_points, is_mandatory, required_data_sources)
    VALUES
      (bcorp_id, 'ENV-CLIMATE', 'Climate Action', 'environment', 'GHG emissions measurement and reduction', 15, false, ARRAY['environmental']),
      (bcorp_id, 'ENV-WASTE', 'Waste Management', 'environment', 'Waste reduction and circularity', 8, false, ARRAY['environmental']),
      (bcorp_id, 'ENV-WATER', 'Water Stewardship', 'environment', 'Water usage and conservation', 6, false, ARRAY['environmental']),
      (bcorp_id, 'ENV-NATURE', 'Land & Nature', 'environment', 'Biodiversity, land use impact', 6, false, ARRAY['environmental'])
    ON CONFLICT (framework_id, requirement_code) DO NOTHING;

    -- Customers category
    INSERT INTO framework_requirements (framework_id, requirement_code, requirement_name, requirement_category, description, max_points, is_mandatory, required_data_sources)
    VALUES
      (bcorp_id, 'CUS-IMPACT', 'Customer Impact', 'customers', 'Products/services that create positive impact', 10, false, ARRAY['products']),
      (bcorp_id, 'CUS-PRIVACY', 'Data Privacy & Security', 'customers', 'Customer data protection', 4, false, ARRAY['governance'])
    ON CONFLICT (framework_id, requirement_code) DO NOTHING;
  END IF;
END $$;
