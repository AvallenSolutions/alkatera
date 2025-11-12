/*
  # Create Calculated Emissions Table for Emissions Results

  ## Overview
  This migration creates the calculated_emissions table to store the results of emissions
  calculations. This table implements the "Glass Box" principle for auditability by maintaining
  clear references to the source activity data and emissions factors used in each calculation.

  ## New Tables
  
  ### `calculated_emissions`
  Stores calculated emissions results with full audit trail linkage.
  
  **Columns:**
  - `id` (uuid, primary key) - Unique identifier for each calculation result
  - `organization_id` (uuid, not null, FK) - Links to the organization that owns this calculation
  - `activity_data_id` (uuid, not null, FK) - References the source activity data used
  - `emissions_factor_id` (uuid, not null, FK) - References the emissions factor applied (factor_id)
  - `calculated_value_co2e` (numeric, not null) - The calculated emissions value in kg CO2e
  - `calculation_timestamp` (timestamptz, not null) - When the calculation was performed
  
  ## Audit Trail & Glass Box Principle
  This table supports full transparency and auditability by:
  - Linking each calculation to its source activity data
  - Recording which emissions factor was used
  - Timestamping when the calculation occurred
  - Allowing reconstruction of calculations for verification
  
  ## Security
  
  ### Row Level Security (RLS)
  - **Enabled:** Yes
  - **Policy:** Organization members can SELECT calculated emissions from their own organization
  
  The policy uses the existing `get_current_organization_id()` helper function to verify
  that the data belongs to the user's organization.

  ## Notes
  - Uses numeric type for calculated_value_co2e to support precise decimal values
  - Foreign key constraints ensure referential integrity across the calculation chain
  - Timestamps default to current time for audit trail
  - Indexes created for common query patterns to optimize performance
  - ON DELETE CASCADE ensures cleanup when source data is removed
*/

-- Create the calculated_emissions table
CREATE TABLE IF NOT EXISTS public.calculated_emissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  activity_data_id uuid NOT NULL REFERENCES public.activity_data(id) ON DELETE CASCADE,
  emissions_factor_id uuid NOT NULL REFERENCES public.emissions_factors(factor_id) ON DELETE CASCADE,
  calculated_value_co2e numeric NOT NULL,
  calculation_timestamp timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.calculated_emissions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow organization members to select calculated emissions
CREATE POLICY "Organization members can select calculated emissions"
  ON public.calculated_emissions
  FOR SELECT
  TO authenticated
  USING (organization_id = get_current_organization_id());

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_calculated_emissions_organization_id 
  ON public.calculated_emissions(organization_id);

CREATE INDEX IF NOT EXISTS idx_calculated_emissions_activity_data_id 
  ON public.calculated_emissions(activity_data_id);

CREATE INDEX IF NOT EXISTS idx_calculated_emissions_emissions_factor_id 
  ON public.calculated_emissions(emissions_factor_id);

CREATE INDEX IF NOT EXISTS idx_calculated_emissions_calculation_timestamp 
  ON public.calculated_emissions(calculation_timestamp);

-- Create a composite index for joining with activity data
CREATE INDEX IF NOT EXISTS idx_calculated_emissions_org_activity 
  ON public.calculated_emissions(organization_id, activity_data_id);
