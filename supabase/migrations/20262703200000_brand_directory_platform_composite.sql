-- ============================================================
-- brand_directory.platform_esg_composite
-- ============================================================
--
-- Background: until now, alkatera-sync (lib/distributor/integration/
-- alkatera-sync.ts) would unconditionally overwrite
-- brand_directory.sustainability_score with the latest
-- esg_score_snapshots.composite. That meant a brand whose alka**tera**
-- platform data was incomplete (composite = 8, say) would see its
-- distributor-visible score drop, even when open-web evidence + the
-- field-level data merge had already produced a much higher
-- vitality (e.g. 75) via calculateVitality(). The headline punished
-- brands for signing up to alka**tera** before fully populating
-- their profile — exactly the opposite of the intended incentive.
--
-- Fix (plan A1): stop overwriting sustainability_score. The
-- recalculate pipeline at lib/distributor/scoring/recalculate.ts
-- already folds the composite in as a heavy Governance signal
-- inside calculateVitality() when alkatera_org_id is set, so the
-- composite still influences the score — but as one signal among
-- many, not a hard override that can drag the headline below the
-- evidence-driven calculation.
--
-- This column persists the raw composite as supplementary context
-- so the breakdown panel can show "alka**tera** platform composite:
-- 8 · open-web vitality: 75 · headline: 75 (merged)" with the
-- composite as audit trail rather than as the headline.
-- ============================================================

alter table public.brand_directory
  add column if not exists platform_esg_composite numeric(5,2);

comment on column public.brand_directory.platform_esg_composite is
  'Most-recent alka**tera** platform ESG composite from esg_score_snapshots. Persisted for supplementary display only; the headline sustainability_score is computed from the field-level merge so partial platform data cannot drag the headline below evidence-driven vitality.';

notify pgrst, 'reload schema';
