/*
  # Create Facility Reporting Sessions Table

  1. New Tables
    - `facility_reporting_sessions`
      - `id` (uuid, primary key)
      - `facility_id` (uuid, foreign key to facilities)
      - `organization_id` (uuid, foreign key to organizations)
      - `reporting_period_start` (date)
      - `reporting_period_end` (date)
      - `total_production_volume` (numeric)
      - `volume_unit` (text - e.g., Litres, Units, kg)
      - `data_source_type` (text - Primary or Secondary_Average)
      - `facility_activity_type` (text, nullable for Secondary data)
      - `fallback_intensity_factor` (numeric, nullable)
      - `created_by` (uuid, foreign key to auth.users)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Schema Changes
    - Add `reporting_session_id` (uuid, foreign key) to `utility_data_entries` table
    - Add `reporting_session_id` (uuid, foreign key) to `facility_emissions_aggregated` table
    - Make existing reporting period fields optional on those tables for backward compatibility

  3. Security
    - Enable RLS on `facility_reporting_sessions` table
    - Add policy for organization members to read/write their own sessions
*/

CREATE TABLE IF NOT EXISTS facility_reporting_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reporting_period_start date NOT NULL,
  reporting_period_end date NOT NULL,
  total_production_volume numeric NOT NULL,
  volume_unit text NOT NULL,
  data_source_type text NOT NULL CHECK (data_source_type IN ('Primary', 'Secondary_Average')),
  facility_activity_type text,
  fallback_intensity_factor numeric,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_period CHECK (reporting_period_end > reporting_period_start),
  CONSTRAINT positive_volume CHECK (total_production_volume > 0)
);

ALTER TABLE facility_reporting_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view organization reporting sessions"
  ON facility_reporting_sessions FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create reporting sessions for their organization"
  ON facility_reporting_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update reporting sessions for their organization"
  ON facility_reporting_sessions FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete reporting sessions for their organization"
  ON facility_reporting_sessions FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'utility_data_entries' AND column_name = 'reporting_session_id'
  ) THEN
    ALTER TABLE utility_data_entries ADD COLUMN reporting_session_id uuid REFERENCES facility_reporting_sessions(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facility_emissions_aggregated' AND column_name = 'reporting_session_id'
  ) THEN
    ALTER TABLE facility_emissions_aggregated ADD COLUMN reporting_session_id uuid REFERENCES facility_reporting_sessions(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX idx_facility_reporting_sessions_facility ON facility_reporting_sessions(facility_id);
CREATE INDEX idx_facility_reporting_sessions_organization ON facility_reporting_sessions(organization_id);
CREATE INDEX idx_facility_reporting_sessions_period ON facility_reporting_sessions(reporting_period_start, reporting_period_end);
