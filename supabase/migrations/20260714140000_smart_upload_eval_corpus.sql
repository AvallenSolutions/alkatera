-- Golden eval corpus for the Smart Upload classifier.
--
-- Files are copied out of ingest-staging into a private bucket at promotion
-- time (staging files may be pruned later); expected_type is the
-- human-verified answer, seeded from corrected_result_type where a correction
-- happened. The corpus feeds the offline eval harness
-- (scripts/ingest-eval.ts) that proves a prompt/tool-description change
-- improves accuracy before it ships.
--
-- Privacy: these are real customer documents. They live in a private bucket,
-- are readable by service-role only, and are NEVER injected into any org's
-- classifier prompt. Global learning stays offline: corpus -> eval -> a human
-- edits the tool descriptions -> eval proves it -> ship.

insert into storage.buckets (id, name, public)
values ('ingest-eval-corpus', 'ingest-eval-corpus', false)
on conflict (id) do nothing;

create table if not exists public.ingest_eval_cases (
  id                    uuid primary key default gen_random_uuid(),
  storage_path          text not null,
  file_name             text not null,
  file_mime             text,
  expected_type         text not null,
  original_result_type  text,
  notes                 text,
  source_org_id         uuid references public.organizations(id) on delete set null,
  promoted_from_job     uuid,
  promoted_by           uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  unique (storage_path)
);

comment on table public.ingest_eval_cases is
  'Golden corpus for offline classifier evals. Admin-promoted real uploads; never injected into any org''s prompt.';
comment on column public.ingest_eval_cases.expected_type is
  'Human-verified document type — the answer the classifier should give.';
comment on column public.ingest_eval_cases.original_result_type is
  'What the classifier originally said, when the case was promoted from a misclassification.';

create index if not exists ingest_eval_cases_expected_idx
  on public.ingest_eval_cases (expected_type, created_at desc);

alter table public.ingest_eval_cases enable row level security;
-- No policies: service-role only (admin promote route + offline eval script).
