# LCA report accuracy fixes (UNROOTED / Happy Curations review, 2026-06-10)

Three issues found while checking 9 client LCA reports (3 liquids × 3 formats).

## Fix #1 — Secondary packaging not amortised at End-of-Life  [DONE]
- Root cause: `lib/product-lca-aggregator.ts` EoL loop divides quantity by `reuse_trips`
  only, not `units_per_group`. Production side (`product-lca-calculator.ts:1496`) already
  divides correctly, so production was fine but EoL/circularity used full multipack mass.
- [x] Add `getPackagingUnitsPerGroup(material)` helper in `lib/end-of-life-factors.ts`
- [x] Apply divisor in aggregator EoL loop (mirror reuse_trips)
- [x] Amortise shared-packaging mass in transformer `totalWaste` + recycled-content weight-avg

## Fix #2 — Cardboard box misclassified as 'other'  [DONE]
- Root cause: `MATERIAL_NAME_KEYWORDS` paper pattern lacked `box`; "500ml box" -> 'other'
  (28% recycle, fossil 1.5 kg/kg incineration) instead of 'paper' (74%, biogenic 0.8).
- [x] Add `box(es)?` to paper keyword pattern in `lib/end-of-life-factors.ts`

## Fix #3 — Land Use / Water / Supply Chain tables truncated to 8 rows  [DONE]
- Root cause: `lib/utils/lca-report-transformer.ts` `.slice(0,8)` (lines 1185, 1286, 1326/1330),
  in stored order, hid the biggest contributors. Totals were correct; display incomplete.
- [x] Sort by relevant metric desc + cap at SECTION_TABLE_ROW_LIMIT (14) + explicit overflow row.
      Pages are fixed-height (1123px, overflow:hidden) so full pagination deferred; overflow row
      keeps it honest and the full inventory is already in the paginated Ingredient Breakdown.

## Verification  [DONE]
- [x] Vitest: shared cardboard box -> EoL /units_per_group, classified 'paper'/biogenic
      (lib/__tests__/product-lca-aggregator-shared-packaging.test.ts)
- [x] Vitest: getMaterialFactorKey + getPackagingUnitsPerGroup (end-of-life-factors.test.ts)
- [x] Vitest: transformer returns all materials, sorted, overflow row (lca-report-transformer-tables.test.ts)
- [x] Existing LCA suite: 178 passed, no regressions. tsc --noEmit clean.

## Review / results
Box end-of-life burden per bottle (computed via calculateMaterialEoL, UK region):
  500ml box:  OLD +0.1122  ->  NEW +0.0062   (now ~all biogenic, fossil avoided -0.0003)
  4x420 box:  OLD +0.1023  ->  NEW +0.0056
  6x420 box:  OLD +0.1313  ->  NEW +0.0048
Production side was already correctly amortised, so the only headline change is EoL.

Indicative corrected per-bottle totals (reported -> corrected; +/-0.005):
  Ginger   500x4 0.678->~0.572 | 420x4 0.545->~0.448 | 420x6 0.566->~0.439
  Turmeric 500x4 0.559->~0.453 | 420x4 0.431->~0.334 | 420x6 0.446->~0.319
  Greens   500x4 0.552->~0.446 | 420x4 0.446->~0.349 | 420x6 0.468->~0.341
Ordering now sensible: 500ml > 420ml, and 6-pack < 4-pack per bottle.

NEXT (data, not code): the 9 client products must be RECALCULATED (re-run LCA) so the
stored aggregated_impacts pick up fixes #1/#2, then reports regenerated (fix #3 applies at
regeneration). Earlier hand table that also "amortised production" was wrong and is superseded.
