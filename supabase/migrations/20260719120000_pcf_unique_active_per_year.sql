-- One active PCF per product and reference year.
--
-- Why: nothing prevented two live footprint records for the same product+year
-- (Everleaf Marine held a draft at 0.188 AND a completed at 0.104), so "the
-- number" was ambiguous. The aggregator's supersede step also keyed on
-- product_id only, so completing a 2026 PCF would supersede the 2025 one.
--
-- This migration (1) supersedes all but the newest completed PCF per
-- (product_id, reference_year), then (2) enforces uniqueness going forward with
-- a partial unique index. Drafts/pending/estimates may still coexist during
-- editing; standalone LCAs (product_id is null) are out of scope.
--
-- Ships together with the code fix in lib/product-lca-aggregator.ts that adds
-- reference_year to the supersede filter (otherwise multi-year completions
-- would hit the new index).

-- 1. Cleanup: keep the newest completed PCF per (product_id, reference_year),
--    mark the rest superseded.
update public.product_carbon_footprints p
set status = 'superseded'
where p.status = 'completed'
  and p.product_id is not null
  and p.id not in (
    select distinct on (product_id, reference_year) id
    from public.product_carbon_footprints
    where status = 'completed' and product_id is not null
    order by product_id, reference_year, created_at desc, id desc
  );

-- 2. Enforce going forward.
create unique index if not exists uniq_active_pcf_per_product_year
  on public.product_carbon_footprints (product_id, reference_year)
  where product_id is not null and status = 'completed';

comment on index public.uniq_active_pcf_per_product_year is
  'At most one completed (active) PCF per product and reference year. Completion supersedes the previous active record first (product-lca-aggregator).';
