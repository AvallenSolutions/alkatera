-- Add impact decomposition columns to ecoinvent_material_proxies
-- Mirrors the decomposition columns on openlca_impact_cache, enabling
-- the search API to surface transport/electricity composition in the
-- emission factor search results before factor selection.
--
-- See: supabase/migrations/20260312000000_openlca_impact_decomposition.sql
--      for the equivalent columns on the live cache table.

ALTER TABLE ecoinvent_material_proxies
  ADD COLUMN IF NOT EXISTS impact_climate_production numeric,
  ADD COLUMN IF NOT EXISTS impact_climate_transport numeric,
  ADD COLUMN IF NOT EXISTS impact_climate_electricity numeric,
  ADD COLUMN IF NOT EXISTS embedded_electricity_geography text;

COMMENT ON COLUMN ecoinvent_material_proxies.impact_climate_production IS
  'Climate impact excluding transport and electricity sub-processes (kg CO2e/unit). From OpenLCA contribution analysis.';
COMMENT ON COLUMN ecoinvent_material_proxies.impact_climate_transport IS
  'Climate impact from embedded transport sub-processes (kg CO2e/unit). From upstream tree analysis.';
COMMENT ON COLUMN ecoinvent_material_proxies.impact_climate_electricity IS
  'Climate impact from embedded electricity sub-processes (kg CO2e/unit). From upstream tree analysis.';
COMMENT ON COLUMN ecoinvent_material_proxies.embedded_electricity_geography IS
  'ISO country code of the electricity process in the ecoinvent factor (e.g. GLO, ZW). For grid factor adjustment.';
