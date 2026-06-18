-- ============================================================
-- BRAND DIRECTORY: scoring_mode column
-- ============================================================
-- Two-tier scoring lands in this commit. The mode column records
-- which scorer produced the persisted sustainability_score and
-- by-pillar breakdown so the UI knows how to render it:
--
--   'scraped'  — non-alka**tera** brand. 3 pillars
--                (environment, social, governance), credit-based
--                weighted mean. Missing fields contribute 0 (no
--                penalty), so a brand with strong cert evidence
--                scores meaningfully even when carbon numbers aren't
--                public.
--   'alkatera' — alka**tera** customer. 6 pillars (carbon, water,
--                packaging, agriculture, governance, corporate),
--                penalty-based — missing required fields hit the
--                score hard because the brand controls the data.
--
-- recalculate.ts picks the mode automatically from
-- brand_directory.alkatera_org_id IS NOT NULL and writes the value
-- here so the brand-detail panel can render the right number of
-- pillar bars.
-- ============================================================

begin;

alter table public.brand_directory
  add column if not exists scoring_mode text not null default 'scraped'
    check (scoring_mode in ('scraped', 'alkatera'));

-- Existing alkatera-linked rows: flip to 'alkatera' mode so the next
-- recalc runs them through the 6-pillar penalty scorer.
update public.brand_directory
  set scoring_mode = 'alkatera'
  where alkatera_org_id is not null
    and scoring_mode <> 'alkatera';

notify pgrst, 'reload schema';

commit;
