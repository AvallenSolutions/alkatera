-- ============================================================================
-- SUPPLY CHAIN EXTENSION MODULE
-- ============================================================================
-- CRITICAL: This extends existing supplier functionality WITHOUT modifying
-- any existing supplier tables or logic.
--
-- Supports:
--   - B Corp 2.1 Supply Chain requirements
--   - CSRD ESRS S2 (Workers in Value Chain) reporting
--   - Supplier sustainability and human rights assessments
-- ============================================================================

-- ============================================================================
-- SUPPLIER SUSTAINABILITY ASSESSMENTS
-- Track supplier environmental and social performance
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_sustainability_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Assessment details
  assessment_date DATE NOT NULL,
  assessment_type VARCHAR(100) NOT NULL, -- self_assessment, audit, desktop_review, site_visit
  assessor_name VARCHAR(255),
  assessor_type VARCHAR(100), -- internal, third_party

  -- Environmental scores (0-100)
  environmental_score DECIMAL(5,2),
  carbon_management_score DECIMAL(5,2),
  waste_management_score DECIMAL(5,2),
  water_management_score DECIMAL(5,2),
  biodiversity_score DECIMAL(5,2),

  -- Social scores (0-100)
  social_score DECIMAL(5,2),
  labor_practices_score DECIMAL(5,2),
  health_safety_score DECIMAL(5,2),
  community_impact_score DECIMAL(5,2),

  -- Governance scores (0-100)
  governance_score DECIMAL(5,2),
  ethics_score DECIMAL(5,2),
  transparency_score DECIMAL(5,2),

  -- Overall
  overall_score DECIMAL(5,2),
  risk_rating VARCHAR(50), -- low, medium, high, critical

  -- Findings
  key_findings TEXT,
  strengths TEXT,
  areas_for_improvement TEXT,

  -- Evidence
  evidence_documents JSONB, -- Array of document URLs/references

  -- Follow-up
  next_assessment_date DATE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- SUPPLIER CERTIFICATIONS
-- Track supplier certifications and standards
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Certification details
  certification_name VARCHAR(255) NOT NULL,
  certification_type VARCHAR(100) NOT NULL, -- iso, bcorp, fsoc, msc, fsc, organic, fairtrade, other
  certification_body VARCHAR(255),
  certification_number VARCHAR(255),

  -- Validity
  issue_date DATE,
  expiry_date DATE,
  is_current BOOLEAN GENERATED ALWAYS AS (expiry_date IS NULL OR expiry_date >= CURRENT_DATE) STORED,

  -- Scope
  scope_description TEXT,
  products_covered TEXT[],

  -- Verification
  verified_by VARCHAR(255),
  verification_date DATE,
  certificate_url TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- SUPPLIER CODE OF CONDUCT
-- Track code of conduct acknowledgments
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_code_of_conduct (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Code version
  code_version VARCHAR(50) NOT NULL,
  code_name VARCHAR(255) DEFAULT 'Supplier Code of Conduct',

  -- Acknowledgment
  acknowledged_date DATE,
  acknowledged_by VARCHAR(255),
  acknowledged_role VARCHAR(255),

  -- Coverage
  covers_labor_standards BOOLEAN DEFAULT true,
  covers_environmental_standards BOOLEAN DEFAULT true,
  covers_ethics BOOLEAN DEFAULT true,
  covers_human_rights BOOLEAN DEFAULT true,
  covers_health_safety BOOLEAN DEFAULT true,

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, acknowledged, expired, refused
  expiry_date DATE,
  renewal_required_by DATE,

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- One active code per supplier
  UNIQUE(supplier_id, code_version)
);

-- ============================================================================
-- SUPPLIER HUMAN RIGHTS RISKS
-- Track human rights due diligence
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_human_rights_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Assessment details
  assessment_date DATE NOT NULL,
  assessment_methodology VARCHAR(255), -- e.g., UN Guiding Principles framework

  -- Risk identification
  risk_category VARCHAR(100) NOT NULL, -- forced_labor, child_labor, discrimination, freedom_of_association, living_wage, working_hours, health_safety
  risk_description TEXT,
  risk_level VARCHAR(50) NOT NULL, -- low, medium, high, critical
  likelihood VARCHAR(50), -- unlikely, possible, likely, almost_certain
  impact VARCHAR(50), -- minor, moderate, major, severe

  -- Affected groups
  affected_stakeholders TEXT, -- e.g., "migrant workers", "women", "indigenous communities"
  estimated_affected_count INTEGER,

  -- Location
  risk_location VARCHAR(255),
  country VARCHAR(100),
  region VARCHAR(255),

  -- Mitigation
  mitigation_status VARCHAR(50), -- identified, planned, in_progress, resolved, accepted
  mitigation_actions TEXT,
  mitigation_deadline DATE,
  mitigation_owner VARCHAR(255),

  -- Verification
  last_verified_date DATE,
  verification_method VARCHAR(255),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- SUPPLIER IMPROVEMENT PLANS
-- Track supplier development and improvement
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_improvement_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Plan details
  plan_name VARCHAR(255) NOT NULL,
  plan_type VARCHAR(100) NOT NULL, -- corrective_action, development, capacity_building, transition
  description TEXT,

  -- Trigger
  trigger_assessment_id UUID REFERENCES supplier_sustainability_assessments(id),
  trigger_reason TEXT,

  -- Timeline
  start_date DATE,
  target_completion_date DATE,
  actual_completion_date DATE,

  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- draft, active, on_hold, completed, cancelled
  progress_percentage INTEGER DEFAULT 0,

  -- Actions
  improvement_areas TEXT[],
  key_milestones JSONB, -- Array of {milestone, target_date, status}

  -- Support
  support_provided TEXT,
  resources_allocated DECIMAL(12,2),
  support_type VARCHAR(100), -- training, funding, technical_assistance

  -- Outcomes
  expected_outcomes TEXT,
  actual_outcomes TEXT,
  lessons_learned TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- SUPPLIER SUSTAINABILITY SCORES
-- Aggregated supplier sustainability scores for portfolio view
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_sustainability_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Calculation period
  calculation_date DATE NOT NULL,
  reporting_year INTEGER NOT NULL,

  -- Portfolio metrics
  total_suppliers INTEGER,
  assessed_suppliers INTEGER,
  certified_suppliers INTEGER,
  code_acknowledged_suppliers INTEGER,

  -- Average scores
  avg_environmental_score DECIMAL(5,2),
  avg_social_score DECIMAL(5,2),
  avg_governance_score DECIMAL(5,2),
  avg_overall_score DECIMAL(5,2),

  -- Risk distribution
  low_risk_count INTEGER,
  medium_risk_count INTEGER,
  high_risk_count INTEGER,
  critical_risk_count INTEGER,

  -- Human rights
  suppliers_with_hr_risks INTEGER,
  active_hr_mitigations INTEGER,

  -- Improvement
  active_improvement_plans INTEGER,
  completed_improvement_plans INTEGER,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_supplier_assessments_supplier ON supplier_sustainability_assessments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_assessments_org ON supplier_sustainability_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_supplier_assessments_date ON supplier_sustainability_assessments(assessment_date);

CREATE INDEX IF NOT EXISTS idx_supplier_certifications_supplier ON supplier_certifications(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_certifications_org ON supplier_certifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_supplier_certifications_type ON supplier_certifications(certification_type);

CREATE INDEX IF NOT EXISTS idx_supplier_coc_supplier ON supplier_code_of_conduct(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_coc_org ON supplier_code_of_conduct(organization_id);
CREATE INDEX IF NOT EXISTS idx_supplier_coc_status ON supplier_code_of_conduct(status);

CREATE INDEX IF NOT EXISTS idx_supplier_hr_risks_supplier ON supplier_human_rights_risks(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_hr_risks_org ON supplier_human_rights_risks(organization_id);
CREATE INDEX IF NOT EXISTS idx_supplier_hr_risks_level ON supplier_human_rights_risks(risk_level);

CREATE INDEX IF NOT EXISTS idx_supplier_improvements_supplier ON supplier_improvement_plans(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_improvements_org ON supplier_improvement_plans(organization_id);
CREATE INDEX IF NOT EXISTS idx_supplier_improvements_status ON supplier_improvement_plans(status);

CREATE INDEX IF NOT EXISTS idx_supplier_scores_org ON supplier_sustainability_scores(organization_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE supplier_sustainability_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_code_of_conduct ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_human_rights_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_improvement_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_sustainability_scores ENABLE ROW LEVEL SECURITY;

-- Policies for supplier_sustainability_assessments
CREATE POLICY "supplier_assessments_org_select" ON supplier_sustainability_assessments
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "supplier_assessments_org_insert" ON supplier_sustainability_assessments
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "supplier_assessments_org_update" ON supplier_sustainability_assessments
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "supplier_assessments_org_delete" ON supplier_sustainability_assessments
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Policies for supplier_certifications
CREATE POLICY "supplier_certifications_org_select" ON supplier_certifications
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "supplier_certifications_org_insert" ON supplier_certifications
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "supplier_certifications_org_update" ON supplier_certifications
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "supplier_certifications_org_delete" ON supplier_certifications
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Policies for supplier_code_of_conduct
CREATE POLICY "supplier_coc_org_select" ON supplier_code_of_conduct
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "supplier_coc_org_insert" ON supplier_code_of_conduct
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "supplier_coc_org_update" ON supplier_code_of_conduct
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "supplier_coc_org_delete" ON supplier_code_of_conduct
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Policies for supplier_human_rights_risks
CREATE POLICY "supplier_hr_risks_org_select" ON supplier_human_rights_risks
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "supplier_hr_risks_org_insert" ON supplier_human_rights_risks
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "supplier_hr_risks_org_update" ON supplier_human_rights_risks
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "supplier_hr_risks_org_delete" ON supplier_human_rights_risks
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Policies for supplier_improvement_plans
CREATE POLICY "supplier_improvements_org_select" ON supplier_improvement_plans
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "supplier_improvements_org_insert" ON supplier_improvement_plans
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "supplier_improvements_org_update" ON supplier_improvement_plans
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "supplier_improvements_org_delete" ON supplier_improvement_plans
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Policies for supplier_sustainability_scores
CREATE POLICY "supplier_scores_org_select" ON supplier_sustainability_scores
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "supplier_scores_org_insert" ON supplier_sustainability_scores
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "supplier_scores_org_update" ON supplier_sustainability_scores
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "supplier_scores_org_delete" ON supplier_sustainability_scores
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
