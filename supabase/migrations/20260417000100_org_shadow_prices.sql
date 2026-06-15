-- Pulse -- Shadow prices.
--
-- Each organisation can attach a financial value to a sustainability metric
-- (carbon at the UK ETS price, water at the Ofwat rate, landfill at the UK
-- landfill tax, and so on). The Pulse KPI tiles read these prices to render
-- a second, CFO-legible number beneath every value ("3,200 tCO2e / 272k at
-- £85/tCO2e").
--
-- Rows with organization_id = NULL are GLOBAL DEFAULTS. When resolving a
-- price for an org we prefer the most recent org-specific row first and
-- fall back to the most recent global row. Historical prices are kept
-- (effective_from) so dashboards can back-price old snapshots.
--
-- Design choices:
--   * `price_per_unit` is quoted in the price's display unit (e.g. £85 per
--     tCO2e). `native_unit_multiplier` converts a metric_snapshots value
--     into the display unit before applying the price. This keeps prices
--     readable while leaving metric values in the unit the rest of the
--     app already uses.
--   * `source` is a free-text provenance string so finance can always see
--     where a number came from.
--   * Composite uniqueness on (org, metric, currency, effective_from) so
--     an org can rotate prices by adding new rows rather than mutating old
--     ones. Treat the table as append-only for auditability.

create table if not exists public.org_shadow_prices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  metric_key text not null,
  currency text not null default 'GBP',
  price_per_unit numeric not null,
  unit text not null,
  native_unit_multiplier numeric not null default 1,
  source text,
  effective_from date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, metric_key, currency, effective_from)
);

create index if not exists org_shadow_prices_lookup
  on public.org_shadow_prices (organization_id, metric_key, effective_from desc);

create index if not exists org_shadow_prices_global_lookup
  on public.org_shadow_prices (metric_key, effective_from desc)
  where organization_id is null;

-- Row-level security: org members can read their org's rows plus global
-- defaults; only owners/admins can write their org's rows; nobody can mutate
-- globals through the API (those are seeded via migrations).

alter table public.org_shadow_prices enable row level security;

drop policy if exists org_shadow_prices_read on public.org_shadow_prices;
create policy org_shadow_prices_read on public.org_shadow_prices
  for select
  using (
    organization_id is null
    or organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = auth.uid()
    )
  );

drop policy if exists org_shadow_prices_write on public.org_shadow_prices;
create policy org_shadow_prices_write on public.org_shadow_prices
  for all
  using (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      join public.roles r on r.id = om.role_id
      where om.user_id = auth.uid()
        and r.name in ('owner', 'admin')
    )
  )
  with check (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      join public.roles r on r.id = om.role_id
      where om.user_id = auth.uid()
        and r.name in ('owner', 'admin')
    )
  );

-- Seed global defaults. These are intentionally conservative UK baselines;
-- every org can override at /pulse/settings/shadow-prices.
insert into public.org_shadow_prices
  (organization_id, metric_key, currency, price_per_unit, unit, native_unit_multiplier, source, effective_from)
values
  -- total_co2e is stored in kg; tCO2e = kg / 1000.
  (null, 'total_co2e',        'GBP', 85.00, 'tCO2e', 0.001, 'UK ETS average April 2026',          '2026-01-01'),
  -- water_consumption is already in m³.
  (null, 'water_consumption', 'GBP',  2.50, 'm3',    1,     'Ofwat UK business average 2024',     '2026-01-01')
on conflict (organization_id, metric_key, currency, effective_from) do nothing;

comment on table public.org_shadow_prices is
  'Pulse shadow prices: per-org (or global default) monetary factors used to render £ alongside every KPI tile.';
