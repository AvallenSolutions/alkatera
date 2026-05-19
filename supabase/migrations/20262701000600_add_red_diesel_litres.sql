-- Separate red / agricultural (gas oil) diesel from road diesel for
-- vineyard & orchard machinery, so it can be priced with the distinct DEFRA
-- red-diesel factor in viticulture-calculator.ts. Nullable; existing rows
-- (NULL) contribute 0 red diesel and keep their existing road-diesel
-- treatment, so no recompute change for historical data.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vineyard_growing_profiles'
      AND column_name = 'red_diesel_litres_per_year'
  ) THEN
    ALTER TABLE public.vineyard_growing_profiles
      ADD COLUMN red_diesel_litres_per_year numeric
        CHECK (red_diesel_litres_per_year IS NULL
               OR red_diesel_litres_per_year >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orchard_growing_profiles'
      AND column_name = 'red_diesel_litres_per_year'
  ) THEN
    ALTER TABLE public.orchard_growing_profiles
      ADD COLUMN red_diesel_litres_per_year numeric
        CHECK (red_diesel_litres_per_year IS NULL
               OR red_diesel_litres_per_year >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.vineyard_growing_profiles.red_diesel_litres_per_year IS
  'Red / agricultural (gas oil) diesel for off-road vineyard machinery, litres/yr. Priced with DEFRA red-diesel factor (distinct from road diesel). NULL = none.';
COMMENT ON COLUMN public.orchard_growing_profiles.red_diesel_litres_per_year IS
  'Red / agricultural (gas oil) diesel for off-road orchard machinery, litres/yr. Priced with DEFRA red-diesel factor (distinct from road diesel). NULL = none.';
