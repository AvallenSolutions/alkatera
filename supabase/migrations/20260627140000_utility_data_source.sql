-- Programme 2 / Phase 2 follow-up: mark how a utility_data_entries row was sourced.
--
-- A half-hourly smart-meter upload now DERIVES the monthly utility totals (so a
-- user uploads once — either a bill or their smart-meter CSV, never both). We
-- tag those derived rows so re-uploads replace only our own derived rows, never
-- a manually-entered or bill-imported row, and so the UI can warn on overlap.
--
--   data_source: 'smart_meter' = derived from smart_meter_readings
--                null / other   = bill import / manual entry (unchanged)

alter table public.utility_data_entries add column if not exists data_source text;

comment on column public.utility_data_entries.data_source is
  'How the row was sourced: ''smart_meter'' = derived from half-hourly smart_meter_readings; null/other = bill or manual.';

create index if not exists utility_data_entries_facility_type_source_idx
  on public.utility_data_entries (facility_id, utility_type, data_source);
