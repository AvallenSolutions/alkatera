/*
  # Backfill Missing Fields in Production Sites

  1. Changes
    - Update all product_lca_production_sites records missing organization_id
    - Update all product_lca_production_sites records missing data_source
    - Ensures existing data is consistent with new requirements

  2. Notes
    - organization_id is derived from the product_lca's organization
    - data_source defaults to 'Verified' for existing sites
*/

-- Backfill missing organization_id from product_lcas
UPDATE product_lca_production_sites ps
SET organization_id = pl.organization_id
FROM product_lcas pl
WHERE ps.product_lca_id = pl.id
  AND ps.organization_id IS NULL;

-- Backfill missing data_source
UPDATE product_lca_production_sites
SET data_source = 'Verified'
WHERE data_source IS NULL;

-- Log the changes
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % production site records', updated_count;
END $$;
