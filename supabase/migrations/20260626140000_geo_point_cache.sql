-- ============================================================================
-- Foundation B: geospatial point-lookup cache
-- ============================================================================
--
-- Satellite / soil rasters are fixed reference data, so the value at a given
-- coordinate never changes. This table caches the result of every point lookup
-- (SoilGrids soil organic carbon first, ESA WorldCover land cover next, WRI
-- Aqueduct water stress later) keyed by dataset + rounded coordinate, so a pixel
-- is fetched from the external source at most once. After the first lookup an
-- area is instant and resilient to the source being slow or down.
--
-- Coordinates are rounded to roughly the dataset's resolution before caching
-- (SoilGrids ~250 m → 3 dp ≈ 110 m) so nearby lookups reuse the same pixel.
--
-- This is non-sensitive public reference data (not org-scoped): readable by any
-- authenticated user, writable only by the service role (the lookups run in
-- Inngest with the service role, like the other reference-data writers).
-- ============================================================================

create table if not exists public.geo_point_cache (
  id          uuid primary key default gen_random_uuid(),
  dataset     text not null,            -- 'soilgrids_ocs_0_30cm' | 'worldcover_lc' | ...
  lat_round   numeric not null,
  lng_round   numeric not null,
  value_num   numeric,                  -- numeric result (e.g. t C/ha, BWS score)
  value_text  text,                     -- categorical result (e.g. land-cover class)
  raw         jsonb not null default '{}'::jsonb,
  fetched_at  timestamptz not null default now(),
  unique (dataset, lat_round, lng_round)
);

comment on table public.geo_point_cache is
  'Cache of geospatial point lookups (SoilGrids, WorldCover, ...) keyed by dataset + rounded coordinate, so each pixel is fetched from the external source at most once.';

create index if not exists geo_point_cache_lookup_idx
  on public.geo_point_cache (dataset, lat_round, lng_round);

alter table public.geo_point_cache enable row level security;

drop policy if exists "geo_point_cache readable by authenticated" on public.geo_point_cache;
create policy "geo_point_cache readable by authenticated"
  on public.geo_point_cache for select
  to authenticated
  using (true);

-- No write policies: only the service role (which bypasses RLS) populates it.
