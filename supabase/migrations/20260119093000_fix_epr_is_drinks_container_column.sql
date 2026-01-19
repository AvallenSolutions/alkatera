/*
  Fix for: Packaging Save Error - epr_is_drinks_container column missing

  This migration ensures the epr_is_drinks_container column exists on the
  product_materials table. This column was originally defined in migration
  20260116160201_add_epr_packaging_components.sql but may not have been
  applied to all environments.

  The column is required for UK EPR (Extended Producer Responsibility)
  compliance to flag drinks containers between 150ml-3L that need separate
  tracking.
*/

-- Add epr_is_drinks_container column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_materials'
    AND column_name = 'epr_is_drinks_container'
  ) THEN
    ALTER TABLE public.product_materials
    ADD COLUMN epr_is_drinks_container BOOLEAN DEFAULT false;

    COMMENT ON COLUMN public.product_materials.epr_is_drinks_container
      IS 'Flag for drinks containers 150ml-3L that need separate EPR tracking';

    RAISE NOTICE 'Added epr_is_drinks_container column to product_materials';
  ELSE
    RAISE NOTICE 'epr_is_drinks_container column already exists';
  END IF;
END $$;

-- Also ensure all other EPR columns from the original migration exist
-- (defensive fix in case original migration was partially applied)

DO $$
BEGIN
  -- has_component_breakdown
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_materials'
    AND column_name = 'has_component_breakdown'
  ) THEN
    ALTER TABLE public.product_materials
    ADD COLUMN has_component_breakdown BOOLEAN NOT NULL DEFAULT false;
  END IF;

  -- epr_packaging_level
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_materials'
    AND column_name = 'epr_packaging_level'
  ) THEN
    ALTER TABLE public.product_materials
    ADD COLUMN epr_packaging_level TEXT CHECK (
      epr_packaging_level IS NULL OR
      epr_packaging_level IN ('primary', 'secondary', 'tertiary', 'shipment')
    );
  END IF;

  -- epr_packaging_activity
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_materials'
    AND column_name = 'epr_packaging_activity'
  ) THEN
    ALTER TABLE public.product_materials
    ADD COLUMN epr_packaging_activity TEXT CHECK (
      epr_packaging_activity IS NULL OR
      epr_packaging_activity IN ('brand', 'packed_filled', 'imported', 'empty', 'hired', 'marketplace')
    );
  END IF;

  -- epr_is_household
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_materials'
    AND column_name = 'epr_is_household'
  ) THEN
    ALTER TABLE public.product_materials
    ADD COLUMN epr_is_household BOOLEAN DEFAULT true;
  END IF;

  -- epr_ram_rating
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_materials'
    AND column_name = 'epr_ram_rating'
  ) THEN
    ALTER TABLE public.product_materials
    ADD COLUMN epr_ram_rating TEXT CHECK (
      epr_ram_rating IS NULL OR
      epr_ram_rating IN ('red', 'amber', 'green')
    );
  END IF;

  -- epr_uk_nation
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_materials'
    AND column_name = 'epr_uk_nation'
  ) THEN
    ALTER TABLE public.product_materials
    ADD COLUMN epr_uk_nation TEXT CHECK (
      epr_uk_nation IS NULL OR
      epr_uk_nation IN ('england', 'scotland', 'wales', 'northern_ireland')
    );
  END IF;
END $$;
