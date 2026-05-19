-- COD-based wastewater CH4 inputs on facility_activity_entries.
--
-- Both columns nullable. When wastewater_cod_mg_per_litre is NULL the
-- calculation falls back to the legacy volume × emission-factor path, so
-- existing water_discharge rows are unaffected (zero behaviour change).
--
-- wastewater_treatment_method (existing enum column) is reused as the MCF key.
-- discharge destination determines the GHG Protocol scope split:
--   on_site_treatment / land / water_body => Scope 1 (direct)
--   sewer                                  => Scope 3 Cat 5 (off-site utility)

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'facility_activity_entries'
      AND column_name = 'wastewater_cod_mg_per_litre'
  ) THEN
    ALTER TABLE public.facility_activity_entries
      ADD COLUMN wastewater_cod_mg_per_litre numeric
        CHECK (wastewater_cod_mg_per_litre IS NULL
               OR wastewater_cod_mg_per_litre >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'facility_activity_entries'
      AND column_name = 'wastewater_discharge_destination'
  ) THEN
    ALTER TABLE public.facility_activity_entries
      ADD COLUMN wastewater_discharge_destination text
        CHECK (wastewater_discharge_destination IS NULL
               OR wastewater_discharge_destination IN
                  ('on_site_treatment', 'sewer', 'water_body', 'land'));
  END IF;
END $$;

COMMENT ON COLUMN public.facility_activity_entries.wastewater_cod_mg_per_litre IS
  'Chemical Oxygen Demand of discharged wastewater (mg O2/L). Drives IPCC 2006 Vol 5 Ch 6 CH4 model. NULL = legacy volume × factor path.';
COMMENT ON COLUMN public.facility_activity_entries.wastewater_discharge_destination IS
  'on_site_treatment / land / water_body = Scope 1 (direct). sewer = Scope 3 Cat 5 (treated off-site). Determines scope split.';
