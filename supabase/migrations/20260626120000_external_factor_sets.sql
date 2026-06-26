-- ============================================================================
-- Foundation A: external reference-data ingestion (versioned factor sets)
-- ============================================================================
--
-- Backs the corporate Scope 1/2/3 emission factors with a versioned, dated,
-- citable library that can absorb annual public-data releases (DESNZ GHG
-- conversion factors first, then EPA USEEIO spend factors, etc.) WITHOUT
-- overwriting history.
--
--   factor_sets       one row per (provider, dataset, version) release
--   reference_factors  the individual factors belonging to a set
--
-- A new annual release inserts a new factor_sets row and stamps valid_to on the
-- prior current row for that (provider, dataset), so older reports can always be
-- recomputed against the factors that were authoritative at the time.
--
-- Read model: a factor is "current" when its set has valid_to IS NULL. The app
-- warms an in-memory cache from the current sets; the emission calculators read
-- that cache first and fall back to their built-in constants on a cold cache, so
-- this table is purely additive and changes nothing until a set is loaded.
--
-- These are global reference data (not org-scoped): readable by any authenticated
-- user, writable only by the service role (RLS denies all other writes).
-- ============================================================================

create table if not exists public.factor_sets (
  id          uuid primary key default gen_random_uuid(),
  provider    text not null,                 -- 'DESNZ' | 'EPA_USEEIO' | 'DEFRA'
  dataset     text not null,                 -- 'ghg_conversion_factors' | 'useeio_v2'
  version     text not null,                 -- '2024' | 'v2.0.1'
  valid_from  date not null,
  valid_to    date,                          -- null = current
  licence     text not null,                 -- 'OGL-3.0' | 'public-domain' | 'CC-BY-4.0'
  source_url  text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (provider, dataset, version)
);

comment on table public.factor_sets is
  'Versioned releases of public emission-factor datasets (DESNZ, USEEIO, ...). valid_to IS NULL marks the current release for a (provider, dataset).';

create table if not exists public.reference_factors (
  id              uuid primary key default gen_random_uuid(),
  factor_set_id   uuid not null references public.factor_sets(id) on delete cascade,
  kind            text not null,             -- 'grid' | 'utility' | 'spend' | 'fuel'
  lookup_key      text not null,             -- 'GB' | 'natural_gas' | 'grid_electricity'
  scope           text,                      -- 'Scope 1' | 'Scope 2' | 'Scope 3' | null
  factor          numeric not null,
  unit            text not null,             -- 'kgCO2e/kWh' | 'kgCO2e/litre' | 'kgCO2e/GBP'
  uncertainty     numeric,                   -- 0-1, optional
  geographic_scope text,                     -- ISO code / region; null = applies anywhere
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  unique (factor_set_id, kind, lookup_key, geographic_scope)
);

comment on table public.reference_factors is
  'Individual factors belonging to a factor_set. Looked up by (kind, lookup_key, geographic_scope).';

create index if not exists reference_factors_lookup_idx
  on public.reference_factors (kind, lookup_key, geographic_scope);
create index if not exists reference_factors_set_idx
  on public.reference_factors (factor_set_id);
create index if not exists factor_sets_current_idx
  on public.factor_sets (provider, dataset, valid_to);

-- ── RLS: global read for authenticated users; writes service-role only ──
alter table public.factor_sets enable row level security;
alter table public.reference_factors enable row level security;

drop policy if exists "factor_sets readable by authenticated" on public.factor_sets;
create policy "factor_sets readable by authenticated"
  on public.factor_sets for select
  to authenticated
  using (true);

drop policy if exists "reference_factors readable by authenticated" on public.reference_factors;
create policy "reference_factors readable by authenticated"
  on public.reference_factors for select
  to authenticated
  using (true);

-- No INSERT/UPDATE/DELETE policies: only the service role (which bypasses RLS)
-- can write, exactly like the Agribalyse backfill writes staging_emission_factors.
