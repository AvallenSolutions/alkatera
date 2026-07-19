-- Parametric packaging factor endpoints.
--
-- Why: packaging emission factors were resolved by fuzzy name-matching against
-- staging_emission_factors / ecoinvent_material_proxies (unordered ilike LIMIT 1),
-- so the same product could produce different footprints between runs when a new
-- factor row appeared (Everleaf Marine 50cl: 0.188 vs 0.104 kg CO2e with no input
-- change). This table replaces factor search for packaging entirely: each material
-- class carries a vetted virgin (0% recycled) and fully recycled (100%) endpoint
-- per impact category, and the calculator interpolates linearly at the item's
-- recycled content (standard PAS 2050 / GHG Protocol recycled-content cut-off
-- treatment). Given the inputs there is exactly one answer.
--
-- Versioning: rows are immutable once approved. Corrections or dataset updates
-- insert a NEW row with a bumped library_version; the calculator pins the chosen
-- endpoint id + library_version onto each PCF material row so historical reports
-- reproduce exactly.
--
-- Seed values are PROVISIONAL (is_provisional = true): derived from the existing
-- ecoinvent_material_proxies rows and published industry data, pending sign-off
-- against the ecoinvent 3.12 virgin and cullet/secondary processes. Provisional
-- rows surface as data_quality_grade MEDIUM in reports.

create table if not exists public.packaging_factor_endpoints (
  id uuid primary key default gen_random_uuid(),
  material_class text not null,
  variant text not null default 'standard',
  region text not null default 'EU-27',

  -- Climate endpoints (kg CO2e per kg material). Fossil split required; the
  -- biogenic/dLUC splits are nullable (0 for mineral/fossil materials).
  virgin_climate numeric not null,
  recycled_climate numeric not null,
  virgin_climate_fossil numeric not null,
  recycled_climate_fossil numeric not null,
  virgin_climate_biogenic numeric,
  recycled_climate_biogenic numeric,
  virgin_climate_dluc numeric,
  recycled_climate_dluc numeric,

  -- Non-climate endpoint pairs (per kg material). Nullable = not characterised;
  -- the derivation reports the gap rather than inventing a number.
  virgin_water numeric,
  recycled_water numeric,
  virgin_water_scarcity numeric,
  recycled_water_scarcity numeric,
  virgin_land numeric,
  recycled_land numeric,
  virgin_waste numeric,
  recycled_waste numeric,
  virgin_terrestrial_ecotoxicity numeric,
  recycled_terrestrial_ecotoxicity numeric,
  virgin_freshwater_eutrophication numeric,
  recycled_freshwater_eutrophication numeric,
  virgin_terrestrial_acidification numeric,
  recycled_terrestrial_acidification numeric,
  virgin_fossil_resource_scarcity numeric,
  recycled_fossil_resource_scarcity numeric,

  -- Provenance
  source text not null,
  dataset text not null default 'ecoinvent',
  dataset_version text not null default '3.12',
  system_model text not null default 'Cutoff',
  reference_year integer,
  notes text,

  -- Versioning / sign-off
  library_version integer not null default 1,
  is_provisional boolean not null default true,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint packaging_factor_endpoints_unique
    unique (material_class, variant, region, library_version),
  -- Sanity guard: recycled production can never emit more than virgin.
  constraint packaging_factor_endpoints_virgin_gte_recycled
    check (virgin_climate >= recycled_climate and recycled_climate >= 0)
);

comment on table public.packaging_factor_endpoints is
  'Hand-curated virgin/recycled endpoint pairs per packaging material class. The LCA calculator derives packaging factors by linear interpolation at the item''s recycled content (cut-off convention); no fuzzy factor search. Rows are immutable once approved; corrections bump library_version.';
comment on column public.packaging_factor_endpoints.material_class is
  'Controlled vocabulary key from lib/constants/packaging-material-classes.ts (glass, aluminium, steel, pet, hdpe, pp, ldpe_film, paperboard, kraft, corrugated, cork).';
comment on column public.packaging_factor_endpoints.variant is
  'Material variant where it moves the factor, e.g. glass colour (flint/green/amber). ''standard'' otherwise.';
comment on column public.packaging_factor_endpoints.is_provisional is
  'True until the endpoint values are signed off against the named ecoinvent processes. Provisional rows report as MEDIUM data quality.';
comment on column public.packaging_factor_endpoints.library_version is
  'Monotonic per (material_class, variant, region). The calculator always resolves the highest version and pins it to the PCF.';

create index if not exists idx_packaging_factor_endpoints_lookup
  on public.packaging_factor_endpoints (material_class, variant, region, library_version desc);

-- RLS: the LCA calculator runs client-side with the browser client, so
-- authenticated SELECT is load-bearing. Writes are curation-only (service role).
alter table public.packaging_factor_endpoints enable row level security;

drop policy if exists "Authenticated users can view packaging factor endpoints" on public.packaging_factor_endpoints;
create policy "Authenticated users can view packaging factor endpoints"
  on public.packaging_factor_endpoints for select to authenticated using (true);

drop policy if exists "Service role can manage packaging factor endpoints" on public.packaging_factor_endpoints;
create policy "Service role can manage packaging factor endpoints"
  on public.packaging_factor_endpoints to service_role using (true) with check (true);

grant select on table public.packaging_factor_endpoints to authenticated;
grant all on table public.packaging_factor_endpoints to service_role;

-- Convenience view: the active (highest-version) endpoint per class/variant/region.
create or replace view public.packaging_factor_endpoints_active
  with (security_invoker = true) as
select distinct on (material_class, variant, region) *
from public.packaging_factor_endpoints
order by material_class, variant, region, library_version desc;

comment on view public.packaging_factor_endpoints_active is
  'Highest library_version endpoint per (material_class, variant, region). Security invoker; inherits table RLS.';

-- ---------------------------------------------------------------------------
-- Seed: provisional endpoints, EU-27, library_version 1.
--
-- Climate anchors: glass virgin 1.10 and 60%-recycled 0.65 come from the
-- existing ecoinvent_material_proxies rows the platform already used; a linear
-- fit implies the 100%-recycled endpoint 0.35 (to be confirmed against the
-- ecoinvent cullet process). PET 2.30 and HDPE 1.90 likewise anchor to the
-- existing proxies. Recycled endpoints derive from published displacement data
-- (IAI aluminium remelt ~5% of primary energy; worldsteel EAF ~60% saving;
-- Plastics Europe rPET/rHDPE ~55%; CEPI recycled fibre ~35%; FEVE cullet ~25%
-- energy saving per furnace, compounding to ~68% at full cullet).
-- Non-climate values copied from the same proxy rows where present, else NULL.
-- Fossil split: these materials are fossil/mineral dominated; biogenic set to 0
-- provisionally (paper/cork biogenic characterisation is a sign-off item).
-- ---------------------------------------------------------------------------

insert into public.packaging_factor_endpoints
  (id, material_class, variant, region,
   virgin_climate, recycled_climate, virgin_climate_fossil, recycled_climate_fossil,
   virgin_climate_biogenic, recycled_climate_biogenic, virgin_climate_dluc, recycled_climate_dluc,
   virgin_water, recycled_water, virgin_land, recycled_land, virgin_waste, recycled_waste,
   source, notes, library_version, is_provisional)
values
  ('a1000000-0000-4000-8000-000000000001', 'glass', 'flint', 'EU-27',
   1.10, 0.35, 1.10, 0.35, 0, 0, 0, 0,
   0.005, 0.003, 0.02, 0.01, 0.05, 0.02,
   'ecoinvent 3.12 packaging glass (virgin) + linear fit through existing 60% cullet proxy; FEVE 2023',
   'Provisional. Virgin anchored to platform proxy glass_bottle_virgin (1.10); recycled endpoint 0.35 implied by 60%-cullet proxy at 0.65. Confirm against ecoinvent cullet process at sign-off.',
   1, true),
  ('a1000000-0000-4000-8000-000000000002', 'glass', 'green', 'EU-27',
   1.00, 0.33, 1.00, 0.33, 0, 0, 0, 0,
   0.005, 0.003, 0.02, 0.01, 0.05, 0.02,
   'ecoinvent 3.12 packaging glass, green (virgin) + FEVE 2023 cullet data',
   'Provisional. Green glass runs slightly below flint (furnace chemistry, higher tolerated cullet). Confirm per-colour ecoinvent processes at sign-off.',
   1, true),
  ('a1000000-0000-4000-8000-000000000003', 'glass', 'amber', 'EU-27',
   1.05, 0.34, 1.05, 0.34, 0, 0, 0, 0,
   0.005, 0.003, 0.02, 0.01, 0.05, 0.02,
   'ecoinvent 3.12 packaging glass, amber (virgin) + FEVE 2023 cullet data',
   'Provisional. Confirm per-colour ecoinvent processes at sign-off.',
   1, true),
  ('a1000000-0000-4000-8000-000000000004', 'aluminium', 'standard', 'EU-27',
   8.50, 0.60, 8.50, 0.60, 0, 0, 0, 0,
   0.015, 0.004, 0.05, 0.01, 0.20, 0.05,
   'ecoinvent 3.12 aluminium, primary ingot + sheet forming; IAI remelt data (recycled ~5-8% of primary)',
   'Provisional. Virgin between platform proxy aluminium_cap (9.20 GLO) and EU primary sheet. Confirm ecoinvent secondary aluminium process at sign-off.',
   1, true),
  ('a1000000-0000-4000-8000-000000000005', 'steel', 'standard', 'EU-27',
   2.30, 0.90, 2.30, 0.90, 0, 0, 0, 0,
   0.010, 0.005, 0.03, 0.015, 0.10, 0.05,
   'ecoinvent 3.12 tinplate/steel sheet BF-BOF (virgin) vs EAF (recycled); worldsteel',
   'Provisional. EAF route ~60% below BF-BOF. Confirm ecoinvent EAF steel process at sign-off.',
   1, true),
  ('a1000000-0000-4000-8000-000000000006', 'pet', 'standard', 'EU-27',
   2.30, 1.05, 2.30, 1.05, 0, 0, 0, 0,
   0.004, 0.003, 0.01, 0.005, 0.03, 0.02,
   'ecoinvent 3.12 PET granulate, bottle grade (virgin); Plastics Europe rPET cradle-to-gate',
   'Provisional. Virgin anchored to platform proxy pet_bottle_virgin (2.30). Confirm ecoinvent rPET process at sign-off.',
   1, true),
  ('a1000000-0000-4000-8000-000000000007', 'hdpe', 'standard', 'EU-27',
   1.90, 0.85, 1.90, 0.85, 0, 0, 0, 0,
   0.003, 0.002, 0.01, 0.005, 0.02, 0.015,
   'ecoinvent 3.12 HDPE granulate (virgin); Plastics Europe rHDPE cradle-to-gate',
   'Provisional. Virgin anchored to platform proxy hdpe_bottle (1.90). Confirm ecoinvent rHDPE process at sign-off.',
   1, true),
  ('a1000000-0000-4000-8000-000000000008', 'pp', 'standard', 'EU-27',
   1.95, 0.90, 1.95, 0.90, 0, 0, 0, 0,
   0.003, 0.002, 0.01, 0.005, 0.02, 0.015,
   'ecoinvent 3.12 PP granulate (virgin); Plastics Europe recycled polyolefin data',
   'Provisional. Confirm ecoinvent rPP process at sign-off.',
   1, true),
  ('a1000000-0000-4000-8000-000000000009', 'ldpe_film', 'standard', 'EU-27',
   2.10, 0.95, 2.10, 0.95, 0, 0, 0, 0,
   0.003, 0.002, 0.01, 0.005, 0.02, 0.015,
   'ecoinvent 3.12 LDPE film extrusion (virgin); Plastics Europe recycled LDPE data',
   'Provisional. Includes film extrusion. Confirm ecoinvent recycled LDPE film process at sign-off.',
   1, true),
  ('a1000000-0000-4000-8000-00000000000a', 'paperboard', 'standard', 'EU-27',
   0.95, 0.62, 0.95, 0.62, 0, 0, 0, 0,
   0.06, 0.04, 0.60, 0.20, 0.08, 0.05,
   'ecoinvent 3.12 folding boxboard/carton board (virgin fibre); CEPI recycled fibre data (~35% saving)',
   'Provisional. Virgin anchored to platform proxy cardboard_corrugated (0.95). Biogenic split is a sign-off item (currently 0).',
   1, true),
  ('a1000000-0000-4000-8000-00000000000b', 'corrugated', 'standard', 'EU-27',
   0.95, 0.62, 0.95, 0.62, 0, 0, 0, 0,
   0.06, 0.04, 0.60, 0.20, 0.08, 0.05,
   'ecoinvent 3.12 corrugated board (virgin fibre); CEPI recycled fibre data',
   'Provisional. European corrugated already averages high recycled content; virgin endpoint is the kraftliner route. Biogenic split is a sign-off item.',
   1, true),
  ('a1000000-0000-4000-8000-00000000000c', 'kraft', 'standard', 'EU-27',
   1.10, 0.72, 1.10, 0.72, 0, 0, 0, 0,
   0.08, 0.05, 0.90, 0.30, 0.05, 0.03,
   'ecoinvent 3.12 kraft paper, unbleached (virgin); CEPI recycled fibre data',
   'Provisional. Anchored to platform proxy paper_label (1.10). Biogenic split is a sign-off item.',
   1, true),
  ('a1000000-0000-4000-8000-00000000000d', 'cork', 'standard', 'EU-27',
   1.20, 0.60, 1.20, 0.60, 0, 0, 0, 0,
   0.01, 0.008, 0.50, 0.25, 0.02, 0.015,
   'ecoinvent 3.12 cork stopper production; APCOR data for agglomerated/recycled granulate',
   'Provisional. Natural cork carries significant biogenic storage not yet characterised here (sign-off item; currently conservative).',
   1, true)
on conflict (material_class, variant, region, library_version) do nothing;

-- ---------------------------------------------------------------------------
-- Curated gap-filler factors for composite packaging with no ecoinvent
-- mono-material equivalent. These live in staging_emission_factors, tagged
-- category='Packaging', global (organization_id null), and are pinned BY ID via
-- lib/constants/packaging-material-classes.ts. They are never fuzzy-matched.
-- No recycled interpolation applies; the blended factor stands as reviewed.
-- Fixed UUIDs so the vocabulary and tests can reference them stably.
-- ---------------------------------------------------------------------------

insert into public.staging_emission_factors
  (id, organization_id, name, category, co2_factor, co2_fossil_factor, co2_biogenic_factor,
   reference_unit, source, geographic_scope, water_factor, land_factor, waste_factor)
values
  ('b2000000-0000-4000-8000-000000000001', null,
   'Gap-filler: Bag-in-box composite (curated)', 'Packaging',
   1.25, 1.25, 0, 'kg',
   'Curated blend: carton board outer (~80% mass) + LDPE/EVOH bladder and tap (~20% mass), ecoinvent 3.12 components. Provisional pending sign-off.',
   'EU-27', 0.05, 0.45, 0.06),
  ('b2000000-0000-4000-8000-000000000002', null,
   'Gap-filler: Plastic laminate pouch (curated)', 'Packaging',
   2.60, 2.60, 0, 'kg',
   'Curated blend: PET/alu/PE multilayer laminate, ecoinvent 3.12 components. Provisional pending sign-off.',
   'EU-27', 0.004, 0.01, 0.03),
  ('b2000000-0000-4000-8000-000000000003', null,
   'Gap-filler: Liquid carton (curated)', 'Packaging',
   1.40, 1.40, 0, 'kg',
   'Curated blend: liquid packaging board + PE + alu foil, ecoinvent 3.12 components. Provisional pending sign-off.',
   'EU-27', 0.05, 0.40, 0.05)
on conflict (id) do nothing;
