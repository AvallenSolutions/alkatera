-- ============================================================
-- CANONICAL BRAND DIRECTORY — PHASE 1
-- ============================================================
-- Introduces a global brand_directory table: one canonical record per
-- drinks brand, shared across every distributor that lists the brand
-- and every alka**tera** organisation that represents the brand. Today
-- each distributor's brand_profiles row is a self-contained copy of a
-- brand — two distributors selling Avallen Spirits each have their own
-- brand_profiles row, duplicated scraped data, duplicated outreach,
-- duplicated verifications. This migration begins the move to "one
-- brand, many listings" by:
--
--   1. Creating the brand_directory table with the brand-attribute
--      columns currently scattered across brand_profiles + organizations.
--   2. Adding brand_profiles.brand_directory_id so each existing
--      brand_profiles row becomes a "listing" pointing at a canonical
--      directory entry.
--   3. Installing a trigger on organizations that auto-creates/updates a
--      directory entry whenever a brand joins alka**tera** or changes
--      their org details.
--   4. Backfilling: every existing organization gets a directory entry
--      first (so alkatera customers seed the directory), then every
--      brand_profiles row is linked to either the org-derived entry
--      (when alkatera_org_id is set, or when names match exactly) or to
--      a freshly created directory entry. Multiple brand_profiles with
--      the same normalized_name collapse onto a shared directory entry.
--
-- Consumer code (data merger, scoring pipeline, brand-upload review
-- portal, distributor UI) still reads from brand_profiles in Phase 1 —
-- no consumer changes here. Phase 2 wires the matcher into the SKU
-- upload flow; Phase 3 re-keys sustainability data tables to point at
-- brand_directory_id; later phases drop the per-distributor duplication
-- entirely.
-- ============================================================

begin;

-- pg_trgm is already enabled in Phase 6 (alkatera_integration); this is
-- defensive in case the order of historical migrations changes.
create extension if not exists pg_trgm;

-- ============================================================
-- Tables
-- ============================================================

create table public.brand_directory (
  id                   uuid primary key default gen_random_uuid(),
  -- Display name, what UIs render. Case-preserving.
  name                 text not null,
  -- lowercased + alphanumeric-only for fuzzy match.
  normalized_name      text not null,
  -- Alternate spellings the matcher should also recognise.
  aliases              text[] not null default '{}',
  website              text,
  category             text,
  country_of_origin    text,
  founding_year        integer,
  parent_company       text,
  description          text,
  -- Set when this directory entry maps to an alka**tera** customer. A
  -- single org maps to at most one directory entry — enforced by the
  -- partial unique index below.
  alkatera_org_id      uuid references public.organizations(id) on delete set null,
  -- Mirrors of the latest snapshot scores. Today these live on
  -- brand_profiles; Phase 3 will move authoritative copies here.
  sustainability_score numeric(5,2),
  score_tier           text check (score_tier in ('leader','progressing','developing','insufficient')),
  completeness_score   numeric(5,2),
  -- How this directory entry came into existence.
  discovered_via       text not null default 'sku_upload' check (discovered_via in
                          ('sku_upload','alkatera_signup','manual','phase1_backfill')),
  -- The distributor whose upload first surfaced this brand, if any.
  discovered_by_distributor_org_id uuid references public.distributor_organizations(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Trigram index for fuzzy-name matching at SKU upload time and on
-- alkatera signup. We also index aliases so old spellings keep working.
create index brand_directory_normalized_name_trgm
  on public.brand_directory using gin (normalized_name gin_trgm_ops);
create index brand_directory_aliases_gin
  on public.brand_directory using gin (aliases);

-- One alka**tera** org maps to at most one directory entry.
create unique index brand_directory_alkatera_org_uq
  on public.brand_directory (alkatera_org_id)
  where alkatera_org_id is not null;

-- Exact-name lookup index for the backfill + the cheap-first path of
-- the matcher.
create index brand_directory_normalized_name_idx
  on public.brand_directory (normalized_name);

-- ============================================================
-- Listings: brand_profiles now points at a directory entry
-- ============================================================

alter table public.brand_profiles
  add column brand_directory_id uuid references public.brand_directory(id) on delete restrict;

create index brand_profiles_directory_idx
  on public.brand_profiles (brand_directory_id);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.brand_directory enable row level security;

-- The directory is shared infrastructure. Any authenticated user (any
-- distributor team, any alkatera brand member) can read entries — this
-- is what makes the directory grow into a single source of truth.
-- Writes happen via service role + the trigger below.
create policy "anyone authenticated can read brand directory"
  on public.brand_directory for select
  using (auth.uid() is not null);

-- ============================================================
-- Normalisation helper
-- ============================================================
-- The same string used as `brand_profiles.normalized_name`: lowercased,
-- punctuation stripped. Kept here so the trigger + matcher share the
-- exact rule.
create or replace function public.brand_directory_normalize(value text)
returns text
language sql immutable
as $$
  select lower(regexp_replace(coalesce(value, ''), '[^a-zA-Z0-9 ]', '', 'g'))
$$;

-- ============================================================
-- alka**tera** organizations <-> brand_directory sync trigger
-- ============================================================
-- Runs after every insert/update on organizations. On insert we either
-- link to an existing directory entry (when a name match is found and
-- not already claimed by another org) or create a new entry. On update
-- we propagate name/website/country/founding_year/description through
-- to the linked directory entry. Brand-owned values always win over
-- scraped values, so this is a one-way push organizations -> directory
-- for the columns the brand owns on alka**tera**.
create or replace function public.sync_organization_to_brand_directory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_directory_id  uuid;
  v_norm          text;
begin
  v_norm := public.brand_directory_normalize(new.name);
  if v_norm = '' then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    -- Prefer an existing entry that's not yet linked to any other org
    -- AND has a high-confidence name match. We use exact normalized
    -- match here to be conservative; fuzzy match is exposed via the
    -- application-side matcher on SKU upload.
    select id into v_directory_id
    from public.brand_directory
    where alkatera_org_id is null
      and normalized_name = v_norm
    limit 1;

    if v_directory_id is not null then
      update public.brand_directory
        set alkatera_org_id  = new.id,
            website          = coalesce(brand_directory.website, new.website),
            country_of_origin = coalesce(brand_directory.country_of_origin, new.country),
            founding_year    = coalesce(brand_directory.founding_year, new.founding_year),
            description      = coalesce(brand_directory.description, new.description),
            updated_at       = now()
        where id = v_directory_id;
    else
      insert into public.brand_directory (
        name, normalized_name, website, country_of_origin, founding_year,
        description, alkatera_org_id, discovered_via
      ) values (
        new.name, v_norm, new.website, new.country, new.founding_year,
        new.description, new.id, 'alkatera_signup'
      );
    end if;

  elsif TG_OP = 'UPDATE' then
    -- Only push the columns the brand owns. We don't overwrite the
    -- directory's category, score, etc. — those are platform-computed.
    update public.brand_directory
      set name             = new.name,
          normalized_name  = v_norm,
          website          = new.website,
          country_of_origin = new.country,
          founding_year    = new.founding_year,
          description      = coalesce(new.description, brand_directory.description),
          updated_at       = now()
      where alkatera_org_id = new.id;
  end if;

  return new;
end;
$$;

create trigger trg_sync_org_to_directory
  after insert or update of name, website, country, founding_year, description
  on public.organizations
  for each row execute function public.sync_organization_to_brand_directory();

-- ============================================================
-- Backfill, in two passes
-- ============================================================

-- Pass 1: seed from organizations.
-- Every existing alka**tera** customer becomes a directory entry. Some
-- orgs may share a normalized name (rare, but possible) — DISTINCT ON
-- keeps the most recently created so the directory always points at
-- the live record.
insert into public.brand_directory (
  name, normalized_name, website, country_of_origin, founding_year,
  description, alkatera_org_id, discovered_via
)
select distinct on (public.brand_directory_normalize(name))
  name,
  public.brand_directory_normalize(name),
  website,
  country,
  founding_year,
  description,
  id,
  'phase1_backfill'
from public.organizations
where coalesce(name, '') <> ''
order by public.brand_directory_normalize(name), created_at desc;

-- Pass 2: seed from brand_profiles.
-- For each unique normalized_name across all existing brand_profiles
-- create a directory entry only if one doesn't already exist. Skip the
-- insert if EITHER the normalized_name OR the brand_profile's
-- alkatera_org_id is already represented in the directory (Pass 1 may
-- have inserted an org-derived row with a slightly different name but
-- the same alkatera_org_id). The canonical row per group is the
-- highest-completeness one so the directory inherits the richest
-- existing data.
with grouped as (
  select
    normalized_name,
    (array_agg(id order by coalesce(completeness_score, 0) desc, created_at asc))[1] as canonical_id
  from public.brand_profiles
  where normalized_name is not null and normalized_name <> ''
  group by normalized_name
)
insert into public.brand_directory (
  name, normalized_name, website, country_of_origin, category, alkatera_org_id,
  sustainability_score, score_tier, completeness_score,
  discovered_by_distributor_org_id, discovered_via
)
select
  bp.name,
  bp.normalized_name,
  bp.website,
  bp.country_of_origin,
  bp.category,
  bp.alkatera_org_id,
  bp.sustainability_score,
  bp.score_tier,
  bp.completeness_score,
  bp.distributor_org_id,
  'phase1_backfill'
from grouped g
join public.brand_profiles bp on bp.id = g.canonical_id
where
  not exists (
    select 1 from public.brand_directory bd
    where bd.normalized_name = g.normalized_name
  )
  and (
    bp.alkatera_org_id is null
    or not exists (
      select 1 from public.brand_directory bd
      where bd.alkatera_org_id = bp.alkatera_org_id
    )
  );

-- Pass 3a: link brand_profiles by alkatera_org_id first. This catches
-- the case where Pass 1 created an org-derived row whose normalized
-- name differs from the distributor's normalized name for the same
-- brand (e.g. "Avallen Spirits Ltd" vs "Avallen Spirits").
update public.brand_profiles bp
set brand_directory_id = bd.id
from public.brand_directory bd
where bp.alkatera_org_id is not null
  and bd.alkatera_org_id = bp.alkatera_org_id
  and bp.brand_directory_id is null;

-- Pass 3b: link any still-unlinked brand_profiles by exact normalized_name.
update public.brand_profiles bp
set brand_directory_id = bd.id
from public.brand_directory bd
where bp.normalized_name = bd.normalized_name
  and bp.brand_directory_id is null;

-- Pass 3c: any brand_profile that linked to a directory entry via
-- alkatera_org_id but has a different normalized_name should add its
-- name to the directory's aliases so the matcher recognises both
-- spellings going forward.
update public.brand_directory bd
set aliases = array_append(bd.aliases, bp.normalized_name),
    updated_at = now()
from public.brand_profiles bp
where bp.brand_directory_id = bd.id
  and bp.normalized_name <> bd.normalized_name
  and not (bp.normalized_name = any(bd.aliases));

-- Edge case: brand_profile knows the alkatera org; if its linked
-- directory entry doesn't yet, push the link up.
update public.brand_directory bd
set alkatera_org_id = bp.alkatera_org_id,
    updated_at = now()
from public.brand_profiles bp
where bd.id = bp.brand_directory_id
  and bd.alkatera_org_id is null
  and bp.alkatera_org_id is not null;

-- ============================================================
-- Finally: brand_directory_id is now mandatory for every listing.
-- ============================================================
alter table public.brand_profiles
  alter column brand_directory_id set not null;

commit;
