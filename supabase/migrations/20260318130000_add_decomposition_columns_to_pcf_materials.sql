-- Migration: Add impact decomposition columns to product_carbon_footprint_materials
-- These columns were added to openlca_impact_cache and ecoinvent_material_proxies
-- in migration 20260312000000 but were missing from the destination table where
-- LCA calculation results are stored, causing "column not found in schema cache" errors.

ALTER TABLE public.product_carbon_footprint_materials
  ADD COLUMN IF NOT EXISTS impact_climate_production numeric,
  ADD COLUMN IF NOT EXISTS impact_climate_transport_embedded numeric,
  ADD COLUMN IF NOT EXISTS impact_climate_electricity_embedded numeric,
  ADD COLUMN IF NOT EXISTS embedded_electricity_geography text;

COMMENT ON COLUMN product_carbon_footprint_materials.impact_climate_production IS
  'GWP contribution from the production process itself (excluding embedded transport and electricity)';
COMMENT ON COLUMN product_carbon_footprint_materials.impact_climate_transport_embedded IS
  'GWP contribution from transport embedded in the material production chain';
COMMENT ON COLUMN product_carbon_footprint_materials.impact_climate_electricity_embedded IS
  'GWP contribution from electricity embedded in the material production chain';
COMMENT ON COLUMN product_carbon_footprint_materials.embedded_electricity_geography IS
  'ISO country/region code of the electricity mix used in the material impact factor';
