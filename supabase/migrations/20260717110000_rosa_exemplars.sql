-- Rosa exemplars -- Pillar 4 step 3 "Feed back" (data-revolution-plan.md).
--
-- The weights-free "retrain": curated question -> ideal answer/tool-trace
-- pairs, selected by keyword overlap (lib/rosa/exemplars.ts) and injected
-- into the chat system prompt (app/api/rosa/chat/route.ts) under
-- "## Worked examples". Created either from the curation queue
-- (/admin/rosa-learning, created_from references the case it came from) or
-- authored directly by an admin.

create table if not exists public.rosa_exemplars (
  id             uuid primary key default gen_random_uuid(),
  question       text not null,
  ideal_answer   text not null,
  tool_trace     jsonb,
  tags           text[] not null default '{}'::text[],
  active         boolean not null default true,
  created_from   uuid references public.rosa_learning_cases(id) on delete set null,
  created_at     timestamptz not null default now()
);

comment on table public.rosa_exemplars is
  'Curated worked examples injected into Rosa''s system prompt by keyword-overlap relevance (Pillar 4 step 3). Never treated as live data -- see lib/rosa/exemplars.ts injection hardening.';
comment on column public.rosa_exemplars.tool_trace is
  'Optional illustrative record of which tool(s) the ideal answer used, e.g. [{"tool": "get_product_footprint"}]. Reference only, never replayed.';

create index if not exists rosa_exemplars_active_idx
  on public.rosa_exemplars (active, created_at desc);

alter table public.rosa_exemplars enable row level security;
-- No policies: service-role only (chat route reads at request time via the
-- service client already in scope; admin CRUD at /admin/rosa-learning).
