/*
  # Contract Manufacturer Allocation System - ISO 14067 Compliant

  This migration creates the core infrastructure for tracking emissions from contract 
  manufacturers using physical allocation methodology per ISO 14044/14067 requirements.

  ## Overview
  
  The system implements time-bound allocation snapshots where each submission represents
  a discrete reporting period. This preserves temporal integrity for accurate emission
  factor application - data from 2023 uses 2023 factors, 2024 uses 2024 factors.

  ## New Tables

  1. **contract_manufacturer_allocations**
     - Core table storing allocation data for contract manufacturers
     - Each record is a time-stamped snapshot tied to specific reporting period
     - Stores BOTH raw energy data AND converted CO2e for audit trail and recalculation
     
  2. **contract_manufacturer_energy_inputs**
     - Detailed energy consumption breakdown by fuel type
     - Enables recalculation when emission factors are updated
     - Links to main allocation record

  ## Key Columns - contract_manufacturer_allocations

  - Reporting Period: reporting_period_start, reporting_period_end (time-bound snapshot)
  - Input A: total_facility_production_volume, production_volume_unit
  - Input B: total_facility_co2e_kg (with dual storage via energy_inputs table)
  - Input C: client_production_volume
  - Calculated: attribution_ratio, allocated_emissions_kg_co2e, emission_intensity
  - Status: draft, provisional, verified, approved
  - Flags: is_energy_intensive_process triggers provisional status

  ## Security
  
  - RLS enabled on all tables
  - Organization-scoped access for standard users
  - Admin-only access for verification actions

  ## Important Notes

  1. Each allocation is a LOCKED time-stamped record once submitted
  2. Overlapping reporting periods for same product-facility are prevented
  3. Raw energy data enables retrospective recalculation when factors update
  4. Provisional status blocks final report generation until verified
*/

-- Create contract_manufacturer_allocations table
CREATE TABLE IF NOT EXISTS public.contract_manufacturer_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  
  -- Reporting Period (Time-Bound Snapshot)
  reporting_period_start DATE NOT NULL,
  reporting_period_end DATE NOT NULL,
  
  -- Input A: Total Facility Production
  total_facility_production_volume NUMERIC NOT NULL CHECK (total_facility_production_volume > 0),
  production_volume_unit TEXT NOT NULL DEFAULT 'units',
  
  -- Input B: Facility Energy & Emissions (Dual Storage)
  total_facility_co2e_kg NUMERIC NOT NULL CHECK (total_facility_co2e_kg >= 0),
  co2e_entry_method TEXT NOT NULL DEFAULT 'direct' CHECK (co2e_entry_method IN ('direct', 'calculated_from_energy')),
  emission_factor_year INTEGER,
  emission_factor_source TEXT,
  
  -- Input C: Client Production Volume  
  client_production_volume NUMERIC NOT NULL CHECK (client_production_volume > 0),
  
  -- Calculated Results
  attribution_ratio NUMERIC CHECK (attribution_ratio >= 0 AND attribution_ratio <= 1),
  allocated_emissions_kg_co2e NUMERIC,
  emission_intensity_kg_co2e_per_unit NUMERIC,
  
  -- Status & Flags
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'provisional', 'verified', 'approved')),
  is_energy_intensive_process BOOLEAN NOT NULL DEFAULT false,
  energy_intensive_notes TEXT,
  data_source_tag TEXT NOT NULL DEFAULT 'Primary - Allocated',
  data_quality_score INTEGER CHECK (data_quality_score >= 1 AND data_quality_score <= 5),
  
  -- Audit & Verification
  created_by UUID REFERENCES auth.users(id),
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  verification_notes TEXT,
  calculation_metadata JSONB DEFAULT '{}',
  
  -- Evidence & Documentation
  supporting_evidence_urls TEXT[] DEFAULT '{}',
  supplier_invoice_ref TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_reporting_period CHECK (reporting_period_end > reporting_period_start),
  CONSTRAINT valid_client_volume CHECK (client_production_volume <= total_facility_production_volume)
);

-- Add comments for documentation
COMMENT ON TABLE public.contract_manufacturer_allocations IS 'ISO 14067 compliant physical allocation records for contract manufacturers. Each record is a time-bound snapshot tied to specific reporting period.';
COMMENT ON COLUMN public.contract_manufacturer_allocations.reporting_period_start IS 'Start date of allocation period - ensures temporal integrity for emission factor application';
COMMENT ON COLUMN public.contract_manufacturer_allocations.reporting_period_end IS 'End date of allocation period - data is locked to this specific timeframe';
COMMENT ON COLUMN public.contract_manufacturer_allocations.total_facility_co2e_kg IS 'Total facility CO2e - stored for performance, can be recalculated from energy inputs';
COMMENT ON COLUMN public.contract_manufacturer_allocations.co2e_entry_method IS 'Indicates whether CO2e was entered directly or calculated from raw energy data';
COMMENT ON COLUMN public.contract_manufacturer_allocations.attribution_ratio IS 'Physical allocation ratio: client_volume / total_volume (0-1)';
COMMENT ON COLUMN public.contract_manufacturer_allocations.status IS 'Workflow status: draft, provisional (pending verification), verified, approved';
COMMENT ON COLUMN public.contract_manufacturer_allocations.is_energy_intensive_process IS 'Flag indicating process required unusual energy - triggers provisional status';
COMMENT ON COLUMN public.contract_manufacturer_allocations.calculation_metadata IS 'Complete calculation chain for Glass Box audit trail';

-- Create contract_manufacturer_energy_inputs table for raw energy data storage
CREATE TABLE IF NOT EXISTS public.contract_manufacturer_energy_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id UUID NOT NULL REFERENCES public.contract_manufacturer_allocations(id) ON DELETE CASCADE,
  
  -- Raw Energy Data
  fuel_type TEXT NOT NULL,
  consumption_value NUMERIC NOT NULL CHECK (consumption_value >= 0),
  consumption_unit TEXT NOT NULL,
  
  -- Emission Factor Applied
  emission_factor_used NUMERIC NOT NULL CHECK (emission_factor_used >= 0),
  emission_factor_unit TEXT NOT NULL,
  emission_factor_year INTEGER NOT NULL,
  emission_factor_source TEXT NOT NULL DEFAULT 'DEFRA',
  
  -- Calculated Result
  calculated_co2e_kg NUMERIC NOT NULL CHECK (calculated_co2e_kg >= 0),
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.contract_manufacturer_energy_inputs IS 'Raw energy consumption data by fuel type. Enables retrospective recalculation when emission factors are updated.';
COMMENT ON COLUMN public.contract_manufacturer_energy_inputs.fuel_type IS 'Type of energy source: grid_electricity, natural_gas, diesel, lpg, biomass, etc.';
COMMENT ON COLUMN public.contract_manufacturer_energy_inputs.consumption_value IS 'Original consumption value as reported - immutable source data';
COMMENT ON COLUMN public.contract_manufacturer_energy_inputs.emission_factor_used IS 'Emission factor applied at time of calculation - stored for audit';
COMMENT ON COLUMN public.contract_manufacturer_energy_inputs.calculated_co2e_kg IS 'CO2e calculated from this energy source';

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_cma_organization_id 
  ON public.contract_manufacturer_allocations(organization_id);

CREATE INDEX IF NOT EXISTS idx_cma_product_id 
  ON public.contract_manufacturer_allocations(product_id);

CREATE INDEX IF NOT EXISTS idx_cma_facility_id 
  ON public.contract_manufacturer_allocations(facility_id);

CREATE INDEX IF NOT EXISTS idx_cma_status 
  ON public.contract_manufacturer_allocations(status);

CREATE INDEX IF NOT EXISTS idx_cma_reporting_period 
  ON public.contract_manufacturer_allocations(reporting_period_start, reporting_period_end);

CREATE INDEX IF NOT EXISTS idx_cma_org_product_facility 
  ON public.contract_manufacturer_allocations(organization_id, product_id, facility_id);

CREATE INDEX IF NOT EXISTS idx_cmei_allocation_id 
  ON public.contract_manufacturer_energy_inputs(allocation_id);

-- Unique constraint to prevent overlapping periods for same product-facility combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_cma_unique_period_product_facility 
  ON public.contract_manufacturer_allocations(product_id, facility_id, reporting_period_start, reporting_period_end);

-- Enable RLS
ALTER TABLE public.contract_manufacturer_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_manufacturer_energy_inputs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contract_manufacturer_allocations

-- SELECT: Organization members can view their allocations
CREATE POLICY "Organization members can view allocations"
  ON public.contract_manufacturer_allocations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = contract_manufacturer_allocations.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- INSERT: Organization members can create allocations
CREATE POLICY "Organization members can create allocations"
  ON public.contract_manufacturer_allocations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = contract_manufacturer_allocations.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- UPDATE: Organization members can update draft/provisional allocations, admins can update any
CREATE POLICY "Organization members can update allocations"
  ON public.contract_manufacturer_allocations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = contract_manufacturer_allocations.organization_id
      AND om.user_id = auth.uid()
    )
    AND (
      status IN ('draft', 'provisional')
      OR EXISTS (
        SELECT 1 FROM public.organization_members om
        JOIN public.roles r ON om.role_id = r.id
        WHERE om.organization_id = contract_manufacturer_allocations.organization_id
        AND om.user_id = auth.uid()
        AND r.name IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = contract_manufacturer_allocations.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- DELETE: Only admins can delete allocations
CREATE POLICY "Admins can delete allocations"
  ON public.contract_manufacturer_allocations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.roles r ON om.role_id = r.id
      WHERE om.organization_id = contract_manufacturer_allocations.organization_id
      AND om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

-- RLS Policies for contract_manufacturer_energy_inputs

-- SELECT: Users can view energy inputs for their organization's allocations
CREATE POLICY "Users can view energy inputs for their allocations"
  ON public.contract_manufacturer_energy_inputs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contract_manufacturer_allocations cma
      JOIN public.organization_members om ON om.organization_id = cma.organization_id
      WHERE cma.id = contract_manufacturer_energy_inputs.allocation_id
      AND om.user_id = auth.uid()
    )
  );

-- INSERT: Users can insert energy inputs for their allocations
CREATE POLICY "Users can insert energy inputs for their allocations"
  ON public.contract_manufacturer_energy_inputs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contract_manufacturer_allocations cma
      JOIN public.organization_members om ON om.organization_id = cma.organization_id
      WHERE cma.id = contract_manufacturer_energy_inputs.allocation_id
      AND om.user_id = auth.uid()
    )
  );

-- UPDATE: Users can update energy inputs for draft/provisional allocations
CREATE POLICY "Users can update energy inputs for draft allocations"
  ON public.contract_manufacturer_energy_inputs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contract_manufacturer_allocations cma
      JOIN public.organization_members om ON om.organization_id = cma.organization_id
      WHERE cma.id = contract_manufacturer_energy_inputs.allocation_id
      AND om.user_id = auth.uid()
      AND cma.status IN ('draft', 'provisional')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contract_manufacturer_allocations cma
      JOIN public.organization_members om ON om.organization_id = cma.organization_id
      WHERE cma.id = contract_manufacturer_energy_inputs.allocation_id
      AND om.user_id = auth.uid()
    )
  );

-- DELETE: Cascade from parent allocation handles this
CREATE POLICY "Users can delete energy inputs for draft allocations"
  ON public.contract_manufacturer_energy_inputs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contract_manufacturer_allocations cma
      JOIN public.organization_members om ON om.organization_id = cma.organization_id
      WHERE cma.id = contract_manufacturer_energy_inputs.allocation_id
      AND om.user_id = auth.uid()
      AND cma.status IN ('draft', 'provisional')
    )
  );

-- Function to calculate allocation metrics
CREATE OR REPLACE FUNCTION calculate_allocation_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate attribution ratio
  IF NEW.total_facility_production_volume > 0 THEN
    NEW.attribution_ratio := NEW.client_production_volume / NEW.total_facility_production_volume;
  ELSE
    NEW.attribution_ratio := 0;
  END IF;
  
  -- Calculate allocated emissions
  NEW.allocated_emissions_kg_co2e := NEW.total_facility_co2e_kg * NEW.attribution_ratio;
  
  -- Calculate emission intensity per unit
  IF NEW.client_production_volume > 0 THEN
    NEW.emission_intensity_kg_co2e_per_unit := NEW.allocated_emissions_kg_co2e / NEW.client_production_volume;
  ELSE
    NEW.emission_intensity_kg_co2e_per_unit := 0;
  END IF;
  
  -- Auto-set status to provisional if energy-intensive flag is set
  IF NEW.is_energy_intensive_process = true AND NEW.status = 'draft' THEN
    NEW.status := 'provisional';
  END IF;
  
  -- Set verified status if not energy-intensive and being submitted
  IF NEW.is_energy_intensive_process = false AND NEW.status = 'draft' AND NEW.locked_at IS NOT NULL THEN
    NEW.status := 'verified';
  END IF;
  
  -- Store calculation metadata for audit trail
  NEW.calculation_metadata := jsonb_build_object(
    'calculation_timestamp', now(),
    'formula', 'allocated_emissions = total_facility_co2e * (client_volume / total_volume)',
    'inputs', jsonb_build_object(
      'total_facility_co2e_kg', NEW.total_facility_co2e_kg,
      'total_facility_production_volume', NEW.total_facility_production_volume,
      'client_production_volume', NEW.client_production_volume,
      'production_volume_unit', NEW.production_volume_unit
    ),
    'outputs', jsonb_build_object(
      'attribution_ratio', NEW.attribution_ratio,
      'allocated_emissions_kg_co2e', NEW.allocated_emissions_kg_co2e,
      'emission_intensity_kg_co2e_per_unit', NEW.emission_intensity_kg_co2e_per_unit
    ),
    'emission_factor_metadata', jsonb_build_object(
      'year', NEW.emission_factor_year,
      'source', NEW.emission_factor_source,
      'entry_method', NEW.co2e_entry_method
    )
  );
  
  -- Update timestamp
  NEW.updated_at := now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate metrics on insert/update
DROP TRIGGER IF EXISTS trigger_calculate_allocation_metrics ON public.contract_manufacturer_allocations;
CREATE TRIGGER trigger_calculate_allocation_metrics
  BEFORE INSERT OR UPDATE ON public.contract_manufacturer_allocations
  FOR EACH ROW
  EXECUTE FUNCTION calculate_allocation_metrics();

-- Function to recalculate energy inputs total
CREATE OR REPLACE FUNCTION recalculate_allocation_from_energy_inputs()
RETURNS TRIGGER AS $$
DECLARE
  total_co2e NUMERIC;
BEGIN
  -- Sum all energy input CO2e for this allocation
  SELECT COALESCE(SUM(calculated_co2e_kg), 0)
  INTO total_co2e
  FROM public.contract_manufacturer_energy_inputs
  WHERE allocation_id = COALESCE(NEW.allocation_id, OLD.allocation_id);
  
  -- Update the parent allocation if using calculated_from_energy method
  UPDATE public.contract_manufacturer_allocations
  SET 
    total_facility_co2e_kg = total_co2e,
    updated_at = now()
  WHERE id = COALESCE(NEW.allocation_id, OLD.allocation_id)
  AND co2e_entry_method = 'calculated_from_energy';
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate allocation when energy inputs change
DROP TRIGGER IF EXISTS trigger_recalculate_from_energy ON public.contract_manufacturer_energy_inputs;
CREATE TRIGGER trigger_recalculate_from_energy
  AFTER INSERT OR UPDATE OR DELETE ON public.contract_manufacturer_energy_inputs
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_allocation_from_energy_inputs();

-- Function to validate no overlapping periods
CREATE OR REPLACE FUNCTION validate_no_overlapping_allocation_periods()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.contract_manufacturer_allocations
    WHERE product_id = NEW.product_id
    AND facility_id = NEW.facility_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (
      (NEW.reporting_period_start, NEW.reporting_period_end) OVERLAPS 
      (reporting_period_start, reporting_period_end)
    )
  ) THEN
    RAISE EXCEPTION 'Overlapping allocation periods are not allowed for the same product-facility combination. Each reporting period must be a discrete snapshot.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent overlapping periods
DROP TRIGGER IF EXISTS trigger_validate_allocation_periods ON public.contract_manufacturer_allocations;
CREATE TRIGGER trigger_validate_allocation_periods
  BEFORE INSERT OR UPDATE ON public.contract_manufacturer_allocations
  FOR EACH ROW
  EXECUTE FUNCTION validate_no_overlapping_allocation_periods();

-- View for allocation summary with product and facility details
CREATE OR REPLACE VIEW public.contract_manufacturer_allocation_summary AS
SELECT 
  cma.id,
  cma.organization_id,
  cma.product_id,
  p.name AS product_name,
  cma.facility_id,
  f.name AS facility_name,
  f.address_city AS facility_city,
  f.address_country AS facility_country,
  cma.supplier_id,
  s.name AS supplier_name,
  cma.reporting_period_start,
  cma.reporting_period_end,
  cma.total_facility_production_volume,
  cma.production_volume_unit,
  cma.total_facility_co2e_kg,
  cma.co2e_entry_method,
  cma.client_production_volume,
  cma.attribution_ratio,
  cma.allocated_emissions_kg_co2e,
  cma.emission_intensity_kg_co2e_per_unit,
  cma.status,
  cma.is_energy_intensive_process,
  cma.data_source_tag,
  cma.data_quality_score,
  cma.created_at,
  cma.updated_at,
  cma.locked_at,
  cma.verified_at,
  EXTRACT(DAY FROM (now() - cma.created_at)) AS days_pending
FROM public.contract_manufacturer_allocations cma
LEFT JOIN public.products p ON p.id = cma.product_id
LEFT JOIN public.facilities f ON f.id = cma.facility_id
LEFT JOIN public.suppliers s ON s.id = cma.supplier_id;

COMMENT ON VIEW public.contract_manufacturer_allocation_summary IS 'Summary view joining allocations with product, facility, and supplier details for dashboard display';

-- Grant access to the view
GRANT SELECT ON public.contract_manufacturer_allocation_summary TO authenticated;
