-- ============================================================
-- BRAND SOURCING JOBS (async web-search sourcing)
-- ============================================================
-- The admin "Find brands" tool calls Claude with web search, which
-- reliably takes 40-60s — far past any synchronous serverless timeout
-- (Netlify caps at ~26s, hence the 504 the admin saw). This table
-- backs an async flow:
--
--   1. POST /api/admin/directory/sourcing inserts a row (pending) and
--      fires the directory-sourcing-background Netlify function (15 min
--      window), returning the job id immediately.
--   2. The background function runs the web search and writes `found`
--      (raw brands/products) + status='searched'.
--   3. The client polls GET /api/admin/directory/sourcing/[jobId]; when
--      it sees 'searched' the route ingests the brands as pending
--      (reusing the bulk processors) and sets status='done'.
--
-- Admin-only via RLS. Writes happen through the service role.
-- ============================================================

begin;

create table public.brand_sourcing_jobs (
  id              uuid primary key default gen_random_uuid(),
  created_by      uuid references auth.users(id) on delete set null,
  status          text not null default 'pending'
                    check (status in ('pending','searching','searched','ingesting','done','error')),
  filters         jsonb not null default '{}',
  -- Raw output from the web search: { brands, products, summary }.
  found           jsonb,
  -- Ingest summary: { found_brands, brand_names, brands:{created,linked,errors}, products:{...} }.
  result          jsonb,
  phase_message   text,
  error           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create index brand_sourcing_jobs_created_idx
  on public.brand_sourcing_jobs (created_at desc);
create index brand_sourcing_jobs_status_idx
  on public.brand_sourcing_jobs (status, created_at desc);

alter table public.brand_sourcing_jobs enable row level security;

create policy "admins manage sourcing jobs"
  on public.brand_sourcing_jobs for all
  using (public.is_alkatera_admin()) with check (public.is_alkatera_admin());

create or replace function public.touch_brand_sourcing_jobs_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger trg_brand_sourcing_jobs_touch
  before update on public.brand_sourcing_jobs
  for each row execute function public.touch_brand_sourcing_jobs_updated_at();

commit;
