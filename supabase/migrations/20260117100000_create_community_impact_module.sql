-- ============================================================================
-- COMMUNITY & IMPACT MODULE
-- ============================================================================
-- Supports:
--   - B Corp 2.1 Community requirements
--   - CSRD ESRS S3 (Affected Communities) reporting
--   - Charitable giving and local economic impact tracking
-- ============================================================================

-- ============================================================================
-- CHARITABLE DONATIONS
-- Track charitable giving and donations
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Donation details
  donation_name VARCHAR(255) NOT NULL,
  donation_type VARCHAR(100) NOT NULL, -- cash, in_kind, time, pro_bono
  description TEXT,

  -- Recipient
  recipient_name VARCHAR(255) NOT NULL,
  recipient_type VARCHAR(100), -- charity, nonprofit, community_group, school, other
  recipient_registration_number VARCHAR(100), -- Charity registration number
  recipient_cause VARCHAR(100), -- education, health, environment, poverty, arts, other

  -- Value
  donation_amount DECIMAL(12,2),
  currency VARCHAR(3) DEFAULT 'GBP',
  estimated_value DECIMAL(12,2), -- For in-kind donations
  hours_donated DECIMAL(8,2), -- For time/pro-bono

  -- Timing
  donation_date DATE,
  reporting_year INTEGER,

  -- Impact
  beneficiaries_count INTEGER,
  impact_description TEXT,

  -- Evidence
  evidence_url TEXT,
  receipt_reference VARCHAR(255),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- LOCAL ECONOMIC IMPACT
-- Track local sourcing, employment, and economic contribution
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_local_impact (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Reporting period
  reporting_year INTEGER NOT NULL,
  reporting_quarter INTEGER, -- 1-4, null for annual

  -- Local employment
  total_employees INTEGER,
  local_employees INTEGER, -- Within defined local area
  local_definition VARCHAR(255), -- e.g., "Within 25 miles of HQ"

  -- Local sourcing
  total_procurement_spend DECIMAL(14,2),
  local_procurement_spend DECIMAL(14,2),
  local_supplier_count INTEGER,
  total_supplier_count INTEGER,

  -- Tax contribution
  corporate_tax_paid DECIMAL(12,2),
  payroll_taxes_paid DECIMAL(12,2),
  business_rates_paid DECIMAL(12,2),

  -- Community investment
  community_investment_total DECIMAL(12,2),
  infrastructure_investment DECIMAL(12,2),

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- One record per org per period
  UNIQUE(organization_id, reporting_year, reporting_quarter)
);

-- ============================================================================
-- VOLUNTEER ACTIVITIES
-- Track employee volunteering and skills-based giving
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_volunteer_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Activity details
  activity_name VARCHAR(255) NOT NULL,
  activity_type VARCHAR(100) NOT NULL, -- team_volunteering, individual, skills_based, board_service
  description TEXT,

  -- Organization
  partner_organization VARCHAR(255),
  partner_cause VARCHAR(100),

  -- Participation
  activity_date DATE,
  duration_hours DECIMAL(6,2),
  participant_count INTEGER,
  total_volunteer_hours DECIMAL(8,2), -- duration_hours * participant_count

  -- Impact
  beneficiaries_reached INTEGER,
  impact_description TEXT,

  -- Policy
  is_paid_time BOOLEAN DEFAULT false, -- Employer-paid volunteer time
  volunteer_policy_hours DECIMAL(6,2), -- Hours allocated per employee per year

  -- Evidence
  evidence_url TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- COMMUNITY ENGAGEMENTS
-- Track community meetings, consultations, and interactions
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Engagement details
  engagement_name VARCHAR(255) NOT NULL,
  engagement_type VARCHAR(100) NOT NULL, -- public_meeting, consultation, partnership, sponsorship
  description TEXT,

  -- Community
  community_group VARCHAR(255),
  location VARCHAR(255),

  -- Timing
  engagement_date DATE,

  -- Participants
  internal_participants INTEGER,
  external_participants INTEGER,

  -- Outcomes
  key_topics TEXT[],
  outcomes TEXT,
  commitments_made TEXT,
  follow_up_actions TEXT,

  -- Evidence
  evidence_url TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- IMPACT STORIES
-- Document and share positive impact stories
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_impact_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Story details
  title VARCHAR(255) NOT NULL,
  story_type VARCHAR(100) NOT NULL, -- community, environmental, employee, supplier, customer
  summary TEXT,
  full_story TEXT,

  -- Impact data
  impact_category VARCHAR(100), -- social, environmental, economic
  beneficiaries_type VARCHAR(100),
  beneficiaries_count INTEGER,
  quantified_impact TEXT, -- e.g., "500 trees planted", "100 meals served"

  -- Media
  featured_image_url TEXT,
  video_url TEXT,
  additional_media JSONB, -- Array of media URLs

  -- Publication
  is_published BOOLEAN DEFAULT false,
  published_date DATE,
  external_url TEXT, -- If published externally

  -- SDG alignment
  sdg_alignment INTEGER[], -- UN SDG numbers

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- COMMUNITY IMPACT SCORES
-- Store calculated community impact scores
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_impact_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Component scores (0-100)
  overall_score DECIMAL(5,2),
  giving_score DECIMAL(5,2),
  local_impact_score DECIMAL(5,2),
  volunteering_score DECIMAL(5,2),
  engagement_score DECIMAL(5,2),

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

CREATE INDEX IF NOT EXISTS idx_community_donations_org ON community_donations(organization_id);
CREATE INDEX IF NOT EXISTS idx_community_donations_year ON community_donations(reporting_year);
CREATE INDEX IF NOT EXISTS idx_community_donations_type ON community_donations(donation_type);
CREATE INDEX IF NOT EXISTS idx_community_donations_recipient ON community_donations(recipient_type);

CREATE INDEX IF NOT EXISTS idx_community_local_impact_org ON community_local_impact(organization_id);
CREATE INDEX IF NOT EXISTS idx_community_local_impact_year ON community_local_impact(reporting_year);

CREATE INDEX IF NOT EXISTS idx_community_volunteer_org ON community_volunteer_activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_community_volunteer_date ON community_volunteer_activities(activity_date);

CREATE INDEX IF NOT EXISTS idx_community_engagements_org ON community_engagements(organization_id);
CREATE INDEX IF NOT EXISTS idx_community_engagements_date ON community_engagements(engagement_date);

CREATE INDEX IF NOT EXISTS idx_community_stories_org ON community_impact_stories(organization_id);
CREATE INDEX IF NOT EXISTS idx_community_stories_published ON community_impact_stories(is_published);

CREATE INDEX IF NOT EXISTS idx_community_scores_org ON community_impact_scores(organization_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE community_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_local_impact ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_volunteer_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_impact_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_impact_scores ENABLE ROW LEVEL SECURITY;

-- Policies for community_donations
CREATE POLICY "community_donations_org_select" ON community_donations
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "community_donations_org_insert" ON community_donations
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "community_donations_org_update" ON community_donations
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "community_donations_org_delete" ON community_donations
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Policies for community_local_impact
CREATE POLICY "community_local_impact_org_select" ON community_local_impact
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "community_local_impact_org_insert" ON community_local_impact
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "community_local_impact_org_update" ON community_local_impact
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "community_local_impact_org_delete" ON community_local_impact
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Policies for community_volunteer_activities
CREATE POLICY "community_volunteer_org_select" ON community_volunteer_activities
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "community_volunteer_org_insert" ON community_volunteer_activities
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "community_volunteer_org_update" ON community_volunteer_activities
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "community_volunteer_org_delete" ON community_volunteer_activities
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Policies for community_engagements
CREATE POLICY "community_engagements_org_select" ON community_engagements
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "community_engagements_org_insert" ON community_engagements
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "community_engagements_org_update" ON community_engagements
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "community_engagements_org_delete" ON community_engagements
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Policies for community_impact_stories
CREATE POLICY "community_stories_org_select" ON community_impact_stories
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "community_stories_org_insert" ON community_impact_stories
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "community_stories_org_update" ON community_impact_stories
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "community_stories_org_delete" ON community_impact_stories
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Policies for community_impact_scores
CREATE POLICY "community_scores_org_select" ON community_impact_scores
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "community_scores_org_insert" ON community_impact_scores
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "community_scores_org_update" ON community_impact_scores
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "community_scores_org_delete" ON community_impact_scores
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- ============================================================================
-- VIEW: COMMUNITY IMPACT SUMMARY
-- Aggregated view for dashboard
-- ============================================================================

CREATE OR REPLACE VIEW community_impact_summary AS
SELECT
  d.organization_id,
  COALESCE(COUNT(DISTINCT d.id), 0) AS total_donations,
  COALESCE(SUM(CASE WHEN d.donation_type = 'cash' THEN d.donation_amount ELSE 0 END), 0) AS total_cash_donated,
  COALESCE(SUM(d.hours_donated), 0) AS total_hours_donated,
  COALESCE(SUM(d.beneficiaries_count), 0) AS total_beneficiaries,
  COALESCE(COUNT(DISTINCT v.id), 0) AS volunteer_activities_count,
  COALESCE(SUM(v.total_volunteer_hours), 0) AS total_volunteer_hours,
  COALESCE(COUNT(DISTINCT e.id), 0) AS community_engagements_count,
  COALESCE(COUNT(DISTINCT s.id) FILTER (WHERE s.is_published = true), 0) AS published_stories_count
FROM community_donations d
LEFT JOIN community_volunteer_activities v ON v.organization_id = d.organization_id
LEFT JOIN community_engagements e ON e.organization_id = d.organization_id
LEFT JOIN community_impact_stories s ON s.organization_id = d.organization_id
GROUP BY d.organization_id;
