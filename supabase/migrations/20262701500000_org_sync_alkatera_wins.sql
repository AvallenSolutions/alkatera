-- ============================================================
-- ORG SYNC: alka**tera** customer data overwrites scraped + fuzzy
-- match catches near-misses on signup
-- ============================================================
-- Two bugs in sync_organization_to_brand_directory tied to Tim's
-- "alka**tera** data should always override scraped" requirement:
--
-- 1. INSERT (new alka**tera** signup) only links to an existing
--    directory row when normalized_name matches EXACTLY. If the
--    directory already has a row for this brand under a slightly
--    different spelling, the trigger creates a parallel row, leaving
--    a duplicate. Fix: also try alias matching and fuzzy similarity
--    (>=0.85), mirroring match_brand_directory.
--
-- 2. INSERT linking uses coalesce(brand_directory.*, new.*) for
--    website / country / founding_year / description — existing
--    (scraped) values win when both sides are set. The customer's
--    own data should always take precedence. Fix: coalesce(new.*,
--    brand_directory.*) so alka**tera** wins, falling back to the
--    existing value only when the org row has no value.
--
-- UPDATE path: rewrite to overwrite with new values directly (no
-- coalesce). After a brand has claimed its directory row, the customer
-- is canonical — if they clear a field on alkatera, the directory's
-- copy should clear too rather than keeping a stale scraped value.
-- ============================================================

begin;

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
    -- Pass 1: exact normalised match.
    select id into v_directory_id
    from public.brand_directory
    where alkatera_org_id is null
      and normalized_name = v_norm
    limit 1;

    -- Pass 2: alias match.
    if v_directory_id is null then
      select id into v_directory_id
      from public.brand_directory
      where alkatera_org_id is null
        and v_norm = any(aliases)
      limit 1;
    end if;

    -- Pass 3: fuzzy similarity >=0.85, prefer the closest then oldest.
    if v_directory_id is null then
      select id into v_directory_id
      from public.brand_directory
      where alkatera_org_id is null
        and similarity(normalized_name, v_norm) >= 0.85
      order by similarity(normalized_name, v_norm) desc, created_at asc
      limit 1;
    end if;

    if v_directory_id is not null then
      -- Link to existing row. alka**tera** values OVERWRITE scraped /
      -- sourced values when set; existing value only survives when the
      -- org row has nothing (e.g. founding_year not entered yet).
      update public.brand_directory
        set alkatera_org_id  = new.id,
            name             = new.name,
            normalized_name  = v_norm,
            website          = coalesce(new.website, brand_directory.website),
            country_of_origin = coalesce(new.country, brand_directory.country_of_origin),
            founding_year    = coalesce(new.founding_year, brand_directory.founding_year),
            description      = coalesce(new.description, brand_directory.description),
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
    -- After link, the alka**tera** row is canonical. Assign new values
    -- directly so clearing a field on the customer's side clears the
    -- directory's copy too.
    update public.brand_directory
      set name             = new.name,
          normalized_name  = v_norm,
          website          = new.website,
          country_of_origin = new.country,
          founding_year    = new.founding_year,
          description      = new.description,
          verification_status = 'verified',
          updated_at       = now()
      where alkatera_org_id = new.id;
  end if;

  return new;
end;
$$;

commit;
