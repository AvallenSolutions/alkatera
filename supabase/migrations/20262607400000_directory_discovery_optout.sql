-- ============================================================
-- DIRECTORY DISCOVERY OPT-OUT
-- ============================================================
-- Phase 4 of the proactive-data programme introduces a distributor-
-- facing search surface where any distributor can browse the canonical
-- brand_directory to find brands they don't yet list. The default
-- policy (locked with Tim on 2026-05-22) is "discoverable by default;
-- brands can opt out per-distributor or globally".
--
-- This migration adds `brand_directory.discovery_opt_out` so the brand
-- side can toggle "hide me from non-listing distributors' search". The
-- discovery search query filters by this column. Existing
-- brand_profiles listings keep working — distributors who already
-- list the brand still see it on their brand list, with all the data
-- they had before. Only the discovery surface respects the opt-out.
-- ============================================================

begin;

alter table public.brand_directory
  add column if not exists discovery_opt_out boolean not null default false;

-- Partial index for the common discovery query: WHERE discovery_opt_out = false.
-- Most brands will leave the default, so the partial index keeps the
-- index small and the lookup fast.
create index if not exists brand_directory_discoverable_idx
  on public.brand_directory (sustainability_score desc, completeness_score desc)
  where discovery_opt_out = false;

commit;
