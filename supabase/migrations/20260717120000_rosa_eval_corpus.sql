-- Rosa eval corpus -- Pillar 4 step 4 "Evaluate" (data-revolution-plan.md).
--
-- Golden corpus harvested from real conversations via a "Promote to eval"
-- button on the curation queue (/admin/rosa-learning), mirroring the
-- ingest classifier's promotion flow (ingest_eval_cases). Scored by
-- scripts/rosa-eval.ts -- deterministic checks against `expectations` plus
-- an optional Claude judge -- manual run only, never CI (real tokens).
-- rosa_eval_runs is the scoreboard history the admin page's "last eval
-- score" stat reads.

create table if not exists public.rosa_eval_cases (
  id             uuid primary key default gen_random_uuid(),
  question       text not null,
  org_snapshot   jsonb not null default '{}'::jsonb,
  expectations   jsonb not null default '{}'::jsonb,
  source_case    uuid references public.rosa_learning_cases(id) on delete set null,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

comment on table public.rosa_eval_cases is
  'Golden corpus for the Rosa eval harness (scripts/rosa-eval.ts). Promoted from real curation cases or authored directly; never fed back into any org''s live prompt.';
comment on column public.rosa_eval_cases.org_snapshot is
  'Minimal context the case was captured against: { organization_id, name, counts }. organization_id lets the harness run the real tool loop against real (read-only) org data; cases without one are skipped with a note.';
comment on column public.rosa_eval_cases.expectations is
  'Deterministic checks: { must_call_tool?: string, must_mention?: string | string[], must_cite_wiki?: boolean, must_propose_not_write?: boolean }.';

create index if not exists rosa_eval_cases_active_idx
  on public.rosa_eval_cases (active, created_at desc);

alter table public.rosa_eval_cases enable row level security;
-- No policies: service-role only (admin promote route + offline eval script).

create table if not exists public.rosa_eval_runs (
  id         uuid primary key default gen_random_uuid(),
  run_at     timestamptz not null default now(),
  total      integer not null,
  passed     integer not null,
  results    jsonb not null default '[]'::jsonb
);

comment on table public.rosa_eval_runs is
  'One row per scripts/rosa-eval.ts run. results is an array of per-case outcomes (case id, pass/fail per expectation, judge score if run). The admin page''s "last eval score" reads the most recent row.';

create index if not exists rosa_eval_runs_run_at_idx
  on public.rosa_eval_runs (run_at desc);

alter table public.rosa_eval_runs enable row level security;
-- No policies: service-role only (offline eval script writes; admin API reads).
