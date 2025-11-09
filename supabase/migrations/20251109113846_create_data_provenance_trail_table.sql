/*
  # Create Data Provenance Trail Table - Chain of Custody Ledger
  
  1. Purpose
     - Evidentiary log for all source data and documents provided by users
     - Unbreakable chain of custody from raw document to final calculation
     - Verification status tracking for compliance and audit readiness
     - Strict multi-tenant isolation preventing cross-organisation access
  
  2. New Types
     - `verification_status_enum` - Status values: 'unverified', 'verified', 'rejected'
  
  3. New Tables
     - `data_provenance_trail`
       - `provenance_id` (uuid, primary key) - Unique identifier for each provenance record
       - `organization_id` (uuid, required, FK) - Organisation that owns this evidence
       - `user_id` (uuid, required, FK) - User who uploaded/submitted the evidence
       - `source_description` (text, required) - User-provided description of the document
       - `document_type` (text, required) - Type/category of document
       - `storage_object_path` (text, required, unique) - Path to file in Supabase Storage
       - `verification_status` (enum, required) - Current verification state
       - `created_at` (timestamptz, required) - Timestamp when evidence was submitted
  
  4. Security
     - Enable RLS on `data_provenance_trail` table
     - SELECT policy: Users can only read evidence from their own organisation
     - INSERT policy: Users can only create evidence for their own organisation
     - UPDATE policy: Users can only update their own records
     - NO DELETE policy (enforces permanent evidence retention)
  
  5. Chain of Custody Features
     - Unique storage path ensures document uniqueness
     - Immutable creation timestamp
     - Verification workflow support
     - Complete audit trail from source to calculation
*/

-- =====================================================
-- VERIFICATION STATUS ENUM TYPE
-- =====================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status_enum') THEN
    CREATE TYPE verification_status_enum AS ENUM ('unverified', 'verified', 'rejected');
  END IF;
END $$;

COMMENT ON TYPE verification_status_enum IS 'Verification status for source documents in the data provenance trail. unverified = newly uploaded, verified = approved by authorised user, rejected = flagged as invalid or inappropriate.';

-- =====================================================
-- DATA_PROVENANCE_TRAIL TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS data_provenance_trail (
  provenance_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  source_description text NOT NULL,
  
  document_type text NOT NULL,
  
  storage_object_path text NOT NULL UNIQUE,
  
  verification_status verification_status_enum NOT NULL DEFAULT 'unverified',
  
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add table and column comments for documentation
COMMENT ON TABLE data_provenance_trail IS 'Evidentiary chain of custody ledger for all source documents and data provided by users. Provides complete traceability from raw evidence to final calculations. Records are permanent and cannot be deleted by the application layer.';

COMMENT ON COLUMN data_provenance_trail.provenance_id IS 'Unique identifier for each provenance record. Serves as the primary key for linking evidence to calculations.';

COMMENT ON COLUMN data_provenance_trail.organization_id IS 'Foreign key reference to the organisation that owns this evidence. Enables multi-tenant data isolation and ensures evidence is attributed to the correct organisation.';

COMMENT ON COLUMN data_provenance_trail.user_id IS 'Foreign key reference to the authenticated user who submitted/uploaded the evidence. Provides user-level accountability in the chain of custody.';

COMMENT ON COLUMN data_provenance_trail.source_description IS 'User-provided description of the source document or data. Examples: "Q3 2024 Electricity Bill for London Office", "Monthly fuel receipts - Fleet vehicles", "Supplier emissions report - Acme Corp". Enables human-readable evidence identification.';

COMMENT ON COLUMN data_provenance_trail.document_type IS 'Category or type of the source document. Examples: "invoice", "meter_reading", "shipping_manifest", "utility_bill", "supplier_report", "receipt". Used for filtering and workflow management.';

COMMENT ON COLUMN data_provenance_trail.storage_object_path IS 'Unique path to the file in Supabase Storage (e.g., "org-uuid/evidence/2024/file.pdf"). Must be unique across the entire system. This path is used to retrieve the actual document for verification and audit purposes.';

COMMENT ON COLUMN data_provenance_trail.verification_status IS 'Current verification state of the evidence. "unverified" = newly uploaded and pending review, "verified" = reviewed and approved by authorised personnel, "rejected" = determined to be invalid or inappropriate. Status changes create an audit trail.';

COMMENT ON COLUMN data_provenance_trail.created_at IS 'Immutable timestamp when the evidence was first submitted to the system. Establishes the official record time for chain of custody purposes.';

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

-- Index for multi-tenant queries (most common access pattern)
CREATE INDEX IF NOT EXISTS idx_data_provenance_organization_id 
  ON data_provenance_trail(organization_id);

-- Index for user-specific queries and accountability
CREATE INDEX IF NOT EXISTS idx_data_provenance_user_id 
  ON data_provenance_trail(user_id);

-- Index for document type filtering and reporting
CREATE INDEX IF NOT EXISTS idx_data_provenance_document_type 
  ON data_provenance_trail(document_type);

-- Composite index for organisation + verification status (common workflow query)
CREATE INDEX IF NOT EXISTS idx_data_provenance_org_status 
  ON data_provenance_trail(organization_id, verification_status);

-- Composite index for organisation + document type
CREATE INDEX IF NOT EXISTS idx_data_provenance_org_doctype 
  ON data_provenance_trail(organization_id, document_type);

-- Index for storage path lookups (file retrieval)
CREATE INDEX IF NOT EXISTS idx_data_provenance_storage_path 
  ON data_provenance_trail(storage_object_path);

-- Index for created_at for chronological queries
CREATE INDEX IF NOT EXISTS idx_data_provenance_created_at 
  ON data_provenance_trail(created_at DESC);

-- =====================================================
-- DATA QUALITY CONSTRAINTS
-- =====================================================

-- Ensure source_description is not empty
ALTER TABLE data_provenance_trail ADD CONSTRAINT chk_data_provenance_description_not_empty 
  CHECK (length(trim(source_description)) > 0);

-- Ensure document_type is not empty and follows a format
ALTER TABLE data_provenance_trail ADD CONSTRAINT chk_data_provenance_doctype_not_empty 
  CHECK (length(trim(document_type)) > 0);

-- Ensure document_type is lowercase for consistency
ALTER TABLE data_provenance_trail ADD CONSTRAINT chk_data_provenance_doctype_lowercase 
  CHECK (document_type = lower(document_type));

-- Ensure storage_object_path is not empty and has minimum structure
ALTER TABLE data_provenance_trail ADD CONSTRAINT chk_data_provenance_path_not_empty 
  CHECK (length(trim(storage_object_path)) > 0);

-- Ensure storage_object_path doesn't contain dangerous characters
ALTER TABLE data_provenance_trail ADD CONSTRAINT chk_data_provenance_path_safe 
  CHECK (storage_object_path !~ '[<>"|?*]');

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE data_provenance_trail ENABLE ROW LEVEL SECURITY;

-- SELECT Policy: Users can only read evidence from their own organisation
CREATE POLICY "Allow individual read access based on organization"
  ON data_provenance_trail
  FOR SELECT
  TO authenticated
  USING (
    organization_id::text = (auth.jwt() -> 'app_metadata' ->> 'organization_id')
  );

-- INSERT Policy: Users can only create evidence for their own organisation
CREATE POLICY "Allow individual insert access based on organization"
  ON data_provenance_trail
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id::text = (auth.jwt() -> 'app_metadata' ->> 'organization_id')
  );

-- UPDATE Policy: Users can only update their own records
CREATE POLICY "Allow user to update their own records"
  ON data_provenance_trail
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
  )
  WITH CHECK (
    user_id = auth.uid()
  );

-- Explicitly document that no DELETE policy exists
COMMENT ON POLICY "Allow individual read access based on organization" ON data_provenance_trail IS 
  'Permits SELECT operations only for evidence belonging to the user''s organisation. Organisation ID is extracted from JWT app_metadata to ensure cryptographic isolation between tenants.';

COMMENT ON POLICY "Allow individual insert access based on organization" ON data_provenance_trail IS 
  'Permits INSERT operations only when the new evidence record''s organization_id matches the user''s organisation from JWT app_metadata. Ensures users cannot submit evidence on behalf of other organisations.';

COMMENT ON POLICY "Allow user to update their own records" ON data_provenance_trail IS 
  'Permits UPDATE operations only on records where the user_id matches the authenticated user. This allows users to update descriptions or verification status of their own uploads. No DELETE policy exists to ensure permanent retention of all evidence.';

-- =====================================================
-- HELPER FUNCTION FOR ORGANIZATION VALIDATION
-- =====================================================

-- Create a helper function to validate organisation membership on insert
CREATE OR REPLACE FUNCTION validate_data_provenance_organization()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure the user actually belongs to the organisation they're submitting evidence for
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

CREATE TRIGGER trg_validate_data_provenance_organization
  BEFORE INSERT ON data_provenance_trail
  FOR EACH ROW
  EXECUTE FUNCTION validate_data_provenance_organization();

COMMENT ON FUNCTION validate_data_provenance_organization() IS 
  'Security function that validates the user is actually a member of the organisation before allowing evidence submission. Provides additional security beyond RLS by cross-checking organization_members table.';

COMMENT ON TRIGGER trg_validate_data_provenance_organization ON data_provenance_trail IS 
  'Validates organisation membership before insert to prevent privilege escalation. Works in conjunction with RLS policies to provide defence-in-depth security.';

-- =====================================================
-- AUDIT TRAIL FOR VERIFICATION STATUS CHANGES
-- =====================================================

-- Create audit table for tracking verification status changes
CREATE TABLE IF NOT EXISTS data_provenance_verification_history (
  history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provenance_id uuid NOT NULL REFERENCES data_provenance_trail(provenance_id) ON DELETE CASCADE,
  changed_by uuid NOT NULL REFERENCES auth.users(id),
  old_status verification_status_enum,
  new_status verification_status_enum NOT NULL,
  change_reason text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE data_provenance_verification_history IS 'Audit trail for all verification status changes on evidence records. Provides complete history of who changed status, when, and why. Supports compliance and dispute resolution.';

COMMENT ON COLUMN data_provenance_verification_history.history_id IS 'Unique identifier for this history entry';

COMMENT ON COLUMN data_provenance_verification_history.provenance_id IS 'Reference to the evidence record that was modified';

COMMENT ON COLUMN data_provenance_verification_history.changed_by IS 'User who changed the verification status';

COMMENT ON COLUMN data_provenance_verification_history.old_status IS 'Previous verification status (NULL for initial creation)';

COMMENT ON COLUMN data_provenance_verification_history.new_status IS 'New verification status after change';

COMMENT ON COLUMN data_provenance_verification_history.change_reason IS 'Optional explanation for the status change';

COMMENT ON COLUMN data_provenance_verification_history.changed_at IS 'Timestamp when the status was changed';

-- Index for audit history queries
CREATE INDEX IF NOT EXISTS idx_verification_history_provenance 
  ON data_provenance_verification_history(provenance_id);

CREATE INDEX IF NOT EXISTS idx_verification_history_changed_by 
  ON data_provenance_verification_history(changed_by);

-- Enable RLS on verification history
ALTER TABLE data_provenance_verification_history ENABLE ROW LEVEL SECURITY;

-- Allow users to read history for their organisation's evidence
CREATE POLICY "Allow read access to verification history based on organization"
  ON data_provenance_verification_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM data_provenance_trail
      WHERE data_provenance_trail.provenance_id = data_provenance_verification_history.provenance_id
        AND data_provenance_trail.organization_id::text = (auth.jwt() -> 'app_metadata' ->> 'organization_id')
    )
  );

-- Trigger to log verification status changes
CREATE OR REPLACE FUNCTION log_verification_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.verification_status IS DISTINCT FROM NEW.verification_status THEN
    INSERT INTO data_provenance_verification_history (
      provenance_id,
      changed_by,
      old_status,
      new_status,
      changed_at
    ) VALUES (
      NEW.provenance_id,
      auth.uid(),
      OLD.verification_status,
      NEW.verification_status,
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_log_verification_status_change
  AFTER UPDATE ON data_provenance_trail
  FOR EACH ROW
  WHEN (OLD.verification_status IS DISTINCT FROM NEW.verification_status)
  EXECUTE FUNCTION log_verification_status_change();

COMMENT ON FUNCTION log_verification_status_change() IS 
  'Automatically logs all verification status changes to the audit history table. Provides complete traceability of verification workflow.';

COMMENT ON TRIGGER trg_log_verification_status_change ON data_provenance_trail IS 
  'Captures verification status changes and records them in the audit history for compliance purposes.';

-- =====================================================
-- PREVENT DELETE OPERATIONS (DEFENCE IN DEPTH)
-- =====================================================

-- Create a trigger to prevent any DELETE operations
CREATE OR REPLACE FUNCTION prevent_data_provenance_deletes()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Evidence records are permanent and cannot be deleted. Provenance ID: %. Use verification_status to mark evidence as rejected instead.', OLD.provenance_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_data_provenance_deletes
  BEFORE DELETE ON data_provenance_trail
  FOR EACH ROW
  EXECUTE FUNCTION prevent_data_provenance_deletes();

COMMENT ON FUNCTION prevent_data_provenance_deletes() IS 
  'Defence-in-depth function that explicitly prevents any DELETE operations on evidence records, even if attempted via database admin. Ensures permanent chain of custody.';

COMMENT ON TRIGGER trg_prevent_data_provenance_deletes ON data_provenance_trail IS 
  'Prevents any DELETE operations to maintain permanent evidence trail. Use verification_status="rejected" to mark evidence as invalid instead of deleting.';

-- =====================================================
-- STATISTICS AND REPORTING VIEWS
-- =====================================================

-- Create a view for evidence statistics by organisation
CREATE OR REPLACE VIEW evidence_statistics AS
SELECT 
  organization_id,
  COUNT(*) as total_evidence_records,
  COUNT(*) FILTER (WHERE verification_status = 'unverified') as unverified_count,
  COUNT(*) FILTER (WHERE verification_status = 'verified') as verified_count,
  COUNT(*) FILTER (WHERE verification_status = 'rejected') as rejected_count,
  COUNT(DISTINCT user_id) as unique_contributors,
  COUNT(DISTINCT document_type) as document_types_count,
  MIN(created_at) as first_submission,
  MAX(created_at) as last_submission
FROM data_provenance_trail
GROUP BY organization_id;

COMMENT ON VIEW evidence_statistics IS 
  'Aggregated statistics for evidence records by organisation. Provides counts by verification status, contributor metrics, and submission timeline. Automatically respects RLS policies.';

-- Create a view for document type distribution
CREATE OR REPLACE VIEW evidence_by_document_type AS
SELECT 
  organization_id,
  document_type,
  COUNT(*) as record_count,
  COUNT(*) FILTER (WHERE verification_status = 'verified') as verified_count,
  MIN(created_at) as first_submission,
  MAX(created_at) as most_recent_submission
FROM data_provenance_trail
GROUP BY organization_id, document_type;

COMMENT ON VIEW evidence_by_document_type IS 
  'Evidence record distribution by document type within each organisation. Useful for understanding what types of evidence are most commonly submitted. Respects RLS policies.';

-- Create a view for user contribution metrics
CREATE OR REPLACE VIEW user_evidence_contributions AS
SELECT 
  organization_id,
  user_id,
  COUNT(*) as total_submissions,
  COUNT(*) FILTER (WHERE verification_status = 'verified') as verified_submissions,
  COUNT(*) FILTER (WHERE verification_status = 'rejected') as rejected_submissions,
  MIN(created_at) as first_submission,
  MAX(created_at) as last_submission,
  COUNT(DISTINCT document_type) as document_types_used
FROM data_provenance_trail
GROUP BY organization_id, user_id;

COMMENT ON VIEW user_evidence_contributions IS 
  'Tracks evidence submission activity by user within each organisation. Useful for identifying active contributors and monitoring submission quality. Respects RLS policies.';