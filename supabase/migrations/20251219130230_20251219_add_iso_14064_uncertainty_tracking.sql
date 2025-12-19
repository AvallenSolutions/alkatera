/*
  # Add ISO 14064-1:2018 Compliant Uncertainty Tracking

  This migration adds uncertainty tracking capabilities to enable ISO 14064-1:2018
  compliance, specifically addressing Section 5.2.4 (uncertainty assessment requirement).

  ## Business Impact
  - Enables third-party verification for carbon credits
  - Makes platform enterprise-ready (Fortune 500 requirements)
  - Supports carbon market participation
  - Improves ESG ratings

  ## Changes

  1. **calculation_logs table enhancements**
     - `input_uncertainty` (jsonb) - Stores uncertainty data for each input parameter
     - `output_uncertainty` (numeric) - Combined uncertainty percentage for the output
     - `data_quality_tier` (integer, 1-3) - GHG Protocol data quality tier
     - `uncertainty_method` (text) - Method used for uncertainty calculation

  2. **emissions_factors table enhancements**
     - `uncertainty_percentage` (numeric, 0-100) - Default uncertainty for this factor
     - `uncertainty_lower_bound` (numeric) - Lower bound of 95% confidence interval
     - `uncertainty_upper_bound` (numeric) - Upper bound of 95% confidence interval

  3. **Indexes**
     - Fast lookup by data quality tier for reporting
     - Filtered index on output_uncertainty for uncertainty-aware queries

  ## Data Quality Tiers (GHG Protocol)
  - Tier 1: Primary/Measured data (±2-5% uncertainty)
  - Tier 2: Site-specific/Supplier data (±10-20% uncertainty)
  - Tier 3: Industry averages/Estimates (±50-100% uncertainty)

  ## Uncertainty Calculation Method
  Root-sum-square: √(input_uncertainty² + factor_uncertainty²)
*/

-- Add uncertainty columns to calculation_logs
ALTER TABLE calculation_logs
  ADD COLUMN IF NOT EXISTS input_uncertainty JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS output_uncertainty NUMERIC,
  ADD COLUMN IF NOT EXISTS data_quality_tier INTEGER,
  ADD COLUMN IF NOT EXISTS uncertainty_method TEXT DEFAULT 'root_sum_square';

-- Add constraint for data_quality_tier (1-3)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_data_quality_tier_range'
  ) THEN
    ALTER TABLE calculation_logs
      ADD CONSTRAINT chk_data_quality_tier_range
      CHECK (data_quality_tier IS NULL OR (data_quality_tier >= 1 AND data_quality_tier <= 3));
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN calculation_logs.input_uncertainty IS 'JSONB storing uncertainty data for each input parameter (percentage, tier, type)';
COMMENT ON COLUMN calculation_logs.output_uncertainty IS 'Combined uncertainty percentage for the calculated output (95% confidence level)';
COMMENT ON COLUMN calculation_logs.data_quality_tier IS 'GHG Protocol data quality tier: 1=Primary/Measured, 2=Site-specific, 3=Industry average';
COMMENT ON COLUMN calculation_logs.uncertainty_method IS 'Method used for uncertainty calculation (e.g., root_sum_square, monte_carlo)';

-- Add uncertainty columns to emissions_factors
ALTER TABLE emissions_factors
  ADD COLUMN IF NOT EXISTS uncertainty_percentage NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS uncertainty_lower_bound NUMERIC,
  ADD COLUMN IF NOT EXISTS uncertainty_upper_bound NUMERIC;

-- Add constraint for uncertainty_percentage range (0-100)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_uncertainty_percentage_range'
  ) THEN
    ALTER TABLE emissions_factors
      ADD CONSTRAINT chk_uncertainty_percentage_range
      CHECK (uncertainty_percentage >= 0 AND uncertainty_percentage <= 100);
  END IF;
END $$;

-- Add comments for emissions_factors uncertainty columns
COMMENT ON COLUMN emissions_factors.uncertainty_percentage IS 'Default uncertainty percentage for this emission factor (0-100)';
COMMENT ON COLUMN emissions_factors.uncertainty_lower_bound IS 'Lower bound of 95% confidence interval for the factor value';
COMMENT ON COLUMN emissions_factors.uncertainty_upper_bound IS 'Upper bound of 95% confidence interval for the factor value';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_calculation_logs_data_quality_tier 
  ON calculation_logs(data_quality_tier);

CREATE INDEX IF NOT EXISTS idx_calculation_logs_output_uncertainty 
  ON calculation_logs(output_uncertainty) 
  WHERE output_uncertainty IS NOT NULL;

-- Create index for emissions factors with uncertainty data
CREATE INDEX IF NOT EXISTS idx_emissions_factors_uncertainty 
  ON emissions_factors(uncertainty_percentage) 
  WHERE uncertainty_percentage > 0;
