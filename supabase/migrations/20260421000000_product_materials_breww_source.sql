-- Allow Breww-derived data_source values on product_materials and
-- product_carbon_footprint_materials. Two constraints guard data_source:
-- `data_source_integrity` (structural: requires data_source_id when set)
-- and `valid_data_source` (whitelist). Both extended here to allow
-- 'breww_recipe_avg' (12-month avg ingredient usage scaled per SKU) and
-- 'breww_sku_container' (SKU container weight).

ALTER TABLE public.product_materials
  DROP CONSTRAINT IF EXISTS data_source_integrity;

ALTER TABLE public.product_materials
  ADD CONSTRAINT data_source_integrity CHECK (
    (data_source = 'openlca' AND data_source_id IS NOT NULL)
    OR (data_source = 'supplier' AND supplier_product_id IS NOT NULL)
    OR (data_source = 'breww_recipe_avg' AND data_source_id IS NOT NULL)
    OR (data_source = 'breww_sku_container')
    OR (data_source IS NULL)
  );

ALTER TABLE public.product_carbon_footprint_materials
  DROP CONSTRAINT IF EXISTS data_source_integrity;

ALTER TABLE public.product_carbon_footprint_materials
  ADD CONSTRAINT data_source_integrity CHECK (
    (data_source = 'openlca' AND data_source_id IS NOT NULL)
    OR (data_source = 'supplier' AND supplier_product_id IS NOT NULL)
    OR (data_source = 'breww_recipe_avg' AND data_source_id IS NOT NULL)
    OR (data_source = 'breww_sku_container')
    OR (data_source IS NULL)
  );

ALTER TABLE public.product_materials
  DROP CONSTRAINT IF EXISTS valid_data_source;

ALTER TABLE public.product_materials
  ADD CONSTRAINT valid_data_source CHECK (
    data_source IS NULL
    OR data_source = ANY (ARRAY['openlca', 'supplier', 'breww_recipe_avg', 'breww_sku_container'])
  );

ALTER TABLE public.product_carbon_footprint_materials
  DROP CONSTRAINT IF EXISTS valid_data_source;

ALTER TABLE public.product_carbon_footprint_materials
  ADD CONSTRAINT valid_data_source CHECK (
    data_source IS NULL
    OR data_source = ANY (ARRAY['openlca', 'supplier', 'breww_recipe_avg', 'breww_sku_container'])
  );
