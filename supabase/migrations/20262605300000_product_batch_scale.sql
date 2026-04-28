-- Add batch-scale recipe support to products.
-- When recipe_scale_mode = 'per_batch', ingredient quantities on
-- product_carbon_footprint_materials are stored as batch totals and the LCA
-- calculator allocates them to the functional unit at calculation time.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS recipe_scale_mode text NOT NULL DEFAULT 'per_unit',
  ADD COLUMN IF NOT EXISTS batch_yield_value numeric,
  ADD COLUMN IF NOT EXISTS batch_yield_unit text;

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_recipe_scale_mode_check;

ALTER TABLE products
  ADD CONSTRAINT products_recipe_scale_mode_check
  CHECK (recipe_scale_mode IN ('per_unit', 'per_batch'));

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_batch_yield_unit_check;

ALTER TABLE products
  ADD CONSTRAINT products_batch_yield_unit_check
  CHECK (batch_yield_unit IS NULL OR batch_yield_unit IN ('bottles', 'units', 'L', 'kL', 'hL', 'ml'));

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_batch_yield_required_when_batch_mode;

ALTER TABLE products
  ADD CONSTRAINT products_batch_yield_required_when_batch_mode
  CHECK (
    recipe_scale_mode = 'per_unit'
    OR (batch_yield_value IS NOT NULL AND batch_yield_value > 0 AND batch_yield_unit IS NOT NULL)
  );
