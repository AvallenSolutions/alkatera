-- EPR Wizard State
-- Adds a wizard_state JSONB column to epr_organization_settings to persist
-- the guided EPR data entry wizard progress per organisation.

ALTER TABLE epr_organization_settings
ADD COLUMN IF NOT EXISTS wizard_state JSONB DEFAULT NULL;

COMMENT ON COLUMN epr_organization_settings.wizard_state IS
  'Persists progress through the Rosa-guided EPR data entry wizard (step, completedSteps, etc.)';
