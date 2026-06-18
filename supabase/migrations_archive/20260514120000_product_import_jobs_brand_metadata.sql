-- Expand product_import_jobs to capture richer brand metadata extracted from a
-- website during onboarding. The columns added here back rec 1a of the
-- onboarding -> Rosa day-one data density plan: when Rosa reads a brand's
-- website, she now harvests brand story, founders, awards, suppliers,
-- distribution markets and production locations alongside the product list.
--
-- Storing everything in one JSONB column avoids a fan-out of nullable
-- columns. Each key is optional; the extractor sets only what it finds.

alter table public.product_import_jobs
  add column if not exists brand_metadata jsonb;

comment on column public.product_import_jobs.brand_metadata is
  'Structured brand data extracted from the website crawl: founding_year, '
  'founder_names[], mission, awards[], suppliers[], distribution_markets[], '
  'production_locations[], logo_url, brand_colour. All keys optional.';
