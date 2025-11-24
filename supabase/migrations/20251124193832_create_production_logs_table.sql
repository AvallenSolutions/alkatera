/*
  # Create Production Logs Table

  1. New Tables
    - `production_logs`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `facility_id` (uuid, foreign key to facilities)
      - `product_id` (uuid, foreign key to products)
      - `date` (date)
      - `volume` (float)
      - `unit` (text, enum: Litre, Hectolitre, Unit)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `production_logs` table
    - Add policies for authenticated users to manage their organization's production logs

  3. Purpose
    - Track production volumes by facility and product
    - Acts as allocation key (denominator) for Scope 1 & 2 emission intensity calculations
    - Enables accurate per-product carbon footprint allocation
*/

-- Create production_logs table
CREATE TABLE IF NOT EXISTS production_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  volume float NOT NULL CHECK (volume > 0),
  unit text NOT NULL DEFAULT 'Litre' CHECK (unit IN ('Litre', 'Hectolitre', 'Unit')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_production_logs_organization_id ON production_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_production_logs_facility_id ON production_logs(facility_id);
CREATE INDEX IF NOT EXISTS idx_production_logs_product_id ON production_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_production_logs_date ON production_logs(date);
CREATE INDEX IF NOT EXISTS idx_production_logs_facility_date ON production_logs(facility_id, date);

-- Enable RLS
ALTER TABLE production_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view production logs for their organization
CREATE POLICY "Users can view own organization production logs"
  ON production_logs
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can insert production logs for their organization
CREATE POLICY "Users can insert own organization production logs"
  ON production_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can update production logs for their organization
CREATE POLICY "Users can update own organization production logs"
  ON production_logs
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

-- Policy: Users can delete production logs for their organization
CREATE POLICY "Users can delete own organization production logs"
  ON production_logs
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_production_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_production_logs_updated_at
  BEFORE UPDATE ON production_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_production_logs_updated_at();

-- Create helper function to get total facility volume for a period
CREATE OR REPLACE FUNCTION get_facility_production_volume(
  p_facility_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  total_volume_litres float,
  product_count integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    SUM(
      CASE
        WHEN unit = 'Litre' THEN volume
        WHEN unit = 'Hectolitre' THEN volume * 100
        WHEN unit = 'Unit' THEN volume
        ELSE volume
      END
    ) AS total_volume_litres,
    COUNT(DISTINCT product_id)::integer AS product_count
  FROM production_logs
  WHERE
    facility_id = p_facility_id
    AND date BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
