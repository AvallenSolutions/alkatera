/*
  # Create Corporate Carbon Footprint (CCF) Tables

  1. New Tables
    - `corporate_reports`
      - `id` (uuid, primary key) - Unique report identifier
      - `organization_id` (uuid, foreign key) - Links to organization
      - `year` (integer) - Reporting year (e.g., 2024)
      - `status` (text) - Report status: Draft or Finalized
      - `total_emissions` (float) - Total CO2e for quick retrieval
      - `breakdown_json` (jsonb) - Frozen snapshot of Scope 1, 2, 3 breakdown
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
      - `finalized_at` (timestamptz) - When report was finalized

    - `corporate_overheads`
      - `id` (uuid, primary key) - Unique overhead entry
      - `report_id` (uuid, foreign key) - Links to corporate report
      - `category` (text) - Scope 3 category type
      - `spend_amount` (float) - Monetary spend amount
      - `currency` (text) - Currency code (GBP, USD, EUR)
      - `emission_factor` (float) - EEIO factor used
      - `computed_co2e` (float) - Calculated emissions
      - `created_at` (timestamptz) - Creation timestamp

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their organization's reports

  3. Purpose
    - Store ISO-compliant annual carbon footprint snapshots
    - Capture gap-fill data for Scope 3 categories not in product recipes
    - Enable hybrid bottom-up + top-down carbon accounting
*/

-- Create corporate_reports table
CREATE TABLE IF NOT EXISTS corporate_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  year integer NOT NULL CHECK (year >= 2000 AND year <= 2100),
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Finalized')),
  total_emissions float DEFAULT 0,
  breakdown_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  finalized_at timestamptz,
  UNIQUE(organization_id, year)
);

-- Create corporate_overheads table
CREATE TABLE IF NOT EXISTS corporate_overheads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES corporate_reports(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN (
    'business_travel',
    'purchased_services',
    'employee_commuting',
    'capital_goods',
    'upstream_transportation',
    'waste_disposal',
    'other'
  )),
  spend_amount float NOT NULL CHECK (spend_amount >= 0),
  currency text NOT NULL DEFAULT 'GBP' CHECK (currency IN ('GBP', 'USD', 'EUR')),
  emission_factor float,
  computed_co2e float,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_corporate_reports_organization_id ON corporate_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_corporate_reports_year ON corporate_reports(year);
CREATE INDEX IF NOT EXISTS idx_corporate_reports_status ON corporate_reports(status);
CREATE INDEX IF NOT EXISTS idx_corporate_overheads_report_id ON corporate_overheads(report_id);
CREATE INDEX IF NOT EXISTS idx_corporate_overheads_category ON corporate_overheads(category);

-- Enable RLS
ALTER TABLE corporate_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_overheads ENABLE ROW LEVEL SECURITY;

-- Policies for corporate_reports
CREATE POLICY "Users can view own organization corporate reports"
  ON corporate_reports
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own organization corporate reports"
  ON corporate_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own organization corporate reports"
  ON corporate_reports
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own organization corporate reports"
  ON corporate_reports
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Policies for corporate_overheads
CREATE POLICY "Users can view corporate overheads for their reports"
  ON corporate_overheads
  FOR SELECT
  TO authenticated
  USING (
    report_id IN (
      SELECT id
      FROM corporate_reports
      WHERE organization_id IN (
        SELECT organization_id
        FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert corporate overheads for their reports"
  ON corporate_overheads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    report_id IN (
      SELECT id
      FROM corporate_reports
      WHERE organization_id IN (
        SELECT organization_id
        FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update corporate overheads for their reports"
  ON corporate_overheads
  FOR UPDATE
  TO authenticated
  USING (
    report_id IN (
      SELECT id
      FROM corporate_reports
      WHERE organization_id IN (
        SELECT organization_id
        FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    report_id IN (
      SELECT id
      FROM corporate_reports
      WHERE organization_id IN (
        SELECT organization_id
        FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete corporate overheads for their reports"
  ON corporate_overheads
  FOR DELETE
  TO authenticated
  USING (
    report_id IN (
      SELECT id
      FROM corporate_reports
      WHERE organization_id IN (
        SELECT organization_id
        FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_corporate_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_corporate_reports_updated_at
  BEFORE UPDATE ON corporate_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_corporate_reports_updated_at();

-- Helper function to get EEIO emission factors
CREATE OR REPLACE FUNCTION get_eeio_emission_factor(
  p_category text,
  p_currency text DEFAULT 'GBP'
)
RETURNS float AS $$
BEGIN
  -- Default EEIO factors (kgCO2e per currency unit)
  -- These are simplified examples - replace with actual EEIO factors
  RETURN CASE
    WHEN p_category = 'business_travel' THEN 0.25
    WHEN p_category = 'purchased_services' THEN 0.15
    WHEN p_category = 'employee_commuting' THEN 0.20
    WHEN p_category = 'capital_goods' THEN 0.30
    WHEN p_category = 'upstream_transportation' THEN 0.35
    WHEN p_category = 'waste_disposal' THEN 0.10
    ELSE 0.20
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
