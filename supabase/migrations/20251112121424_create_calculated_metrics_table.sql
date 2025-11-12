/*
  # Create Calculated Metrics Table

  1. New Tables
    - `calculated_metrics`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `metric_type` (text, type of metric e.g., 'blue_water_footprint', 'green_water_footprint')
      - `metric_value` (numeric, calculated value)
      - `metric_unit` (text, unit of measurement)
      - `activity_data_id` (uuid, optional foreign key to activity_data)
      - `source_log_id` (uuid, foreign key to calculation_logs)
      - `calculation_date` (timestamptz)
      - `reporting_period_start` (date, optional)
      - `reporting_period_end` (date, optional)
      - `metadata` (jsonb, optional additional data)
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on `calculated_metrics` table
    - Add policy for organization members to read metrics
    - Add policy for authenticated users to insert metrics (service role)
  
  3. Indexes
    - Index on organization_id for efficient queries
    - Index on metric_type for filtering
    - Index on source_log_id for traceability
*/

-- Create calculated_metrics table
CREATE TABLE IF NOT EXISTS calculated_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric_type text NOT NULL,
  metric_value numeric NOT NULL,
  metric_unit text NOT NULL,
  activity_data_id uuid REFERENCES activity_data(id) ON DELETE SET NULL,
  source_log_id uuid REFERENCES calculation_logs(log_id) ON DELETE CASCADE,
  calculation_date timestamptz NOT NULL DEFAULT now(),
  reporting_period_start date,
  reporting_period_end date,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_calculated_metrics_organization_id ON calculated_metrics(organization_id);
CREATE INDEX IF NOT EXISTS idx_calculated_metrics_metric_type ON calculated_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_calculated_metrics_source_log_id ON calculated_metrics(source_log_id);
CREATE INDEX IF NOT EXISTS idx_calculated_metrics_activity_data_id ON calculated_metrics(activity_data_id);

-- Enable RLS
ALTER TABLE calculated_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Organization members can view calculated metrics
CREATE POLICY "Organization members can view calculated metrics"
  ON calculated_metrics FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Service role can insert calculated metrics
CREATE POLICY "Service role can insert calculated metrics"
  ON calculated_metrics FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Service role can update calculated metrics
CREATE POLICY "Service role can update calculated metrics"
  ON calculated_metrics FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Service role can delete calculated metrics
CREATE POLICY "Service role can delete calculated metrics"
  ON calculated_metrics FOR DELETE
  TO authenticated
  USING (true);
