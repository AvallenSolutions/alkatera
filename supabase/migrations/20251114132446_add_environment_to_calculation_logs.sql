/*
  # Add Environment Tracking to Calculation Logs

  1. Changes to `product_lca_calculation_logs`
    - Add `environment` column to track execution environment
    - Supports environment-aware auditing and debugging

  2. Notes
    - Environment values typically: 'local_dev', 'staging', 'production'
    - Enables filtering logs by environment for troubleshooting
    - Critical for compliance and audit trails
*/

-- Add environment column to product_lca_calculation_logs
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_lca_calculation_logs' 
    AND column_name = 'environment'
  ) THEN
    ALTER TABLE public.product_lca_calculation_logs 
    ADD COLUMN environment TEXT;
  END IF;
END $$;

-- Create index for filtering by environment
CREATE INDEX IF NOT EXISTS idx_lca_calc_logs_environment 
ON public.product_lca_calculation_logs(environment);

-- Add comment for documentation
COMMENT ON COLUMN public.product_lca_calculation_logs.environment IS 
'Execution environment where calculation was performed (e.g., local_dev, staging, production)';