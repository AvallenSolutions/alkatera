-- ============================================================
-- brand_directory.review_status
-- ============================================================
--
-- Phase B of the brand data pipeline rebuild adds an explicit
-- state machine for each brand:
--
--   provisional → the initial fast 3-source scrape has run, but
--                 no deeper enrichment has happened yet. Few or
--                 no leadership signals; the distributor card
--                 should signpost that more data is on the way.
--
--   enriched    → deep-enrich (Gemini grounded search + landing
--                 page PDF crawl) has completed. Score and signals
--                 reflect a real-world sweep but are still
--                 unverified by a human.
--
--   reviewed    → an alka**tera** admin has eyeballed every signal
--                 + evidence URL in the new admin review queue
--                 and confirmed it represents the brand fairly.
--                 Distributors can trust the score is curated.
--
--   verified    → the brand owner themselves has confirmed via the
--                 existing brand_verified upload flow. Highest
--                 confidence; precedence already lives in the
--                 data merger.
--
-- Distributors see this as a status badge on each brand card and
-- can filter "show reviewed+". Future deep-enrich runs reset
-- 'enriched' brands back to 'enriched' (still needs re-review if
-- material new evidence lands) without overwriting 'reviewed' or
-- 'verified' brands.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'brand_review_status') then
    create type public.brand_review_status as enum (
      'provisional',
      'enriched',
      'reviewed',
      'verified'
    );
  end if;
end $$;

alter table public.brand_directory
  add column if not exists review_status public.brand_review_status
    not null default 'provisional';

create index if not exists brand_directory_review_status_idx
  on public.brand_directory (review_status);

comment on column public.brand_directory.review_status is
  'Brand profile review state. provisional → enriched → reviewed → verified. Distributor cards surface this; admin review queue walks the enriched bucket. Future deep-enrich runs never demote — manual reviewed/verified status is sticky.';

-- Backfill: any brand_directory row that already has deep-enrich
-- evidence on file (a finding with source_name='admin_deep_enrich' or
-- an entry in deep_enrich_jobs that completed) graduates to 'enriched'.
-- Brands with no findings stay 'provisional' so the new auto-enrich
-- queue picks them up.
update public.brand_directory bd
   set review_status = 'enriched'
 where bd.review_status = 'provisional'
   and exists (
     select 1
       from public.scraped_brand_data sbd
      where sbd.brand_directory_id = bd.id
        and sbd.superseded_by is null
        and sbd.source_name = 'admin_deep_enrich'
   );

notify pgrst, 'reload schema';
