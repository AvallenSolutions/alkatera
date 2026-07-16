-- Rosa learning cases -- Pillar 4 step 2 "Curate" (data-revolution-plan.md).
--
-- The weekly curation sweep (lib/inngest/functions/rosa-learning.ts, event
-- rosa/learning.sweep) reads the last 7 days of failure signals already
-- captured by step 1 (rosa_message_feedback verdicts, rosa_telemetry
-- learning.* events, support.ticket_filed with after_answer=true), clusters
-- them deterministically (lib/rosa/learning-sweep.ts), and writes one row
-- here per cluster. An admin works the queue at /admin/rosa-learning and
-- resolves each case to one of four levers: a wiki/knowledge edit, a
-- curated exemplar (rosa_exemplars), an org-memory correction, or a
-- tool/code fix ticket -- or dismisses it as noise.
--
-- organization_id is nullable: a cluster spanning more than one
-- organisation (e.g. the same knowledge-bank query missing everywhere) is a
-- cross-org pattern, recorded with organization_id = null.

create table if not exists public.rosa_learning_cases (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('missing_knowledge', 'wrong_tool', 'wrong_data', 'wrong_tone', 'unclassified')),
  status         text not null default 'open' check (status in ('open', 'resolved', 'dismissed', 'promoted')),
  summary        text not null,
  evidence       jsonb not null default '{}'::jsonb,
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz,
  resolution     jsonb
);

comment on table public.rosa_learning_cases is
  'Weekly-swept clusters of Rosa failure signals (Pillar 4 step 2 "Curate"). One row per cluster; resolved by an admin at /admin/rosa-learning.';
comment on column public.rosa_learning_cases.evidence is
  'Cluster evidence: message/telemetry ids, the representative query or conversation, signal counts, and a deterministic cluster_key used to dedupe repeat sweeps.';
comment on column public.rosa_learning_cases.resolution is
  'Set when status moves off open. Shape: { type: knowledge|exemplar|memory|code|dismiss, note?, exemplar_id?, wiki_href? }.';

create index if not exists rosa_learning_cases_status_kind_idx
  on public.rosa_learning_cases (status, kind, created_at desc);

create index if not exists rosa_learning_cases_org_idx
  on public.rosa_learning_cases (organization_id);

-- Dedupe lookups key off evidence->>'cluster_key' while a case is still open.
create index if not exists rosa_learning_cases_cluster_key_idx
  on public.rosa_learning_cases ((evidence ->> 'cluster_key')) where status = 'open';

alter table public.rosa_learning_cases enable row level security;
-- No policies: service-role only (Inngest sweep writes, admin API reads/writes).
-- This is alkatera-internal curation data, never org-scoped for a customer.
