-- ============================================================
-- MERGE PRODUCT DIRECTORY DUPES (admin sweep)
-- ============================================================
-- product_directory accrues duplicates the same way brand_directory
-- does — the LLM extractor returns "Two Drifters White Rum 70cl" on
-- one page and "Pure White Rum 70cl" on another, and the fuzzy
-- matcher can't bridge a ~0.5 trigram similarity. The smart matcher
-- prevents new dupes on ingest (LLM verification step); this function
-- cleans up the dupes that already exist.
--
-- FK fan-out for product_directory:
--   - brand_skus.product_directory_id           ON DELETE RESTRICT
--     (must be reassigned before the dupe row can be deleted)
--   - scraped_brand_data.product_directory_id   ON DELETE CASCADE
--   - brand_document_submissions.product_directory_ids uuid[]
--     (array element rewrite — array_remove + array_append)
--
-- Guards:
--   - canonical_id != dupe_id
--   - both rows must exist
--   - both rows must belong to the same brand_directory_id (you can't
--     merge a Two Drifters product into a Warner's product by mistake)
-- ============================================================

begin;

create or replace function public.merge_product_directory_dupe(
  p_canonical_id uuid,
  p_dupe_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_canonical_brand uuid;
  v_canonical_name  text;
  v_canonical_gtin  text;
  v_dupe_brand      uuid;
  v_dupe_name       text;
  v_dupe_gtin       text;
begin
  if p_canonical_id = p_dupe_id then
    raise exception 'merge_product_dupe: canonical and dupe must differ';
  end if;

  select brand_directory_id, name, gtin
    into v_canonical_brand, v_canonical_name, v_canonical_gtin
  from public.product_directory where id = p_canonical_id;
  if not found then
    raise exception 'merge_product_dupe: canonical % not found', p_canonical_id;
  end if;

  select brand_directory_id, name, gtin
    into v_dupe_brand, v_dupe_name, v_dupe_gtin
  from public.product_directory where id = p_dupe_id;
  if not found then
    raise exception 'merge_product_dupe: dupe % not found', p_dupe_id;
  end if;

  if v_canonical_brand <> v_dupe_brand then
    raise exception 'merge_product_dupe: rows belong to different brands (% vs %)',
      v_canonical_brand, v_dupe_brand;
  end if;

  -- 1. brand_skus: move the dupe's listings onto the canonical product.
  --    There's no unique constraint on (distributor, product_directory_id)
  --    so we can just reassign without collision handling.
  update public.brand_skus
    set product_directory_id = p_canonical_id, updated_at = now()
    where product_directory_id = p_dupe_id;

  -- 2. scraped_brand_data: reassign per-product findings. The
  --    sustainability data the EPD processor extracted under the dupe
  --    is just as valid against the canonical row; the data-merger
  --    will pick the active row by precedence after the move.
  update public.scraped_brand_data
    set product_directory_id = p_canonical_id
    where product_directory_id = p_dupe_id;

  -- 3. brand_document_submissions.product_directory_ids uuid[] —
  --    rewrite array elements that referenced the dupe.
  update public.brand_document_submissions
    set product_directory_ids = (
      select coalesce(
        array_agg(distinct case when v = p_dupe_id then p_canonical_id else v end),
        '{}'::uuid[]
      )
      from unnest(product_directory_ids) as v
    )
    where p_dupe_id = any(product_directory_ids);

  -- 4. Promote dupe gtin onto the canonical if the canonical didn't
  --    have one. Partial-unique on gtin lets us write it provided the
  --    dupe's gtin is unique globally; if the canonical already has
  --    a gtin, just delete the dupe's row (we keep canonical's
  --    identity).
  if v_canonical_gtin is null and v_dupe_gtin is not null then
    update public.product_directory
      set gtin = v_dupe_gtin, updated_at = now()
      where id = p_canonical_id;
    update public.product_directory
      set gtin = null
      where id = p_dupe_id;
  end if;

  -- 5. Delete the dupe row. Cascades clean up the remaining FKs.
  delete from public.product_directory where id = p_dupe_id;
end;
$$;

grant execute on function public.merge_product_directory_dupe(uuid, uuid) to service_role;

notify pgrst, 'reload schema';

commit;
