-- Per-entry refrigerant type for granular GWP.
--
-- Nullable; legacy refrigerant_leakage rows (NULL) resolve to the historical
-- R-134a default (GWP 1430) in calculation code, preserving backward
-- compatibility. No CHECK constraint: REFRIGERANT_GWP in lib/ghg-constants.ts
-- is the source of truth and will evolve; unrecognised keys fall back to the
-- default in code.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'utility_data_entries'
      AND column_name = 'refrigerant_type'
  ) THEN
    ALTER TABLE public.utility_data_entries
      ADD COLUMN refrigerant_type text DEFAULT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.utility_data_entries.refrigerant_type IS
  'Refrigerant gas key matching REFRIGERANT_GWP in lib/ghg-constants.ts (e.g. r404a). Only meaningful when utility_type = refrigerant_leakage. NULL = legacy entry, treated as r134a (GWP 1430).';
