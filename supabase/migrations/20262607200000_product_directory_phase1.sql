-- ============================================================
-- CANONICAL PRODUCT DIRECTORY — PHASE 1
-- ============================================================
-- Extends the canonical brand_directory model down to the product
-- level. Today brand_skus is a per-distributor listing of a product —
-- two distributors selling Avallen Calvados 70cl each have their own
-- brand_skus row, and any LCA findings attached to a SKU live under
-- the per-listing key. The strategic prize is the same as for brands:
-- one canonical product record globally, shared across every
-- distributor that lists it, fed by alka**tera** customer data when a
-- product exists in product_carbon_footprints.
--
-- This migration:
--   1. Adds the product_directory table (GTIN-keyed where available,
--      fuzzy match within a brand otherwise).
--   2. Adds gtin to brand_skus (a real gap — the upload flow does not
--      capture GTIN today). Future uploads will populate it via the
--      column mapper.
--   3. Adds product_directory_id FK to brand_skus and scraped_brand_data,
--      and product_directory_ids[] to brand_document_submissions.
--   4. Back-fills: groups every existing brand_skus row by
--      (brand_profile.brand_directory_id, normalized(product_name)),
--      creates one product_directory row per group, and links FKs on
--      each listing. Stamps `phase1_backfill` on discovered_via so we
--      can recognise the source later.
--   5. Installs RLS (any authenticated user can read, writes via
--      service role / app).
-- ============================================================

begin;

-- pg_trgm comes from the brand directory phase 1; defensive in case
-- this migration ever ships standalone.
create extension if not exists pg_trgm;

-- ============================================================
-- product_directory table
-- ============================================================
create table public.product_directory (
  id                       uuid primary key default gen_random_uuid(),
  -- GTIN-13/12/8 if known. Nullable because most brands today don't
  -- ship GTIN through the upload CSV. Indexed as a partial unique
  -- below so two products can both have null without conflict.
  gtin                     text,
  brand_directory_id       uuid not null references public.brand_directory(id) on delete cascade,
  -- Display name, what UIs render.
  name                     text not null,
  -- lowercased + alphanumeric-only for fuzzy match within a brand.
  normalized_name          text not null,
  category                 text,        -- spirit | wine | beer | non_alc | other
  abv                      numeric(4,2),
  container_size_ml        integer,
  container_format         text,        -- bottle | can | keg | bag_in_box | other
  recipe_overview          text,
  -- Mirrors of latest LCA. Phase 2 (real-time sync) populates these
  -- from alka**tera** product_carbon_footprints.
  embodied_carbon_kgco2e   numeric(10,3),
  embodied_water_l         numeric(10,2),
  completeness_score       numeric(5,2),
  -- Set when this product maps to an alka**tera** product_carbon_footprints
  -- row. Enforced single-mapping by the partial unique index below.
  alkatera_product_id      uuid,
  discovered_via           text not null default 'sku_upload' check (discovered_via in
                              ('sku_upload','alkatera_signup','manual','phase1_backfill')),
  -- The distributor whose upload first surfaced this product, if any.
  discovered_by_distributor_org_id uuid references public.distributor_organizations(id) on delete set null,
  discovered_at            timestamptz not null default now(),
  last_synced_at           timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- Trigram for fuzzy product name matching scoped to a brand.
create index product_directory_normalized_name_trgm
  on public.product_directory using gin (normalized_name gin_trgm_ops);

-- Composite for the cheap-first matcher path: exact (brand, name).
create index product_directory_brand_name_idx
  on public.product_directory (brand_directory_id, normalized_name);

-- Partial unique on GTIN: enforce one canonical product per real GTIN.
create unique index product_directory_gtin_uq
  on public.product_directory (gtin)
  where gtin is not null;

-- Partial unique on alkatera_product_id: one canonical record per
-- alkatera product_carbon_footprints row.
create unique index product_directory_alkatera_product_uq
  on public.product_directory (alkatera_product_id)
  where alkatera_product_id is not null;

-- ============================================================
-- brand_skus: add gtin + product_directory_id
-- ============================================================
alter table public.brand_skus
  add column gtin text,
  add column product_directory_id uuid references public.product_directory(id) on delete restrict;

create index brand_skus_directory_idx
  on public.brand_skus (product_directory_id);

create index brand_skus_gtin_idx
  on public.brand_skus (gtin)
  where gtin is not null;

-- ============================================================
-- scraped_brand_data: add product_directory_id (parallel to brand_sku_id)
-- ============================================================
-- A finding attributed to a specific product attaches to the canonical
-- product so it serves every distributor that lists it. We keep the
-- existing brand_sku_id column for now (per-listing audit trail);
-- consumer reads will prefer product_directory_id.
alter table public.scraped_brand_data
  add column product_directory_id uuid references public.product_directory(id) on delete cascade;

create index scraped_brand_data_product_idx
  on public.scraped_brand_data (product_directory_id, field_key)
  where superseded_by is null and product_directory_id is not null;

-- ============================================================
-- brand_document_submissions: parallel canonical product list
-- ============================================================
alter table public.brand_document_submissions
  add column product_directory_ids uuid[] not null default '{}';

create index brand_document_submissions_product_ids_gin
  on public.brand_document_submissions using gin (product_directory_ids);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.product_directory enable row level security;

-- Like brand_directory: shared infrastructure. Any authenticated user
-- can read. Writes via service role / matcher RPC.
create policy "anyone authenticated can read product directory"
  on public.product_directory for select
  using (auth.uid() is not null);

-- ============================================================
-- Normalisation helper for product names
-- ============================================================
-- Same shape as brand_directory_normalize so the matcher reasons about
-- product names the same way it reasons about brand names. Stripping
-- punctuation handles "Avallen Calvados 70cl" vs "Avallen Calvados, 70cl".
create or replace function public.product_directory_normalize(value text)
returns text
language sql immutable
as $$
  select lower(regexp_replace(coalesce(value, ''), '[^a-zA-Z0-9 ]', '', 'g'))
$$;

-- ============================================================
-- Updated-at trigger
-- ============================================================
create or replace function public.touch_product_directory_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_product_directory_touch_updated_at
  before update on public.product_directory
  for each row execute function public.touch_product_directory_updated_at();

-- ============================================================
-- Backfill: one product_directory row per (brand_directory_id, normalized_name)
-- ============================================================
-- Approach: for every existing brand_skus row, look up the parent
-- brand_profile's brand_directory_id, normalise the product_name, and
-- group across all distributors. For each unique group, insert a
-- product_directory row picking the longest product_name as canonical
-- (rough heuristic — distributors with cleaner data tend to include
-- size in the name, which we want to keep). Then update every
-- brand_skus row in the group to point at the new directory id.
--
-- Wrapped in a DO block so we can introspect counts in dev without
-- needing a separate dry-run path. If anything goes wrong the whole
-- migration rolls back via the surrounding transaction.

do $$
declare
  v_inserted int;
  v_linked   int;
  v_total_skus int;
  v_unlinked   int;
begin
  -- Sanity: every brand_profile must already have a brand_directory_id
  -- (from brand directory phase 1). If not, we can't link products to
  -- the right canonical brand.
  select count(*) into v_unlinked
    from public.brand_skus s
    join public.brand_profiles bp on bp.id = s.brand_profile_id
    where bp.brand_directory_id is null;
  if v_unlinked > 0 then
    raise exception 'product_directory_backfill_aborted: % brand_skus have a brand_profile with null brand_directory_id; rerun the brand_directory phase 1 backfill first',
      v_unlinked;
  end if;

  -- Insert one canonical product row per group. We pick the longest
  -- product_name within the group as the display name (best-effort —
  -- it captures size/format cues like "70cl" that shorter names drop).
  with grouped as (
    select
      bp.brand_directory_id,
      public.product_directory_normalize(s.product_name) as normalized_name,
      (array_agg(s.product_name order by length(s.product_name) desc, s.created_at asc))[1] as canonical_name,
      (array_agg(s.category)         filter (where s.category is not null))[1]         as category,
      (array_agg(s.country_of_origin) filter (where s.country_of_origin is not null))[1] as country_of_origin,
      bp.distributor_org_id as discovered_by_distributor_org_id
    from public.brand_skus s
    join public.brand_profiles bp on bp.id = s.brand_profile_id
    where s.product_name is not null
      and s.product_name <> ''
    group by bp.brand_directory_id, public.product_directory_normalize(s.product_name), bp.distributor_org_id
  )
  insert into public.product_directory (
    brand_directory_id, name, normalized_name, category,
    discovered_via, discovered_by_distributor_org_id
  )
  select
    g.brand_directory_id,
    g.canonical_name,
    g.normalized_name,
    g.category,
    'phase1_backfill',
    g.discovered_by_distributor_org_id
  from grouped g
  where g.normalized_name <> '';

  get diagnostics v_inserted = ROW_COUNT;

  -- Link every brand_skus row to its directory entry.
  update public.brand_skus s
  set product_directory_id = pd.id
  from public.brand_profiles bp,
       public.product_directory pd
  where bp.id = s.brand_profile_id
    and pd.brand_directory_id = bp.brand_directory_id
    and pd.normalized_name = public.product_directory_normalize(s.product_name)
    and s.product_directory_id is null;

  get diagnostics v_linked = ROW_COUNT;

  select count(*) into v_total_skus from public.brand_skus where product_name is not null and product_name <> '';

  raise notice 'product_directory phase 1 backfill: % directory rows inserted, % brand_skus linked (out of % with non-empty product_name)',
    v_inserted, v_linked, v_total_skus;
end $$;

commit;
