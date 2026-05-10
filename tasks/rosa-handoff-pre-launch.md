# Rosa Pre-Launch Handoff

**Last touched:** 2026-05-10. **Branch:** `claude/nice-buck-b9690f` (worktree at `.claude/worktrees/nice-buck-b9690f/`). **All work uncommitted.**

This supersedes [tasks/rosa-handoff.md](rosa-handoff.md) (which describes the original Rosa drawer/hub overhaul). Read this first; that one second for historical context.

## Where we are right now

We're **mid-Climate-scoring redesign**, paused before any code changes. The pillar-by-pillar review is the current active workstream. Tim wants every pillar's score to be defensible and realistic, not a hidden hack.

**Decisions Tim has just made about Climate**:
- Per **unit** (whole product, packaging included), not per litre of liquid
- Use **live production data** for unit counts. Never hardcode (the existing `/performance/page.tsx:517` `estimatedLitresPerProduct = 50000` is a hack we're killing)
- Blend = **60% intensity vs benchmark + 40% YoY total emissions trend** (Option A from my proposal)

**Next steps for Climate (do these next)**:
1. Add a pure function `computeClimateScore({ intensity_ratio, yoy_delta_pct })` to `lib/vitality/environmental.ts` that returns 0-100
2. Server-side data fetch in `app/api/vitality/composite/route.ts`:
   - Sum `production_logs.units_produced` for current year per product
   - Sum total emissions for current year (already done) AND prior year (new)
   - Per-unit benchmark = weighted avg of `(kgCO2ePerLitre × product.unit_size_l)` across products, weighted by units produced
3. Update `computeEnvironmentalPillar` in `lib/vitality/composite.ts` to accept the blended climate inputs
4. Update `/performance/page.tsx` (`useCompanyMetrics` consumer) to use the same path, drop the 50,000 hardcode
5. Update `lib/vitality/__tests__/environmental.test.ts` and `composite.test.ts` for the blended climate
6. Verify on localhost: top card score = detail card score for alkatera Demo

**Key schema reads** (already done):
- `production_logs` schema at [supabase/migrations/20251108000000_initial_schema.sql:7772](supabase/migrations/20251108000000_initial_schema.sql) — has `product_id`, `units_produced`, `volume`, `unit`, `date`
- `products` schema at line 7425 — check for `unit_size`/`unit_size_l` field
- `product_carbon_footprints` has `aggregated_impacts` JSONB and `total_ghg_emissions` numeric

After Climate, do the same exercise for **Water → Circularity → Nature → Social → Governance** in that order.

## Critical bug context (recently fixed but worth knowing)

1. **Cross-org cache leak (FIXED)**: switching orgs showed stale data. Was because `Cache-Control: private, max-age=...` keys by URL only. All Rosa/vitality endpoints now `no-store` + `dynamic = 'force-dynamic'` on briefing/mood. Server-side DB caches still give perf.

2. **Vitality scoring zero (PARTIALLY FIXED, still wrong)**: my server-side env aggregator was selecting non-existent `production_volume` column on PCFs. Added the production-volume join chain mirroring `useCompanyMetrics` (production_logs → pcf_production_sites → cm_allocations → 1 unit fallback). BUT: scores still don't match the detail cards because:
   - **Climate**: server divides by per-litre benchmark; client multiplies benchmark by `50,000 L/product` first. Server says 25, client says 80. **This is the active workstream.**
   - **Nature**: server doesn't compute `biodiversityRisk` at all; client does via `deriveBiodiversityRisk(natureMetrics)` against `NATURE_PERFORMANCE_THRESHOLDS`. Server returns null, client returns 80.
   - Water + Circularity match.

3. **Operational facts**:
   - Dev server runs on port 8888 from this worktree. Tim sometimes runs the marketing-site worktree on the same port — if `lsof -ti:8888` returns a process from a different worktree, kill it and restart from nice-buck
   - `lsof -ti:8888 | xargs kill -9 && cd .../nice-buck-b9690f && pnpm dev --port 8888`
   - Tim has confirmed all SQL migrations have been run

## What's been built this session (post-original-handoff)

A complete pre-launch polish pass on Rosa:

**Vitality score (NEW)**
- ESG composite score with E/S/G pillars + 12-week trend
- Replaces HeroGreeting on `/rosa/` with `VitalityHero` (click → modal breakdown with Rosa-voiced read)
- New `EsgVitalityScoreHero` on `/performance/` (replaces the legacy `VitalityScoreHero` 4-pillar env-only hero)
- Per-org weighting via sliders at `/governance/vitality-weights/` (default E 50% / S 25% / G 25%)
- Snapshots stored in `esg_score_snapshots` (one row per org per day, idempotent upsert)
- Endpoint `/api/vitality/composite`: defaults to fast deterministic read (DB only ~500ms); pass `?read=1` to opt into Claude-curated read
- Modal upgrades read in background after open; "deepening" spinner while Claude responds
- `/performance/` auto-upgrades the read after first paint
- Score explainer popovers on composite + each E/S/G card with calculation breakdown + "Ask Rosa to explain"
- Composite popover sizing fixed (uses `--radix-popover-content-available-height`)

**Priority tiles** — Rosa-curated 3-tile row driven by signal pack + Claude tool_use; cached + fallback to deterministic. Was earlier work this session; stable.

**Progress Tracker** — replaces old Activity Pulse. Per-user choice (carbon, water, LCA coverage, supplier ESG, target progress, Rosa-curated). 12-week chart + Rosa-voiced read. Propose-confirm tool `propose_set_progress_tracker` lets Rosa set it via the drawer. Earlier this session.

**Telemetry + cost guard**
- Append-only `rosa_telemetry` table with allowlisted events
- Endpoint `/api/rosa/telemetry`, client helper `lib/rosa/track.ts`
- Wired into: tile click/snooze, vitality modal open, weights save/reset, tracker change, hub layout toggle/reset, persona set, hub setup completion
- Daily caps per user per Claude-call event (vitality.read 30, tracker.read 40, tile.curated 50). Over budget → fallback to deterministic + log `*.budget_blocked`

**Smoother UX**
- AI read upgrade: headline stays stable; only detail + next-move fade in when Claude version arrives
- VitalityHero is `role="button"` (was `<button>` containing nested HubLayoutSettings button — invalid HTML, fixed)

**Header tidy** — `Ask Rosa anything…` search and `Upload` button removed from header (per Tim). Imports cleaned.

**Mobile stripped** (per Tim — alkatera isn't a mobile product)
- Deleted `hooks/useMediaQuery.ts`
- Removed `isMobile` branch from RosaDrawer (no more bottom sheet)
- Reverted RosaTrigger position to plain `bottom-6 right-6`

**Tests** — 59 passing. `lib/vitality/__tests__/composite.test.ts`, `lib/vitality/__tests__/environmental.test.ts`, `lib/rosa/__tests__/priority-tiles-validate.test.ts`. Run `pnpm vitest run lib/vitality/__tests__ lib/rosa/__tests__/priority-tiles-validate.test.ts`.

## Locked preferences (don't drift)

- British English; no em dashes; "alka**tera**" lowercase with bold "tera"
- Rosa never describes herself as "AI", "AI assistant", "chatbot", "language model", "digital assistant", "sustainability guide". Only "Rosa" or "your sustainability partner"
- All writes through propose → confirm
- No outbound emails by Rosa
- Push to main when committing
- **Plain language only**, never jargon. Always explain WHY in plain English so users can self-select
- **Live data, never hardcoded** (the `50,000 L/product` heuristic is on the chopping block; this is a category-wide preference)
- Mobile is not a target — strip mobile-specific code; don't add it

## Architecture map

**Rosa hub composition** ([components/rosa/ForYouToday.tsx](components/rosa/ForYouToday.tsx))
- `<VitalityHero />` (top, always-on)
- `<PriorityTiles onOpenQueue={...} />` (3 Rosa-curated tiles)
- Activity row: `<ProgressTracker />` (col-span-8) + `<ProductSpotlight />` (col-span-4)
- Prompts row: `<QuickPrompts />` + `<QuickActions />`
- Recent row: `<RecentlyFromRosa />` + `<RecentConversations />`

**Vitality endpoint flow** ([app/api/vitality/composite/route.ts](app/api/vitality/composite/route.ts))
1. Build environmental inputs (PCFs + production-volume join + benchmark)
2. Build social inputs (community_impact_scores + people_culture_scores + supplier ESG submission rate)
3. Build governance inputs (governance_scores + cert progress)
4. Compose with org weights from `organizations.vitality_weights`
5. Snapshot today (idempotent upsert into `esg_score_snapshots`)
6. Read 12-week trend from snapshots
7. Optionally call Claude for narrative read (`?read=1` only); guarded by daily budget
8. Return everything

**Composition math** ([lib/vitality/composite.ts](lib/vitality/composite.ts))
- `computeEnvironmentalPillar(inputs)` — weighted avg of climate/water/circularity/nature with redistribution
- `computeSocialPillar(inputs)` — equal-weight avg of community/people-culture/supplier-ESG
- `computeGovernancePillar(inputs)` — 85% governance + 15% certifications
- `composeVitality({e,s,g,weights})` — weighted ESG composite with redistribution
- `scoreBand(score)` → EXCELLENT/HEALTHY/DEVELOPING/EMERGING/NEEDS ATTENTION/AWAITING DATA

**Environmental aggregator** ([lib/vitality/environmental.ts](lib/vitality/environmental.ts))
- `aggregateImpacts(lcas)` → totalImpacts (climate, water_consumption, water_scarcity_aware, etc), weighted by production_volume
- `computeWaterRiskLevel(totalImpacts)` → 'low'/'medium'/'high' based on AWARE/consumption ratio
- `computeCircularityPercentage(lcas)` → 0-100 from EOL waste with packaging fallback
- `buildEnvironmentalSignals` — composes all the above
- `toEnvironmentalInputs` — converts signals → `EnvironmentalInputs` for the pillar calc
- **DOESN'T YET DO**: blended climate (intensity + YoY); biodiversity risk derivation

## Operational gotchas

- The `useCompanyMetrics` hook is ~1500 lines, lots of side effects, queries `production_logs`, `product_carbon_footprints`, `product_carbon_footprint_production_sites`, `contract_manufacturer_allocations`, water risks, waste, nature metrics. Don't try to refactor it whole — extract just the slices we need
- The legacy `VitalityScoreHero` component still exists at `components/vitality/VitalityScoreHero.tsx` and is the source of truth for `calculateVitalityScores`. Both surfaces import it. If the math changes, both move together
- All migrations have been run by Tim. New tables exist: `esg_score_snapshots`, `rosa_priority_tile_cache`, `rosa_telemetry`, `rosa_progress_tracker_cache`. New column: `organizations.vitality_weights`
- Auto mode is currently active. Ship work; don't ask permission for routine decisions
- The `tasks/rosa-handoff.md` from the previous session describes the foundational Rosa drawer + hub work. Useful for context on the propose-confirm flow, page-context wiring, etc. Don't re-do that work

## Files most likely to be touched next

- [lib/vitality/environmental.ts](lib/vitality/environmental.ts) — add `computeClimateScore` blended function + `deriveBiodiversityRisk` server-side
- [lib/vitality/composite.ts](lib/vitality/composite.ts) — update `computeEnvironmentalPillar` signature for blended climate
- [app/api/vitality/composite/route.ts](app/api/vitality/composite/route.ts) — fetch production_logs + prior year emissions, drop simple per-LCA intensity
- [app/(authenticated)/performance/page.tsx](app/(authenticated)/performance/page.tsx) — drop the `estimatedLitresPerProduct = 50000` hack at line 517; route the same blended climate inputs through `vitalityScores` memo
- [components/vitality/VitalityScoreHero.tsx](components/vitality/VitalityScoreHero.tsx) — `calculateVitalityScores` may need a new signature (or the climate input changes shape)
- [lib/vitality/__tests__/environmental.test.ts](lib/vitality/__tests__/environmental.test.ts) and [lib/vitality/__tests__/composite.test.ts](lib/vitality/__tests__/composite.test.ts) — extend tests for blended climate

## Verification checklist (when Climate redesign lands)

1. On `/rosa/` for alkatera Demo, the top ESG card's Climate sub-pillar matches the deep-dive Climate card on `/performance/`
2. Switching from one org to another reflects within seconds (no cache leak)
3. Tests pass: `pnpm vitest run lib/vitality/__tests__ lib/rosa/__tests__/priority-tiles-validate.test.ts`
4. Check `production_logs` has data for the year — if not, the score is "AWAITING DATA" not 0
5. Check the explainer popover on the Environmental card on `/performance/` shows the new blended math correctly

## After Climate

Same exercise for, in order:
- **Water**: currently uses `water_risk_level` from AWARE/consumption ratio. Tim will likely want this similarly blended (intensity vs benchmark + trend or absolute risk)
- **Circularity**: currently uses `circularityRate` from EOL waste with packaging fallback. Reasonable to keep but verify methodology
- **Nature**: currently `deriveBiodiversityRisk` against thresholds. Server-side doesn't even compute it — needs lifting
- **Social**: composes community + people-culture + supplier ESG with equal weight. Each sub-pillar may need scrutiny
- **Governance**: 85% governance practices + 15% cert progress. Verify both
