-- ============================================================================
-- GOVERNANCE & ETHICS MODULE
-- ============================================================================
-- Supports:
--   - B Corp 2.1 Governance requirements
--   - CSRD ESRS G1 (Business Conduct) reporting
--   - Policy management and transparency
-- ============================================================================

-- ============================================================================
-- GOVERNANCE POLICIES
-- Track organizational policies and their versions
-- ============================================================================

CREATE TABLE IF NOT EXISTS governance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Policy identification
  policy_name VARCHAR(255) NOT NULL,
  policy_code VARCHAR(50), -- e.g., POL-001
  policy_type VARCHAR(100) NOT NULL, -- ethics, environmental, social, governance, compliance

  -- Policy details
  description TEXT,
  scope TEXT, -- Who/what the policy applies to
  owner_name VARCHAR(255), -- Policy owner/sponsor
  owner_department VARCHAR(255),

  -- Status tracking
  status VARCHAR(50) DEFAULT 'draft', -- draft, active, under_review, archived
  effective_date DATE,
  review_date DATE, -- Next scheduled review
  last_reviewed_at TIMESTAMPTZ,

  -- Publishing
  is_public BOOLEAN DEFAULT false,
  public_url TEXT,

  -- Compliance mapping
  bcorp_requirement VARCHAR(255), -- Which B Corp requirement this supports
  csrd_requirement VARCHAR(255), -- Which CSRD/ESRS requirement this supports

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- POLICY VERSIONS
-- Track version history for each policy
-- ============================================================================

CREATE TABLE IF NOT EXISTS governance_policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES governance_policies(id) ON DELETE CASCADE,

  -- Version info
  version_number VARCHAR(20) NOT NULL, -- e.g., 1.0, 2.1
  version_date DATE NOT NULL,

  -- Content
  content_summary TEXT, -- Summary of changes
  document_url TEXT, -- Link to full policy document

  -- Approval
  approved_by VARCHAR(255),
  approval_date DATE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- STAKEHOLDERS
-- Track stakeholder engagement and communication
-- ============================================================================

CREATE TABLE IF NOT EXISTS governance_stakeholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Stakeholder identification
  stakeholder_name VARCHAR(255) NOT NULL,
  stakeholder_type VARCHAR(100) NOT NULL, -- employees, customers, suppliers, investors, community, regulators, ngos

  -- Contact info
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_role VARCHAR(255),

  -- Engagement details
  engagement_frequency VARCHAR(50), -- quarterly, monthly, annual, ad_hoc
  engagement_method VARCHAR(100), -- survey, meeting, report, newsletter
  last_engagement_date DATE,
  next_scheduled_engagement DATE,

  -- Relationship
  relationship_quality VARCHAR(50), -- excellent, good, developing, challenging
  key_interests TEXT, -- What matters most to this stakeholder

  -- Impact assessment
  influence_level VARCHAR(50), -- high, medium, low
  impact_level VARCHAR(50), -- high, medium, low

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- STAKEHOLDER ENGAGEMENTS
-- Log individual engagement activities
-- ============================================================================

CREATE TABLE IF NOT EXISTS governance_stakeholder_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stakeholder_id UUID NOT NULL REFERENCES governance_stakeholders(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Engagement details
  engagement_date DATE NOT NULL,
  engagement_type VARCHAR(100) NOT NULL, -- meeting, survey, presentation, workshop
  description TEXT,

  -- Participants
  internal_participants TEXT[], -- Names of internal participants
  external_participants INTEGER, -- Number of external participants

  -- Outcomes
  key_topics TEXT[],
  key_outcomes TEXT,
  follow_up_actions TEXT,

  -- Evidence
  evidence_url TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- BOARD COMPOSITION
-- Track board member details for governance reporting
-- ============================================================================

CREATE TABLE IF NOT EXISTS governance_board_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Member identification
  member_name VARCHAR(255) NOT NULL,
  role VARCHAR(100) NOT NULL, -- chair, vice_chair, director, secretary, treasurer
  member_type VARCHAR(100) NOT NULL, -- executive, non_executive, independent

  -- Diversity data
  gender VARCHAR(50),
  age_bracket VARCHAR(50), -- under_30, 30_50, over_50
  ethnicity VARCHAR(100),
  disability_status VARCHAR(50),

  -- Expertise
  expertise_areas TEXT[], -- e.g., ['finance', 'sustainability', 'legal']
  industry_experience TEXT,

  -- Tenure
  appointment_date DATE,
  term_end_date DATE,
  is_current BOOLEAN DEFAULT true,

  -- Committees
  committee_memberships TEXT[], -- e.g., ['audit', 'remuneration', 'sustainability']

  -- Independence
  is_independent BOOLEAN,
  independence_assessment TEXT,

  -- Attendance
  meeting_attendance_rate DECIMAL(5,2), -- percentage

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- MISSION & PURPOSE
-- Track organization's mission, values, and benefit corporation status
-- ============================================================================

CREATE TABLE IF NOT EXISTS governance_mission (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Mission statement
  mission_statement TEXT,
  mission_last_updated DATE,

  -- Vision
  vision_statement TEXT,

  -- Values
  core_values JSONB, -- Array of {name, description}

  -- Purpose
  purpose_statement TEXT,
  purpose_type VARCHAR(100), -- profit, purpose, hybrid

  -- Legal structure
  legal_structure VARCHAR(100), -- ltd, plc, cic, benefit_corp, b_corp
  is_benefit_corporation BOOLEAN DEFAULT false,
  benefit_corp_registration_date DATE,

  -- Articles of association
  articles_include_stakeholder_consideration BOOLEAN,
  articles_last_amended DATE,

  -- Public commitments
  sdg_commitments INTEGER[], -- UN SDG numbers committed to
  climate_commitments TEXT[],

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Single record per organization
  UNIQUE(organization_id)
);

-- ============================================================================
-- LOBBYING & ADVOCACY
-- Track political contributions and lobbying activities
-- ============================================================================

CREATE TABLE IF NOT EXISTS governance_lobbying (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Activity details
  activity_type VARCHAR(100) NOT NULL, -- lobbying, political_contribution, trade_association, advocacy
  activity_name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Timing
  activity_date DATE,
  reporting_period_start DATE,
  reporting_period_end DATE,

  -- Financial
  amount DECIMAL(12,2),
  currency VARCHAR(3) DEFAULT 'GBP',

  -- Target/recipient
  recipient_name VARCHAR(255),
  recipient_type VARCHAR(100), -- politician, party, trade_body, ngo

  -- Topics
  policy_topics TEXT[],

  -- Alignment
  aligned_with_climate_commitments BOOLEAN,
  alignment_notes TEXT,

  -- Transparency
  is_public BOOLEAN DEFAULT false,
  disclosure_url TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- ETHICS & COMPLIANCE
-- Track ethics training, whistleblowing, and compliance matters
-- ============================================================================

CREATE TABLE IF NOT EXISTS governance_ethics_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Record type
  record_type VARCHAR(100) NOT NULL, -- ethics_training, whistleblowing_case, compliance_audit, incident
  record_name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Dates
  record_date DATE NOT NULL,
  resolution_date DATE,

  -- For training
  participants INTEGER,
  completion_rate DECIMAL(5,2),

  -- For cases/incidents
  severity VARCHAR(50), -- low, medium, high, critical
  status VARCHAR(50), -- open, investigating, resolved, closed
  resolution_summary TEXT,

  -- Outcomes
  corrective_actions TEXT,
  lessons_learned TEXT,

  -- Confidentiality
  is_confidential BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- GOVERNANCE SCORES
-- Store calculated governance scores
-- ============================================================================

CREATE TABLE IF NOT EXISTS governance_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Component scores (0-100)
  overall_score DECIMAL(5,2),
  policy_score DECIMAL(5,2),
  stakeholder_score DECIMAL(5,2),
  board_score DECIMAL(5,2),
  ethics_score DECIMAL(5,2),
  transparency_score DECIMAL(5,2),

  -- Data quality
  data_completeness DECIMAL(5,2),

  -- Calculation metadata
  calculated_at TIMESTAMPTZ DEFAULT now(),
  calculation_period_start DATE,
  calculation_period_end DATE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_governance_policies_org ON governance_policies(organization_id);
CREATE INDEX IF NOT EXISTS idx_governance_policies_status ON governance_policies(status);
CREATE INDEX IF NOT EXISTS idx_governance_policies_type ON governance_policies(policy_type);

CREATE INDEX IF NOT EXISTS idx_governance_policy_versions_policy ON governance_policy_versions(policy_id);

CREATE INDEX IF NOT EXISTS idx_governance_stakeholders_org ON governance_stakeholders(organization_id);
CREATE INDEX IF NOT EXISTS idx_governance_stakeholders_type ON governance_stakeholders(stakeholder_type);

CREATE INDEX IF NOT EXISTS idx_governance_engagements_stakeholder ON governance_stakeholder_engagements(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_governance_engagements_org ON governance_stakeholder_engagements(organization_id);
CREATE INDEX IF NOT EXISTS idx_governance_engagements_date ON governance_stakeholder_engagements(engagement_date);

CREATE INDEX IF NOT EXISTS idx_governance_board_org ON governance_board_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_governance_board_current ON governance_board_members(is_current);

CREATE INDEX IF NOT EXISTS idx_governance_mission_org ON governance_mission(organization_id);

CREATE INDEX IF NOT EXISTS idx_governance_lobbying_org ON governance_lobbying(organization_id);
CREATE INDEX IF NOT EXISTS idx_governance_lobbying_type ON governance_lobbying(activity_type);

CREATE INDEX IF NOT EXISTS idx_governance_ethics_org ON governance_ethics_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_governance_ethics_type ON governance_ethics_records(record_type);

CREATE INDEX IF NOT EXISTS idx_governance_scores_org ON governance_scores(organization_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE governance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_stakeholder_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_mission ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_lobbying ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_ethics_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_scores ENABLE ROW LEVEL SECURITY;

-- Policies for governance_policies
CREATE POLICY "governance_policies_org_select" ON governance_policies
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "governance_policies_org_insert" ON governance_policies
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "governance_policies_org_update" ON governance_policies
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "governance_policies_org_delete" ON governance_policies
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Policies for governance_policy_versions
CREATE POLICY "governance_policy_versions_org_select" ON governance_policy_versions
  FOR SELECT USING (policy_id IN (
    SELECT id FROM governance_policies WHERE organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  ));
CREATE POLICY "governance_policy_versions_org_insert" ON governance_policy_versions
  FOR INSERT WITH CHECK (policy_id IN (
    SELECT id FROM governance_policies WHERE organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  ));
CREATE POLICY "governance_policy_versions_org_update" ON governance_policy_versions
  FOR UPDATE USING (policy_id IN (
    SELECT id FROM governance_policies WHERE organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  ));
CREATE POLICY "governance_policy_versions_org_delete" ON governance_policy_versions
  FOR DELETE USING (policy_id IN (
    SELECT id FROM governance_policies WHERE organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  ));

-- Policies for governance_stakeholders
CREATE POLICY "governance_stakeholders_org_select" ON governance_stakeholders
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "governance_stakeholders_org_insert" ON governance_stakeholders
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "governance_stakeholders_org_update" ON governance_stakeholders
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "governance_stakeholders_org_delete" ON governance_stakeholders
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Policies for governance_stakeholder_engagements
CREATE POLICY "governance_engagements_org_select" ON governance_stakeholder_engagements
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "governance_engagements_org_insert" ON governance_stakeholder_engagements
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "governance_engagements_org_update" ON governance_stakeholder_engagements
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "governance_engagements_org_delete" ON governance_stakeholder_engagements
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Policies for governance_board_members
CREATE POLICY "governance_board_org_select" ON governance_board_members
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "governance_board_org_insert" ON governance_board_members
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "governance_board_org_update" ON governance_board_members
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "governance_board_org_delete" ON governance_board_members
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Policies for governance_mission
CREATE POLICY "governance_mission_org_select" ON governance_mission
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "governance_mission_org_insert" ON governance_mission
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "governance_mission_org_update" ON governance_mission
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "governance_mission_org_delete" ON governance_mission
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Policies for governance_lobbying
CREATE POLICY "governance_lobbying_org_select" ON governance_lobbying
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "governance_lobbying_org_insert" ON governance_lobbying
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "governance_lobbying_org_update" ON governance_lobbying
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "governance_lobbying_org_delete" ON governance_lobbying
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Policies for governance_ethics_records
CREATE POLICY "governance_ethics_org_select" ON governance_ethics_records
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "governance_ethics_org_insert" ON governance_ethics_records
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "governance_ethics_org_update" ON governance_ethics_records
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "governance_ethics_org_delete" ON governance_ethics_records
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Policies for governance_scores
CREATE POLICY "governance_scores_org_select" ON governance_scores
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "governance_scores_org_insert" ON governance_scores
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "governance_scores_org_update" ON governance_scores
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "governance_scores_org_delete" ON governance_scores
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- ============================================================================
-- VIEW: GOVERNANCE SUMMARY
-- Aggregated view for dashboard
-- ============================================================================

CREATE OR REPLACE VIEW governance_summary AS
SELECT
  p.organization_id,

  -- Policy counts
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'active') AS active_policies,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'draft') AS draft_policies,
  COUNT(DISTINCT p.id) FILTER (WHERE p.review_date <= CURRENT_DATE + INTERVAL '30 days') AS policies_due_review,

  -- Stakeholder counts
  COUNT(DISTINCT s.id) AS total_stakeholders,
  COUNT(DISTINCT se.id) FILTER (WHERE se.engagement_date >= CURRENT_DATE - INTERVAL '90 days') AS recent_engagements,

  -- Board counts
  COUNT(DISTINCT b.id) FILTER (WHERE b.is_current = true) AS current_board_members,
  COUNT(DISTINCT b.id) FILTER (WHERE b.is_current = true AND b.is_independent = true) AS independent_board_members,

  -- Ethics counts
  COUNT(DISTINCT e.id) FILTER (WHERE e.record_type = 'ethics_training' AND e.record_date >= CURRENT_DATE - INTERVAL '1 year') AS ethics_trainings_this_year,
  COUNT(DISTINCT e.id) FILTER (WHERE e.record_type = 'whistleblowing_case' AND e.status = 'open') AS open_whistleblowing_cases

FROM governance_policies p
LEFT JOIN governance_stakeholders s ON s.organization_id = p.organization_id
LEFT JOIN governance_stakeholder_engagements se ON se.organization_id = p.organization_id
LEFT JOIN governance_board_members b ON b.organization_id = p.organization_id
LEFT JOIN governance_ethics_records e ON e.organization_id = p.organization_id
GROUP BY p.organization_id;

-- ============================================================================
-- SEED DATA: COMMON POLICY TYPES
-- ============================================================================

-- Note: No seed data needed for governance - organizations will create their own policies
