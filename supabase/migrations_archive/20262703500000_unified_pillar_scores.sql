-- ============================================================
-- UNIFIED BRAND SCORING — per-pillar scores + confidence
-- ============================================================
-- The distributor brand scorer is being unified onto a single 0–100
-- scale built around alka**tera**'s own pillars: four environmental
-- pillars (Climate, Nature, Water, Circularity) plus Social and
-- Governance. recalculate.ts now writes a per-pillar breakdown and a
-- data-confidence label on each recalc, and persists which way the
-- brand's product category was resolved (declared / detected / default)
-- so the UI can be honest about how category-adjusted the score is.
--
-- All additive + idempotent. The legacy *_completeness pillar columns
-- on brand_completeness_snapshots are untouched — completeness scoring
-- is unchanged.
-- ============================================================

begin;

-- Per-recalc vitality pillar breakdown + confidence on the snapshot
-- history table (keyed by brand_directory_id since the Phase 3 rekey).
alter table public.brand_completeness_snapshots
  add column if not exists climate_score       numeric(5,2),
  add column if not exists nature_score        numeric(5,2),
  add column if not exists water_score         numeric(5,2),
  add column if not exists circularity_score   numeric(5,2),
  add column if not exists social_score        numeric(5,2),
  add column if not exists governance_score    numeric(5,2),
  add column if not exists environment_score   numeric(5,2),
  add column if not exists score_confidence    text
    check (score_confidence in ('high','medium','low')),
  add column if not exists category_confidence text
    check (category_confidence in ('declared','detected','industry_default'));

-- Headline confidence + category provenance mirrored onto the canonical
-- directory row so the brand list / cards read them without a join.
alter table public.brand_directory
  add column if not exists category_source  text
    check (category_source in ('declared','detected','default')),
  add column if not exists score_confidence text
    check (score_confidence in ('high','medium','low'));

notify pgrst, 'reload schema';

commit;
