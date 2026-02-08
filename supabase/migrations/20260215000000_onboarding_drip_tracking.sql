-- Onboarding email drip tracking
-- Tracks which onboarding emails have been sent to avoid duplicates

CREATE TABLE IF NOT EXISTS onboarding_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  email_type TEXT NOT NULL,  -- 'day_1_welcome', 'day_3_checkin', 'day_7_nudge'
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_email_unique UNIQUE (organization_id, user_id, email_type)
);

-- Index for efficient lookups when checking which emails have been sent
CREATE INDEX idx_onboarding_email_log_org_user ON onboarding_email_log(organization_id, user_id);

-- RLS
ALTER TABLE onboarding_email_log ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (edge function runs as service role)
CREATE POLICY "Service role full access" ON onboarding_email_log
  FOR ALL USING (auth.role() = 'service_role');
