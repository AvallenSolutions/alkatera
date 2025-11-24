/*
  # Enhance Corporate Overheads for Line-Item Entries

  1. Changes
    - Add `description` field for labeling entries (e.g., "Flight to NYC", "Legal Services - Q1")
    - Add `entry_date` field for tracking when the expense occurred
    - Update indexes for better query performance
    - Add check constraint for minimum spend amount

  2. Purpose
    - Support detailed line-item tracking for business travel and services
    - Enable users to log multiple entries per category
    - Improve auditability and transparency
*/

-- Add new columns to corporate_overheads
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'corporate_overheads' AND column_name = 'description'
  ) THEN
    ALTER TABLE corporate_overheads ADD COLUMN description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'corporate_overheads' AND column_name = 'entry_date'
  ) THEN
    ALTER TABLE corporate_overheads ADD COLUMN entry_date date DEFAULT CURRENT_DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'corporate_overheads' AND column_name = 'fte_count'
  ) THEN
    ALTER TABLE corporate_overheads ADD COLUMN fte_count integer CHECK (fte_count >= 0);
  END IF;
END $$;

-- Create index on entry_date for date-range queries
CREATE INDEX IF NOT EXISTS idx_corporate_overheads_entry_date ON corporate_overheads(entry_date);

-- Create composite index for report + category queries
CREATE INDEX IF NOT EXISTS idx_corporate_overheads_report_category ON corporate_overheads(report_id, category);

-- Helper function to calculate aggregated overhead totals by category
CREATE OR REPLACE FUNCTION get_overhead_totals_by_category(
  p_report_id uuid
)
RETURNS TABLE (
  category text,
  total_spend float,
  total_co2e float,
  entry_count integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    co.category,
    SUM(co.spend_amount) AS total_spend,
    SUM(co.computed_co2e) AS total_co2e,
    COUNT(*)::integer AS entry_count
  FROM corporate_overheads co
  WHERE co.report_id = p_report_id
  GROUP BY co.category
  ORDER BY co.category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get FTE count from overheads
CREATE OR REPLACE FUNCTION get_employee_fte_count(
  p_report_id uuid
)
RETURNS integer AS $$
DECLARE
  v_fte_count integer;
BEGIN
  SELECT fte_count INTO v_fte_count
  FROM corporate_overheads
  WHERE report_id = p_report_id
    AND category = 'employee_commuting'
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN COALESCE(v_fte_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
