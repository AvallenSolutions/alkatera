-- Make production_run_resource_data.production_volume_unit case-insensitive.
--
-- The Run Data UI writes capitalised values ('Litres', 'Hectolitres', 'Units')
-- to satisfy the original CHECK constraint, but the rest of the codebase
-- (PRODUCTION_UNITS in calculate-lca, calculator fallbacks, lookup maps) uses
-- lowercase. Rather than force a codebase-wide standardisation now, accept
-- either case at the data layer so both conventions interoperate.
--
-- Readers should still normalise via lower(...) when comparing.

ALTER TABLE public.production_run_resource_data
  DROP CONSTRAINT IF EXISTS prrd_volume_unit_check;

ALTER TABLE public.production_run_resource_data
  ADD CONSTRAINT prrd_volume_unit_check CHECK (
    lower(production_volume_unit) IN ('litres', 'hectolitres', 'units', 'kg')
  );
