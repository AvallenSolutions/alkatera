/*
  # Add Scope Breakdown to Production Sites

  1. Changes to `product_lca_production_sites`
    - Add `scope1_emissions_kg_co2e` (direct emissions from owned/controlled sources)
    - Add `scope2_emissions_kg_co2e` (indirect emissions from purchased electricity/heat/steam)
    - Add `scope3_emissions_kg_co2e` (other indirect emissions in value chain)

  2. Changes to `contract_manufacturer_allocations`
    - Add same scope breakdown columns for consistency
    - Enables proper emission categorization per GHG Protocol

  3. Backfill Strategy
    - For existing records with allocated_emissions_kg_co2e > 0
    - Apply standard manufacturing allocation: Scope 1 = 35%, Scope 2 = 65%
    - This represents typical manufacturing facility emissions split

  ## Notes
  - Supports GHG Protocol compliant scope reporting
  - Enables proper lifecycle stage attribution per ISO 14044
  - Standard ratios can be overridden with actual facility data when available
*/

-- Add scope breakdown columns to product_lca_production_sites
ALTER TABLE public.product_lca_production_sites
ADD COLUMN IF NOT EXISTS scope1_emissions_kg_co2e NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS scope2_emissions_kg_co2e NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS scope3_emissions_kg_co2e NUMERIC DEFAULT 0;

-- Add scope breakdown columns to contract_manufacturer_allocations
ALTER TABLE public.contract_manufacturer_allocations
ADD COLUMN IF NOT EXISTS scope1_emissions_kg_co2e NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS scope2_emissions_kg_co2e NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS scope3_emissions_kg_co2e NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS allocated_water_litres NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS allocated_waste_kg NUMERIC DEFAULT 0;

-- Add comments
COMMENT ON COLUMN public.product_lca_production_sites.scope1_emissions_kg_co2e IS 'Direct GHG emissions from owned or controlled sources (e.g., on-site fuel combustion)';
COMMENT ON COLUMN public.product_lca_production_sites.scope2_emissions_kg_co2e IS 'Indirect GHG emissions from purchased electricity, heat, or steam';
COMMENT ON COLUMN public.product_lca_production_sites.scope3_emissions_kg_co2e IS 'Other indirect GHG emissions in the value chain (typically minimal for manufacturing)';

COMMENT ON COLUMN public.contract_manufacturer_allocations.scope1_emissions_kg_co2e IS 'Allocated Scope 1 emissions for this product';
COMMENT ON COLUMN public.contract_manufacturer_allocations.scope2_emissions_kg_co2e IS 'Allocated Scope 2 emissions for this product';
COMMENT ON COLUMN public.contract_manufacturer_allocations.scope3_emissions_kg_co2e IS 'Allocated Scope 3 emissions for this product';

-- Backfill existing product_lca_production_sites records with scope breakdown
-- Standard manufacturing allocation: Scope 1 = 35%, Scope 2 = 65%
UPDATE public.product_lca_production_sites
SET
  scope1_emissions_kg_co2e = COALESCE(allocated_emissions_kg_co2e, 0) * 0.35,
  scope2_emissions_kg_co2e = COALESCE(allocated_emissions_kg_co2e, 0) * 0.65,
  scope3_emissions_kg_co2e = 0
WHERE allocated_emissions_kg_co2e IS NOT NULL
  AND allocated_emissions_kg_co2e > 0
  AND (scope1_emissions_kg_co2e IS NULL OR scope1_emissions_kg_co2e = 0);

-- Backfill existing contract_manufacturer_allocations records with scope breakdown
UPDATE public.contract_manufacturer_allocations
SET
  scope1_emissions_kg_co2e = COALESCE(allocated_emissions_kg_co2e, 0) * 0.35,
  scope2_emissions_kg_co2e = COALESCE(allocated_emissions_kg_co2e, 0) * 0.65,
  scope3_emissions_kg_co2e = 0
WHERE allocated_emissions_kg_co2e IS NOT NULL
  AND allocated_emissions_kg_co2e > 0
  AND (scope1_emissions_kg_co2e IS NULL OR scope1_emissions_kg_co2e = 0);

-- Update the calculate_allocation_metrics function to also calculate scope breakdown
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

  -- Calculate scope breakdown (standard manufacturing allocation if not provided)
  -- Scope 1: 35% (on-site combustion, process emissions)
  -- Scope 2: 65% (purchased electricity, heat, steam)
  -- Scope 3: 0% (minimal for direct manufacturing operations)
  IF NEW.scope1_emissions_kg_co2e IS NULL OR NEW.scope1_emissions_kg_co2e = 0 THEN
    NEW.scope1_emissions_kg_co2e := NEW.allocated_emissions_kg_co2e * 0.35;
  END IF;

  IF NEW.scope2_emissions_kg_co2e IS NULL OR NEW.scope2_emissions_kg_co2e = 0 THEN
    NEW.scope2_emissions_kg_co2e := NEW.allocated_emissions_kg_co2e * 0.65;
  END IF;

  IF NEW.scope3_emissions_kg_co2e IS NULL THEN
    NEW.scope3_emissions_kg_co2e := 0;
  END IF;

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
      'emission_intensity_kg_co2e_per_unit', NEW.emission_intensity_kg_co2e_per_unit,
      'scope1_emissions_kg_co2e', NEW.scope1_emissions_kg_co2e,
      'scope2_emissions_kg_co2e', NEW.scope2_emissions_kg_co2e,
      'scope3_emissions_kg_co2e', NEW.scope3_emissions_kg_co2e
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

-- Update the allocation summary view to include scope breakdown
DROP VIEW IF EXISTS public.contract_manufacturer_allocation_summary;
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
  cma.scope1_emissions_kg_co2e,
  cma.scope2_emissions_kg_co2e,
  cma.scope3_emissions_kg_co2e,
  cma.allocated_water_litres,
  cma.allocated_waste_kg,
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

GRANT SELECT ON public.contract_manufacturer_allocation_summary TO authenticated;
