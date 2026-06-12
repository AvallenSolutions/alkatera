# Dual-standard LCA report compliance (ISO 14067:2018 + GHG Protocol Product Standard)

Goal: make the LCA report defensibly compliant with BOTH ISO 14067:2018 (fossil-only
headline, biogenic reported separately) AND the GHG Protocol Product Standard (biogenic
included in an all-species total, disclosed separately). Standards research confirmed the
only headline divergence is biogenic CO2; the architecture is already "one inventory, two
totals". Tim's scope decision: do all three gaps; conservative claim stance.

## Findings (where we stand)
- The PDF report (lib/pdf/render-lca-html.ts) is already ~80% dual-compliant: fossil-only
  headline (headlineFossilCarbon), all-species total, carbon-origin split, biogenic note,
  dLUC line, full GHG species table. Both reports share transformLCADataForReport.
- The React on-screen report (/lca-report/[id] -> AlkaTeraProductLCA) is fed the SAME rich
  data but renders only a subset, and HARDCODES data-quality values.
- The fossil/biogenic split is only genuine when a material resolves via OpenLCA or an
  ecoinvent proxy carrying the breakdown columns; otherwise the resolver fabricates 85/15.

## Phase A — Rendering + claim wording (contained, low risk, do first) — DONE
- [x] A1: Fixed hardcoded data-quality values in ExecSummaryPage (Part1.tsx). Now reads
      data.dataQuality.coverageSummary.primaryDataShare and a temporalLabel() mapping of
      pedigreeMatrix.temporalRepresentativeness (1-2 High, 3 Medium, 4-5 Low).
- [x] A2: ClimateMethodologyPage rebuilt to PDF parity (Methodologies.tsx). Renders the two
      headline totals (fossil-only vs all-species), full per-species/per-origin GHG table
      (CO2 fossil/biogenic/LULUC, CH4 fossil/biogenic, N2O, HFCs), the §6.4.9.3 footnote,
      the biogenic note, and reframed "Reference Standards". Visually verified via fixture
      route: fits the A4 page exactly (1123px, no clipping).
- [x] A3: Conservative claim wording applied:
      - render-lca-html.ts cover: "...Compliant" -> "Prepared in accordance with..."
      - Layout.tsx footer: "ISO 14040/44 Compliant" -> "Prepared in accordance with..."
      - Part1.tsx exec copy: "adhering to" -> "in accordance with"
      - Dropped PAS 2050 from both standards lists; "Compliance" -> "Reference Standards"
      - Corrected pedigree overclaims in transformer (exec prose, missingDataTreatment,
        doc comment) and aggregator aggregation_method (no longer claims a §4.2.3.6.3 mandate)
- [x] A4: Verified - tsc exit 0 / 0 errors; 27 unit tests green (generate-pdf-route x20 +
      transformer-tables x7); ClimateMethodologyPage visually confirmed in browser.

## Phase B — Make the fossil/biogenic split real — DONE (Tim: 100% fossil + flag, no recalc)
- [x] B1: Audited the resolver. Found EIGHT 85/15 fabrication sites (not the ~5 expected):
      buildSupplierProductResult, Priority 1c supplier LCA, Priority 2 DEFRA+ecoinvent hybrid
      (ratio default), direct proxy, name proxy, ecoinvent proxy, staging factor, and the
      cached last-resort path.
- [x] B2: Replaced all 8. Each now uses the real fossil/biogenic columns when present;
      otherwise attributes the whole total to fossil (biogenic = 0) and sets a new
      WaterfallResult.carbon_split_estimated flag. No 85/15 fabrication remains.
- [x] B3: Threaded the flag through for honest disclosure: calculator carries
      carbon_split_estimated onto each lcaMaterial -> aggregator counts non-trivial
      estimated materials into ghg_breakdown.carbon_origin.estimated_split_count ->
      transformer appends a sentence to the biogenic note ("For N input(s), a fossil/
      biogenic split was not separately characterised ... reported wholly as fossil CO2").
- [x] B4: No recalculation (Tim's choice). Future calculations use the new logic; existing
      PCFs are untouched.
- [x] Verify: tsc exit 0 / 0 errors; 281 tests green. Updated 2 resolver tests + 2 supplier
      tests from the old 85/15 expectation to the new methodology; added an aggregator test
      asserting estimated_split_count.

## Review
- Counter-intuitive headline finding: the PDF report was already ~80% dual-compliant via the
  shared transformer (fossil-only headline + all-species total + per-origin GHG table). The
  gaps were (a) the React on-screen report rendered only a subset and hardcoded data-quality
  values, (b) the fossil/biogenic split was fabricated 85/15 whenever real LCI columns were
  absent, and (c) overstated conformance claims.
- Phase A (rendering + claims) and Phase B (real split + estimated-flag disclosure) both
  shipped and are verified. No production recalculation was run.
- Follow-ups noted, not actioned: the exec-summary's 2nd/3rd paragraphs are still hardcoded
  marketing prose ("demonstrates reduced carbon emissions...") shown on every report
  regardless of the product — same integrity class as the 65% fix, worth removing. And the
  deeper win remains routing more materials through OpenLCA/ecoinvent processes that carry a
  genuine fossil/biogenic split, so fewer inputs hit the 100%-fossil fallback at all.

---

# Facility utility data dashboard (visual display of uploaded bill data)

Goal: on the facility History tab, show a visual 12-month view of all utility, water and waste data (from uploaded bills and manual entry) so gaps and trends are obvious.

## Plan
- [x] New component `components/facilities/FacilityDataDashboard.tsx`
  - 12-month coverage grid: one row per data series (each utility type, water intake/discharge/recycled, waste streams), one column per month. Cells show the monthly value; gaps highlighted amber; months before tracking started shown muted; current month shown as pending (bill may not have arrived yet).
  - Bills spanning multiple months (e.g. quarterly water bills) are allocated across months by days, so a quarterly bill covers 3 months rather than showing false gaps.
  - Trend chart (recharts BarChart, brand #ccff00) for a selectable series, with average reference line, trend vs previous 3 months, coverage stat, and a list of gap months.
  - Contracted utilities (facility_data_contracts) with no data show as full-gap rows.
- [x] Mount the dashboard at the top of the History tab in `app/(authenticated)/company/facilities/[id]/page.tsx`, reusing the already-fetched utilityData, waterData, wasteData, dataContracts.
- [x] Verify: typecheck passes; route compiles and serves 200 on dev server; 5 rendered unit tests pass (gap detection, quarterly-bill allocation, contracted-utility full-gap row, estimated-data marking, empty state).

## Review
- Coverage grid: one row per series (energy/fuel, water, waste), 12 month columns with the monthly value in each cell. Green = recorded, amber filled = estimated, amber dashed = gap, plain dashed = current month pending, dot = before tracking started. Coverage badge per row (covered/tracked months).
- Multi-month bills are spread across covered months proportionally by days, so a quarterly water bill fills 3 months instead of showing 2 false gaps.
- Trend chart: any series selectable (dropdown or click a row label), brand-coloured bars, average reference line, total/monthly average/3-month trend/coverage stats, and missing months listed as badges.
- Added a jsdom ResizeObserver stub to vitest.setup.ts (recharts needs it).
- Could not visually verify in the preview browser: no auth session locally and .env.local points at production Supabase, so verification was done via rendered unit tests + dev-server compile instead.

---

# Code review remediation (from CODE_REVIEW_2026-06-10.md)

(Previous FY-aware reporting plan completed and committed: 86454144 and earlier.)

Working one by one, verifying each before moving on.

## Critical / High
- [x] B1: Recycled-content credit applied twice (calculator + aggregator)
- [x] B2: Inbound transport excluded from headline LCA total
- [x] S1: Carbon-budgets IDOR (membership check on GET) + same hole found in shadow-prices
- [x] S2: Greenwash public scanner SSRF (use safeFetch) + fetch-url-content + scraping fetchPage
- [x] S4: .gitignore business documents
- [x] R1: Stripe webhook idempotency + lost events (migration 20262703900000 needs applying)
- [x] B3: natural_gas_m3 dropped + m3/m³ unit mismatch
- [x] B4: Maturation ABV dilution in persisted LCA path
- [x] B5: OpenLCA error misclassification (fixed + the whole no-match feature committed)
- [x] B6: Corporate Scope 3 double counts (Cat 9/4/11)
- [x] B7: Xero suppression single-month + no pro-rating
- [x] B8: Facility per-unit conversion litres vs functional units
- [x] R2: Inngest dead retries + stranded enrich jobs + grounded-search timeout (+ R6 claim guards)
- [x] R3: Xero token-refresh race + cron fan-out to Inngest
- [x] P1: Corporate emissions N+1 + move server-side
- [x] P2: Report PDF generation to Inngest

## Medium / Low (after the above)
- [ ] B9-B18 calculation mediums (EF 3.1 parsing, cache categories, biogenic split, factor drift, audit log, viticulture allocation)
- [ ] B19-B25 general mediums/lows (onboarding debounce, org switch role, notify double-send, pulse NaN) — B22 vitest exclude DONE
- [ ] S3: procurement RPC caller check
- [ ] S5: error.message sweep (serverErrorResponse rollout)
- [ ] R4: SlideSpeak stuck states
- [ ] R5: validation rollout (parseFiniteNumber + zod)
- [x] R6: Inngest claim error checks (done with R2)
- [ ] P3-P8 performance mediums

## Review log
- P2 (2026-06-10): Sustainability report PDF pipeline extracted to
  lib/reports/generate-sustainability-pdf.ts and runs as Inngest fn
  reportPdfGenerate (2 steps: build-report-data with queries/key findings/
  narratives; render-and-upload-pdf with PDFShift + storage; onFailure marks
  the report failed). The route now authorises (RLS-scoped report fetch),
  sets status aggregating_data and dispatches; statuses use the existing
  check-constraint values and feed the polling progress UI. No client change
  needed (useReportBuilder already fire-and-forgets + polls).
  NOTE (pre-existing flake, unrelated): supplier-products smart-import test
  "allows an org member..." gets 429 from in-memory rate-limit state shared
  across tests.
- P1 (2026-06-10): (a) Cat 1 production-log loop now fetches the latest
  completed PCF per product in ONE batched query (was one query per log row:
  260+ for a weekly-logging org, 1300+ on the trends tab). (b) New
  GET /api/emissions/corporate (membership-verified) runs the full cascade
  server-side incl. the historical-imports fallback; useCompanyFootprint is
  now a single HTTP call. Hook tests rewritten against the fetch contract;
  PCF mocks updated to the batched array shape. Remaining client-side callers
  (scope-1-2 page, useScope3Emissions) still benefit from (a); migrating them
  to the route is a follow-up.
- R3 (2026-06-10): (a) Token rotation now persists via
  updateTokensIfRefreshUnchanged (optimistic check on the stored refresh-token
  ciphertext); losing the cross-lambda race re-reads the winner's tokens
  instead of overwriting them with an invalidated rotation, plus a self-heal
  re-read when the refresh call itself fails because another instance consumed
  the token. No migration needed. (b) /api/cron/xero-sync is now a heartbeat
  dispatching xero/sync.tick; new lib/inngest/functions/xero.ts fans out one
  run per org (per-org concurrency 1, global 3, retry 1, onFailure sends the
  admin alert email per failed org). 181 xero tests green, tsc clean.
  Smoke-test the Inngest registration after deploy.
- R2+R6 (2026-06-10): scraping/documents worker steps now THROW so the
  configured retries actually fire; terminal failures write 'error' via new
  onFailure handlers. STALE_MS raised 5→30 min so the recovery sweep can't
  re-queue mid-retry jobs (double runs). Tick claims now status-guard the
  update and throw on DB errors (no fan-out for unclaimed rows). Enrich:
  onFailure added (no stale sweep exists for deep_enrich_jobs) and the
  persist claim accepts 'ingesting' so self-retries aren't stuck (admin route
  still claims on 'searched' only, no race). runGroundedSearch gets a 120s
  withTimeout — the original deep-enrich incident class. tsc clean; no unit
  harness exists for Inngest fns — smoke-test via Inngest dashboard after
  deploy.
- B8 (2026-06-10): Calculator now converts litre/hl/ml production volumes to
  functional units (via product unit size) before handing facilityEmissions to
  the aggregator, at both push sites (primary + archetype proxy). Unconvertible
  units (kg/cases/pallets) keep treated-as-units behaviour with a warning.
  2 regression tests; full lib sweep green bar the 3 pre-existing distributor
  failures.
- B7 (2026-06-10): (a) periodsCovered() in slice-mapping expands utility/fleet
  suppression signals across EVERY covered month, clamped to the window
  (annual bills previously suppressed Xero in their start month only, and
  out-of-window starts suppressed nothing). (b) overlapFraction() in
  utility-factors pro-rates overlap-matched entries everywhere quantities are
  summed: product LCA facility utilities + water, corporate scope 1/2
  utilities, all three fleet queries (now overlap-fetched too, fixing the
  FY-straddle binary in/out), and the trace route (kept consistent; also
  inherited the m3/m³ fix). Legacy rows without period dates keep full-count
  behaviour. 12 new tests (periodsCovered 8 + pro-rating 4); 567 green
  across calculations/emissions/xero/calculator suites.
- B6 (2026-06-10): Scope 3 restructure. Cat 4 calculator REMOVED (its Method 1
  summed per-bottle quantities as annual tonnage; inbound transport is inside
  Cat 1 per-unit scope 3 after B2; its spend fallback double-counted
  overheads). upstream_logistics overheads now land on upstream_transport via
  an explicit overhead-loop case (previously default→purchased_services AND
  Cat 4 fallback = double). Cat 9 no longer re-reads downstream_logistics
  overheads (main loop counts them once). Cat 9 + Cat 11 estimators now
  exclude products whose latest completed PCF boundary already includes
  distribution / use phase (was double-counted inside Cat 1). Tests rewritten:
  67 green across scope3-categories + corporate-emissions; tsc clean.
  NOTE (pre-existing, unrelated): hooks/data/__tests__/useProductSpotlight
  fails with "No QueryClient set" — test harness lacks a QueryClientProvider
  wrapper; predates this work.
- B5 (2026-06-10): classifyOpenLcaError moved to lib/openlca/classify-error.ts
  with the specific server-state messages ("Impact method not found",
  "Calculation result ... not found") matched BEFORE the generic 404 sniff, so
  transient server problems can no longer be recorded as permanent
  openlca_no_match. 6 unit tests pin the ordering. The previously uncommitted
  OpenLCA no-match feature (route error vocabulary, resolver flag + skip,
  wizard transient/no-match split) was complete, reviewed and half-landed (its
  migration was already on main), so it was committed as part of this fix.
- B4 (2026-06-10): Persisted LCA path now passes bottleAbvPercent
  (products.alcohol_content_abv) to calculateMaturationImpacts and divides by
  the BOTTLED output volume, matching the product-page preview maths. Unknown/
  zero ABV falls back to no dilution (conservative, unchanged behaviour). New
  regression test (63% cask → 46% bottle). Aged-spirit PCFs need
  recalculation: maturation stage was over-stated ~38-75%.
- B3 (2026-06-10): natural_gas_m3 added to the product LCA calculator's factor
  map (entries previously hit the unknown-type continue and contributed ZERO
  Scope 1). m³-conversion checks in the calculator, corporate-emissions and
  Xero resolved-emissions now accept both 'm3' (what the UI writes) and 'm³';
  previously each file matched only one spelling. slice-mapping verified
  already correct. 3 new tests; calculations/emissions/xero suites 502 green.
  Affected PCFs for gas-heated facilities need recalculation.
- R1 (2026-06-10): stripe_webhook_events table (migration 20262703900000,
  POSTED IN CHAT, needs applying in Supabase SQL editor). Route now claims the
  event before processing, marks processed only after handler success, returns
  500 on failure so Stripe retries (RPCs are idempotent), and skips as
  duplicate only deliveries that completed. Claim degrades gracefully if the
  migration is not yet applied (logs + proceeds). 4 new route tests cover
  process/fail/retry/duplicate.
- S4 (2026-06-10): .gitignore now covers office/PDF documents, LibreOffice
  lock files, Knowledge Bank directories and .claude/worktrees/. Verified no
  such file was already tracked and all the confidential repo-root documents
  are now ignored.
- S2 (2026-06-10): Extracted safeFetch (host + resolved-IP validation, manual
  per-hop redirect re-validation) to lib/utils/safe-fetch.ts and applied it to
  the three remaining redirect-follow fetchers of user-supplied URLs: the
  unauthenticated greenwash scanner, /api/fetch-url-content (authenticated,
  same hole), and the distributor scraping fetchPage (directory-sourced URLs,
  defence-in-depth). import-from-url-background now imports the shared module
  instead of its local copy. 10 new unit tests incl. redirect-to-metadata and
  DNS-rebinding cases. Repo-wide redirect:'follow' sweep is now clean.
- S1 (2026-06-10): Membership check added to resolveOrg in carbon-budgets AND
  shadow-prices (swept all 17 copies of the pattern across app/api/pulse; these
  two were the only ones missing it; facility-impact/layout/peer-benchmark/
  targets use the cookie-scoped anon client so RLS constrains them). tsc clean.
- B2 (2026-06-10): Aggregator now adds each material's impact_transport to the
  headline total, scope 3, fossil totals, stage bucket and by_material entry,
  exactly once: skipped when the row's decomposition fields
  (impact_climate_production + impact_climate_transport_embedded) show the
  calculator already replaced transport into impact_climate. Implemented in the
  aggregator (not the calculator) so all existing persisted PCFs are corrected
  on next aggregation without recalc, and storage keeps factor vs transport
  separate. Synthetic rows persist impact_transport = 0 so are unaffected.
  transport_note/integrity comments updated; 10 tests updated to the corrected
  semantics + 1 new decomposition no-double-count test. lib suite: 3040 pass,
  only the 4 pre-existing unrelated failures (distributor x3, rosa) remain.
- B1 (2026-06-10): Credit now applied once, in the calculator at persist time.
  Removed the aggregator's re-credit block (its recycledContentCredit accumulator
  was never read, so nothing downstream lost). Found and fixed a wider pinned-mode
  bug than the review flagged: pinned materials re-applied reuse amortisation,
  recycled credit, units_per_group allocation AND inbound-container carbon to
  stored values that already embed them; all four now skipped when pinned.
  Regression test added (aggregator passes stored credited values through
  unchanged). 135 calculator/aggregator tests green, tsc clean.
  NOTE: PCFs with recycled packaging calculated while both credit blocks were
  live are understated; recalculate after deploy.
- B22 (2026-06-10, pulled forward): vitest exclude now covers .claude/** so
  stale worktree checkouts stop producing hundreds of spurious failures (they
  were also matching named-file runs, blocking B1 verification).
