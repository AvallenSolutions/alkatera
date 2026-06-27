-- Programme 2 / Phase 2: half-hourly smart-meter consumption.
--
-- Stores 30-min electricity/gas readings per facility (from a CSV upload now;
-- Octopus/n3rgy API feeds later). The carbon-aware Scope 2 granular figure
-- consumption-weights each half hour by the region's intensity at that half hour
-- — the whole point of half-hourly data. Reading data is non-headline (the
-- reported Scope 2 still uses the annual factor).

create table if not exists public.smart_meter_readings (
  id              uuid primary key default gen_random_uuid(),
  facility_id     uuid not null references public.facilities(id) on delete cascade,
  fuel            text not null check (fuel in ('electricity', 'gas')),
  recorded_at     timestamptz not null,         -- 30-min boundary, UTC
  consumption_kwh numeric not null,
  meter_id        text,                          -- MPAN/MPRN if known
  source          text not null default 'csv_upload',
  created_at      timestamptz not null default now(),
  unique (facility_id, fuel, recorded_at)
);

comment on table public.smart_meter_readings is
  'Half-hourly smart-meter consumption (electricity/gas) per facility, for carbon-aware Scope 2 and energy-timing.';

create index if not exists smart_meter_readings_facility_time_idx
  on public.smart_meter_readings (facility_id, fuel, recorded_at);

alter table public.smart_meter_readings enable row level security;

-- Read: any member of the facility's organisation. Writes are service-role only
-- (the upload route verifies access then writes with the service client).
drop policy if exists "smart_meter_readings readable by org members" on public.smart_meter_readings;
create policy "smart_meter_readings readable by org members"
  on public.smart_meter_readings for select
  to authenticated
  using (
    facility_id in (
      select f.id from public.facilities f
      join public.organization_members om on om.organization_id = f.organization_id
      where om.user_id = auth.uid()
    )
  );
