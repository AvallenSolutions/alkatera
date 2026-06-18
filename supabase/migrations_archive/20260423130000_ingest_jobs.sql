-- Async job tracking for Smart Upload ("Upload anything" dropzone + facility
-- bill dialogs). Mirrors product_import_jobs: the synchronous Next.js POST
-- route enqueues a row here and fires an HMAC-signed trigger at a -background
-- Netlify function (15 min), which runs the slow Claude classifier +
-- extraction and writes the result back. The client polls for status.
--
-- Result shapes vary by tool (utility bill, water, waste, BOM, historical
-- sustainability/LCA report, unsupported). We keep the result_type string
-- and payload jsonb mirroring the existing IngestResponse union so the
-- client can dispatch on result_type exactly as it does today.

create table public.ingest_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null check (status in ('pending','extracting','completed','failed')),
  phase_message text,
  -- Path in the ingest-staging bucket. Background function reads the file
  -- from here; save-step may move it elsewhere.
  stash_path text not null,
  file_name text not null,
  file_mime text,
  result_type text,
  result_payload jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ingest_jobs_user_created_idx
  on public.ingest_jobs (user_id, created_at desc);

alter table public.ingest_jobs enable row level security;

create policy "users read own ingest jobs"
  on public.ingest_jobs for select
  using (auth.uid() = user_id);
-- No insert/update/delete policy: writes only via service-role key.

-- Fix PostgREST schema cache so the anon role picks up enrichment columns on
-- utility_data_entries (account_number, mpan, mprn, fuel_mix, etc.). The
-- permanent fix is routing saves through a server API with the service-role
-- client; this reload just ensures any remaining anon-client readers work.
notify pgrst, 'reload schema';
