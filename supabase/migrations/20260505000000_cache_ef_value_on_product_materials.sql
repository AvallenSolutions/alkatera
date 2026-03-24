-- Cache the emission factor value directly on product_materials so that LCA
-- calculation always has a local fallback when the original data source
-- (OpenLCA API, staging table, ecoinvent proxy) cannot be resolved at
-- calculation time.  This prevents the recurring "No emission factor found"
-- error for materials that the user has already assigned a factor to.

ALTER TABLE product_materials
  ADD COLUMN IF NOT EXISTS cached_co2_factor numeric;

COMMENT ON COLUMN product_materials.cached_co2_factor IS
  'kg CO2e per reference unit, cached at assignment time as a resolver fallback';
