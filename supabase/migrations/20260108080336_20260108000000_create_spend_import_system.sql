/*
  # AI-Powered Spend Data Import System

  1. New Tables
    - `spend_import_batches`
      - Tracks upload sessions for spend data files
      - Links to organization and corporate report
      - Stores file metadata and processing status

    - `spend_import_items`
      - Stores individual line items from uploaded files
      - Includes AI categorization suggestions with confidence scores
      - Tracks approval status and user overrides
      - Calculates emissions per item

  2. Security
    - Enable RLS on both tables
    - Users can only access their organization's import data
    - Policies for CRUD operations based on organization membership

  3. Indexes
    - Optimize queries on batch_id, status, and suggested_category
    - Enable fast filtering and sorting of import items
*/

-- Create spend_import_batches table
CREATE TABLE IF NOT EXISTS spend_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES corporate_reports(id) ON DELETE CASCADE,
  filename text NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  processed_rows integer NOT NULL DEFAULT 0,
  approved_rows integer NOT NULL DEFAULT 0,
  rejected_rows integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'ready_for_review', 'partially_imported', 'completed', 'failed')),
  error_message text,
  ai_processing_started_at timestamptz,
  ai_processing_completed_at timestamptz,
  imported_at timestamptz,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

-- Create spend_import_items table
CREATE TABLE IF NOT EXISTS spend_import_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES spend_import_batches(id) ON DELETE CASCADE,
  row_number integer NOT NULL,

  -- Raw data from file
  raw_description text NOT NULL,
  raw_amount numeric(12, 2) NOT NULL,
  raw_currency text NOT NULL DEFAULT 'GBP',
  raw_date date,
  raw_vendor text,
  raw_category text,

  -- AI categorization
  suggested_category text CHECK (suggested_category IN (
    'business_travel',
    'purchased_services',
    'capital_goods',
    'downstream_logistics',
    'operational_waste',
    'marketing_materials',
    'employee_commuting',
    'other'
  )),
  ai_confidence_score numeric(5, 2) CHECK (ai_confidence_score >= 0 AND ai_confidence_score <= 100),
  ai_reasoning text,
  ai_processed_at timestamptz,

  -- User approval
  user_approved_category text CHECK (user_approved_category IN (
    'business_travel',
    'purchased_services',
    'capital_goods',
    'downstream_logistics',
    'operational_waste',
    'marketing_materials',
    'employee_commuting',
    'other'
  )),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'imported')),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,

  -- Emissions calculation
  computed_co2e numeric(12, 6),
  emission_factor_id uuid REFERENCES staging_emission_factors(id),
  calculation_notes text,

  -- Audit trail
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Ensure unique row numbers within a batch
  UNIQUE (batch_id, row_number)
);

-- Enable RLS
ALTER TABLE spend_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE spend_import_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for spend_import_batches
CREATE POLICY "Users can view own organization's import batches"
  ON spend_import_batches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = spend_import_batches.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create import batches for own organization"
  ON spend_import_batches FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = spend_import_batches.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own organization's import batches"
  ON spend_import_batches FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = spend_import_batches.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own organization's import batches"
  ON spend_import_batches FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = spend_import_batches.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- RLS Policies for spend_import_items
CREATE POLICY "Users can view own organization's import items"
  ON spend_import_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spend_import_batches b
      JOIN organization_members om ON om.organization_id = b.organization_id
      WHERE b.id = spend_import_items.batch_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create import items for own organization"
  ON spend_import_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM spend_import_batches b
      JOIN organization_members om ON om.organization_id = b.organization_id
      WHERE b.id = spend_import_items.batch_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own organization's import items"
  ON spend_import_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spend_import_batches b
      JOIN organization_members om ON om.organization_id = b.organization_id
      WHERE b.id = spend_import_items.batch_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own organization's import items"
  ON spend_import_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spend_import_batches b
      JOIN organization_members om ON om.organization_id = b.organization_id
      WHERE b.id = spend_import_items.batch_id
      AND om.user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_spend_import_batches_org ON spend_import_batches(organization_id);
CREATE INDEX IF NOT EXISTS idx_spend_import_batches_report ON spend_import_batches(report_id);
CREATE INDEX IF NOT EXISTS idx_spend_import_batches_status ON spend_import_batches(status);
CREATE INDEX IF NOT EXISTS idx_spend_import_items_batch ON spend_import_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_spend_import_items_status ON spend_import_items(status);
CREATE INDEX IF NOT EXISTS idx_spend_import_items_category ON spend_import_items(suggested_category);

-- Create function to update batch statistics
CREATE OR REPLACE FUNCTION update_spend_batch_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE spend_import_batches
  SET
    processed_rows = (
      SELECT COUNT(*) FROM spend_import_items
      WHERE batch_id = NEW.batch_id
      AND ai_processed_at IS NOT NULL
    ),
    approved_rows = (
      SELECT COUNT(*) FROM spend_import_items
      WHERE batch_id = NEW.batch_id
      AND status = 'approved'
    ),
    rejected_rows = (
      SELECT COUNT(*) FROM spend_import_items
      WHERE batch_id = NEW.batch_id
      AND status = 'rejected'
    ),
    updated_at = now()
  WHERE id = NEW.batch_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update batch stats
DROP TRIGGER IF EXISTS trigger_update_spend_batch_stats ON spend_import_items;
CREATE TRIGGER trigger_update_spend_batch_stats
  AFTER INSERT OR UPDATE ON spend_import_items
  FOR EACH ROW
  EXECUTE FUNCTION update_spend_batch_stats();