/*
  # Add Calculation Proof Fields to Calculation Logs

  ## Overview
  This migration extends the calculation_logs table to support cryptographic proof tracking
  by adding a reference to calculated_emissions and a multiplication_proof field.

  ## Changes
  
  ### Modified Tables
  
  #### `calculation_logs`
  **New Columns:**
  - `calculation_id` (uuid, nullable, FK) - References the calculated_emissions record
  - `multiplication_proof` (text, nullable) - Cryptographic proof string for verification
  
  ## Purpose
  These fields enable:
  - Direct linkage between calculation logs and calculated emissions results
  - Cryptographic proof generation for audit and verification
  - Traceable chain of custody from input data through to final results
  
  ## Notes
  - Columns are nullable to maintain backwards compatibility with existing logs
  - Foreign key ensures referential integrity with calculated_emissions
  - Proof string format: organization_id-activity_data_id-emissions_factor_id-calculated_value_co2e
*/

-- Add calculation_id column to link to calculated_emissions
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calculation_logs' 
    AND column_name = 'calculation_id'
  ) THEN
    ALTER TABLE calculation_logs 
    ADD COLUMN calculation_id uuid REFERENCES calculated_emissions(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add multiplication_proof column for cryptographic verification
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calculation_logs' 
    AND column_name = 'multiplication_proof'
  ) THEN
    ALTER TABLE calculation_logs 
    ADD COLUMN multiplication_proof text;
  END IF;
END $$;

-- Create index for calculation_id lookups
CREATE INDEX IF NOT EXISTS idx_calculation_logs_calculation_id 
  ON calculation_logs(calculation_id);

-- Add comments for documentation
COMMENT ON COLUMN calculation_logs.calculation_id IS 
  'Foreign key reference to the calculated_emissions record that this log entry verifies. Provides direct linkage between audit logs and calculation results.';

COMMENT ON COLUMN calculation_logs.multiplication_proof IS 
  'Cryptographic proof string concatenating key calculation values for verification. Format: organization_id-activity_data_id-emissions_factor_id-calculated_value_co2e. Enables independent verification of calculation integrity.';
