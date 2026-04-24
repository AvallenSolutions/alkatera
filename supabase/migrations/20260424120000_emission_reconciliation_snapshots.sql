-- Phase 0 of double-count elimination: instrumentation only.
-- Stores point-in-time snapshots of an organisation's emissions totals and per-source
-- attribution so that future rule changes (Phase 1 suppression, Phase 2 inventory ledger)
-- can be reconciled against a pre-change baseline and surfaced to customers.

create table if not exists public.emission_reconciliation_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  year integer not null,
  captured_at timestamptz not null default now(),
  totals_json jsonb not null default '{}'::jsonb,
  sources_json jsonb not null default '[]'::jsonb,
  notes text,
  captured_by uuid references auth.users(id) on delete set null,
  constraint emission_reconciliation_snapshots_year_check
    check (year between 2000 and 2100)
);

create index if not exists emission_reconciliation_snapshots_org_year_idx
  on public.emission_reconciliation_snapshots (organization_id, year, captured_at desc);

alter table public.emission_reconciliation_snapshots enable row level security;

create policy "emission_reconciliation_snapshots_admin_read"
  on public.emission_reconciliation_snapshots
  for select
  using (public.is_alkatera_admin());

create policy "emission_reconciliation_snapshots_admin_write"
  on public.emission_reconciliation_snapshots
  for all
  using (public.is_alkatera_admin())
  with check (public.is_alkatera_admin());

comment on table public.emission_reconciliation_snapshots is
  'Phase 0 instrumentation: baseline snapshots of per-org emission totals and per-source attribution, taken before suppression rules (Phase 1) or inventory-ledger changes (Phase 2) ship.';
