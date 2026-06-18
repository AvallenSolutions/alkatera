-- Add cutoff_criteria and dqi_score columns to product_carbon_footprints
-- Required by the Enhanced Compliance Wizard and LCA Report Generator
ALTER TABLE product_carbon_footprints
  ADD COLUMN IF NOT EXISTS cutoff_criteria TEXT DEFAULT NULL;

ALTER TABLE product_carbon_footprints
  ADD COLUMN IF NOT EXISTS dqi_score NUMERIC DEFAULT NULL;
