/*
  # Create Emissions Factors Table - Audit-Ready Ledger
  
  1. Purpose
     - Master library for all emissions factors used in platform calculations
     - Immutable reference data with full traceability and compliance metadata
     - Read-only to application layer; managed via CSO-governed Git workflow
  
  2. New Tables
     - `emissions_factors`
       - `factor_id` (uuid, primary key) - Unique identifier for each emissions factor
       - `name` (text, required) - Descriptive name of the emissions factor
       - `value` (numeric, required) - The actual emissions factor value used in calculations
       - `unit` (text, required) - Unit of measurement for the factor
       - `source` (text, required) - Source authority/database reference
       - `source_documentation_link` (text, required) - Direct URL to source documentation
       - `year_of_publication` (integer, required) - Publication year/vintage of the factor
       - `geographic_scope` (text, required) - Geographic applicability of the factor
       - `system_model` (text, optional) - LCA system model if applicable
       - `created_at` (timestamptz) - Record creation timestamp
       - `updated_at` (timestamptz) - Record update timestamp
  
  3. Security
     - Enable RLS on `emissions_factors` table
     - Add read-only policy for authenticated users (SELECT only)
     - NO INSERT, UPDATE, or DELETE policies (enforces immutability)
     - All data modifications managed via database migrations
  
  4. Compliance Features
     - Full audit trail with timestamps
     - Source traceability with documentation links
     - Version control via year_of_publication
     - Geographic and methodological context preservation
*/

-- =====================================================
-- EMISSIONS_FACTORS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS emissions_factors (
  factor_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name text NOT NULL,
  
  value numeric NOT NULL,
  
  unit text NOT NULL,
  
  source text NOT NULL,
  
  source_documentation_link text NOT NULL,
  
  year_of_publication integer NOT NULL,
  
  geographic_scope text NOT NULL,
  
  system_model text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add column comments for documentation
COMMENT ON TABLE emissions_factors IS 'Master library of emissions factors for carbon calculations. Read-only to application; managed via CSO-governed workflow.';

COMMENT ON COLUMN emissions_factors.factor_id IS 'Unique identifier for each emissions factor entry';

COMMENT ON COLUMN emissions_factors.name IS 'Descriptive name of the emissions factor (e.g., "Grid electricity - UK", "Natural gas combustion")';

COMMENT ON COLUMN emissions_factors.value IS 'The actual emissions factor value used in carbon calculations';

COMMENT ON COLUMN emissions_factors.unit IS 'Unit of measurement for the factor (e.g., "kgCO2e/kWh", "kgCO2e/kg", "kgCO2e/tonne")';

COMMENT ON COLUMN emissions_factors.source IS 'Source authority or database (e.g., "DEFRA 2023", "EPA 2024", "Ecoinvent 3.9", "IPCC AR6")';

COMMENT ON COLUMN emissions_factors.source_documentation_link IS 'Direct URL to the authoritative source documentation for audit and verification purposes';

COMMENT ON COLUMN emissions_factors.year_of_publication IS 'Publication year/vintage of the emissions factor for version control and currency tracking';

COMMENT ON COLUMN emissions_factors.geographic_scope IS 'Geographic region of applicability (e.g., "UK", "EU-27", "United States", "Global", "California")';

COMMENT ON COLUMN emissions_factors.system_model IS 'LCA system model methodology if applicable (e.g., "Cut-off", "APOS", "Consequential"). NULL for non-LCA factors.';

COMMENT ON COLUMN emissions_factors.created_at IS 'Timestamp when the emissions factor record was created in the system';

COMMENT ON COLUMN emissions_factors.updated_at IS 'Timestamp of the last update to the emissions factor record';

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_emissions_factors_name ON emissions_factors(name);
CREATE INDEX IF NOT EXISTS idx_emissions_factors_geographic_scope ON emissions_factors(geographic_scope);
CREATE INDEX IF NOT EXISTS idx_emissions_factors_source ON emissions_factors(source);
CREATE INDEX IF NOT EXISTS idx_emissions_factors_year ON emissions_factors(year_of_publication);

-- Add constraints for data quality
ALTER TABLE emissions_factors ADD CONSTRAINT chk_emissions_factors_value_positive 
  CHECK (value >= 0);

ALTER TABLE emissions_factors ADD CONSTRAINT chk_emissions_factors_year_valid 
  CHECK (year_of_publication >= 1990 AND year_of_publication <= EXTRACT(YEAR FROM CURRENT_DATE) + 1);

ALTER TABLE emissions_factors ADD CONSTRAINT chk_emissions_factors_url_format 
  CHECK (source_documentation_link ~* '^https?://');

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE emissions_factors ENABLE ROW LEVEL SECURITY;

-- Create read-only policy for authenticated users
CREATE POLICY "Allow read-only access to authenticated users"
  ON emissions_factors
  FOR SELECT
  TO authenticated
  USING (true);

-- Explicitly document that no write policies exist
COMMENT ON POLICY "Allow read-only access to authenticated users" ON emissions_factors IS 
  'Permits SELECT operations only. No INSERT, UPDATE, or DELETE policies exist to enforce immutability at database level. All modifications must be performed via database migrations.';

-- =====================================================
-- TRIGGER FOR UPDATED_AT TIMESTAMP
-- =====================================================

CREATE OR REPLACE FUNCTION update_emissions_factors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_emissions_factors_updated_at
  BEFORE UPDATE ON emissions_factors
  FOR EACH ROW
  EXECUTE FUNCTION update_emissions_factors_updated_at();

COMMENT ON FUNCTION update_emissions_factors_updated_at() IS 
  'Automatically updates the updated_at timestamp when an emissions factor record is modified via migration';

COMMENT ON TRIGGER trg_emissions_factors_updated_at ON emissions_factors IS 
  'Ensures updated_at timestamp is automatically maintained for audit trail purposes';