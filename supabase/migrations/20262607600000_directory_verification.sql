-- ============================================================
-- DIRECTORY VERIFICATION GATE
-- ============================================================
-- Prevents poor-quality / scraped misinformation from going live in
-- the distributor Discover surface. Every brand_directory and
-- product_directory entry now carries a verification_status:
--
--   pending   — newly ingested (Cowork/JSON ingest, scraping,
--               distributor uploads, admin CSV). NOT shown in Discover.
--   verified  — reviewed by an admin, or auto-trusted (alka**tera**
--               brands own their data). Shown in Discover.
--   rejected  — an admin marked it bad. Never shown.
--
-- Policy (locked 2026-05-22):
--   * Only alka**tera**-linked brands auto-verify. Everything else is
--     pending until an admin reviews it.
--   * Verifying a brand cascades to its products.
--   * Existing entries are smart-backfilled: alka**tera**-linked OR with
--     meaningful completeness become verified; thin scraped-only
--     entries become pending.
--
-- Discoverability is now gated by BOTH discovery_opt_out = false AND
-- verification_status = 'verified'. A distributor's own listing
-- (brand_profiles) is unaffected — this gate is only about the wider
-- Discover search where other distributors find new brands.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Columns
-- ------------------------------------------------------------
alter table public.brand_directory
  add column if not exists verification_status text not null default 'pending'
    check (verification_status in ('pending','verified','rejected')),
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id) on delete set null,
  add column if not exists rejection_reason text;

alter table public.product_directory
  add column if not exists verification_status text not null default 'pending'
    check (verification_status in ('pending','verified','rejected')),
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id) on delete set null;

-- Indexes for the Discover filter + the admin review queue.
create index if not exists brand_directory_verification_idx
  on public.brand_directory (verification_status);
create index if not exists brand_directory_pending_idx
  on public.brand_directory (created_at desc)
  where verification_status = 'pending';
create index if not exists product_directory_verification_idx
  on public.product_directory (verification_status);

-- ------------------------------------------------------------
-- 2. Smart backfill — existing brands
-- ------------------------------------------------------------
-- Verify entries that are alka**tera**-linked OR carry meaningful
-- completeness (>= 10). Everything else stays pending for review.
update public.brand_directory
  set verification_status = 'verified',
      verified_at = now()
  where verification_status = 'pending'
    and (
      alkatera_org_id is not null
      or coalesce(completeness_score, 0) >= 10
    );

-- ------------------------------------------------------------
-- 3. Smart backfill — products inherit their brand's status
-- ------------------------------------------------------------
-- A product under a verified brand is verified (brand is the unit of
-- trust). Products under pending brands stay pending.
update public.product_directory pd
  set verification_status = 'verified',
      verified_at = now()
  from public.brand_directory bd
  where pd.brand_directory_id = bd.id
    and bd.verification_status = 'verified'
    and pd.verification_status = 'pending';

-- ------------------------------------------------------------
-- 4. alka**tera** org → directory trigger now auto-verifies
-- ------------------------------------------------------------
-- Brands that own their data on alka**tera** are trusted. When the
-- org→directory sync creates or links a directory entry, stamp it
-- verified (flipping a previously-pending scraped entry to verified
-- the moment the real brand claims it).
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
            -- A real alka**tera** brand just claimed this entry: trust it.
            verification_status = 'verified',
            verified_at      = now(),
            updated_at       = now()
        where id = v_directory_id;
    else
      insert into public.brand_directory (
        name, normalized_name, website, country_of_origin, founding_year,
        description, alkatera_org_id, discovered_via,
        verification_status, verified_at
      ) values (
        new.name, v_norm, new.website, new.country, new.founding_year,
        new.description, new.id, 'alkatera_signup',
        'verified', now()
      );
    end if;

  elsif TG_OP = 'UPDATE' then
    update public.brand_directory
      set name             = new.name,
          normalized_name  = v_norm,
          website          = new.website,
          country_of_origin = new.country,
          founding_year    = new.founding_year,
          description      = coalesce(new.description, brand_directory.description),
          -- Keep linked brands verified.
          verification_status = 'verified',
          updated_at       = now()
      where alkatera_org_id = new.id;
  end if;

  return new;
end;
$$;

commit;
