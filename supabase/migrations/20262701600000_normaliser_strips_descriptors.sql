-- ============================================================
-- BRAND DIRECTORY: normaliser strips producer + product descriptors
-- ============================================================
-- Two Drifters Rum vs Two Drifters Distillery sit at ~0.4 pg_trgm
-- similarity — well below the matcher's 0.85 threshold — even though
-- they're obviously the same brand. The matcher can't catch this with
-- string similarity alone; the fix is to strip the producer / product
-- descriptors at normalisation time so both names collapse to
-- "two drifters".
--
-- Descriptors stripped (trailing, repeatable):
--   producer  — distillery, distilleries, distillers, distilling,
--               brewery, breweries, brewers, brewing, winery,
--               wineries, winemakers, vineyard, vineyards, cellars
--   product   — rum, gin, vodka, whisky, whiskey, bourbon, scotch,
--               brandy, cognac, tequila, mezcal
--   generic   — spirits, spirit, drinks, drink, beverages, beverage
--
-- Legal-entity suffixes (ltd, sas, gmbh, …) carried over from the
-- previous normaliser migration. The full pattern is anchored to the
-- end of the string so a one-word brand named "Distillery" (unlikely
-- but possible) is left alone, and the inner `(\s+...)*` lets multiple
-- suffixes peel off in one pass (e.g. "Foo Distillers Ltd").
--
-- Risk: aggressive stripping could collide unrelated brands sharing a
-- root word (e.g. "Foo Spirits" + "Foo Distillery" → both "foo"). For
-- the tightly-scoped UK drinks data we have today the trade-off lands
-- on dedup; if it starts mis-merging we'll add a per-tenant override
-- or move to LLM-based semantic dedup at intake.
-- ============================================================

begin;

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
        '\s+(sas|sa|sarl|srl|spa|ltd|limited|llc|gmbh|bv|inc|incorporated|plc|pty|co|company|kg|ag|distillery|distilleries|distillers|distilling|brewery|breweries|brewers|brewing|winery|wineries|winemakers|vineyard|vineyards|cellars|rum|gin|vodka|whisky|whiskey|bourbon|scotch|brandy|cognac|tequila|mezcal|spirits|spirit|drinks|drink|beverages|beverage)(\s+(sas|sa|sarl|srl|spa|ltd|limited|llc|gmbh|bv|inc|incorporated|plc|pty|co|company|kg|ag|distillery|distilleries|distillers|distilling|brewery|breweries|brewers|brewing|winery|wineries|winemakers|vineyard|vineyards|cellars|rum|gin|vodka|whisky|whiskey|bourbon|scotch|brandy|cognac|tequila|mezcal|spirits|spirit|drinks|drink|beverages|beverage))*\s*$',
        '',
        'g'
      ) as v
    from stripped
  )
  select trim(regexp_replace(v, '\s+', ' ', 'g')) from desuffixed;
$$;

-- Backfill normalized_name across brand_directory using the new
-- normaliser. No unique constraint on normalized_name, so two rows
-- collapsing to the same key is fine — the matcher returns both and
-- the alka**tera**-linked tie-break ranks the canonical row first.
update public.brand_directory
set normalized_name = public.brand_directory_normalize(name)
where normalized_name <> public.brand_directory_normalize(name);

commit;
