-- ============================================================
-- SCRAPING JOBS: admin intake (directory-keyed jobs)
--   + BRAND SOURCING JOBS: batched mode (target_count + progress)
-- ============================================================
-- Today scraping_jobs is keyed by brand_profile_id (a distributor's
-- listing). The "fill the directory" admin intake creates brand_directory
-- rows directly, no listing, so we need a way to enqueue a scrape pass
-- against a directory entry that no distributor has listed yet.
--
-- Approach: scraping_jobs gains a brand_directory_id column. Exactly one
-- of (brand_profile_id + distributor_org_id) or brand_directory_id is
-- set on any given row. The cron route picks up either kind; the agent
-- runs the same sources, and writes the same scraped_brand_data rows
-- (which are already directory-keyed since phase 3).
--
-- A new triggered_by enum value 'admin_intake' lets us filter these in
-- analytics without conflating with distributor-driven manual scrapes.
-- ============================================================

begin;

-- 1. Relax the listing-keyed columns and add the directory-keyed one.
alter table public.scraping_jobs
  alter column brand_profile_id drop not null;
alter table public.scraping_jobs
  alter column distributor_org_id drop not null;
alter table public.scraping_jobs
  add column if not exists brand_directory_id uuid
    references public.brand_directory(id) on delete cascade;

-- 2. Enforce exactly-one-target. A job either targets a distributor
--    listing (brand_profile_id + distributor_org_id) or a directory
--    entry directly (brand_directory_id). Never both, never neither.
alter table public.scraping_jobs
  drop constraint if exists scraping_jobs_target_check;
alter table public.scraping_jobs
  add constraint scraping_jobs_target_check check (
    (
      brand_profile_id is not null
      and distributor_org_id is not null
      and brand_directory_id is null
    )
    or (
      brand_directory_id is not null
      and brand_profile_id is null
      and distributor_org_id is null
    )
  );

-- 3. Extend triggered_by enum.
alter table public.scraping_jobs
  drop constraint if exists scraping_jobs_triggered_by_check;
alter table public.scraping_jobs
  add constraint scraping_jobs_triggered_by_check check (
    triggered_by in ('auto', 'manual', 'sku_import', 'admin_intake')
  );

-- 4. Index on the new column so the cron pickup query stays cheap.
create index if not exists scraping_jobs_directory_idx
  on public.scraping_jobs (brand_directory_id);

-- 5. RLS — let alkatera admins read directory-keyed scraping jobs so
--    the admin panel can show enrichment status on pending brands. The
--    existing "distributor members read scraping jobs" policy already
--    covers listing-keyed jobs.
drop policy if exists "alkatera admins read intake scraping jobs"
  on public.scraping_jobs;
create policy "alkatera admins read intake scraping jobs"
  on public.scraping_jobs for select
  using (
    brand_directory_id is not null and public.is_alkatera_admin()
  );

-- ============================================================
-- BRAND SOURCING JOBS: batched mode
-- ============================================================
-- The "Find brands" tool previously did one web-search call per job
-- (~25 brands max). To populate the directory with hundreds of brands
-- the job loops chunks of <=25 with a rolling per-job exclusion list so
-- the LLM doesn't repeat itself. target_count is how many brands the
-- admin asked for; progress is the running counter the UI polls.
alter table public.brand_sourcing_jobs
  add column if not exists target_count integer not null default 12;
alter table public.brand_sourcing_jobs
  add column if not exists progress jsonb not null default '{}'::jsonb;

commit;
