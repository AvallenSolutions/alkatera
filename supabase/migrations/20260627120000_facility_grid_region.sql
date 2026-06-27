-- Programme 2 / Phase 1: cache each facility's GB grid region for 30-min carbon matching.
--
-- The Carbon Intensity API resolves a postcode outcode to one of the 14 DNO
-- regions (1-14) / country aggregates (15-17). We resolve once from the
-- facility postcode and cache it here so the Scope 2 granular calc and the
-- per-facility live-intensity widget never re-resolve.

alter table public.facilities add column if not exists grid_region_code text;

comment on column public.facilities.grid_region_code is
  'Cached UK Carbon Intensity API region (GB-1..GB-17) resolved from the facility postcode, for 30-minute grid-carbon matching.';
