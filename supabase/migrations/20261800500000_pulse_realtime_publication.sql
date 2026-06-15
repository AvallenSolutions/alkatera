-- Pulse Phase 2 — Realtime publication
--
-- Enables Supabase Realtime ("postgres_changes") on the tables that the
-- Pulse dashboard subscribes to so users see updates the moment data lands.
--
-- Each ALTER PUBLICATION is wrapped in a DO block + EXCEPTION handler so
-- the migration is idempotent (re-runs without erroring if the table is
-- already a member of supabase_realtime).
--
-- RLS still applies to the realtime stream: subscribers only receive row
-- events that pass the table's existing SELECT policies.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.facility_activity_entries;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.product_carbon_footprints;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_products;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.production_logs;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.metric_snapshots;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
