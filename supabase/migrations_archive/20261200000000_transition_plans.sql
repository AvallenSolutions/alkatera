-- Transition Plans
-- Stores decarbonisation transition plans per organisation per year.
-- Each plan contains reduction targets, milestones, and AI-generated
-- risks and opportunities that feed the Transition Roadmap report section.
--
-- ReductionTarget shape (stored in targets JSONB array):
-- {
--   id:                   string  — uuid
--   scope:                'scope1' | 'scope2' | 'scope3' | 'total'
--   targetYear:           number
--   reductionPct:         number  — percentage reduction vs. baseline_year
--   absoluteTargetTco2e?: number
--   notes?:               string
-- }
--
-- TransitionMilestone shape (stored in milestones JSONB array):
-- {
--   id:                      string  — uuid
--   title:                   string
--   targetDate:              string  — ISO date (YYYY-MM-DD)
--   status:                  'not_started' | 'in_progress' | 'complete'
--   linkedEventId?:          string  — FK to operational_change_events
--   scopeReference?:         'scope1' | 'scope2' | 'scope3'
--   emissionsImpactTco2e?:   number
--   notes?:                  string
-- }
--
-- RiskOpportunity shape (stored in risks_and_opportunities JSONB array):
-- {
--   id:              string  — uuid
--   type:            'risk' | 'opportunity'
--   category:        'physical' | 'transition' | 'regulatory' | 'reputational' | 'financial'
--   title:           string
--   description:     string
--   likelihood:      'low' | 'medium' | 'high'
--   impact:          'low' | 'medium' | 'high'
--   timeHorizon:     'short' | 'medium' | 'long'
--   aiGenerated:     boolean
-- }

CREATE TABLE IF NOT EXISTS transition_plans (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_year                 INTEGER NOT NULL,
  baseline_year             INTEGER NOT NULL,
  baseline_emissions_tco2e  DECIMAL,
  targets                   JSONB NOT NULL DEFAULT '[]',
  milestones                JSONB NOT NULL DEFAULT '[]',
  risks_and_opportunities   JSONB,
  sbti_aligned              BOOLEAN NOT NULL DEFAULT false,
  sbti_target_year          INTEGER,
  created_by                UUID REFERENCES auth.users(id),
  created_at                TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at                TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(organization_id, plan_year)
);

-- RLS: organisations can only see and edit their own plans
ALTER TABLE transition_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_can_view_transition_plans"
  ON transition_plans FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org_members_can_insert_transition_plans"
  ON transition_plans FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org_members_can_update_transition_plans"
  ON transition_plans FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org_members_can_delete_transition_plans"
  ON transition_plans FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION update_transition_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_transition_plans_updated_at
  BEFORE UPDATE ON transition_plans
  FOR EACH ROW EXECUTE FUNCTION update_transition_plans_updated_at();

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
