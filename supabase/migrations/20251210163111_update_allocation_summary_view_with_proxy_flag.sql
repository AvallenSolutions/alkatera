/*
  # Update Allocation Summary View to Include Proxy Data Flag

  Updates the contract_manufacturer_allocation_summary view to include the uses_proxy_data field
  so that the UI can display EST badges for proxy-based estimates.
*/

-- Drop the existing view
DROP VIEW IF EXISTS public.contract_manufacturer_allocation_summary;

-- Recreate the view with the uses_proxy_data field
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
  cma.co2e_entry_method,
  cma.client_production_volume,
  cma.attribution_ratio,
  cma.allocated_emissions_kg_co2e,
  cma.emission_intensity_kg_co2e_per_unit,
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

COMMENT ON VIEW public.contract_manufacturer_allocation_summary IS 'Summary view joining allocations with product, facility, and supplier details for dashboard display. Includes uses_proxy_data flag for EST badge display.';

-- Grant access to the view
GRANT SELECT ON public.contract_manufacturer_allocation_summary TO authenticated;
