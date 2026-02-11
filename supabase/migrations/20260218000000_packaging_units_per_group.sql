-- =============================================================================
-- Packaging Per-Unit Allocation (ISO 14044 §4.3.4.2)
-- =============================================================================
-- Secondary/shipment/tertiary packaging serves multiple product units.
-- This migration adds a `units_per_group` column so the LCA calculator can
-- divide the packaging impact by the number of units, attributing only the
-- per-unit share to the product carbon footprint.
--
-- Also fixes a latent bug: the CHECK constraint on `packaging_category` was
-- missing 'shipment' and 'tertiary', preventing those categories from being
-- saved despite being supported in the UI and TypeScript types.
-- =============================================================================

-- 1. Add units_per_group to product_materials (the input/recipe table)
ALTER TABLE product_materials
  ADD COLUMN IF NOT EXISTS units_per_group integer DEFAULT 1
  CHECK (units_per_group >= 1);

-- 2. Fix CHECK constraint to include all 6 packaging categories
-- Drop the old constraint that only allowed container/label/closure/secondary
ALTER TABLE product_materials
  DROP CONSTRAINT IF EXISTS check_packaging_category;

ALTER TABLE product_materials
  ADD CONSTRAINT check_packaging_category
  CHECK (
    packaging_category IS NULL
    OR packaging_category = ANY(ARRAY['container','label','closure','secondary','shipment','tertiary'])
  );

-- 3. Add units_per_group to product_carbon_footprint_materials (the output/results table)
--    Stored for traceability — the impact values in this table are already per-unit,
--    but recording the allocation divisor allows auditors to reconstruct the original value.
ALTER TABLE product_carbon_footprint_materials
  ADD COLUMN IF NOT EXISTS units_per_group integer DEFAULT 1;

-- 4. Documentation
COMMENT ON COLUMN product_materials.units_per_group IS
  'Number of product units served by this packaging item. 1 for primary packaging (container/label/closure). >1 for secondary/shipment/tertiary. Used for ISO 14044 physical allocation.';

COMMENT ON COLUMN product_carbon_footprint_materials.units_per_group IS
  'Allocation divisor applied during PCF calculation. Records how many product units shared this packaging item for audit traceability.';
