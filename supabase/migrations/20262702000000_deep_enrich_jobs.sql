-- ============================================================
-- DEEP ENRICH JOBS (async deep-enrich)
-- ============================================================
-- Deep-enrich runs Claude Sonnet with up to 10 web_search calls + a
-- comprehensive prompt + downstream PDF downloads + a completeness
-- recalc. Empirically this is 45-90s, way past Netlify's ~30s synchronous
-- ceiling — production was 504-ing every invocation. Same fix as the
-- brand_sourcing_jobs pattern from a few sessions ago:
--
--   1. POST /api/admin/directory/brands/[id]/deep-enrich inserts a job
--      row (pending) and fires the deep-enrich-background Netlify
--      function (15 min window), returning the jobId immediately.
--   2. The background function runs deepEnrichBrand and writes the raw
--      enriched payload onto the job + status='searched'.
--   3. The client polls GET /api/admin/directory/deep-enrich/[jobId];
--      when status='searched' the route runs the persistence pipeline
--      (brand patch + credentials + smart product matcher + PDF
--      ingester + completeness recalc) and sets status='done'.
-- ============================================================

begin;

create table if not exists public.deep_enrich_jobs (
  id                  uuid primary key default gen_random_uuid(),
  brand_directory_id  uuid not null references public.brand_directory(id) on delete cascade,
  created_by          uuid references auth.users(id) on delete set null,
  status              text not null default 'pending'
                        check (status in ('pending','searching','searched','ingesting','done','error')),
  phase_message       text,
  -- Raw output from deepEnrichBrand: { brand, credentials, products, documents, summary }
  enriched            jsonb,
  -- Ingest summary: { brand: {fields_updated}, credentials, products, documents }
  result              jsonb,
  error               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  completed_at        timestamptz
);

create index if not exists deep_enrich_jobs_brand_idx
  on public.deep_enrich_jobs (brand_directory_id, created_at desc);
create index if not exists deep_enrich_jobs_status_idx
  on public.deep_enrich_jobs (status, created_at desc);

alter table public.deep_enrich_jobs enable row level security;

drop policy if exists "admins manage deep enrich jobs" on public.deep_enrich_jobs;
create policy "admins manage deep enrich jobs"
  on public.deep_enrich_jobs for all
  using (public.is_alkatera_admin()) with check (public.is_alkatera_admin());

create or replace function public.touch_deep_enrich_jobs_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_deep_enrich_jobs_touch on public.deep_enrich_jobs;
create trigger trg_deep_enrich_jobs_touch
  before update on public.deep_enrich_jobs
  for each row execute function public.touch_deep_enrich_jobs_updated_at();

notify pgrst, 'reload schema';

commit;
