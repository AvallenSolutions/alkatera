/*
  # Create Facilities Table

  1. New Tables
    - `facilities`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `name` (text, facility name)
      - `location` (text, optional physical location)
      - `facility_type` (text, optional type classification)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `facilities` table
    - Add policy for organization members to read facilities
    - Add policy for admins to manage facilities
  
  3. Indexes
    - Index on organization_id for efficient queries
*/

-- Create facilities table
CREATE TABLE IF NOT EXISTS facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text,
  facility_type text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for efficient organization queries
CREATE INDEX IF NOT EXISTS idx_facilities_organization_id ON facilities(organization_id);

-- Enable RLS
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;

-- Policy: Organization members can view facilities
CREATE POLICY "Organization members can view facilities"
  ON facilities FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Organization admins can insert facilities
CREATE POLICY "Organization admins can create facilities"
  ON facilities FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

-- Policy: Organization admins can update facilities
CREATE POLICY "Organization admins can update facilities"
  ON facilities FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

-- Policy: Organization admins can delete facilities
CREATE POLICY "Organization admins can delete facilities"
  ON facilities FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_facilities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER facilities_updated_at
  BEFORE UPDATE ON facilities
  FOR EACH ROW
  EXECUTE FUNCTION update_facilities_updated_at();
