-- Migration: Biogenic Carbon Flag
-- Adds is_biogenic_carbon to both product_materials (user input) and
-- product_carbon_footprint_materials (resolved output) for ISO 14067
-- Section 7 fossil/biogenic carbon classification.

-- product_carbon_footprint_materials (resolved LCA output rows)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_carbon_footprint_materials'
      AND column_name = 'is_biogenic_carbon'
  ) THEN
    ALTER TABLE public.product_carbon_footprint_materials
      ADD COLUMN is_biogenic_carbon boolean NOT NULL DEFAULT false;
  END IF;
END $$;

COMMENT ON COLUMN public.product_carbon_footprint_materials.is_biogenic_carbon IS
  'When true, impact_climate is classified as biogenic carbon per ISO 14067 Section 7';

-- product_materials (user ingredient input rows)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_materials'
      AND column_name = 'is_biogenic_carbon'
  ) THEN
    ALTER TABLE public.product_materials
      ADD COLUMN is_biogenic_carbon boolean NOT NULL DEFAULT false;
  END IF;
END $$;

COMMENT ON COLUMN public.product_materials.is_biogenic_carbon IS
  'User-declared: carbon from this material is biogenic (fermentation, plant growth)';
