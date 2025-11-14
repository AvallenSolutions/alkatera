/*
  # Create Facility Emissions Aggregated Table

  1. New Table: `facility_emissions_aggregated`
    - `id` (uuid, primary key)
    - `facility_id` (uuid, foreign key to facilities)
    - `organization_id` (uuid, foreign key to organizations)
    - `reporting_period_start` (date)
    - `reporting_period_end` (date)
    - `total_co2e` (numeric)
    - `unit` (text, default 'kg CO₂e')
    - `results_payload` (jsonb) - Immutable snapshot containing:
      * disaggregated_summary: Object with emission source totals
      * activity_data_ids: Array of activity data record UUIDs
      * emission_factor_ids: Array of emission factor record UUIDs
    - `calculation_date` (timestamptz)
    - `calculated_by` (uuid, foreign key to auth.users)
    - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Policies for organization-based access
    - Prevent duplicate calculations for same facility/period

  3. Notes
    - Supports corporate-level emissions aggregation
    - Provides complete audit trail with disaggregated data
    - Single source of truth for facility emissions reporting
*/

-- Create facility_emissions_aggregated table
CREATE TABLE IF NOT EXISTS public.facility_emissions_aggregated (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    reporting_period_start DATE NOT NULL,
    reporting_period_end DATE NOT NULL,
    total_co2e NUMERIC NOT NULL,
    unit TEXT NOT NULL DEFAULT 'kg CO₂e',
    results_payload JSONB NOT NULL,
    calculation_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    calculated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_facility_period UNIQUE (facility_id, reporting_period_start, reporting_period_end)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_facility_emissions_agg_facility_id 
ON public.facility_emissions_aggregated(facility_id);

CREATE INDEX IF NOT EXISTS idx_facility_emissions_agg_org_id 
ON public.facility_emissions_aggregated(organization_id);

CREATE INDEX IF NOT EXISTS idx_facility_emissions_agg_period 
ON public.facility_emissions_aggregated(reporting_period_start, reporting_period_end);

CREATE INDEX IF NOT EXISTS idx_facility_emissions_agg_calc_date 
ON public.facility_emissions_aggregated(calculation_date DESC);

-- Create GIN index for JSONB payload queries
CREATE INDEX IF NOT EXISTS idx_facility_emissions_agg_results_payload 
ON public.facility_emissions_aggregated USING GIN (results_payload);

-- Enable RLS
ALTER TABLE public.facility_emissions_aggregated ENABLE ROW LEVEL SECURITY;

-- RLS Policy for viewing emissions data
CREATE POLICY "Users can view emissions for their organization's facilities"
ON public.facility_emissions_aggregated
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.organization_members
        WHERE organization_members.organization_id = facility_emissions_aggregated.organization_id
        AND organization_members.user_id = auth.uid()
    )
);

-- RLS Policy for inserting emissions data (service role only)
CREATE POLICY "Service role can insert facility emissions"
ON public.facility_emissions_aggregated
FOR INSERT
TO service_role
WITH CHECK (true);

-- RLS Policy for updating emissions data (service role only)
CREATE POLICY "Service role can update facility emissions"
ON public.facility_emissions_aggregated
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE public.facility_emissions_aggregated IS 
'Aggregated Scope 1 and Scope 2 emissions calculations for facilities by reporting period';

COMMENT ON COLUMN public.facility_emissions_aggregated.results_payload IS 
'Immutable calculation snapshot containing disaggregated_summary, activity_data_ids, and emission_factor_ids';

COMMENT ON COLUMN public.facility_emissions_aggregated.total_co2e IS 
'Total CO₂ equivalent emissions for the facility in the reporting period';

COMMENT ON CONSTRAINT unique_facility_period ON public.facility_emissions_aggregated IS 
'Prevents duplicate calculations for the same facility and reporting period';