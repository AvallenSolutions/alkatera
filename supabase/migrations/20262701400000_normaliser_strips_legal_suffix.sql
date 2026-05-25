-- ============================================================
-- BRAND DIRECTORY: normaliser strips legal-entity suffixes
--   + match_brand_directory prefers alkatera-linked rows on ties
-- ============================================================
-- Today the SQL normaliser does lowercase + strip non-alphanumeric
-- only, while the TS-side normalizeBrandName (used by application
-- code that doesn't go through SQL) ALSO strips legal-entity suffixes
-- like Ltd / Limited / LLC / Inc / SAS / GmbH / SARL.
--
-- This mismatch means brand_directory rows seeded via different paths
-- get different normalized_name values for the same brand:
--   * Org-sync trigger: stores "warners distillery ltd"
--   * Sourcing/admin upload: stores "warners distillery"
-- and the matcher's exact-normalised path doesn't fire, dropping the
-- pair down to fuzzy where it sometimes misses the 0.85 threshold.
-- Result: a duplicate pending row for a brand alka**tera** already owns.
--
-- This migration:
--   1. Aligns the SQL normaliser with the TS one (same legal-suffix
--      pattern), so any future write produces the canonical key.
--   2. Updates match_brand_directory to prefer alkatera-linked rows
--      on similarity ties, so when both a pending dupe and the
--      canonical alka**tera** row sit at the same similarity, the
--      matcher always lands on the alka**tera** row.
--   3. Backfills normalized_name across brand_directory using the new
--      function. There's no unique constraint on this column, so
--      collapsing two rows onto the same normalised_name is fine —
--      the matcher returns both and ranks alka**tera** first.
-- ============================================================

begin;

-- 1. Aligned normaliser. Mirrors the TS regex in lib/distributor/
-- brand-normalizer.ts so any code path producing a normalised name
-- (SQL trigger, RPC, application) lands on the same key.
create or replace function public.brand_directory_normalize(value text)
returns text
language sql immutable
as $$
  with stripped as (
    select
      lower(
        regexp_replace(
          coalesce(value, ''),
          '[^a-zA-Z0-9 ]',
          '',
          'g'
        )
      ) as v
  ),
  desuffixed as (
    select
      regexp_replace(
        v,
        '\s+(sas|sa|sarl|srl|spa|ltd|limited|llc|gmbh|bv|inc|incorporated|plc|pty|co|company|kg|ag)(\s+(sas|sa|sarl|srl|spa|ltd|limited|llc|gmbh|bv|inc|incorporated|plc|pty|co|company|kg|ag))*\s*$',
        '',
        'g'
      ) as v
    from stripped
  )
  select trim(regexp_replace(v, '\s+', ' ', 'g')) from desuffixed;
$$;

-- 2. match_brand_directory: prefer alka**tera**-linked rows on ties.
-- Existing precedence (exact_name → alias → fuzzy) is preserved; we
-- only change the ORDER BY so two rows at the same similarity rank
-- the alkatera-customer one first.
create or replace function public.match_brand_directory(
  query_name text,
  similarity_threshold float default 0.85
)
returns table(
  id uuid,
  name text,
  normalized_name text,
  alkatera_org_id uuid,
  similarity float,
  match_via text
)
language sql stable
security definer
set search_path = public
as $$
  with q as (
    select public.brand_directory_normalize(query_name) as norm
  )
  select
    bd.id,
    bd.name,
    bd.normalized_name,
    bd.alkatera_org_id,
    case
      when bd.normalized_name = q.norm then 1.0::float
      when q.norm = any(bd.aliases) then 1.0::float
      else similarity(bd.normalized_name, q.norm)
    end as similarity,
    case
      when bd.normalized_name = q.norm then 'exact_name'
      when q.norm = any(bd.aliases) then 'alias'
      else 'fuzzy'
    end as match_via
  from public.brand_directory bd
  cross join q
  where q.norm <> ''
    and (
      bd.normalized_name = q.norm
      or q.norm = any(bd.aliases)
      or similarity(bd.normalized_name, q.norm) >= similarity_threshold
    )
  order by
    similarity desc,
    case when bd.alkatera_org_id is not null then 0 else 1 end,
    bd.created_at asc
  limit 5;
$$;

-- 3. Backfill normalized_name across brand_directory using the new
-- normaliser. Idempotent — re-running is a no-op once the function is
-- aligned.
update public.brand_directory
set normalized_name = public.brand_directory_normalize(name)
where normalized_name <> public.brand_directory_normalize(name);

commit;
