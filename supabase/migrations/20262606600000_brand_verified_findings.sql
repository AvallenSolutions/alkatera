-- ============================================================
-- DISTRIBUTOR PORTAL — brand-verified findings
-- ============================================================
-- The public /brand-upload/[token] page now lets the brand review every
-- field we hold for them and either confirm it ("looks right") or
-- correct it ("here's what it should be"). Both flows write a row into
-- scraped_brand_data with source_name='brand_verified' and confidence
-- 1.00, which the merger then prefers over every other source.
--
-- Why scraped_brand_data instead of a new table?
--   - The supersede chain already exists. Verifications follow the same
--     model: insert a fresh row, point superseded_by from the prior
--     verified row in the same scope to the new one. One "active"
--     verification per (brand, sku, field) falls out for free.
--   - The RPC get_brand_data_for_distributor already returns these rows
--     unchanged, so the brand-detail view, exports, vitality calculator
--     and completeness scorer all pick up verifications without code
--     changes beyond the merger precedence.
--   - field_value + field_value_numeric already cover every type we
--     need (boolean, number, year, string, longtext) via coerceFieldValue.
--
-- The three new columns hold the verification metadata that doesn't
-- exist on scraped rows (who, when, did they confirm or correct).
-- They're all nullable so existing rows keep working unchanged.
-- ============================================================

begin;

alter table public.scraped_brand_data
  add column if not exists verified_by_name    text,
  add column if not exists verified_by_email   text,
  add column if not exists verification_method text
    check (verification_method in ('confirmed', 'corrected'));

-- Extend the extraction_method check so we can write brand-verified rows
-- without dom_parse / llm_extract / pattern_match / api making sense.
alter table public.scraped_brand_data
  drop constraint if exists scraped_brand_data_extraction_method_check;
alter table public.scraped_brand_data
  add constraint scraped_brand_data_extraction_method_check
  check (extraction_method in (
    'dom_parse','llm_extract','pattern_match','api','brand_verified'
  ));

-- Active-verification lookup: most queries need "is there a brand
-- verification for this field?". Partial index keeps it cheap.
create index if not exists scraped_brand_data_verified_active_idx
  on public.scraped_brand_data (brand_profile_id, field_key)
  where source_name = 'brand_verified' and superseded_by is null;

create index if not exists scraped_brand_data_verified_sku_active_idx
  on public.scraped_brand_data (brand_sku_id, field_key)
  where source_name = 'brand_verified' and superseded_by is null
    and brand_sku_id is not null;

commit;
