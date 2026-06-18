-- Async job tracking for "Import products from website"
-- Decouples long-running scrape + Claude extraction from the 26s Netlify
-- synchronous function cap by running the work in a -background function
-- (15 min) and letting the client poll this row for status.

create table public.product_import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  url text not null,
  status text not null check (status in ('pending','scraping','extracting','completed','failed')),
  phase_message text,
  pages_analyzed integer,
  products jsonb,
  org_certifications jsonb,
  org_description text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_import_jobs_user_created_idx
  on public.product_import_jobs (user_id, created_at desc);

alter table public.product_import_jobs enable row level security;

create policy "users read own import jobs"
  on public.product_import_jobs for select
  using (auth.uid() = user_id);
-- No insert/update/delete policy: writes only via service-role key.
