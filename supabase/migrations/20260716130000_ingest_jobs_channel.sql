-- Ingest job channel marking.
--
-- data-revolution-plan.md Pillar 1: consolidate the classifiers — Rosa
-- drawer uploads and supplier smart-import route through
-- lib/ingest/classify-document.ts + ingest-staging + ingest_jobs, so every
-- channel feeds and benefits from the same ingest_document_profiles /
-- ingest_feedback learning loop.
--
-- ingest_jobs carries no metadata/jsonb column to piggyback a channel tag on
-- (checked the schema: only result_payload, which stays null until the job
-- completes, and result_payload's shape is a discriminated union keyed by
-- result_type, not a place for job-level provenance). An additive text
-- column is the clean, minimal-diff option instead of overloading an
-- existing field.
--
-- null / 'smart_upload' = the original Smart Upload dropzone (unchanged
-- default — every existing row and every INSERT that omits the column keeps
-- working exactly as before).
-- 'rosa' = stashed by the Rosa drawer's document review flow
-- (app/api/rosa/uploads/route.ts).
-- 'supplier_import' = a classification-only pass run alongside a supplier
-- smart-import extraction (app/api/supplier-products/smart-import/route.ts),
-- kept separate from that flow's own supplier_product_import_jobs row.

alter table public.ingest_jobs
  add column if not exists channel text;

alter table public.ingest_jobs
  drop constraint if exists ingest_jobs_channel_check;

alter table public.ingest_jobs
  add constraint ingest_jobs_channel_check
  check (channel is null or channel = any (array['smart_upload', 'rosa', 'supplier_import']));

comment on column public.ingest_jobs.channel is
  'Which intake surface created this job: null/''smart_upload'' = the Smart Upload dropzone, ''rosa'' = the Rosa drawer upload, ''supplier_import'' = a supplier smart-import classification pass. Lets all document pipelines share ingest_jobs + the learning loop while staying distinguishable in admin views.';

create index if not exists ingest_jobs_channel_idx on public.ingest_jobs (channel);
