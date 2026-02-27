-- ==========================================================================
-- Add matched_source_name to product_materials
-- When users select a proxy ingredient (e.g., Citric Acid for Malic Acid),
-- material_name stores the user's real ingredient name and
-- matched_source_name stores the database match used for calculations.
-- NULL means no proxy was used (material_name IS the database match).
-- ==========================================================================

ALTER TABLE product_materials
ADD COLUMN IF NOT EXISTS matched_source_name text;

COMMENT ON COLUMN product_materials.matched_source_name IS
  'The database emission factor name when a proxy was used. NULL means material_name is the exact match.';
