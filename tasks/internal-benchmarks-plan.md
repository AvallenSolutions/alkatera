# Internal benchmarks: our own data as the reference

Plan written 24 July 2026, after Anne Jones's audit found that not one of the
13 rows in `lib/industry-benchmarks.ts` is supported by the source it cites.

## The idea

Stop assembling a benchmark from eight incompatible papers and derive it from
the platform's own completed LCAs.

The strategic argument is not "our data is better" — with a small customer base
it is thinner. It is that **peer benchmarks are boundary-consistent by
construction**. A customer's cradle-to-gate figure gets compared against other
customers' cradle-to-gate figures, computed by the same engine on the same
factor sets, at the same pack format. That satisfies ISO 14044's same-boundary
requirement structurally rather than by curation, which is the thing the
literature table can never do, however well cited.

It is the stage-and-format-resolved benchmark Anne recommends, sourced from us.

## What already exists (do not rebuild)

Two systems, both live:

1. **Pulse peer benchmarks.** `metric_snapshots` → `peer_benchmark_view` →
   `GET /api/pulse/peer-benchmark`. Anonymised cross-org p25/p50/p75, mean,
   min, max, plus the org's percentile rank. 90-day window, latest snapshot per
   org, and **k-anonymity ≥ 5 enforced inside the view** (`HAVING count(*) >= 5`)
   rather than in application code, so no route can bypass it. This is the right
   architecture and the model for everything below.
2. **Vitality benchmarks.** `get_organization_benchmark_comparison` →
   `hooks/data/useVitalityBenchmarks.ts` → the pillar cards. Platform and
   category averages plus a "top performer".

**Neither feeds the intensity denominator that drives the climate score.** That
is still the hardcoded literature table.

## Three gaps

**A. The wrong metrics are captured.** `metric_snapshots` currently holds
`total_co2e`, `lca_completeness_pct`, `products_assessed`, `water_consumption`
— absolutes and completeness. There is no per-litre intensity keyed by category
and boundary, which is exactly the number a benchmark needs. Cheapest gap to
close: it is derivable from completed PCFs we already store.

**B. Cohort size is the binding constraint.** k≥5 is correct and must not be
relaxed. But splitting a small customer base by category — and then by pack
format and boundary, which is what makes the comparison fair — produces buckets
that may never reach five. On the local DB the view returns **zero** metrics
today. The answer is not to lower k; it is a fallback ladder (below).

**C. A privacy hole in the vitality benchmark.**
`get_organization_benchmark_comparison` returns `*_top` (the single best org's
score) alongside `organization_count`, and I could find no minimum-cohort guard
in it. In a category with three orgs, "top performer in Spirits" is close to
publishing a named competitor's score. Pulse got this right; this one did not.
**Fix this regardless of whether the rest of the plan proceeds.**

## The fallback ladder

One rule, applied per product, in order. The UI must always say which rung it
is on — a peer benchmark and a literature benchmark must never look alike.

1. **Peer, like-for-like** — same category, same pack format, same boundary,
   k≥5. Best. "Compared with 8 similar products on alkatera."
2. **Peer, category-only** — same category and boundary, any format, k≥5.
   "Compared with 11 other spirits on alkatera."
3. **Literature**, with its `sourceSupportsValue` caveat surfaced, and only for
   rows where that flag is not `'no'`.
4. **No benchmark.** Show the measured figure alone. "We cannot benchmark this
   yet" beside a real number is more credible than a fabricated 70.

Rung 4 is a feature, not a failure. It is also what several categories deserve
today: the Non-Alcoholic sub-categories and anything on the default fallback.

## The work

### Phase 1 — capture the right metric (no user-visible change)
1. Add a snapshot writer for **`co2e_per_litre`**, keyed by
   `product_category`, `system_boundary` and pack format, written whenever a
   PCF reaches `completed`. Reuse the existing `metric_snapshots` shape; add
   the dimensions as columns or a `dimensions jsonb`, not as string-mangled
   metric keys.
2. Backfill from existing completed PCFs, so the cohort starts non-empty.
3. Extend `peer_benchmark_view` (or add a sibling) to group by those
   dimensions, keeping `HAVING count(DISTINCT organization_id) >= 5`. Note the
   current view counts rows, not distinct orgs — with one row per org per
   metric that is equivalent today, but it should be explicit.

### Phase 2 — make it visible before it is authoritative
4. Add an admin surface showing, per bucket: sample size, p25/p50/p75, and
   whether it clears k≥5. We need to see the shape of our own data before we
   score anyone against it.
5. Compare each bucket that clears k≥5 against the corresponding literature
   row. Large divergence is a finding either way: it either impugns the
   literature row or reveals a systematic modelling error in our own engine.
   **Do not skip this step** — it is the only cheap validation we get.

### Phase 3 — wire it into the score
6. Implement the fallback ladder in the intensity path, replacing the direct
   `pickBenchmark` call.
7. Surface the rung in the UI, with the cohort size ("compared with 8 similar
   products"), never a bare number.
8. Only then consider retiring literature rows.

### Phase 0 — do this now, independent of the above
9. **Add a minimum-cohort guard to `get_organization_benchmark_comparison`**
   and stop returning `*_top` below it (gap C).

## What this does not solve

- **Absolute emissions.** Peer benchmarks are intensity comparisons. Absolute
  tonnes remain the outcome and the Targets driver.
- **Being better than the industry.** A cohort of alkatera customers is not a
  representative sample of the drinks sector; it is a sample of businesses that
  bought carbon software. Expect it to be better than average, and never label
  it "industry average". Call it what it is: "other products on alkatera".
- **Cold start.** Until buckets fill, the literature table is still doing the
  work. So the citation repairs in `tasks/vitality-redesign-plan.md` are not
  cancelled by this plan — they are the bridge to it.

## Honest risks

- **Circularity.** If our engine has a systematic bias, benchmarking customers
  against each other hides it, because both sides carry the same error. The
  literature comparison in step 5 is the only guard against this, which is why
  it is not optional.
- **Cohort drift.** As the customer base changes shape, the benchmark moves
  underneath a customer who changed nothing. Snapshot the benchmark used with
  each score, so a historical score can always be explained.
- **Competitive sensitivity.** Producers will ask who is in their cohort. k≥5
  plus never exposing a max is the floor; a defined category taxonomy that
  cannot be narrowed to one competitor is the rest of it.
