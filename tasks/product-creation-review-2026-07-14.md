# Product Creation: Full Review and Diagnosis

**Date:** 14 July 2026
**Scope:** the entire product creation journey, from importing products from a URL through ingredients, smart uploads, packaging, maturation, production, the LCA wizard and engine, to multipack cradle-to-grave LCAs.
**Method:** seven parallel deep-review passes (URL import, ingredients/recipe, smart upload ingest, packaging/EPR, maturation/production, LCA wizard/engine, multipacks + end-to-end UX), each briefed on known past bugs so fixes were verified rather than rediscovered. One finding (the URL import materials bug) was verified empirically against the local prod-baseline database. All findings are in committed code unless noted; the uncommitted working-tree changes were reviewed separately and are clean.

Roughly 100 distinct findings after deduplication. Several were independently found by two or three reviewers, which raises confidence in them. This report groups them by impact, then gives a prioritised fix list and UX/admin-reduction recommendations.

---

## Executive summary

The platform's core engineering is genuinely strong: the maturation calculator, the aggregator's ISO 14067 consistency machinery, the shared packaging row builder, the smart-upload classifier design and the SSRF-hardened scraper are all above commercial-tool standard. The problems cluster at **the seams between subsystems**: data written by one surface that another surface never reads, UI conventions one flow breaks, and a client-side-only calculator that nothing invalidates when server-side data changes.

The six most consequential findings:

1. **Packaging is divided by the batch bottle count in per-batch and production-chain modes**, but the packaging UI only ever collects per-unit weights. A 1,000-bottle batch under-counts all packaging 1,000x. Packaging is usually the largest single contributor for drinks, and every product built on the six seeded production-chain templates (whisky, gin, beer etc.) is affected. Found independently by two reviewers.
2. **URL import's packaging and ingredient rows are silently never saved.** Every insert omits `unit`, the DB check constraint rejects the row, and the route never checks the result. Verified against the local database. The entire materials branch of the import feature is dead code in production. The fix is one line.
3. **End-of-life pathway choices made in the LCA wizard are silently discarded.** The wizard keys pathways by `product_materials.id`; the aggregator looks them up by the freshly inserted PCF material row id. The keys can never match, so the wizard preview and the final report show different EoL numbers.
4. **Changing the system boundary after calculating never forces a recalculation.** A user can calculate cradle-to-gate, flip to cradle-to-grave, and publish a report titled cradle-to-grave containing gate-only numbers (or the inverse, overstating a gate claim).
5. **Self-grown arable ingredients contribute exactly zero to the LCA.** The factor resolver zeroes them "to avoid double counting", but farm-level injection only exists for vineyards and orchards. A distiller's self-grown barley footprint silently vanishes.
6. **Multipack cradle-to-grave LCAs never check component boundary consistency.** Component PCFs are summed regardless of their own system boundary, so a "cradle-to-grave" case of 24 bottles can omit end-of-life for all 24 bottles, or double count distribution, with no warning. Multipack transport weight also defaults to the shipper box alone (~30x understatement).

There is also one genuine cross-org security hole (LCA review comment updates), two API routes that accept an unvalidated organisation id into service-role queries, and a structural architecture risk: **the calculator is client-side only and nothing tracks staleness**, so smart uploads, imports and admin edits leave published footprints silently out of date until a human clicks Recalculate.

---

## 1. Calculation errors (numbers are wrong today)

### Critical

| # | Finding | Where |
|---|---------|-------|
| C1 | **Packaging divided by batch divisor.** In `per_batch` and production-chain modes every `product_materials` row is divided by `bottlesPerBatch`, but only the ingredient UI collects per-batch quantities; the packaging UI is strictly per-unit and the live preview applies no divisor. Packaging collapses towards zero and the "implausibly light" warning fires as a side effect. | `lib/product-lca-calculator.ts:1499,1530,3120` |
| C2 | **Self-grown arable ingredients are zeroed with no farm-level injection.** Resolver returns all-zero for `is_self_grown`; calculator injects farm impacts for vineyards and orchards only. The recent fix that made `arable_field_id` survive saves makes this gap reachable in practice. | `lib/impact-waterfall-resolver.ts:497`, `lib/product-lca-calculator.ts` (no arable path) |
| C3 | **Wizard EoL pathway edits silently discarded.** `eolConfig.pathways` keyed by `product_materials.id`; aggregator looks up by the new PCF material row id. Only the legacy factorKey fallback works, and the wizard no longer writes factorKey keys. | `EndOfLifeStep.tsx:155-227` vs `lib/product-lca-aggregator.ts:645` |
| C4 | **Reusable containers amortise production but dispose full mass every unit.** The calculator writes PCF material rows without `reuse_trips`, `recyclability_percent`, `end_of_life_pathway`, `container_material` or `matched_source_name` (most columns do not exist on that table), yet the aggregator's EoL loop reads all five. A firkin with 100 trips gets production divided by 100 but its full 9 kg disposed on every pint: the exact 100x EoL over-count a code comment claims to prevent. | `lib/product-lca-calculator.ts:1941-2023` + `lib/product-lca-aggregator.ts:599-704` |
| C5 | **Boundary change after calculation never recalculates.** Autosave writes the new boundary onto a PCF whose `aggregated_impacts` were computed under the old one; `finishWizard` does not re-run aggregation despite a comment claiming it does. Step re-anchoring also marks the calculate step and the new phase steps as already complete. | `WizardContext.tsx:1016-1031,1219,1415-1449` |
| C6 | **Duplicate ingredient names corrupt impacts.** Factor resolution and pinning maps are keyed by `material_name`; two rows named "Cane Sugar" (300 g and 20 g) both read the same quantity-scaled result, booking one of them twice. | `lib/product-lca-calculator.ts:1439,1489-1524` |
| C7 | **Direct-run electricity divided by a defaulted volume of 1.** When allocation volume is blank/zero/unparseable, a whole production run's kWh lands on one unit (a 10,000-bottle run's 4,000 kWh becomes ~1,000 kg CO2e per bottle), guarded only by console warnings. | `lib/product-lca-aggregator.ts:435`, `lib/product-lca-calculator.ts:1073-1116,1397-1410` |
| C8 | **Multipack boundary mixing and transport weight.** Component PCF totals summed with no `system_boundary` check (missing or double-counted lifecycle stages, no warning); distribution weight autofill uses the shipper box alone for multipacks (~30x under) and the material-sum path ignores batch allocation and `units_per_group` for single SKUs (overstatement by the batch/pack factor). `Math.max(0, ...)` also silently zeroes net-negative components. Non-climate categories (water, land etc.) carry only the shipper box with no caveat. | `lib/product-lca-calculator.ts:443-471`, `DistributionStep.tsx:54-119`, `lib/product-lca-aggregator.ts:619-633` |

### High

| # | Finding | Where |
|---|---------|-------|
| C9 | **EPR tonnage never divides shared packaging by `units_per_group`.** A 24-pack trade case is counted once per bottle: 24x over-declared tonnage and fees. The LCA side divides correctly; none of the three EPR routes even select the column. | `app/api/epr/obligation/route.ts:120`, `calculate-fees/route.ts:152-153`, `generate-submission/route.ts:206` |
| C10 | **`epr_material_type` is never written by normal flows**, so every normally created packaging row falls to the `other` RPD code and the wrong fee rate. The completeness checker does not flag it. | `lib/products/packaging-material-data.ts`, `app/(authenticated)/epr/page.tsx:255-279` |
| C11 | **EPR submissions read legacy `component_*_weight` columns that only bulk-import writes.** The recipe editor's EPR Material Breakdown writes `packaging_material_components`, which no EPR route reads. Users who fill the component editor get submissions that ignore it. | `app/api/epr/generate-submission/route.ts:127-132,199-200` |
| C12 | **Per-litre BOM dosages can import unscaled.** Items are relabelled `per_unit` even when scaling failed for lack of a finished size, and Import is not gated on size being known. A 2 g/L dosage on a 250 ml can saves as 2 g per unit: 4x overstatement, no flag. | `BOMImportFlow.tsx:877-888`, `BOMReviewTable.tsx:293` |
| C13 | **Refrigerant leakage uses a flat HFC-134a GWP (1430) in product LCAs** and never selects `refrigerant_type`, while the company Scope 1/2 page resolves per-type GWP (R-404A = 3922). Product LCAs understate ~2.7x and disagree with the company report built from the same rows. | `lib/product-lca-calculator.ts:916,953` vs `data/scope-1-2/page.tsx:388` |
| C14 | **Count-unit quantities multiplied by per-kg factors with no denominator check.** "6 units" of closures matched to a per-kg aluminium factor books 6 kg of aluminium. | `lib/impact-waterfall-resolver.ts:386-388,729,1373,1547` |
| C15 | **Recycled-content credit is a flat x(1 - pct x 0.5) for all materials**, understating aluminium (~95% saving) and overstating glass (~25%), and it is applied even when the resolved factor already embeds recycled content: a double credit nothing warns about. | `lib/product-lca-calculator.ts:1654-1691` |

### Medium

- **C16. Maturation silently dropped from the persisted LCA** when `product_type` fails an eligibility check the UI does not share (the recipe editor's Maturation tab uses a different, broader rule). Only a `console.warn`; never pushed to the user-visible warnings channel. `lib/product-lca-calculator.ts:2080-2086` vs `RecipeEditorPanel.tsx:315-317`.
- **C17. Warehouse country silently overridden** by the primary production facility's country whenever facility allocations exist; the profile field exists and the previews use it. Distil in Ireland, mature in Scotland: persisted CO2e uses the Irish grid. `product-lca-calculator.ts:2090-2096`.
- **C18. Maturation preview vs persisted divergence on ABV fallbacks**: preview falls back to category-default bottle ABV, the persisted calculator assumes no dilution; per-bottle maturation CO2e can differ by up to 75% between what the card shows and what is saved. `SpecificationTab.tsx:52-64` vs `product-lca-calculator.ts:2102-2106`.
- **C19. Evaporation losses never uplift upstream burden** in per-unit mode: the ~18% of spirit lost over 10 years carries no grain/new-make footprint onto surviving bottles. Aged-spirit ingredient footprints systematically understated.
- **C20. Two unreconciled allocation denominators** in production-chain mode (bottling output vs maturation bottled output); `deriveBottlesPerChain`, written to define the precedence, is dead code. `product-lca-calculator.ts:1457-1478,2129-2133`.
- **C21. Warehouse energy double count and scope misclassification**: maturation warehouse kWh counted again via facility allocation if the same site is linked, and all maturation rows are booked Scope 3 even for owned warehouses. `lib/product-lca-aggregator.ts:341-348`.
- **C22. Viticulture allocation ignores the entered quantity**, mixes multi-vintage averaged numerators with the latest vintage's yield, assumes 100% of estate yield becomes this product, and contains a vestigial no-op ternary. `product-lca-calculator.ts:2359-2412`.
- **C23. Material classification degrades at aggregation time**: PCF material rows lack `matched_source_name`/`container_material`, so EoL classification falls back to name keywords. "330ml Can" classifies as `other` (there is no generic can-to-aluminium mapping), "Pet Nat" matches PET, "PP Label" hits the paper rule. Unknowns get the harsh 1.5 kg CO2e/kg incineration factor. `lib/product-lca-aggregator.ts:638-640`, `lib/end-of-life-factors.ts:355-379`.
- **C24. `is_biogenic_carbon` reclassifies transport and container carbon as biogenic** (fossil set to 0 after DEFRA transport and container carbon were added). Headline unchanged; ISO fossil/biogenic disclosure wrong. `product-lca-calculator.ts:1976-1977`.
- **C25. Batch repropagation silently downgrades boundary to cradle-to-gate** when `last_wizard_settings` is missing, superseding a published grave footprint with a gate one, reported as "done". `lib/utils/recalculate-product-lca.ts:52`.
- **C26. Retail refrigeration lives inside use-phase config**, so cradle-to-shelf studies exclude retail chiller energy entirely; and all carbonation CO2 is booked biogenic even for fossil-derived industrial CO2 in soft drinks. `lib/use-phase-factors.ts:22-36`, `aggregator:525-528`.
- **C27. Facility kWh reporting ignores the overlap pro-rating applied to emissions**, so the report's energy table will not reconcile with its CO2e. `product-lca-calculator.ts:1211-1215`.
- **C28. ISO 14067 audit log is dead code**: `resolved_factor_id` never reaches persisted material rows, so `calculation_logs` never receives a row and factor traceability is silently absent. `product-lca-calculator.ts:3172-3178`.
- **C29. Missing BOM quantities become 0 placeholders, then vanish at save** ("7 ingredients saved" when 9 were imported); and `convertToGrams` treats any non-kg/g unit as grams (a bottle at "1 unit" becomes 1 g). `BOMImportFlow.tsx:403-404,931-942`, `useRecipeEditor.ts:563`.
- **C30. Extracted ABV displayed then thrown away** by URL import confirm; users re-type it per product. `confirm/route.ts:132-145`.
- **C31. Fertiliser origin split leaves 5% unclassified** on viticulture/orchard rows, below the aggregator's reconciliation threshold. `product-lca-calculator.ts:2452-2454,2797-2799`.

---

## 2. Data-loss and integrity bugs

### Critical

- **D1. URL import materials never saved** (missing `unit` violates `product_materials_unit_check`; insert result never checked; verified against the local DB). Users re-enter everything the import already extracted. `app/api/products/import-from-url/confirm/route.ts:244-251,280-287`.
- **D2. A single material resolution failure hard-deletes the user's draft PCF**, destroying goal/scope text, ISO fields and wizard progress. Even without deletion, a failed calculation strands the draft at `pending`, which the wizard's resume lookup (`status='draft'`) never finds: next open starts blank and creates a second row. A known failure mode (OpenLCA cert expiry) triggers this. `lib/product-lca-calculator.ts:2035,545-568`, `WizardContext.tsx:466`.
- **D3. Superseded completed PCFs are demoted to `draft`** (the schema has a `superseded` status the code believes does not exist) and, because supersede bumps `updated_at`, the wizard resumes the just-superseded historical record as "where you left off" and can promote it back to completed. Version history becomes a shell game. `lib/product-lca-aggregator.ts:1465-1485`.
- **D4. The review state machine does not exist in practice**: `ready_for_review` and `approved` violate the status CHECK, the updates are never error-checked, and the routes return success anyway. (Had they succeeded, every `.eq('status','completed')` consumer would have stopped seeing the approved PCF, so the status design needs revisiting, not just the constraint.) `app/api/lca/[id]/review/route.ts:146-149`, `approve/route.ts:83-86`.

### High

- **D5. BOM import mints `ing-`/`pkg-` tempIds** where every save path classifies rows by `temp-` prefix: imported rows are treated as existing, updated `.eq('id','ing-...')` against a uuid column, autosave toasts an error every 8 seconds, and imported packaging cannot be persisted at all. `BOMImportFlow.tsx:396,416` vs `useRecipeEditor.ts:644-645,852-853,912-913`.
- **D6. The dirty-detection fingerprint omits exactly the fields the last recipe fix rescued** (self-grown links, biogenic flag, inbound container fields, transport legs, stage, EPR fields, factor swaps that keep the same status...). Edits to those fields never schedule autosave, never set `isDirty`, never trigger the leave warning. The save path is now lossless but these edits frequently never reach it. `useRecipeEditor.ts:84-104`.
- **D7. Manual Save Ingredients is a non-atomic wipe-then-write**: rows are deleted before the insert that can still fail (one bad row loses the recipe), and a mid-edit row with a cleared amount is silently deleted where the packaging path warns and keeps it. `useRecipeEditor.ts:579-598`.
- **D8. In-flight autosave races the manual save** (cancel only clears the pending timer) and can re-insert rows after the wipe: a fresh route to the old tripled-ingredients symptom. `useRecipeEditor.ts:562,1012`, `useAutoSave.ts:30-35`.
- **D9. Stuck ingest jobs**: files at or under 5MB are classified inline inside a 26s lambda budget; a 60-page PDF gets the lambda killed mid-await, the job sticks at `extracting` forever, and the stuck-job rescue only handles `pending`. Retrying repeats the identical failure. `app/api/ingest/auto/route.ts:19,26,444`, `[jobId]/route.ts:36-40`.
- **D10. Production URL-import dispatch is fire-and-forget** (`void fetch` then return): on Lambda the instance can freeze before dispatch, leaving jobs at `pending` forever; no janitor exists. `app/api/products/import-from-url/route.ts:107-117`.

### Medium

- **D11. Packaging autosave rewrites EPR component child rows with unchecked errors**: delete succeeds, insert fails, breakdown silently blanked (the old bug's symptom via a new path). Manual save checks both; autosave checks neither. `useRecipeEditor.ts:979,991-1001`.
- **D12. Removing all components (or unticking breakdown) never deletes child rows**; orphans reappear on reload. `useRecipeEditor.ts:715-743,294`.
- **D13. Removing the last ingredient can never be persisted** (autosave returns early on empty, manual save rejects); it reappears on reload. `useRecipeEditor.ts:566-568,850`.
- **D14. 0% recycled content cannot round-trip on the parent packaging row** (0 becomes null at save, null becomes blank at load); the earlier fix covered only the EPR component editor. Same collapse in the multipack builder. `lib/products/packaging-material-data.ts:94`, `useRecipeEditor.ts:328`, `lib/multipacks.ts:61`.
- **D15. Multipack creation swallows packaging insert failures** and reports success; the shipper box never reaches the DB and the footprint calculates without it. `lib/multipacks.ts:460-463`.
- **D16. Multipack packaging form's material type and notes discarded on save**, so EoL classification falls back to name inference ("Shrink Wrap" with Foam selected classifies by the name string). `lib/multipacks.ts:49-77`.
- **D17. Packaging templates drop reuse trips, recyclability, EoL pathway, carbon intensity, container fields and transport legs**: applying a keg template silently loses its 150 trips (150x production over-count on the new product). `hooks/data/usePackagingTemplates.ts:54-123`.
- **D18. Ingest packaging endpoint is append-only** with no dedupe: re-uploading a spec doubles every row, the footprint and the EPR tonnage; and it defaults `units_per_group` to 1 for shared roles, charging a 12-bottle shipper once per bottle. `app/api/products/[id]/packaging/route.ts:80,85`.
- **D19. Maturation profile deleted on one unconfirmed click** (hard DB delete, ~14 fields); and an explicit 0 barrel CO2e override is coerced back to the 40-65 kg default. `MaturationProfileCard.tsx:286-296`, `useRecipeEditor.ts:777,817-843`.
- **D20. EF metadata (`ef_source`, quality grade, uncertainty, reference unit) never persisted**, so quality tooltips empty on reload and the unit-mismatch check disarms. `lib/products/ingredient-material-data.ts`.
- **D21. Component product deletion cascades silently out of multipacks**; the multipack keeps its stale total until a recalc silently drops the component. Baseline schema `ON DELETE CASCADE` + delete handlers.
- **D22. Claude extraction capped at 4096 output tokens on URL import**: large catalogues (~40+ products) truncate, failing opaquely or silently dropping products. `import-from-url-background.ts:616-618`.
- **D23. Classifier serialisation caps spreadsheets at 100 rows/sheet and the BOM flow skips re-parsing when any items exist**: a 150-line recipe imports ~100 lines with no truncation flag. `lib/ingest/spreadsheet-text.ts:30-31`, `BOMImportFlow.tsx:228-234`.

---

## 3. Security findings

- **S1. HIGH. Cross-org write hole in LCA review comment updates**: the route verifies the caller owns the PCF in the URL, then updates the comment by id alone with the service-role client; nothing checks the comment belongs to that PCF. A member of Org A with any comment UUID from Org B can set Org B's critical review comments to `rejected`/`addressed`, gaming their ISO critical-review gate. `app/api/lca/[id]/review/comment/[commentId]/route.ts:57-62`.
- **S2. HIGH. `/api/ingredients/search` walks supplier data for an unvalidated `organization_id`** with the service role: any authenticated user can enumerate another org's linked suppliers, product names and factor usage. `app/api/ingredients/search/route.ts:321,397-428,696`.
- **S3. HIGH. URL-import confirm writes org-level rows (`organization_certifications`, `agent_exceptions`) via service role with an unvalidated body `organizationId`** and no membership or `denyReadOnlyAdvisor` check anywhere under `import-from-url/`. The product insert is only accidentally safe because it uses the cookie client (RLS applies); one refactor to the folder's sibling pattern makes it an arbitrary cross-org write. `confirm/route.ts:85-160,320-405`.
- **S4. MEDIUM. EPR PRN and submission routes accept read-only advisors for writes** (their shared auth helper accepts any advisor access grant without `denyReadOnlyAdvisor`/`guardOrgWrite`). `app/api/epr/prn/route.ts:114-192`, `generate-submission/route.ts:296-342`.
- **S5. MEDIUM. `multipack_components` RLS validates the multipack's org but not the component's**: any service-role path walking components would fold a foreign org's product name and footprint into output; `createCompleteMultipack` does no ownership check either. Baseline schema:37028-37030.
- **S6. MEDIUM. Save routes resolve the org implicitly** (`resolveAccessibleOrg` with no `requestedOrgId`) while the upload was classified under an explicit client org: multi-org users and advisors can write extracted spend/packaging into the wrong org or get inexplicable 404s. `products/[id]/packaging`, `spend/invoice`, `supplier-products/evidence` routes.
- **S7. MEDIUM. Advisor access inconsistencies**: write-access advisors get a hard 403 saving historical reports (member-only check); read-only advisors are locked out of review reads (`resolveUserOrganization` instead of the advisor-aware resolver, unlike the sensitivity/interpretation routes which do it correctly). `app/api/ingest/historical/route.ts:47-53`, `app/api/lca/[id]/review/*`.
- **S8. LOW. Supplier evidence copies use `getPublicUrl`**: confirm the bucket is private and signed-URL served, or filed CoAs are world-readable. `supplier-products/evidence/route.ts:84`.
- **S9. LOW. No rate limiting on URL-import enqueue** (each run costs ~10 fetches plus a Sonnet call); the ingest rate limiter is an in-memory per-lambda Map that resets on cold start and does not bound spend across instances.
- **S10. INFO. Prompt injection surface in ingest is real but reasonably bounded** (tool-schema-constrained output, human review before save, sanitised hint re-injection). Residual risk is a user rubber-stamping fabricated figures from a malicious document.

---

## 4. Architecture risk: client-side calculation with no staleness tracking

The single biggest structural risk (flagged by three reviewers from different angles):

`aggregated_impacts` and `products.latest_lca_carbon_footprint` are written once, client-side, at calculation time. The only staleness guard compares `product_materials.updated_at`, runs only at PDF generation, and can be bypassed. Nothing checks facility utility entries, production runs, growing profiles, maturation profiles, grid factors, staging factors, or multipack component recalculations. Smart uploads, bulk imports, URL imports and admin edits all mutate these server-side with no recalc trigger and no visible flag. Concrete symptoms found:

- A component product's recalculated LCA never invalidates multipacks containing it (the staleness banner is materials-only and renders only inside the recipe editor, which multipacks never open).
- The wizard can resume into an older PCF than the one the product page displays (`updated_at` vs `created_at` ordering disagreement).
- The client-side factor cache never warms, so wizard numbers and server-computed numbers drift via built-in constants vs DB reference factors.

**Recommendation:** compute a server-side `inputs_hash` on the read paths (the fingerprint machinery already exists in the calculator but is write-only today), store it on the PCF, and surface a consistent "this footprint is out of date" banner with one-click recalculate on the product page, passport, Pulse and reports. Longer term, queue recalculations through Inngest when inputs change rather than relying on a human clicking Recalculate.

---

## 5. UX, flow and admin burden

### Broken or dead-end experiences

- **U1. Archiving a product does nothing the user can see**: it sets `is_draft = true`, toasts success, and the product reappears everywhere unchanged, because no surface filters or badges the overloaded flag. Needs a real `archived_at` column or at minimum a badge and filter. `products/[id]/page.tsx:56-74`, `products/page.tsx:130-139`.
- **U2. Multipacks cannot be edited after creation**: the component editor functions have no UI consumer and the contents card's Edit button routes to a Specification tab with no multipack handling. Only path is delete-and-recreate. Multipack creation is also all-or-nothing (no Save Draft; client state lost on navigation).
- **U3. URL import gives up at 3 minutes while the job runs up to 15**, the dialog says "up to a minute", one transient poll failure kills the whole flow, and the success screen shows the client-side count rather than what the server actually created.
- **U4. Ingest jobs are invisible**: closing the dialog mid-analysis orphans a completed job with no user-facing jobs list, so the only option is to re-upload and re-pay for classification. Stashes also accumulate forever (no TTL). Batch uploads silently discard remaining files when any file hands off to a wizard.
- **U5. Dead links and orphaned pages**: the distribution and end-of-life "Coming Soon" stubs link to `/products/[id]/lca/initiate`, which 404s; `calculate-lca/page.tsx` (1,158 lines), `products/detail` and `ProductActions` have no inbound links. Worse, the legacy Manage Materials page still reachable from `ProductActions` lets users create bare packaging rows that bypass the shared builder, are invisible to EPR, and let LCA and EPR weights diverge: the exact inline-builder pattern Phase 1 was meant to eliminate.
- **U6. CSVs cannot be selected via click-to-browse** in the dropzone (drag-drop works); Rosa's input bar accepts them, so behaviour differs by entry point. Reclassify is a dead end for >5MB files (told to re-upload into the same classifier, no forced-type path).
- **U7. Shopify fast-path imports the entire catalogue** (merch, gift sets) pre-ticked, defaulting everything to "Spirits", where the Claude path filters correctly.

### Friction and terminology

- **U8. Multipack copy speaks single-SKU language** ("Please add ingredients and packaging", "Ingredients 0 added", "All 0 materials have verified emission data") and never mentions that component footprints arrive at the Calculate step.
- **U9. CTA terminology drifts**: "Create LCA", "Run LCA", a route named `compliance-wizard`, and "carbon footprint analysis" read as three different features. House rule is that the user-facing term is always "LCA".
- **U10. The wizard is up to 14 steps** and silently pre-fills boilerplate ISO text into goal/cut-off fields, which both hides the jargon problem and weakens the documentation's honesty; label the defaults ("standard text, edit if needed") instead of injecting invisibly. The functional unit also flip-flops between a crude string written at calculation and the composed boundary-aware one written on autosave.
- **U11. Multipack picker gives no indication which products have a completed LCA**, so users discover missing component footprints only after calculating (the calculation completes with a confident headline that quietly omits them).
- **U12. False-alarm warnings**: the "shared packaging with no valid units_per_group" warning fires on explicit 1s (every multipack recalc), and "Suggest defaults" overwrites an explicit supplier-declared 0% recycled content because of a falsy check.
- **U13. Em dashes and copy rules**: user-facing em dashes in BoundaryStep, DistributionStep, MaterialValidationStep, RecipeStalenessBanner, the import page and ingredient dialogs (house rule: never).
- **U14. Maturation "avoided burden" allocation is accepted by the DB and types but no UI exposes it and the calculator ignores it**; methodology notes hardcode cut-off.

---

## 6. Recommendations

### P0: fix now (numbers wrong or data being lost)

1. **URL import materials**: pass a valid `unit` on every `product_materials` insert in the confirm route and check insert errors. One line resurrects the feature. Also map extracted ABV to `alcohol_content_abv`.
2. **Stop dividing packaging by the batch divisor** in per-batch and production-chain modes (scope the divisor to ingredient rows). This is the largest live calculation error.
3. **Fix EoL pathway keying**: carry the originating `product_materials.id` onto PCF material rows and key `eolConfig.pathways` lookups on it.
4. **Add the circularity columns to `product_carbon_footprint_materials`** (`reuse_trips`, `recyclability_percent`, `end_of_life_pathway`, `container_material`, `matched_source_name`) and copy them at calc time, so reuse amortisation, recyclability caps and material classification survive into the report. This one change fixes C4, C23 and most of the EoL seam.
5. **Force recalculation (or hard-invalidate results) when the system boundary changes** after a calculation, and stop marking the calculate step complete on re-anchor.
6. **Stop hard-deleting draft PCFs on calculator failure**; mark them `failed` and let the wizard resume from `draft` or `failed`. Use the schema's `superseded` status instead of demoting old completed PCFs to `draft`.
7. **Fix the review flow**: use status values the CHECK allows (or extend it deliberately), check update errors, and rework the comment-update route to verify the comment belongs to the PCF (`verifyPcfAccess` pattern). Closes the cross-org hole at the same time.
8. **Key factor resolution and pinning by row id, not material name.**
9. **Guard the direct-run divisor**: refuse to complete (or surface a blocking warning) when allocation volume is missing rather than defaulting to 1.
10. **Arable self-grown**: either inject arable farm-level impacts like vineyards/orchards, or stop zeroing arable rows until the injection exists (fall back to the market factor with a warning).
11. **BOM import**: gate the Import button on a known finished size (or import as per-litre and scale at save), mint `temp-` tempIds, and stop relabelling unscaled items `per_unit`.
12. **EPR**: divide shared packaging by `units_per_group`, write `epr_material_type` from the shared builder, and make submissions read `packaging_material_components`.
13. **URL import dispatch**: await the background trigger; add a janitor for stuck `pending`/`extracting` jobs and extend the client poll to match the real job budget.
14. **Ingredients search and import-confirm org validation**: validate membership of the supplied org id before any service-role query; add `guardOrgWrite`/`denyReadOnlyAdvisor` to the EPR PRN and submission writes.

### P1: fix soon (integrity, consistency, trust)

15. Server-side staleness: `inputs_hash` on PCFs, staleness banner on every surface, Inngest recalc queue (Section 4).
16. Make saves atomic: upsert-style Save Ingredients (mirror autosave's keep-ids approach), make autosave truly cancellable, check errors on the packaging component rewrite, allow deleting the last ingredient.
17. Complete the dirty-detection fingerprint (or fingerprint the whole built row) so self-grown/biogenic/container/EPR edits autosave.
18. Multipack: boundary consistency check across components (block or warn on mismatch), full-pack transport weight default, edit-components UI, badge component LCA status in the picker, stop clamping negative components, staleness banner when a component recalculates, delete-warning when a product is in multipacks.
19. Maturation: unify the two eligibility rules (calculator vs tab), surface the drop as a visible warning, respect the profile's warehouse country, align preview and persisted ABV fallbacks, add the evaporation uplift to per-unit ingredient burden, dedupe warehouse energy against facility allocations and classify owned-warehouse energy Scope 1/2.
20. Refrigerants: resolve per-type GWP in the product calculator (the resolver already exists).
21. Recycled-content credit: per-material displacement rates and skip the multiplier when the factor already embeds recycled content.
22. Count-vs-kg factor guard: hard-flag any material whose unit class disagrees with the matched factor's denominator.
23. Packaging templates and multipack builder: carry full fidelity (reuse trips, pathway, material type, 0% recycled content).
24. Restore the factor audit log (`resolved_factor_id` onto persisted rows) for ISO traceability.
25. Route all ingest save routes through the explicit org id the review happened under.

### P2: UX and admin-reduction improvements

26. **Make archive real**: an `archived_at` column, badge and filter; keep `is_draft` for drafts only.
27. **One jobs inbox**: a user-facing list of ingest and import jobs (status, results, resume links) so closed dialogs and timeouts are recoverable instead of re-paid. Add a stash TTL.
28. **Kill the legacy surfaces**: delete the Coming Soon stubs, the dead `calculate-lca` page and the Manage Materials inline builder (or rebuild it on the shared row builder), and fix the 404 escape hatch.
29. **Unify terminology** on "LCA" across CTAs and routes; sweep the em dashes; multipack-aware copy on the product overview and validation steps.
30. **Reduce re-entry**: BOM/URL/ingest extractions should pre-fill everything they captured (ABV, materials, quantities with basis); supplier memory and previous-product cloning ("start from your last gin") for packaging and recipe; labelled ISO boilerplate rather than invisible injection.
31. **Shopify import parity**: apply the same merch/gift-set filtering and category inference as the Claude path; raise the extraction token cap or chunk large catalogues; report server-created counts on the success screen.
32. **Confirmation on destructive actions**: maturation profile delete, product delete when referenced by multipacks.
33. **Surface engine warnings**: the calculator and aggregator produce excellent plain-language warnings that die in `console.warn` (run intensity, factor traceability, maturation eligibility); route them all through `calculatorWarnings` so users see them in the report.

---

## 7. What works well

Worth stating plainly, because the foundations are strong and the fixes above are mostly seam-closing rather than rebuilding:

- **The engine's consistency machinery** is more rigorous than most commercial LCA tools: GHG species reconciliation, carbon-origin reconciliation, stage-sum checks, N2O plausibility capping, lognormal uncertainty, and the double-credit EoL warning.
- **The maturation calculator** is the strongest literature-grounded modelling in the codebase: sourced constants, compound angel's share, correct NMVOC treatment of ethanol loss, ISO cut-off barrel allocation, tested cask-to-bottle ABV dilution.
- **The smart-upload pipeline** shows real production scar tissue: HMAC-signed background jobs, stuck-job recovery, tool-schema-constrained classification with confidence capture, and a well-layered self-learning loop.
- **The URL import scraper** does SSRF protection properly (protocol allowlist, private-range blocking, per-hop redirect revalidation) and the Shopify fast path is a smart cost win.
- **The recipe surface** is the right shape for non-experts: multiple entry paths from a rich empty state, background auto-matching with one-click confirm, live impact previews, plausibility checks in the form and again in the calculator.
- **The Phase 1 unifications hold**: one shared packaging row builder behind every save path, the UUID/parseInt fix, delete-before-insert for the tripled-ingredients bug, `boundaryToDbEnum()` discipline, and the multipack-onto-product_materials migration that gave EPR, EoL and the Specification tab multipack support for free.
- **The uncommitted working-tree changes reviewed are clean** and two of them (guardOrgWrite on the packaging ingest route, the hectolitre-aware recalc allocations with tests) already close gaps in this report's scope.

The recurring theme is not sloppy code but **projection seams**: the editor works on `product_materials`, while the aggregator, EPR and reports work on projections that the modern save paths never fully populate, and a client-side calculator whose outputs nothing invalidates. Closing those seams (P0 items 3, 4, 12; P1 item 15) resolves a disproportionate share of the findings at once.
