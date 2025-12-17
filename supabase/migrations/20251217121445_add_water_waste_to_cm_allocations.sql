/*
  # Add Water and Waste Tracking to Contract Manufacturer Allocations

  1. Schema Changes
    - Add `total_facility_water_litres` to track facility water consumption
    - Add `total_facility_waste_kg` to track facility waste generation
    - Add `allocated_water_litres` for allocated water to client
    - Add `allocated_waste_kg` for allocated waste to client
    - Add `water_intensity_litres_per_unit` for water per production unit
    - Add `waste_intensity_kg_per_unit` for waste per production unit

  2. View Update
    - Update `contract_manufacturer_allocation_summary` view to include new columns
*/

-- Add water and waste columns to contract_manufacturer_allocations table
ALTER TABLE public.contract_manufacturer_allocations
ADD COLUMN IF NOT EXISTS total_facility_water_litres NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_facility_waste_kg NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS allocated_water_litres NUMERIC,
ADD COLUMN IF NOT EXISTS allocated_waste_kg NUMERIC,
ADD COLUMN IF NOT EXISTS water_intensity_litres_per_unit NUMERIC,
ADD COLUMN IF NOT EXISTS waste_intensity_kg_per_unit NUMERIC;

-- Update the allocation summary view to include water and waste
DROP VIEW IF EXISTS public.contract_manufacturer_allocation_summary;

CREATE VIEW public.contract_manufacturer_allocation_summary AS
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
  cma.total_facility_water_litres,
  cma.total_facility_waste_kg,
  cma.co2e_entry_method,
  cma.client_production_volume,
  cma.attribution_ratio,
  cma.allocated_emissions_kg_co2e,
  cma.allocated_water_litres,
  cma.allocated_waste_kg,
  cma.emission_intensity_kg_co2e_per_unit,
  cma.water_intensity_litres_per_unit,
  cma.waste_intensity_kg_per_unit,
  cma.status,
  cma.is_energy_intensive_process,
  cma.uses_proxy_data,
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

COMMENT ON VIEW public.contract_manufacturer_allocation_summary IS 'Summary view with water and waste tracking for contract manufacturer allocations';

GRANT SELECT ON public.contract_manufacturer_allocation_summary TO authenticated;
