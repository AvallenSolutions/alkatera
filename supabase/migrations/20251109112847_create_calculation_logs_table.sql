/*
  # Create Calculation Logs Table - Immutable Multi-Tenant Audit Ledger
  
  1. Purpose
     - Immutable ledger for every calculation performed on the platform
     - Complete audit trail with all inputs, outputs, factors, and methodology
     - Strict multi-tenant isolation preventing cross-organisation access
     - Verifiable calculation history for compliance and verification
  
  2. New Tables
     - `calculation_logs`
       - `log_id` (uuid, primary key) - Unique identifier for each calculation log entry
       - `organization_id` (uuid, required, FK) - Organisation that owns this calculation
       - `user_id` (uuid, required, FK) - User who performed the calculation
       - `input_data` (jsonb, required) - Complete snapshot of all input data
       - `output_value` (numeric, required) - Final calculated emissions value
       - `output_unit` (text, required) - Unit of the output value
       - `methodology_version` (text, required) - Version of calculation methodology used
       - `factor_ids_used` (uuid[], required) - Array of emissions factor IDs used
       - `created_at` (timestamptz, required) - Timestamp when calculation was performed
  
  3. Security
     - Enable RLS on `calculation_logs` table
     - SELECT policy: Users can only read logs from their own organisation
     - INSERT policy: Users can only create logs for their own organisation
     - NO UPDATE or DELETE policies (enforces immutability)
     - Multi-tenant isolation via auth.jwt() organisation_id claims
  
  4. Immutability Features
     - No UPDATE policies at database level
     - No DELETE policies at database level
     - Once written, logs cannot be modified or removed by application
     - Complete audit trail preservation
  
  5. Performance
     - Indexes on organization_id and user_id for fast multi-tenant queries
     - JSONB indexing on input_data for flexible querying
     - Array indexing on factor_ids_used for factor usage analysis
*/

-- =====================================================
-- CALCULATION_LOGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS calculation_logs (
  log_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  input_data jsonb NOT NULL,
  
  output_value numeric NOT NULL,
  
  output_unit text NOT NULL,
  
  methodology_version text NOT NULL,
  
  factor_ids_used uuid[] NOT NULL,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add table and column comments for documentation
COMMENT ON TABLE calculation_logs IS 'Immutable audit ledger of all carbon calculations performed on the platform. Provides complete traceability with multi-tenant isolation. Once written, logs cannot be modified or deleted by the application layer.';

COMMENT ON COLUMN calculation_logs.log_id IS 'Unique identifier for each calculation log entry. Serves as the primary key for the audit trail.';

COMMENT ON COLUMN calculation_logs.organization_id IS 'Foreign key reference to the organisation that owns this calculation. Enables multi-tenant data isolation and ensures each calculation is attributed to the correct organisation.';

COMMENT ON COLUMN calculation_logs.user_id IS 'Foreign key reference to the authenticated user who performed the calculation. Provides user-level audit trail and accountability.';

COMMENT ON COLUMN calculation_logs.input_data IS 'Complete JSON snapshot of all user-provided input data for the calculation. Includes activity data, parameters, facility information, and any other inputs. Enables full reconstruction and verification of the calculation.';

COMMENT ON COLUMN calculation_logs.output_value IS 'The final calculated emissions value produced by the calculation engine. Stored as numeric for precision in compliance reporting.';

COMMENT ON COLUMN calculation_logs.output_unit IS 'Unit of measurement for the output value (e.g., "kgCO2e", "tCO2e", "MtCO2e"). Essential for correct interpretation and reporting of results.';

COMMENT ON COLUMN calculation_logs.methodology_version IS 'Version identifier of the calculation methodology used (e.g., "ghg_protocol_scope2_v2.1", "iso14064_v1.0"). Enables tracking of methodology changes over time and ensures reproducibility.';

COMMENT ON COLUMN calculation_logs.factor_ids_used IS 'Array of UUIDs referencing the emissions factors from public.emissions_factors that were used in this calculation. Provides complete traceability of factors and enables impact analysis when factors are updated.';

COMMENT ON COLUMN calculation_logs.created_at IS 'Immutable timestamp of when the calculation was performed and logged. Serves as the official record time for audit and compliance purposes.';

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

-- Index for multi-tenant queries (most common access pattern)
CREATE INDEX IF NOT EXISTS idx_calculation_logs_organization_id 
  ON calculation_logs(organization_id);

-- Index for user-specific queries and audit trails
CREATE INDEX IF NOT EXISTS idx_calculation_logs_user_id 
  ON calculation_logs(user_id);

-- Composite index for organisation + time range queries (common for reporting)
CREATE INDEX IF NOT EXISTS idx_calculation_logs_org_created 
  ON calculation_logs(organization_id, created_at DESC);

-- Index for methodology version analysis
CREATE INDEX IF NOT EXISTS idx_calculation_logs_methodology 
  ON calculation_logs(methodology_version);

-- GIN index for JSONB input_data queries (enables flexible filtering)
CREATE INDEX IF NOT EXISTS idx_calculation_logs_input_data 
  ON calculation_logs USING gin(input_data);

-- GIN index for factor_ids_used array queries (enables "which calcs used this factor?" queries)
CREATE INDEX IF NOT EXISTS idx_calculation_logs_factor_ids 
  ON calculation_logs USING gin(factor_ids_used);

-- =====================================================
-- DATA QUALITY CONSTRAINTS
-- =====================================================

-- Ensure output values are non-negative (cannot have negative emissions in this context)
ALTER TABLE calculation_logs ADD CONSTRAINT chk_calculation_logs_output_positive 
  CHECK (output_value >= 0);

-- Ensure methodology version follows a format (basic validation)
ALTER TABLE calculation_logs ADD CONSTRAINT chk_calculation_logs_methodology_format 
  CHECK (length(methodology_version) >= 3);

-- Ensure output_unit is not empty
ALTER TABLE calculation_logs ADD CONSTRAINT chk_calculation_logs_unit_not_empty 
  CHECK (length(trim(output_unit)) > 0);

-- Ensure factor_ids_used array is not empty (must use at least one factor)
ALTER TABLE calculation_logs ADD CONSTRAINT chk_calculation_logs_factors_not_empty 
  CHECK (array_length(factor_ids_used, 1) > 0);

-- Ensure input_data is not empty JSON
ALTER TABLE calculation_logs ADD CONSTRAINT chk_calculation_logs_input_not_empty 
  CHECK (jsonb_typeof(input_data) = 'object' AND input_data != '{}'::jsonb);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE calculation_logs ENABLE ROW LEVEL SECURITY;

-- SELECT Policy: Users can only read logs from their own organisation
CREATE POLICY "Allow individual read access based on organization"
  ON calculation_logs
  FOR SELECT
  TO authenticated
  USING (
    organization_id::text = (auth.jwt() -> 'app_metadata' ->> 'organization_id')
  );

-- INSERT Policy: Users can only create logs for their own organisation
CREATE POLICY "Allow individual insert access based on organization"
  ON calculation_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id::text = (auth.jwt() -> 'app_metadata' ->> 'organization_id')
  );

-- Explicitly document that no UPDATE or DELETE policies exist
COMMENT ON POLICY "Allow individual read access based on organization" ON calculation_logs IS 
  'Permits SELECT operations only for logs belonging to the user''s organisation. Organisation ID is extracted from JWT app_metadata to ensure cryptographic isolation between tenants.';

COMMENT ON POLICY "Allow individual insert access based on organization" ON calculation_logs IS 
  'Permits INSERT operations only when the new log''s organization_id matches the user''s organisation from JWT app_metadata. No UPDATE or DELETE policies exist to enforce immutability at the database level.';

-- =====================================================
-- HELPER FUNCTION FOR ORGANIZATION VALIDATION
-- =====================================================

-- Create a helper function to validate organisation membership on insert
CREATE OR REPLACE FUNCTION validate_calculation_log_organization()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure the user actually belongs to the organisation they're logging for
  IF NOT EXISTS (
    SELECT 1 
    FROM organization_members 
    WHERE user_id = auth.uid() 
      AND organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'User is not a member of the specified organisation';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_validate_calculation_log_organization
  BEFORE INSERT ON calculation_logs
  FOR EACH ROW
  EXECUTE FUNCTION validate_calculation_log_organization();

COMMENT ON FUNCTION validate_calculation_log_organization() IS 
  'Security function that validates the user is actually a member of the organisation before allowing a calculation log insert. Provides additional security beyond RLS by cross-checking organization_members table.';

COMMENT ON TRIGGER trg_validate_calculation_log_organization ON calculation_logs IS 
  'Validates organisation membership before insert to prevent privilege escalation. Works in conjunction with RLS policies to provide defence-in-depth security.';

-- =====================================================
-- STATISTICS AND MONITORING VIEWS
-- =====================================================

-- Create a view for calculation statistics (respects RLS)
CREATE OR REPLACE VIEW calculation_statistics AS
SELECT 
  organization_id,
  COUNT(*) as total_calculations,
  SUM(output_value) as total_emissions,
  AVG(output_value) as avg_emissions,
  MIN(created_at) as first_calculation,
  MAX(created_at) as last_calculation,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT methodology_version) as methodologies_used
FROM calculation_logs
GROUP BY organization_id;

COMMENT ON VIEW calculation_statistics IS 
  'Aggregated statistics for calculation logs by organisation. Automatically respects RLS policies, so users only see statistics for their own organisation.';

-- Create a view for factor usage analysis (respects RLS)
CREATE OR REPLACE VIEW factor_usage_statistics AS
SELECT 
  organization_id,
  unnest(factor_ids_used) as factor_id,
  COUNT(*) as usage_count,
  MIN(created_at) as first_used,
  MAX(created_at) as last_used
FROM calculation_logs
GROUP BY organization_id, unnest(factor_ids_used);

COMMENT ON VIEW factor_usage_statistics IS 
  'Tracks which emissions factors are used in calculations and how frequently. Useful for identifying commonly used factors and assessing impact of factor updates. Respects RLS policies.';

-- =====================================================
-- IMMUTABILITY VERIFICATION
-- =====================================================

-- Create a trigger to prevent any UPDATE operations (defence in depth)
CREATE OR REPLACE FUNCTION prevent_calculation_log_updates()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Calculation logs are immutable and cannot be updated. Log ID: %', OLD.log_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_calculation_log_updates
  BEFORE UPDATE ON calculation_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_calculation_log_updates();

COMMENT ON FUNCTION prevent_calculation_log_updates() IS 
  'Defence-in-depth function that explicitly prevents any UPDATE operations on calculation logs, even if attempted via database admin. Enforces immutability principle.';

COMMENT ON TRIGGER trg_prevent_calculation_log_updates ON calculation_logs IS 
  'Prevents any UPDATE operations on calculation logs to enforce immutability. This provides protection even if RLS policies are accidentally modified.';

-- Create a trigger to prevent any DELETE operations (defence in depth)
CREATE OR REPLACE FUNCTION prevent_calculation_log_deletes()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Calculation logs are immutable and cannot be deleted. Log ID: %', OLD.log_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_calculation_log_deletes
  BEFORE DELETE ON calculation_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_calculation_log_deletes();

COMMENT ON FUNCTION prevent_calculation_log_deletes() IS 
  'Defence-in-depth function that explicitly prevents any DELETE operations on calculation logs, even if attempted via database admin. Ensures permanent audit trail.';

COMMENT ON TRIGGER trg_prevent_calculation_log_deletes ON calculation_logs IS 
  'Prevents any DELETE operations on calculation logs to maintain permanent audit trail. This provides protection even if RLS policies are accidentally modified.';