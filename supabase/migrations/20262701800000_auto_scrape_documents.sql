-- ============================================================
-- AUTO-SCRAPE DOCUMENTS: relax NOT NULL on listing-keyed columns
-- ============================================================
-- The brand-website scraper now discovers sustainability / EPD / LCA
-- PDFs on a brand's site. To auto-download + auto-extract them via the
-- existing document-processing pipeline we need to insert submission
-- and job rows for scrapes that have no distributor listing (admin
-- intake → directory_id only), and even for listing-driven scrapes we
-- want the submission to carry an explicit `submission_source` so
-- analytics can separate "we scraped this" from "the brand uploaded it".
--
-- Schema deltas:
--   brand_document_submissions
--     - distributor_org_id      → nullable (was NOT NULL)
--     - submission_source       → new text column with default
--                                 'distributor_upload' and a CHECK
--   document_processing_jobs
--     - brand_profile_id        → nullable (was NOT NULL)
--     - distributor_org_id      → nullable (was NOT NULL)
--     - brand_directory_id      → new uuid FK so the cron + processor
--                                 can read context for listing-less jobs
--
-- RLS updates: alka**tera** admins get a SELECT path on submissions
-- + jobs that come from auto_scrape / have no distributor_org_id.
-- Existing distributor-member policies are unchanged.
-- ============================================================

begin;

-- 1. brand_document_submissions
alter table public.brand_document_submissions
  alter column distributor_org_id drop not null;

alter table public.brand_document_submissions
  add column if not exists submission_source text not null default 'distributor_upload'
    check (submission_source in (
      'distributor_upload', 'brand_upload', 'admin_intake', 'auto_scrape'
    ));

-- 2. document_processing_jobs
alter table public.document_processing_jobs
  alter column brand_profile_id drop not null;
alter table public.document_processing_jobs
  alter column distributor_org_id drop not null;
alter table public.document_processing_jobs
  add column if not exists brand_directory_id uuid
    references public.brand_directory(id) on delete cascade;

-- Backfill brand_directory_id from the submission's directory id so the
-- existing rows have a value (Phase 3 already populated submissions).
update public.document_processing_jobs dpj
  set brand_directory_id = bds.brand_directory_id
  from public.brand_document_submissions bds
  where bds.id = dpj.submission_id
    and dpj.brand_directory_id is null;

create index if not exists document_processing_jobs_directory_idx
  on public.document_processing_jobs (brand_directory_id, created_at desc);

-- 3. RLS: alka**tera** admins can read auto-scrape submissions + jobs.
--    The existing distributor-member policies stay untouched.
drop policy if exists "alkatera admins read auto-scrape submissions"
  on public.brand_document_submissions;
create policy "alkatera admins read auto-scrape submissions"
  on public.brand_document_submissions for select
  using (
    distributor_org_id is null and public.is_alkatera_admin()
  );

drop policy if exists "alkatera admins read auto-scrape jobs"
  on public.document_processing_jobs;
create policy "alkatera admins read auto-scrape jobs"
  on public.document_processing_jobs for select
  using (
    distributor_org_id is null and public.is_alkatera_admin()
  );

commit;
