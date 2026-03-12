-- Add impact decomposition columns to openlca_impact_cache
-- Enables separation of transport and electricity contributions from
-- ecoinvent cradle-to-gate factors, allowing the platform to replace
-- generic embedded transport/electricity with user-specific values.
--
-- See: lib/openlca/impact-factor-resolver.ts for the extraction logic

ALTER TABLE openlca_impact_cache
  ADD COLUMN IF NOT EXISTS impact_climate_production numeric,
  ADD COLUMN IF NOT EXISTS impact_climate_transport numeric,
  ADD COLUMN IF NOT EXISTS impact_climate_electricity numeric,
  ADD COLUMN IF NOT EXISTS embedded_electricity_geography text,
  ADD COLUMN IF NOT EXISTS transport_process_names text[],
  ADD COLUMN IF NOT EXISTS electricity_process_names text[];

-- Add comment explaining the decomposition
COMMENT ON COLUMN openlca_impact_cache.impact_climate_production IS
  'Climate impact excluding transport and electricity sub-processes (kg CO2e/unit). Calculated via OpenLCA contribution analysis.';
COMMENT ON COLUMN openlca_impact_cache.impact_climate_transport IS
  'Climate impact attributable to embedded transport sub-processes (kg CO2e/unit). From upstream tree analysis.';
COMMENT ON COLUMN openlca_impact_cache.impact_climate_electricity IS
  'Climate impact attributable to embedded electricity sub-processes (kg CO2e/unit). From upstream tree analysis.';
COMMENT ON COLUMN openlca_impact_cache.embedded_electricity_geography IS
  'ISO country code of the electricity process in the ecoinvent factor (e.g. GLO, ZW, IN). Used for grid factor adjustment.';
COMMENT ON COLUMN openlca_impact_cache.transport_process_names IS
  'Names of transport processes identified in the upstream tree. For transparency and debugging.';
COMMENT ON COLUMN openlca_impact_cache.electricity_process_names IS
  'Names of electricity processes identified in the upstream tree. For transparency and debugging.';
