-- ============================================================
-- CANONICAL BRAND DIRECTORY — PHASE 2 PART 1
-- ============================================================
-- A SECURITY DEFINER RPC the application calls during SKU upload (and
-- any other "do we already have this brand?" flow) to find the
-- best-matching brand_directory entry for a given brand name.
--
-- Match precedence:
--   1. Exact normalized_name match (similarity 1.0)
--   2. Exact match against any entry in the directory entry's aliases
--      (similarity 1.0)
--   3. pg_trgm similarity >= threshold (default 0.85)
--
-- Returns the top 5 candidates ordered by similarity DESC so the
-- caller can pick or surface to a manual-confirm queue.
-- ============================================================

begin;

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
  order by similarity desc, bd.created_at asc
  limit 5;
$$;

grant execute on function public.match_brand_directory(text, float) to authenticated;
grant execute on function public.match_brand_directory(text, float) to service_role;

commit;
