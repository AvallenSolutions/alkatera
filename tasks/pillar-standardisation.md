# Standardise distributor + procurement on the six ESG pillars

Decision (Tim, 2026-06-01): both portals use the same six ESG pillars (climate, water,
circularity, nature, social, governance) from a SHARED module, and procurement reads
go through an opt-out-honouring RPC.

## Why
- Scoring engine (lib/vitality/*) already uses ESG pillars (E: climate/water/nature/
  circularity, S, G). Distributor DataStatusTable used the OLDER completeness pillars
  (carbon/water/packaging/agriculture/governance/corporate). Procurement (new) used ESG.
  => two taxonomies. Standardise on ESG.
- Procurement read scraped_brand_data directly (no opt-out enforcement). Distributor uses
  get_brand_data_for_distributor RPC (precedence + sharing opt-outs). Add procurement RPC.

## Constraints / safety
- Do NOT change FIELD_DEFINITIONS.Pillar type or completeness-calculator: those feed
  brand_completeness_snapshots columns (carbon/water/packaging/agriculture/governance/
  corporate) and the scoring. Presentation pillars are DECOUPLED from completeness pillars.
- Keep procurement working pre-migration: RPC call falls back to direct read if absent.

## Steps
- [x] lib/sustainability/pillars.ts — canonical six ESG pillars + FIELD_REGISTRY + helpers
- [x] lib/procurement/pillars.ts -> re-export from shared
- [x] components/distributor/brand-detail/data-status-table.tsx -> groups by six ESG pillars
      via pillarForField() from the shared registry (present/missing table + badges kept)
- [x] pnpm typecheck = 0 errors
- [x] Migration: supabase/migrations/20262702800000_get_brand_data_for_procurement.sql
      (access-gated via procurement_has_access_to_brand; honours brand_sharing_preferences;
      alkatera_live overlay flows on brand_profiles linkage, not brand_distributor_links)
- [x] Wired procurement brand-detail to RPC with graceful fallback to direct read
- [ ] Tim applies the migration SQL in Supabase editor (posted in chat). Page works pre-apply
      via fallback; uses opt-out-aware RPC post-apply.

## Iteration 2: identical data presentation (Tim, 2026-06-01)
- Requirement: distributor + procurement must present the brand sustainability data in the
  IDENTICAL card layout (each portal keeps its own theme). Live data already shared (both read
  scraped_brand_data; verified both RPCs return 33 rows for Maison Clairval).
- Shared component: components/sustainability/pillar-breakdown.tsx (moved out of components/
  procurement/brand-detail/). Theme-token + --brand-primary based, so it renders correctly in
  both the dark distributor theme and the light Foodbuy theme.
- Procurement brand detail + distributor /brands/[id]/data tab BOTH now render
  <PillarBreakdown groups={groupByPillar(...)} />. DataStatusTable no longer used (orphaned).
- Score widgets left per-portal (VitalityCard vs Score/Coverage cards) per "keep styling as is";
  both show the same score+coverage numbers. Offer to unify if Tim wants the score card identical too.
- Confidence gate stays procurement-only by design (operator sees all; client sees trusted subset);
  this is the one intentional data difference, endorsed earlier.

## Dev server note (IMPORTANT)
- Two `next dev` from the same worktree collide on a shared .next. Fixed via distDir override
  (next.config.js: process.env.NEXT_DIST_DIR || '.next'). 8890 uses .next, 8889 uses .next-8889.
- preview_start CACHED the old "dev-alt" registration (without NEXT_DIST_DIR), so the 8889 server
  is currently started via a background shell command:
  `NEXT_DIST_DIR=.next-8889 pnpm dev --port 8889` (from the worktree). To restart 8889 cleanly,
  use that command (or add a fresh launch.json name). 8890 (foodbuy) runs via preview on .next.

## Notes
- Did NOT change FIELD_DEFINITIONS.Pillar or completeness-calculator (scoring untouched).
  Presentation pillars (ESG six) are decoupled from completeness pillars.
- Distributor DataStatusTable still iterates FIELD_DEFINITIONS (the ~40 scraping fields),
  regrouped into the six ESG pillars. The richer platform-only metrics (LCA impact
  categories, social/governance scores) appear in the procurement view now; they will also
  appear in the distributor table once the spawned alkatera-sync task adds them to
  FIELD_DEFINITIONS + emits them. Taxonomy is now identical across both portals.
