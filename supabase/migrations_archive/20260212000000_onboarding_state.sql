-- Onboarding state table for tracking user onboarding progress
-- Stores the full onboarding state as JSONB per organization

CREATE TABLE IF NOT EXISTS onboarding_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  state JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_state_org_unique UNIQUE (organization_id)
);

-- RLS policies
ALTER TABLE onboarding_state ENABLE ROW LEVEL SECURITY;

-- Members of the organization can read onboarding state
CREATE POLICY "Organization members can view onboarding state"
  ON onboarding_state
  FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Members of the organization can insert/update onboarding state
CREATE POLICY "Organization members can manage onboarding state"
  ON onboarding_state
  FOR ALL
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Service role can manage all onboarding state (for API routes)
CREATE POLICY "Service role full access to onboarding state"
  ON onboarding_state
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_state_org
  ON onboarding_state(organization_id);
