# Internal benchmarks — build log

Implementation of `tasks/internal-benchmarks-plan.md`, 24 July 2026.

## Phase 0 — the privacy hole (independent of everything else)

- [x] Migration `20260724120000_vitality_benchmark_k_anonymity.sql`: `vitality_benchmarks`
      rebuilt with `HAVING count(DISTINCT organization_id) >= 5` on both the platform and
      category branches, so no route can bypass it. The Pulse pattern.
- [x] `max(score)` → `percentile_cont(0.75)`. A max in a cohort of five IS one named
      business's score; the plan's own risk section says never expose a max.
- [x] `get_organization_benchmark_comparison` reads the guarded view, returns `cohort_count`,
      and omits a benchmark block entirely when the cohort is too small.
- [x] `useVitalityBenchmarks`: `top_performer` → `top_quartile`, carries the cohort count.
- [x] `ScoreExplainer`: "Top Performer" → "Top quartile"; "AlkaTera Average" → "Other
      businesses on alkatera"; cohort size stated beneath.

## Phase 1 — capture the right metric (no user-visible change)

- [x] Migration `20260724130000_product_intensity_snapshots.sql`: the table, the
      k-guarded `product_intensity_benchmark_view`, RLS, and the admin-only
      `get_product_intensity_buckets()`.
- [x] `lib/benchmarks/pack-format.ts` — the cross-org pack token (`glass-bottle`).
- [x] `lib/benchmarks/product-intensity.ts` — `co2e_per_litre` per completed PCF, with a
      stated reason for every refusal.
- [x] Written on PCF completion (`lca-recalc` Inngest step) and on the daily Pulse sweep.
- [x] Backfill: `benchmarks/intensity.backfill` Inngest function, dispatched from a button
      on `/admin/benchmarks`.

## Phase 2 — make it visible before it is authoritative

- [x] `/admin/benchmarks` — per bucket: products, businesses, p25/p50/p75, clears k≥5 or not.
      Sub-k buckets are visible here and nowhere else.
- [x] **Step 5**: `lib/benchmarks/literature-check.ts` compares every qualifying bucket
      against its literature row, states the boundary relation, and says which side of the
      comparison is the weak one when the published citation is itself unsupported.

## Phase 3 — wire it into the score

- [x] `lib/benchmarks/ladder.ts` — the four rungs, pure and tested.
- [x] `pickBenchmark` deleted from `buildClimateInputs` and replaced by the ladder.
- [x] The rung + cohort size surfaced in `ScoreExplainer` via `climate_breakdown.benchmark`.
- [ ] (Step 8, deferred by the plan) retiring literature rows.

---

## Review

### The three decisions worth knowing about

**A sibling table, not `metric_snapshots`.** Two reasons, either sufficient. It is unique on
`(organization_id, metric_key, snapshot_date)`, one row per org per metric per day, and
intensity is per PRODUCT. And `peer_benchmark_view` groups by `metric_key` alone, so a
`co2e_per_litre` key dropped into that table would immediately produce a cross-category,
cross-boundary, cross-format percentile that any route could read and no caller could tell
apart from a valid one. That is a worse number than the literature row it replaces.

**A p75 rather than suppressing `*_top` below the floor.** The plan asked for a minimum-cohort
guard and for `*_top` to stop below it. Doing exactly that leaves a hole the plan itself names:
a cohort maximum is one identifiable business's exact score at k=5 as much as at k=3. The top
quartile keeps the aspirational anchor the UI was built around and publishes nobody's row.

**The literature rung is strict, and this moves live scores.** `sourceSupportsValue: 'no'`
covers Spirits, Beer & Cider, Non-Alcoholic, the three whiskies, Sparkling Wine, Sparkling
Water and the default fallback. Those products now reach rung 4 and contribute to neither side
of the benchmark average, so an affected organisation's climate score falls back to the
year-on-year term, or reads "awaiting data" if it has no prior year. That is the plan's stated
intent, not a side effect. It is one named constant,
`LITERATURE_RUNG_REQUIRES_SUPPORTED_SOURCE` in `lib/benchmarks/ladder.ts`, so the
citation-repair work can flip it back in one visible line.

### Deliberate exclusions from the cohort

Each one is counted and reported, never silent: not completed, no product, hospitality kinds,
multipacks (their container is a case, not a bottle, so they would add transit packaging to one
side of a `glass-bottle` comparison only), no footprint, no declared volume, an unreadable
system boundary, and a per-litre figure outside 0.01–100 kg.

### Two things the peer benchmark does not fix

The cohort median means half of any cohort scores below benchmark by construction. And a
cohort of alkatera customers is a sample of businesses that bought carbon software, not of the
drinks sector. Expect it to beat the sector. Nothing built on it is labelled "industry
average"; every surface says "other products on alkatera".

### Applied to alkatera-staging (`vwhdyqvlgjqmlzmsvaes`), 24 July 2026

Both migrations applied via the Supabase MCP and verified against the real schema. NOT applied
to Alkatera2 (production) — this is redesign schema and must not be back-ported.

| Check | Expected | Got |
|---|---|---|
| `vitality_benchmarks` p75 columns | 5 | 5 |
| `vitality_benchmarks` `*_top` columns | 0 | 0 |
| Benchmark rows returned today | 0 (staging holds 1 scored org) | 0 |
| `product_intensity_snapshots` RLS | enabled | enabled |
| Policies on it | 1, SELECT only | 1, SELECT only |
| Min/max columns on the benchmark view | 0 | 0 |
| `product_intensity_snapshots_unique` | present | present |
| `get_product_intensity_buckets()` | present | present |

The first row is the hole closing on real data: staging has exactly one organisation with a
vitality score, and the old view was happily publishing that single organisation's exact
pillar scores as "top performer" to anybody who called the RPC. It now returns nothing.

Two notes for whoever runs the next migration here:

- **Ledger drift.** The MCP records its own timestamps, so staging's ledger holds
  `20260724142924` and `20260724143028` rather than the file names `20260724120000` and
  `20260724130000`. A later `supabase db push` will therefore try to apply both again. Both
  are idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP ... IF EXISTS`), so
  a re-run is harmless, but the ledger is worth reconciling.
- **Staging is missing two earlier migrations.** `20260724100000_organizations_works_with` and
  `20260724110000_tier_features_single_source` are absent from the ledger AND from the schema:
  `organizations.works_with` and the `tier_features` table both do not exist there. Not part of
  this work, but the arrival ritual reads `works_with`.

### Verified locally before applying

- Both migrations applied cleanly against a live Postgres in a rolled-back transaction.
- Seeded four businesses: `vitality_benchmarks` returned **zero** rows. Added a fifth: rows
  appeared with `overall_p75 = 70` while the actual cohort maximum was 95, which is the whole
  point of the change.
- Seeded four businesses of products: `product_intensity_benchmark_view` returned **zero**
  rows. Added a fifth: buckets appeared reporting `sample_size 6, organization_count 5`, so
  the two counts really are different questions and the floor is set on the right one.
- A cradle-to-grave product did not join the cradle-to-gate bucket.
- The view exposes no `min` or `max` column at all.
- `get_product_intensity_buckets()` raised `Admin access required` for a non-admin session.
- 552 unit tests pass, including 61 new ones. Full `tsc --noEmit` clean.
- Pre-existing and unrelated: 12 failures in `generate-pdf-route.test.ts` and 1 in
  `supplier-products/smart-import`, both confirmed failing with this work stashed.

### Not done

- **No browser walk-through.** The redesign worktree's local Supabase is not running
  (`supabase_db_redesign` does not exist), so the admin page and the explainer copy have not
  been seen rendered. Everything they read has been verified at the database and unit level.
- **The benchmark used is not persisted with the score.** The plan's cohort-drift risk asks
  for this so a historical score can always be explained. `climate_breakdown.benchmark` now
  carries it through the API, but `organization_vitality_scores` does not store it. That is a
  column and a write, and it belongs with whatever else that table next needs.
- **Water intensity.** `buildWaterInputs` still uses the BIER ratios directly. The table and
  the ladder are both keyed by metric so it is the obvious next tenant.
