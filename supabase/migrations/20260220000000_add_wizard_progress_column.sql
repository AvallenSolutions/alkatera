-- Add wizard_progress JSONB column to product_carbon_footprints
-- Used by the Enhanced Compliance Wizard to persist step progress
ALTER TABLE product_carbon_footprints
  ADD COLUMN IF NOT EXISTS wizard_progress JSONB DEFAULT NULL;
