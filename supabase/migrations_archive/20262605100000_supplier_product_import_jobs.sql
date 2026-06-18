-- Async job tracking for "Smart import supplier products from a PDF/CSV/XLSX"
-- Mirrors product_import_jobs (20260423120000): kickoff route inserts a row,
-- a Netlify -background function picks it up, runs pdf-parse / xlsx + Claude
-- extraction, writes the result back. Client polls until status='completed'
-- then posts the reviewed array to the confirm endpoint.

create table public.supplier_product_import_jobs (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  source text not null check (source in ('pdf','csv','xlsx')),
  file_storage_path text not null,
  file_hash text not null,
  status text not null check (status in ('pending','parsing','extracting','completed','failed')),
  phase_message text,
  extracted_products jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Dedupe lookups: (supplier_id, file_hash) within a 24h window short-circuits
-- a re-upload of the same file back to the cached extraction.
create index supplier_product_import_jobs_supplier_hash_idx
  on public.supplier_product_import_jobs (supplier_id, file_hash, created_at desc);

create index supplier_product_import_jobs_user_created_idx
  on public.supplier_product_import_jobs (user_id, created_at desc);

alter table public.supplier_product_import_jobs enable row level security;

-- Suppliers see their own jobs.
create policy "suppliers read own import jobs"
  on public.supplier_product_import_jobs for select
  using (auth.uid() = user_id);

-- Org members of the supplier's org can also read (matches the broader
-- supplier_products visibility model — buying-org admins reviewing data).
create policy "org members read supplier import jobs in their org"
  on public.supplier_product_import_jobs for select
  using (
    organization_id is not null
    and public.user_has_organization_access(organization_id)
  );

-- No insert/update/delete policy: writes happen only via service-role key
-- (kickoff route + background function + confirm route).
