-- ============================================================
-- MATCH ALKATERA ORG RPC
-- ============================================================
-- The brand_directory matcher (match_brand_directory) only consults
-- the directory itself. When a brand the LLM proposes is actually an
-- existing alka**tera** customer whose name drifted between the org
-- record and the canonical brand name (e.g. legal entity "Warner
-- Edwards Distillery Ltd" vs brand name "Warner's Distillery"), the
-- org→directory trigger may not have caught the match (it only does
-- exact normalised), and the application matcher missed it because
-- it never looks at organizations. The result: a duplicate pending
-- directory entry for a brand alkatera already owns.
--
-- This RPC adds the missing pass: fuzzy match a candidate name against
-- public.organizations. Application code uses it as a fallback after
-- the brand_directory matcher returns no hit. On a match, the matcher
-- either reuses the existing directory row that already points at the
-- org (alkatera_org_id), or creates one and lets the verification gate
-- auto-mark it verified.
-- ============================================================

begin;

create or replace function public.match_alkatera_org(
  query_name text,
  similarity_threshold float default 0.85
)
returns table(
  id uuid,
  name text,
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
    o.id,
    o.name,
    case
      when public.brand_directory_normalize(o.name) = q.norm then 1.0::float
      else similarity(public.brand_directory_normalize(o.name), q.norm)
    end as similarity,
    case
      when public.brand_directory_normalize(o.name) = q.norm then 'exact_name'
      else 'fuzzy'
    end as match_via
  from public.organizations o
  cross join q
  where q.norm <> ''
    and o.name is not null
    and (
      public.brand_directory_normalize(o.name) = q.norm
      or similarity(public.brand_directory_normalize(o.name), q.norm)
         >= similarity_threshold
    )
  order by similarity desc, o.created_at asc
  limit 5;
$$;

grant execute on function public.match_alkatera_org(text, float) to authenticated;
grant execute on function public.match_alkatera_org(text, float) to service_role;

commit;
