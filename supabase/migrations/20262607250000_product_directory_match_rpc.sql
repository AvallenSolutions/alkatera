-- ============================================================
-- CANONICAL PRODUCT DIRECTORY — MATCH RPC
-- ============================================================
-- Companion to match_brand_directory. Resolves the best
-- product_directory entry within a given canonical brand for a
-- candidate product name and optional GTIN.
--
-- Match precedence (in order, first hit wins):
--   1. Exact GTIN match (similarity 1.0) — regardless of name, the
--      GTIN is the authoritative SKU identifier when present.
--   2. Exact normalized_name match within the brand (similarity 1.0).
--   3. pg_trgm similarity >= threshold within the brand (default 0.85).
--
-- Returns top 5 candidates ordered by similarity DESC so the caller
-- can auto-link or queue for manual confirmation.
-- ============================================================

begin;

create or replace function public.match_product_directory(
  p_brand_directory_id uuid,
  p_query_name text,
  p_gtin text default null,
  p_similarity_threshold float default 0.85
)
returns table(
  id uuid,
  name text,
  normalized_name text,
  gtin text,
  alkatera_product_id uuid,
  similarity float,
  match_via text
)
language sql stable
security definer
set search_path = public
as $$
  with q as (
    select
      public.product_directory_normalize(p_query_name) as norm,
      nullif(trim(coalesce(p_gtin, '')), '') as gtin_clean
  )
  select
    pd.id,
    pd.name,
    pd.normalized_name,
    pd.gtin,
    pd.alkatera_product_id,
    case
      when q.gtin_clean is not null and pd.gtin = q.gtin_clean then 1.0::float
      when pd.normalized_name = q.norm then 1.0::float
      else similarity(pd.normalized_name, q.norm)
    end as similarity,
    case
      when q.gtin_clean is not null and pd.gtin = q.gtin_clean then 'gtin'
      when pd.normalized_name = q.norm then 'exact_name'
      else 'fuzzy'
    end as match_via
  from public.product_directory pd
  cross join q
  where pd.brand_directory_id = p_brand_directory_id
    and (
      (q.gtin_clean is not null and pd.gtin = q.gtin_clean)
      or (q.norm <> '' and pd.normalized_name = q.norm)
      or (q.norm <> '' and similarity(pd.normalized_name, q.norm) >= p_similarity_threshold)
    )
  order by similarity desc, pd.created_at asc
  limit 5;
$$;

grant execute on function public.match_product_directory(uuid, text, text, float) to authenticated;
grant execute on function public.match_product_directory(uuid, text, text, float) to service_role;

commit;
