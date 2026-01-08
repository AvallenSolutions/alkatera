/*
  # Create Bulk Import Sessions Table

  1. New Tables
    - `bulk_import_sessions`
      - `id` (text, primary key) - Unique identifier for the import session
      - `organization_id` (uuid, foreign key) - Organization performing the import
      - `status` (text) - Current status: pending, processing, preview, confirmed, completed, completed_with_errors, failed
      - `file_name` (text) - Name of the uploaded file
      - `parsed_data` (jsonb) - Parsed CSV data including products, items, and errors
      - `created_by` (uuid) - User who created the import
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `bulk_import_sessions` table
    - Add policy for organization members to manage their import sessions
    - Admin-level users (company_admin role) can delete sessions
*/

CREATE TABLE IF NOT EXISTS bulk_import_sessions (
  id text PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'preview', 'confirmed', 'completed', 'completed_with_errors', 'failed')),
  file_name text NOT NULL,
  parsed_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bulk_import_sessions_org ON bulk_import_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_bulk_import_sessions_status ON bulk_import_sessions(status);
CREATE INDEX IF NOT EXISTS idx_bulk_import_sessions_created_by ON bulk_import_sessions(created_by);

ALTER TABLE bulk_import_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view their import sessions"
  ON bulk_import_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = bulk_import_sessions.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can create import sessions"
  ON bulk_import_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = bulk_import_sessions.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization members can update their import sessions"
  ON bulk_import_sessions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = bulk_import_sessions.organization_id
      AND organization_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = bulk_import_sessions.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization admins can delete import sessions"
  ON bulk_import_sessions
  FOR DELETE
  TO authenticated
  USING (
    get_my_organization_role(organization_id) = 'company_admin'
  );

CREATE OR REPLACE FUNCTION update_bulk_import_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_bulk_import_sessions_updated_at ON bulk_import_sessions;

CREATE TRIGGER trigger_bulk_import_sessions_updated_at
  BEFORE UPDATE ON bulk_import_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_bulk_import_sessions_updated_at();
