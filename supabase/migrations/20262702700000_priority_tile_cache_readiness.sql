-- #3b: store the readiness summary alongside cached tiles so a cache HIT can
-- return instantly WITHOUT rebuilding the (~31-query) signal pack. Nullable so
-- existing rows remain valid; the route treats NULL as "fall through and build".
ALTER TABLE public.rosa_priority_tile_cache
  ADD COLUMN IF NOT EXISTS readiness_json jsonb;

COMMENT ON COLUMN public.rosa_priority_tile_cache.readiness_json IS
  'Cached readiness summary {next_layer, facility_data, recipes_status, why} so a cache hit serves instantly without building the signal pack.';

-- PostgREST caches the schema; without this the new column is invisible to the
-- API layer and writes to it are silently dropped (see tasks/lessons.md).
NOTIFY pgrst, 'reload schema';
