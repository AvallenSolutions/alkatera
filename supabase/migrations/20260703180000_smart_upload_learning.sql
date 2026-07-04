-- Smart Upload learning loop.
--
-- ingest_feedback: one row per confirmed Smart Upload — what the classifier
-- extracted (from ingest_jobs.result_payload) vs what the user actually saved,
-- with a per-field diff computed server-side. This is the audit/eval layer:
-- it answers "how often does the classifier get each document type right,
-- and which fields do users correct?".
--
-- ingest_document_profiles: per-org memory of confirmed documents keyed by
-- (supplier, document type). Injected as hints into the classifier prompt on
-- subsequent uploads so the classifier gains experience of each org's
-- recurring documents. Learning layer — survives even if feedback rows are
-- pruned later.
--
-- Writes are service-role only, via POST /api/ingest/feedback after explicit
-- job-ownership + org-membership checks (the service client bypasses RLS, so
-- the route enforces scoping at the application level).

create table if not exists public.ingest_feedback (
  id                 uuid primary key default gen_random_uuid(),
  job_id             uuid references public.ingest_jobs(id) on delete set null,
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  user_id            uuid not null references auth.users(id) on delete cascade,
  result_type        text not null,
  supplier_key       text,
  classifier_payload jsonb not null default '{}'::jsonb,
  saved_payload      jsonb not null default '{}'::jsonb,
  field_diff         jsonb not null default '{}'::jsonb,
  context            jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

comment on table public.ingest_feedback is
  'Per-confirmation record of Smart Upload classifier output vs user-saved values, with field-level diff. Written by /api/ingest/feedback.';
comment on column public.ingest_feedback.supplier_key is
  'Normalised supplier/carrier/lab name extracted from the confirmed payload, when the document type carries one.';
comment on column public.ingest_feedback.field_diff is
  'Summary of user edits: { edited, added, removed, fields: [{ path, from, to, change }] }.';
comment on column public.ingest_feedback.context is
  'User choices the classifier cannot see (facility, product, framework, asset bindings).';

-- One feedback row per job (idempotent client retries). Partial so job_id
-- nulls (job pruned later) do not collide.
create unique index if not exists ingest_feedback_job_uidx
  on public.ingest_feedback (job_id) where job_id is not null;
create index if not exists ingest_feedback_org_created_idx
  on public.ingest_feedback (organization_id, created_at desc);

alter table public.ingest_feedback enable row level security;

drop policy if exists "ingest_feedback readable by org members" on public.ingest_feedback;
create policy "ingest_feedback readable by org members"
  on public.ingest_feedback for select
  to authenticated
  using (
    organization_id in (
      select om.organization_id from public.organization_members om
      where om.user_id = auth.uid()
    )
  );
-- No insert/update/delete policies: service-role writes only.

create table if not exists public.ingest_document_profiles (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations(id) on delete cascade,
  supplier_key           text not null,
  result_type            text not null,
  times_seen             integer not null default 1,
  hints                  jsonb not null default '{}'::jsonb,
  last_confirmed_payload jsonb,
  last_seen_at           timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (organization_id, supplier_key, result_type)
);

comment on table public.ingest_document_profiles is
  'Per-org supplier/document memory for Smart Upload: learned corrections injected as classifier hints. Upserted by /api/ingest/feedback.';
comment on column public.ingest_document_profiles.hints is
  'Flat allowlisted key/value corrections (see lib/ingest/feedback-hints.ts), e.g. corrected spend category, usual facility, typical units.';
comment on column public.ingest_document_profiles.times_seen is
  'Confidence signal: how many confirmed uploads matched this (supplier, type). Not deduplicated by file content.';

create index if not exists ingest_document_profiles_org_seen_idx
  on public.ingest_document_profiles (organization_id, times_seen desc, last_seen_at desc);

alter table public.ingest_document_profiles enable row level security;

drop policy if exists "ingest_document_profiles readable by org members" on public.ingest_document_profiles;
create policy "ingest_document_profiles readable by org members"
  on public.ingest_document_profiles for select
  to authenticated
  using (
    organization_id in (
      select om.organization_id from public.organization_members om
      where om.user_id = auth.uid()
    )
  );
-- No client write policies: service-role writes only.
