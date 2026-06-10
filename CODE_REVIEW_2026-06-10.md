# alka**tera** Code Review: bugs, security, performance, reliability

**Date:** 2026-06-10
**Method:** Five parallel specialist review passes (calculation correctness, general correctness, security delta vs the 2026-05-29 review, performance, reliability), followed by manual verification of the headline findings. Every finding carries file:line evidence. `pnpm tsc --noEmit` passes. Targeted test suites for modified files pass (impact-waterfall-resolver 52/52, useSetupProgress 10/10, generate-pdf-route 20/20).
**Verified by hand:** findings B1, B3, S1, R1 were re-read and confirmed directly, not just agent-reported.

---

## Ranked summary (most serious first)

| # | Finding | Area | Severity |
|---|---------|------|----------|
| 1 | Recycled-content credit applied twice (calculator AND aggregator), compounding on pinned recalcs | Bugs | Critical |
| 2 | User-entered inbound transport computed but excluded from the headline LCA total | Bugs | Critical |
| 3 | `natural_gas_m3` utility entries contribute zero Scope 1 to product LCAs; `m3` vs `m³` unit mismatch causes 10.55x undercount | Bugs | Critical |
| 4 | Maturation per-bottle impacts ignore ABV dilution in the persisted LCA path (38-75% overstatement for aged spirits) | Bugs | Critical |
| 5 | Stripe webhook: handler failures return 200 and events are marked processed before handling, so a transient failure permanently loses a subscription activation | Reliability | Critical |
| 6 | IDOR: any authenticated user can read another org's carbon budgets and emissions snapshots via `?organization_id=` | Security | High |
| 7 | Unauthenticated SSRF in the public greenwash scanner (redirect bypass of the host blocklist) | Security | High |
| 8 | OpenLCA error misclassification permanently flags materials `openlca_no_match` after transient server errors | Bugs | High |
| 9 | Corporate Scope 3 double counting (Cat 9 vs overheads, Cat 4 dimensionally wrong, Cat 9/11 overlap with wide-boundary LCAs) | Bugs | High |
| 10 | Corporate emissions runs in the browser with an N+1 (260+ round trips; ~1,300 on the scope-1-2 trends tab) | Performance | Critical (perf) |
| 11 | Inngest `retries: 3` is dead code in scraping/documents workers (catch-all inside `step.run`); enrich jobs strand in `searching`/`ingesting` | Reliability | High |
| 12 | Xero: token-refresh race across lambdas can brick the connection; the sync cron is the banned 300s-ceiling pattern | Reliability | High |
| 13 | Report PDF generation is a synchronous route doing 2x corporate emissions calc + Claude + PDFShift (40-90s realistic) | Performance | High |
| 14 | Xero-vs-utility suppression only covers the bill's start month; overlap-matched entries never pro-rated | Bugs | High |
| 15 | ~149 API routes still return raw `error.message` to clients (deferred MED-6 from the May review, still growing) | Security | Medium |

The full findings follow, grouped by area. Items confirmed in code unless marked otherwise.

---

## 1. Bugs and correctness

### B1 (Critical, verified). Recycled-content credit applied twice
[lib/product-lca-calculator.ts:1353](lib/product-lca-calculator.ts:1353) applies `recycledMultiplier = 1 - (rc/100) * DEFAULT_RECYCLED_CONTENT_CREDIT` to climate impacts before persisting. [lib/product-lca-aggregator.ts:298](lib/product-lca-aggregator.ts:298) then reads the same persisted row (which still carries `recycled_content_percentage`) and reduces it again by the numerically identical factor. A 70%-recycled aluminium can ends up at 0.65 x 0.65 = 0.42 of virgin instead of 0.65, a ~35% understatement of that material. In pinned-recalculation mode (`buildResultFromPinnedMaterial`) the already-credited stored value is fed back through the calculator's credit step, so the credit compounds on every recalc.
**Fix:** apply the credit in exactly one place. Delete the aggregator block at product-lca-aggregator.ts:298-311 (the calculator's version also adjusts fossil/biogenic/dluc consistently) and skip the calculator step for pinned materials.

### B2 (Critical). User-entered inbound transport never reaches the headline footprint
[lib/product-lca-calculator.ts:1446](lib/product-lca-calculator.ts:1446) only folds transport into `impact_climate` when `hasDecomposition = (resolved.impact_climate_production ?? 0) > 0`, but no return path in `resolveImpactFactors` ever sets `impact_climate_production` (the only producer, `lib/openlca/impact-factor-resolver.ts`, is not used by the calculator). The aggregator then deliberately excludes `impact_transport` from `totalClimate` and scope totals ([lib/product-lca-aggregator.ts:324](lib/product-lca-aggregator.ts:324)) on the assumption transport is already embedded, which is only true for the never-taken path. DEFRA inbound transport is computed, displayed, and excluded from `climate_change_gwp100`. The report's `transport_note` is false for most materials.
**Fix:** when `!hasDecomposition`, add `transportEmissions` to `adjustedClimate` for factor sources known not to embed transport (staging, cached, supplier-EPD-gate), or add `totalTransport` into `totalClimate`/`scope3` in the aggregator and update the integrity check at aggregator:866.

### B3 (Critical, verified). `natural_gas_m3` silently dropped; `m3` vs `m³` unit drift
The `EMISSION_FACTORS` map at [lib/product-lca-calculator.ts:706](lib/product-lca-calculator.ts:706) has no `natural_gas_m3` key, although it is a first-class `utility_type` (UI, bill import, corporate-emissions all handle it). Those entries hit the unknown-type `continue` and contribute zero Scope 1 to facility processing emissions. Additionally the m³→kWh conversion at line 753 fires only on the exact string `'m³'`; entries stored as `'m3'` (which the UI writes, see `DirectDataEntry.tsx:631`) are treated as kWh, a 10.55x undercount. `lib/xero/resolved-emissions.ts:231` checks `'m3'` while `lib/calculations/corporate-emissions.ts:134` checks `'m³'`; at most one matches real data.
**Fix:** add `natural_gas_m3: { factor: 0.18293 * 10.55, scope: 'Scope 1' }` and normalise the unit string in one shared helper (e.g. `normaliseEnergyToKwh` in `lib/calculations/utility-factors.ts`) used by all three files.

### B4 (Critical). Maturation ignores ABV dilution in the persisted LCA path
[lib/product-lca-calculator.ts:1763](lib/product-lca-calculator.ts:1763) calls the legacy form `calculateMaturationImpacts(maturationProfile, warehouseCountryCode)` with no `bottleAbvPercent` (so `dilutionFactor = 1`) and derives `totalBottles` from cask-strength `output_volume_litres` instead of `output_volume_bottled_litres`. The maturation calculator's own header states omitting dilution overstates per-bottle CO₂e by 40-75%. The UI previews pass dilution correctly, so the report disagrees with the product page. A Scotch filled at 63.5% and bottled at 46% has barrel + warehouse CO₂e overstated x1.38.
**Fix:** pass `{ warehouseCountryCode, caskFillAbvPercent: maturationProfile.cask_fill_abv_percent, bottleAbvPercent: product.alcohol_content_abv }` and use `output_volume_bottled_litres` at line 1785.

### B5 (High). OpenLCA error misclassification permanently disables live factors per material
[app/api/openlca/calculate/route.ts:101](app/api/openlca/calculate/route.ts:101) (uncommitted): the first branch matches any message containing "not found", so `Impact method not found` (client.ts:590) and `Calculation result ... not found` (client.ts:339) are classified as `process_not_found`/404. The resolver trusts this: two "404s" write `openlca_no_match = true` to `product_materials` ([lib/impact-waterfall-resolver.ts:1008](lib/impact-waterfall-resolver.ts:1008)), silently downgrading the material to proxy factors on every future recalculation after what was a transient server problem.
**Fix:** check the specific messages (`impact method not found`, `calculation result ... not found`) before the generic 404 sniff and return non-404 codes for them.

### B6 (High). Corporate Scope 3 double counting and a dimensionally wrong Cat 4
- [lib/calculations/corporate-emissions.ts:489](lib/calculations/corporate-emissions.ts:489) adds `downstream_logistics` overheads to the breakdown; [lib/calculations/scope3-categories.ts:291](lib/calculations/scope3-categories.ts:291) Cat 9 "Method 1" reads the same rows again; both are summed into the total at corporate-emissions.ts:579-590.
- Cat 4 ([lib/calculations/scope3-categories.ts:164](lib/calculations/scope3-categories.ts:164)) sums per-functional-unit `quantity` from `product_carbon_footprint_materials` as if it were annual shipped tonnage, with no multiplication by units produced and no period filter. The result is a tiny arbitrary number labelled "primary" quality, overlapping Cat 1.
- Cat 9/11 estimators double-count refrigeration/distribution for products whose latest PCF boundary is cradle-to-shelf/consumer/grave (already inside Cat 1 via the per-unit LCA).
- Cat 9/Cat 4 filter on `created_at` (row creation time) rather than the reporting period.
**Fix:** drop Cat 9 Method 1 (or exclude `downstream_logistics` from the overhead switch); rebuild Cat 4 as Σ(per-unit `impact_transport` x units produced in period) or remove it; gate Cat 9/11 estimation on `system_boundary`; filter by entry date.

### B7 (High). Period suppression and pro-rating gaps (FY-aware work)
- [lib/xero/resolved-emissions.ts:239](lib/xero/resolved-emissions.ts:239): an annual/quarterly utility entry creates a Xero-suppression signal in only its start month, so Xero invoices in the other months double-count against the full-period utility quantity. Same single-month keying for fleet suppression (line 283).
- Overlap-matched facility data is counted in full, never pro-rated: [lib/product-lca-calculator.ts:676](lib/product-lca-calculator.ts:676) (utility), :790 (water), `lib/xero/resolved-emissions.ts:131`, `app/api/emissions/trace`. A 12-month bill overlapping a 3-month reporting period contributes its entire annual quantity. Conversely `calculateScope1/2` still uses start-within-window (deliberate deferral), so entries straddling the FY boundary shift wholesale.
**Fix:** expand suppression rows across every covered month (clamped to the window); scale entries by `overlapDays / entryPeriodDays`.

### B8 (High). CM/owned facility per-unit conversion assumes production volume is in functional units
[lib/product-lca-aggregator.ts:436](lib/product-lca-aggregator.ts:436) divides `allocatedEmissions / productVolume` without converting when `productionVolumeUnit` is `'litres'` (the archetype-proxy default). Processing emissions per bottle are off by the bottle-size factor (~43% for 700 ml).
**Fix:** convert to functional units using `product.unit_size_value/unit` keyed on `productionVolumeUnit`.

### B9-B18 (Medium)
- **B9** EF 3.1 fallback parsing ([app/api/openlca/calculate/route.ts:453](app/api/openlca/calculate/route.ts:453)): substring matching means "climate change: fossil" overwrites `impact_climate` (order-dependent, can end up fossil-only); EF "water use" is already scarcity-weighted but gets AWARE-weighted again in the resolver (:929); EF "land use" (pt) lands in `impact_land` (m²·yr). Use an exact-name map per method; skip AWARE when already deprivation-weighted.
- **B10** OpenLCA cache returns fewer categories than a fresh calc (route :197 vs :541): recalcs within the 30-day TTL silently zero particulate/ionising-radiation/POF/toxicity fields. Persist the full set.
- **B11** `is_biogenic_carbon` reclassifies fossil container/transport carbon as biogenic ([lib/product-lca-calculator.ts:1644](lib/product-lca-calculator.ts:1644)). Set biogenic to the biological share only.
- **B12** Extended impact categories resolved then dropped at persistence (calculator :1610-1689); the aggregator then claims "no characterisation factors available", which is untrue.
- **B13** Corporate Cat 1 fallback: silent `unitsProduced = 1`, `Math.max` across sites instead of a sum, no period filter ([lib/calculations/corporate-emissions.ts:439](lib/calculations/corporate-emissions.ts:439), :383).
- **B14** Fuzzy keyword factor matching is nondeterministic: `ilike` + `.limit(1)` with no ORDER BY ([lib/impact-waterfall-resolver.ts:1306](lib/impact-waterfall-resolver.ts:1306)); confidence not penalised. Breaks the determinism fingerprint promise.
- **B15** DEFRA factor drift across three surfaces: `utility-factors.ts` (diesel 2.66, petrol 2.08, CV 10.83) vs `corporate-emissions.ts`/`product-lca-calculator.ts` (2.68787, petrol **2.31**, CV 10.55). Petrol 2.31 kg CO₂e/L matches no recent DEFRA value (~2.08-2.10) and looks like a transcription error in two files. The refrigerant GWP 1430 is AR4, not "AR6" as the comment claims (AR6 HFC-134a is 1530). Consolidate to one factor module and verify petrol.
- **B16** Recycled multiplier applied to CO₂e but not the CH₄/N₂O gas masses (calculator :1352), so the ISO 14067 gas inventory no longer reconciles; the aggregator's reconciliation then masks it.
- **B17** Factor-traceability audit log is dead code: `resolved_factor_id` is never copied onto the inserted material, so `calculation_logs` (ISO 14067 §6.5.6) is always skipped ([lib/product-lca-calculator.ts:2783](lib/product-lca-calculator.ts:2783)).
- **B18** Viticulture allocation mixes multi-vintage averaged impacts with single-vintage yield and allocates the whole vineyard to one product ([lib/product-lca-calculator.ts:2010](lib/product-lca-calculator.ts:2010)); same pattern in the orchard block (:2368).

### General correctness (non-calculation)
- **B19 (Medium)** `saveState` debounce leaks unresolved promises: a superseded save's promise never settles, so `completeOnboarding`'s `await` can hang forever ([lib/onboarding/OnboardingContext.tsx:123](lib/onboarding/OnboardingContext.tsx:123)). Chain superseded promises to the new save's outcome.
- **B20 (Medium)** `switchOrganization` checks supplier context first and unconditionally sets `userRole = 'supplier'`, contradicting `fetchOrganizations`' "members are never suppliers" rule; member+supplier users lose member permissions on org switch. No stale-response guard on rapid A→B→A switches ([lib/organizationContext.tsx:402](lib/organizationContext.tsx:402)).
- **B21 (Medium)** Reconciliation notify has no double-send guard: `notified_at` is selected but never checked, no atomic claim; double-click sends duplicate customer emails ([app/api/admin/reconciliation/notify/route.ts:59](app/api/admin/reconciliation/notify/route.ts:59)). Claim atomically with `.is('notified_at', null)`.
- **B22 (Medium)** vitest globs into `.claude/worktrees/`: a full run reports 931 spurious failures from stale worktree copies, drowning real signal ([vitest.config.ts:12](vitest.config.ts:12)). Add `.claude/**` to the exclude list.
- **B23 (Low)** `pulse/waterfall` NaN `days` param → `Invalid Date` → 500; `SUPABASE_SERVICE_KEY!` non-null assertion binds only to the fallback (several pulse routes).
- **B24 (Low)** Weak zod in reconciliation routes (`recipientEmail` not `.email()`, `year` accepts 2026.5); notify owner lookup scans only the first 5 members by join date.
- **B25 (Low)** Floating `void supabase...upsert(...)` cache writes in serverless routes (openlca/calculate :299, ingredients/search :745) can be dropped on early return.

---

## 2. Security

Context: the 2026-05-29 review's P0/P1/P2 fixes were regression-checked and are **all still intact** (hardened `get_current_organization_id`, greenwash lockdown, `resolveAccessibleOrg` wiring in 42 files, SSRF fix in the import fetcher, rate limiting, vault-based secrets). The uncommitted reconciliation and openlca changes improve security. New findings below.

### S1 (High, verified). IDOR: cross-tenant read of carbon budgets and emissions snapshots
[app/api/pulse/carbon-budgets/route.ts:40](app/api/pulse/carbon-budgets/route.ts:40): `resolveOrg` trusts a query-string `organization_id` without verifying membership; the GET handler never checks `ctx.role` (only POST/DELETE do) and queries run with the service-role client. Any authenticated user can call `GET /api/pulse/carbon-budgets?organization_id=<victim>` and read that org's budgets and absolute `total_co2e` snapshots. The sibling routes (`cost-intensity`, `issb-disclosure`, `board-pack`) all verify membership; this one was modified in commit 8463b5cf and missed.
**Fix:** when `orgIdParam` is present, verify membership and return 403 otherwise (mirror the siblings).

### S2 (High). Unauthenticated SSRF in the public greenwash scanner
[app/api/greenwash/public/route.ts:44](app/api/greenwash/public/route.ts:44): `fetchPageContent` uses `redirect: 'follow'` and `isBlockedHost` runs only on the initial hostname. An anonymous attacker submits a public URL that 302s to `169.254.169.254` or an internal service. Identical class to the May review's HIGH-2, on a fetcher the original fix did not cover.
**Fix:** route through the existing `safeFetch` (`netlify/functions/import-from-url-background.ts`): manual redirects, per-hop resolved-IP revalidation.

### S3 (Medium). `procurement_has_access_to_brand` never checks the caller
`supabase/migrations/20262702300000_procurement_tier_phase1.sql:250`: the SECURITY DEFINER RPC verifies the passed procurement org is linked to the brand but never verifies `auth.uid()` is a member of that org, and it is granted to `authenticated`. Direct PostgREST calls bypass `requireProcurement()`. Low data sensitivity today (shared-directory fields), but fix before the procurement tier ships: add a `procurement_members` membership check at the top.

### S4 (Medium). ~25 confidential business documents in the repo root are not git-ignored
`git check-ignore` confirms signed contracts, the finance model, and security PDFs (`ImpactFocus_Partnership_Agreement_TEJv1.docx`, `B_Corp_Template_Library.xlsx`, `Data_Security_at_Alkatera.pdf`, the `Knowledge Bank - */` directories, etc.) are untracked but not ignored. None are committed today, but one `git add .` sweeps them into history.
**Fix:** add `*.docx`, `*.xlsx`, `*.pptx`, `*.pdf`, `.~lock.*#`, `Knowledge Bank - */` to `.gitignore`.

### S5 (Medium). `error.message` leak sweep (deferred MED-6) still outstanding and growing
149 API route files return raw `error.message` in JSON; 23 of those were added or modified since the May review (e.g. [app/api/distributor/documents/[submissionId]/download/route.ts:38](app/api/distributor/documents/[submissionId]/download/route.ts:38), the new distributor/procurement SKU routes, several pulse routes including carbon-budgets:101). These can surface Postgres/RLS internals and storage paths. The `serverErrorResponse` helper exists; new code is still written in the leaky pattern.
**Fix:** wire `serverErrorResponse` into at least the new distributor/procurement/pulse routes; add a lint rule to stop the bleeding.

Assessed clean: `/api/debug-auth` (env-gated), `/api/internal/*` (service-key header), Inngest webhook (signature), `get_secret` RPC (service-role only), the new distributor document/download routes, procurement route guards, getaccess pages, exec-preview (token-scoped client), and the secrets re-scan of all commits since 9686132f. CSP `unsafe-eval`/`unsafe-inline` remains as the known deferred item.

---

## 3. Performance

### P1 (Critical). Corporate emissions calculation runs in the browser with an N+1
[lib/calculations/corporate-emissions.ts:321](lib/calculations/corporate-emissions.ts:321) issues one `product_carbon_footprints` query per production-log row (the lookup depends only on `product_id`): 5 products logged weekly for a year = 260 queries for 5 distinct rows. The whole cascade runs client-side via the browser Supabase client (~100ms per round trip) from `useCompanyFootprint` and worst of all the scope-1-2 trends tab, which runs it once per reporting year in a `Promise.all` ([app/(authenticated)/data/scope-1-2/page.tsx:932](app/(authenticated)/data/scope-1-2/page.tsx:932)): ~1,300 round trips for one tab click.
**Fix:** dedupe to `.in('product_id', uniqueIds)` (2 queries total), and move the invocation server-side (an `/api/emissions/corporate?year=` route or precompute into `corporate_reports.breakdown_json`).

### P2 (High). Report PDF generation is synchronous and over budget
[app/api/reports/[id]/generate-pdf/route.ts:20](app/api/reports/[id]/generate-pdf/route.ts:20) runs corporate emissions twice (with P1's N+1), three Claude phases (one sequential), then PDFShift, in one synchronous POST. Realistic happy path 40-90s; `maxDuration = 120` is a Vercel convention Netlify ignores. Users get gateway timeouts after the Claude/PDFShift spend is already incurred. This violates the project's own "anything >30s must be Inngest" rule.
**Fix:** move to an Inngest function with `step.run` per phase; the client already polls `generated_reports.status`. Apply the same to the LCA PDF route (no duration config, PDFShift inline).

### P3 (High). `listFacilitiesWithIntensity` N+1 with `select('*')` on a JSONB-heavy table
[lib/facilityIntensity.ts:177](lib/facilityIntensity.ts:177): one query per facility, each dragging the `results_payload` JSONB to use 7 scalar fields. Replace with a single `.in()` query selecting named columns, first-row-per-facility in JS.

### P4 (Medium). React Query installed, used by 1 of ~95 hooks
`QueryProvider` is mounted and `@tanstack/react-query` is a dependency, but 95 hooks use raw `useEffect`+fetch with zero caching or dedup; every navigation refetches everything. Migrate the top ~10 hooks (`useCompanyFootprint`, `useSubscription`, `useSetupProgress`, pulse widgets) to `useQuery` with a few minutes' `staleTime`.

### P5 (Medium). Marketing pages ship full client bundles with framer-motion
997-line `'use client'` page bodies (`marketing/components/PlatformPageClient.tsx` etc.) pull full framer-motion (~34 kB gz) for fade-ins on every marketing route. Switch to `LazyMotion`/`m.` (~6 kB) or CSS scroll animations; `Terms/Privacy/Cookies` don't use motion at all and can drop `'use client'`.

### P6 (Medium). Unbounded snapshot scans in pulse routes
[app/api/pulse/peer-benchmark/route.ts:61](app/api/pulse/peer-benchmark/route.ts:61) fetches the org's entire `metric_snapshots` history (cron-generated, unbounded growth) to take latest-per-metric. Add a date window or a `DISTINCT ON` view.

### P7 (Medium). Leading-wildcard `ilike` scans in the factor-resolver fallback
[lib/impact-waterfall-resolver.ts:1174](lib/impact-waterfall-resolver.ts:1174): up to 3 `%name%` scans per unresolved material on `ecoinvent_material_proxies`; the btree index cannot serve them. Hit hardest exactly during gdt-server outages. One migration: `pg_trgm` + GIN index.

### P8 (Low). Dead jsPDF generators confirmed deletable
`lib/pdf-generator.ts`, `lib/enhanced-pdf-generator.ts`, `lib/passport-pdf-generator.ts`, `lib/pdf-chart-renderer.ts`, `lib/pdf/render-greenwash-pdf.ts` (~2,400 lines) have zero importers. Keep `jspdf` itself (live via the distributor brand-sheet export). Plus minor sequential awaits in `pulse/facility-impact`, the aggregator's initial fetches, and the scope-1-2 page load.

Index coverage on hot tables is otherwise good; pulse routes are generally well batched; list pages paginate.

---

## 4. Reliability

### R1 (Critical, verified). Stripe webhook loses revenue events
[app/api/stripe/webhooks/route.ts:39](app/api/stripe/webhooks/route.ts:39): `isEventProcessed` marks the event processed before the handler runs, and the handler catch returns 200. A transient DB failure during `handleCheckoutSessionCompleted` permanently loses the activation: Stripe won't retry (got 200), and the event is already marked done. The in-memory Map is also per-lambda, so it provides no real idempotency either (duplicate audit rows, duplicate emails, grace-period restarts on cold-instance retries).
**Fix:** persist event IDs to a `stripe_webhook_events` table (`processed = false` on insert, `true` after success); return 500 on transient handler failure so Stripe retries. The subscription RPCs are already idempotent, so retries are safe.

### R2 (High). Inngest retries are dead code; jobs strand in non-terminal states
- [lib/inngest/functions/scraping.ts:146](lib/inngest/functions/scraping.ts:146) and [documents.ts:106](lib/inngest/functions/documents.ts:106): the worker step catches everything and returns an error payload, so the configured `retries: 3`/`retries: 2` never fire; one transient Gemini 429 marks the job terminally errored.
- [lib/inngest/functions/enrich.ts:155](lib/inngest/functions/enrich.ts:155): a persist failure after the atomic claim (`searched`→`ingesting`) makes the retry skip itself (`claimed_by_another_handler`), leaving the row stuck in `ingesting` forever; no `onFailure` handler and no stale sweep for `deep_enrich_jobs`.
- `runGroundedSearch` ([lib/ai/gemini.ts:452](lib/ai/gemini.ts:452)) is the one Gemini entry point with no `withTimeout`, which is the documented original incident class.
**Fix:** let transient errors throw from steps; add `onFailure` handlers that write `status: 'error'`; make the enrich claim self-retry-safe (`.in('status', ['searched','ingesting'])`); wrap grounded search in `withTimeout(90-120s)`.

### R3 (High). Xero: token-refresh race and the banned cron pattern
- [lib/xero/client.ts:55](lib/xero/client.ts:55): the refresh lock is a per-process Map; the daily cron and a user-triggered sync on different lambdas both refresh with the same rotating token and whichever persists last may store a dead one, silently bricking the connection until re-auth.
- [app/api/cron/xero-sync/route.ts:65](app/api/cron/xero-sync/route.ts:65): sequential full sync of every org in one synchronous invocation; a mid-loop kill silently skips later orgs and strands `xero_sync_logs` at `started`. This is exactly the 300s-ceiling pattern CLAUDE.md bans.
**Fix:** atomic DB-level refresh claim (`UPDATE ... WHERE refresh_token = $old RETURNING`); convert the cron to Inngest fan-out (one event per org), like scraping.

### R4 (Medium). SlideSpeak pipeline stuck states
`supabase/functions/generate-sustainability-report/index.ts:556`: a failed `slidespeak_task_id` store is only logged, after which neither the webhook nor manual sync can ever match the report (stuck at `generating_document`, no recovery path). Lost webhooks have no automated fallback, and no SlideSpeak fetch sets a timeout. Also: the sync route never checks org membership before returning `document_url` for any report ID.
**Fix:** treat task-id-store failure as fatal; add an Inngest sweep polling non-terminal reports older than ~15 min; `AbortSignal.timeout(15s)` on fetches; add the org check.

### R5 (Medium). Input validation: 22 of 395 routes use zod; NaN flows into emissions columns
Sampled write routes: [app/api/pulse/targets/route.ts:74](app/api/pulse/targets/route.ts:74) (`Number(body.baseline_value)` with presence check only), [app/api/production-run-resource-data/route.ts:120](app/api/production-run-resource-data/route.ts:120) (eight unguarded `parseFloat`s on emissions inputs), `facility-production-volumes` (same, plus `!production_volume` rejecting a legitimate 0). Malformed bodies become 500s or silently persisted nulls in calculation-feeding columns.
**Fix:** shared `parseFiniteNumber()` helper plus zod rollout, write-routes-first (pulse, production data, facility data).

### R6 (Medium). Inngest tick claim steps ignore DB errors
`scraping.ts:89`, `documents.ts:70`: the claim UPDATE's error is unchecked; on failure the events still fan out while rows stay `queued`, so the next tick re-dispatches the same jobs (duplicate findings). Check the error and throw.

### R7 (Low). Missing timeouts elsewhere
Geocode (Google Maps fetch), Anthropic SDK call sites (default 10 min timeout far exceeds any route budget; pass `timeout: 30_000`), Gemini interactive paths (`runToolLoop`/`streamToolLoop`/`extractStructured`). PDFShift retry has no backoff delay.

Verified solid: the Inngest architecture overall (claim/fan-out, stale-`running` recovery, signing-key verification), the OpenLCA client (timeouts, backoff, 4xx no-retry), the post-incident `live_databases_degraded` surfacing for EF search (the remaining gap: PCFs calculated during an outage carry no "degraded" flag for later re-run), the SlideSpeak webhook receiver, and the Xero sync stage error handling.

---

## What is sound (checked, no findings)

- FY-aware period windowing itself (`lib/log-data/period-utils.ts`): correct including Feb-29 and FY-straddle cases; calendar-year orgs unchanged; tests green. The residual risks are the pro-rating/suppression gaps (B7), already acknowledged as deferred.
- End-of-life factor library sign conventions, allocation-method scaling, regional default sum-checks (the prior glass misclassification fix is in place).
- Transport/distribution tonne-km maths, grid factors, GWP constants, wastewater Tier-1 factors, arable LUC amortisation.
- The May security review's entire remediation set (regression-checked).
- `pnpm tsc --noEmit`: 0 errors. All targeted tests for currently-modified files pass.

## Suggested fix order

1. **B1 + B2** (recycled double credit, excluded transport): both misstate published LCA headline numbers, in opposite directions. Fix together and recalculate affected PCFs.
2. **S1 + S2** (carbon-budgets IDOR, greenwash SSRF): one-line membership check and reuse of existing `safeFetch`. Ship same day, plus the `.gitignore` hardening (S4).
3. **R1** (Stripe webhook): protects revenue events; small DB table + status-code change.
4. **B3 + B4** (natural gas, maturation ABV): large per-product errors for the core customer base.
5. **B5** (OpenLCA misclassification): currently uncommitted, fix before it lands.
6. **B6 + B7** (Scope 3 double counts, suppression/pro-rating): corporate inventory credibility.
7. **R2 + R3** (Inngest retries, Xero): silent data-pipeline decay.
8. **P1 + P2** (corporate emissions N+1 + server-side move, PDF generation to Inngest): biggest user-visible latency and timeout wins.
9. Then the mediums: validation rollout (R5), error-message sweep (S5), React Query adoption (P4), cache/category completeness (B10/B12), factor consolidation (B15).
