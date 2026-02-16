-- Migration: Per-user onboarding state for invited member flow
-- Previously, onboarding_state was keyed by organization_id only.
-- This meant invited members shared the owner's onboarding record.
-- Now each user gets their own onboarding state per organization.

-- ============================================================================
-- 1. Add user_id column (nullable for backward compat)
-- ============================================================================
ALTER TABLE onboarding_state ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 2. Add onboarding_flow column to distinguish owner vs member flow
-- ============================================================================
ALTER TABLE onboarding_state ADD COLUMN IF NOT EXISTS onboarding_flow TEXT NOT NULL DEFAULT 'owner';

-- ============================================================================
-- 3. Backfill existing rows: set user_id to the org owner
-- ============================================================================
UPDATE onboarding_state os
SET user_id = (
  SELECT om.user_id
  FROM organization_members om
  JOIN roles r ON r.id = om.role_id
  WHERE om.organization_id = os.organization_id
    AND r.name = 'owner'
  LIMIT 1
)
WHERE os.user_id IS NULL;

-- ============================================================================
-- 4. Drop old unique constraint and create new compound unique
-- ============================================================================
ALTER TABLE onboarding_state DROP CONSTRAINT IF EXISTS onboarding_state_org_unique;
ALTER TABLE onboarding_state ADD CONSTRAINT onboarding_state_org_user_unique UNIQUE (organization_id, user_id);

-- ============================================================================
-- 5. Create index for fast user+org lookups
-- ============================================================================
DROP INDEX IF EXISTS idx_onboarding_state_org;
CREATE INDEX IF NOT EXISTS idx_onboarding_state_org_user
  ON onboarding_state(organization_id, user_id);

-- ============================================================================
-- 6. Update RLS policies to be user-scoped
-- ============================================================================
DROP POLICY IF EXISTS "Organization members can view onboarding state" ON onboarding_state;
DROP POLICY IF EXISTS "Organization members can manage onboarding state" ON onboarding_state;

-- Users can read their own onboarding state within their org
CREATE POLICY "Users can view own onboarding state"
  ON onboarding_state
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Users can insert/update their own onboarding state within their org
CREATE POLICY "Users can manage own onboarding state"
  ON onboarding_state
  FOR ALL
  USING (
    user_id = auth.uid()
    AND organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Service role policy remains unchanged (already exists)
