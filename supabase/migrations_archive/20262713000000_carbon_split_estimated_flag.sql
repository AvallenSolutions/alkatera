-- Migration: Carbon Split Estimated Flag
-- Adds carbon_split_estimated to product_carbon_footprint_materials (resolved
-- LCA output rows). True when the impact resolver could not characterise a
-- fossil/biogenic carbon split and attributed the whole climate total to fossil
-- (ISO 14067 Section 6.4.9.3 disclosure).
--
-- The calculator (lib/product-lca-calculator.ts) has been writing this field on
-- insert, but the column was never created — causing
-- "Could not find the 'carbon_split_estimated' column ... in the schema cache"
-- at the Calculate step of the LCA wizard.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_carbon_footprint_materials'
      AND column_name = 'carbon_split_estimated'
  ) THEN
    ALTER TABLE public.product_carbon_footprint_materials
      ADD COLUMN carbon_split_estimated boolean NOT NULL DEFAULT false;
  END IF;
END $$;

COMMENT ON COLUMN public.product_carbon_footprint_materials.carbon_split_estimated IS
  'When true, the fossil/biogenic carbon split could not be characterised and the whole climate total was attributed to fossil (ISO 14067 Section 6.4.9.3 disclosure).';

-- Reload PostgREST schema cache so the new column is immediately available
NOTIFY pgrst, 'reload schema';
