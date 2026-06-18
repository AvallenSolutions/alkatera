-- Broadened utility bill extraction — columns to capture the extra data a UK
-- business electricity bill exposes beyond headline kWh. Feeds the Pulse's
-- time-of-use advice (need MPAN → GSP region → half-hourly carbon intensity,
-- plus meter type + rate breakdown to identify shiftable load) and the
-- market-based Scope 2 calculation (fuel_mix, is_green_tariff,
-- emissions_factor_g_per_kwh).
--
-- All nullable so existing rows remain valid. Gas-side bills leave
-- electricity-only fields null and vice-versa.

ALTER TABLE public.utility_data_entries
  ADD COLUMN IF NOT EXISTS mpan text,
  ADD COLUMN IF NOT EXISTS mprn text,
  ADD COLUMN IF NOT EXISTS meter_type text,
  ADD COLUMN IF NOT EXISTS rate_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS fuel_mix jsonb,
  ADD COLUMN IF NOT EXISTS is_green_tariff boolean,
  ADD COLUMN IF NOT EXISTS emissions_factor_g_per_kwh numeric,
  ADD COLUMN IF NOT EXISTS supply_postcode text,
  ADD COLUMN IF NOT EXISTS supply_address text,
  ADD COLUMN IF NOT EXISTS gsp_group text,
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS ccl_amount_gbp numeric,
  ADD COLUMN IF NOT EXISTS total_charged_gbp numeric;

ALTER TABLE public.utility_data_entries
  DROP CONSTRAINT IF EXISTS utility_data_entries_meter_type_check;
ALTER TABLE public.utility_data_entries
  ADD CONSTRAINT utility_data_entries_meter_type_check
  CHECK (meter_type IS NULL OR meter_type IN ('single_rate','economy_7','economy_10','half_hourly','dual_rate','other'));

CREATE INDEX IF NOT EXISTS idx_utility_data_entries_mpan
  ON public.utility_data_entries(mpan) WHERE mpan IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_utility_data_entries_mprn
  ON public.utility_data_entries(mprn) WHERE mprn IS NOT NULL;
