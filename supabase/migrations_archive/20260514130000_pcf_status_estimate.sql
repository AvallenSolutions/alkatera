-- Allow 'estimate' as a status value on product_carbon_footprints.
--
-- During onboarding, we persist an industry-benchmark-derived footprint for
-- each product so Rosa's hub has data on day one. These rows are clearly
-- flagged so ProductSpotlight can render a distinct "Estimate" pill rather
-- than the green "LCA done" pill reserved for completed bottom-up LCAs.

alter table public.product_carbon_footprints
  drop constraint if exists product_carbon_footprints_status_check;

alter table public.product_carbon_footprints
  add constraint product_carbon_footprints_status_check
  check (status in ('draft', 'pending', 'estimate', 'completed', 'failed'));
