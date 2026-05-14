-- ============================================================
-- VITALITY SCORE — history columns
-- ============================================================
-- We already keep a per-recalculation history of completeness scores in
-- brand_completeness_snapshots. Vitality (sustainability-performance)
-- scoring lives alongside completeness in the same recalculation
-- pipeline, so extending the same table is the natural home rather
-- than spinning up a parallel "brand_vitality_snapshots" table.
--
-- brand_profiles.sustainability_score and score_tier were provisioned
-- in Phase 1 and have been waiting for this feature. They mirror the
-- latest snapshot row so the brand list / dashboard can query without
-- a join.
-- ============================================================

begin;

alter table public.brand_completeness_snapshots
  add column if not exists vitality_score numeric(5,2),
  add column if not exists vitality_tier  text check (vitality_tier in
    ('leader','progressing','developing','insufficient'));

create index if not exists brand_completeness_snapshots_vitality_idx
  on public.brand_completeness_snapshots (brand_profile_id, calculated_at desc)
  where vitality_score is not null;

commit;
