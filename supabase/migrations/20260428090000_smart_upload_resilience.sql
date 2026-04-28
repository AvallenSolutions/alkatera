-- Smart Upload resilience pass.
--
-- 1. Add retry_count to ingest_jobs so the poll endpoint can re-fire the
--    background trigger at most once per stuck job without racing with
--    concurrent polls.
-- 2. Re-assert the utility_data_entries enrichment columns idempotently in
--    case 20262604800000_utility_bill_enrichment.sql wasn't applied
--    (typoed timestamp ordering, manual SQL-editor application).
-- 3. NOTIFY pgrst to force a PostgREST schema-cache reload — fixes the
--    "Could not find the 'account_number' column" error on anon-keyed
--    clients that may still be holding a stale cache.

ALTER TABLE public.ingest_jobs
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;

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

NOTIFY pgrst, 'reload schema';
