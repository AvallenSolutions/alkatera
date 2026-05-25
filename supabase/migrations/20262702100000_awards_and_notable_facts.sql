-- ============================================================
-- AWARDS + NOTABLE FACTS
-- ============================================================
-- Drinks brands accumulate two kinds of qualitative signal that the
-- existing per-field certification booleans don't capture:
--
--   1. Awards from industry bodies (IWSC, ISC, SFWSC, Wine Spectator,
--      Decanter, World Whisky Awards, World Gin Awards, Drinks Business
--      Awards, etc.). Usually product-level — Two Drifters Lightly
--      Spiced Rum won an IWSC Gold in 2024 — but occasionally
--      brand-level (Brand of the Year).
--   2. Notable facts / firsts / partnerships ("Carbon negative since
--      2019", "First B Corp distillery in Devon", "Partnered with
--      Cool Earth"). These are usually free-form narrative bits that
--      help a distributor pitch the brand.
--
-- Deep-enrich pulls both via Claude + web_search and writes into the
-- new structures here.
-- ============================================================

begin;

-- 1. brand_awards: one row per (brand, awarding_body, award_name, year).
create table if not exists public.brand_awards (
  id                    uuid primary key default gen_random_uuid(),
  brand_directory_id    uuid not null references public.brand_directory(id) on delete cascade,
  /** Product-level when set; brand-level when null. */
  product_directory_id  uuid references public.product_directory(id) on delete cascade,
  awarding_body         text not null,
  award_name            text not null,
  medal_tier            text check (medal_tier in (
                          'gold', 'silver', 'bronze', 'platinum',
                          'best_in_class', 'master', 'double_gold',
                          'finalist', 'winner', 'other'
                        )),
  year                  integer,
  source_url            text,
  notes                 text,
  /** How we learned about this award. Mirrors brand_directory.discovered_via vocabulary. */
  discovered_via        text not null default 'manual',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists brand_awards_brand_idx
  on public.brand_awards (brand_directory_id, year desc);
create index if not exists brand_awards_product_idx
  on public.brand_awards (product_directory_id)
  where product_directory_id is not null;

-- De-dupe identical (brand, body, name, year) so deep-enrich re-runs
-- don't fan out duplicates. product_directory_id treated as null-equals-null
-- via COALESCE to a sentinel UUID so this constraint actually catches
-- brand-level dupes too.
create unique index if not exists brand_awards_unique_per_award
  on public.brand_awards (
    brand_directory_id,
    coalesce(product_directory_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(awarding_body),
    lower(award_name),
    coalesce(year, 0)
  );

alter table public.brand_awards enable row level security;

drop policy if exists "distributor members read brand_awards" on public.brand_awards;
create policy "distributor members read brand_awards"
  on public.brand_awards for select
  using (
    exists (
      select 1
      from public.brand_profiles bp
      join public.distributor_members dm
        on dm.distributor_org_id = bp.distributor_org_id
      where bp.brand_directory_id = brand_awards.brand_directory_id
        and dm.user_id = auth.uid()
    )
  );

drop policy if exists "alkatera admins manage brand_awards" on public.brand_awards;
create policy "alkatera admins manage brand_awards"
  on public.brand_awards for all
  using (public.is_alkatera_admin()) with check (public.is_alkatera_admin());

create or replace function public.touch_brand_awards_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_brand_awards_touch on public.brand_awards;
create trigger trg_brand_awards_touch
  before update on public.brand_awards
  for each row execute function public.touch_brand_awards_updated_at();

-- 2. notable_facts as text[] on brand_directory + product_directory.
--    Free-form short strings ("Carbon negative since 2019", "First
--    B Corp distillery in Devon", "Partnered with Cool Earth").
alter table public.brand_directory
  add column if not exists notable_facts text[] not null default '{}';

alter table public.product_directory
  add column if not exists notable_facts text[] not null default '{}';

notify pgrst, 'reload schema';

commit;
