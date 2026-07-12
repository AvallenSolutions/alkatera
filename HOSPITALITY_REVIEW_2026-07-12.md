# Hospitality Module Review

**Date:** 12 July 2026
**Scope:** Functionality, calculation accuracy, ease of data capture, gaps, and five improvement areas
**Method:** Four parallel code audits (data model, calculation engine, data capture UX, platform integration), cross-checked against `ALKATERA_HOSPITALITY_PLAN.md`, `alkatera_hospitality_claude_build_prompt.md` and `tasks/hospitality-todo.md`

---

## 1. Executive summary

The hospitality module does what it set out to do: a drinks producer with a restaurant, bar or rooms can model meals, made drinks and room nights, and those impacts flow into the organisational footprint as Scope 3 Category 1, with waste as Category 5. The architectural decision to make meals and drinks `products` rows (via `product_kind`) that reuse the existing LCA engine was the right one; it gives hospitality recipes real emission factors (OpenLCA, ecoinvent, Agribalyse, supplier data) rather than a bolted-on lookup table, and the double-counting guards (own wine served in the venue, room energy already in facility Scope 1/2) are well considered.

The main weaknesses are the inverse of that strength:

1. **Hospitality products leak into drinks surfaces.** The LCA report lists, the dashboard product spotlight and two Pulse metrics do not filter by `product_kind`, so meals and room nights pollute product-facing views and inflate "products assessed" and "LCA completeness" figures.
2. **The critical calculation path is almost entirely untested.** One small test file covers the per-cover divide; the Scope 3 rollup, the include/exclude toggle and every double-counting guard have zero test coverage.
3. **Meal footprints are cradle-to-gate only.** No cooking energy, no service packaging, no prep waste in the per-serving figure. Defensible if the venue's facility metering is complete, understated if it is not, and never explained to the user.
4. **Data capture is functional but high-friction.** Free-text ingredient entry with no factor override, importer output that requires reopening every dish, and no connection to Rosa or the smart upload pipeline.
5. **The shipped module is roughly 15 to 20 per cent of the two planning documents**, which is fine for a beta, but a few of the unbuilt pieces (per-cover normalisation against real covers data, energy allocation to hospitality, factor transparency on the public menu) matter for credibility.

None of these threatens the core proposition. The numbers that reach the company footprint are structurally sound. The work now is hygiene, trust and friction removal.

---

## 2. Functionality: what exists today

### 2.1 Architecture

Everything lives inside the main app behind the `hospitality_beta` flag (admin-granted per org, never tier-inherited). Route access is gated at `app/(authenticated)/hospitality/layout.tsx` via `FeatureGate`, and the sidebar group only renders with the flag. Nine additive migrations (19 to 21 June 2026) introduce the `hospitality_*` tables; the load-bearing move is the `product_kind` column on `products` (`product` | `hospitality_meal` | `hospitality_drink` | `hospitality_room_night`), enforced with a CHECK constraint and used everywhere as the discriminator. All hospitality tables carry consistent org-scoped RLS.

### 2.2 Surfaces

| Surface | What it does |
|---|---|
| `/hospitality` | First-run function chooser (meals / drinks / rooms), then impact dashboard with the "count in company total" toggle |
| `/hospitality/venues` | Restaurant / bar / accommodation venues, optionally linked to a facility |
| `/hospitality/meals`, `/drinks`, `/rooms` | One generic recipe manager and editor for all three kinds; ingredients auto-matched to emission factors; Calculate runs the shared cradle-to-gate LCA |
| `/hospitality/menus` | Menu builder mixing meals, made drinks and own products; publish generates a public slug |
| `/menu/[slug]` | Public QR carbon-label menu with low / medium / high banding |
| `/hospitality/sales` | Service volumes per period (the throughput multiplier), with CSV import, POS export-file import (Square, Toast, Lightspeed files, not live APIs) and copy-last-period |
| `/hospitality/waste` | Food and dry waste by treatment method, feeding Scope 3 Category 5 |
| Menu importer | PDF / image (Claude vision) or spreadsheet / CSV import that creates recipes from dish and ingredient names |

### 2.3 The organisational footprint link (the core purpose)

This works, and it is the most important finding of the review. `lib/calculations/corporate-emissions.ts` (the single source of truth) calls `calculateHospitality()` and adds the result to Scope 3 as Category 1, labelled "Hospitality service" in reports. The maths per product is:

```
contribution = (PCF scope 3 CO2e ÷ covers) × units_sold
```

with meals and drinks reported as `food`, room-night consumables as `supplies`, plus hospitality waste as Category 5. Inclusion is controlled by `organizations.report_defaults.include_hospitality` (default on); the figure is always computed and only added when enabled. Pulse and the sustainability PDF inherit it automatically because they call the same aggregator.

Three deliberate double-counting guards are in place and correct:

- Hospitality `product_kind` rows are excluded from the normal product LCA rollup in both aggregation paths.
- Own wine served in the venue is tagged `internal_consumption` on menu items and never enters the hospitality total (it is already in production figures).
- Room energy and water allocation is display-only ("already in facility Scope 1/2") and never re-added.

---

## 3. Accuracy of calculations

### 3.1 What is sound

- **Factor quality.** Ingredients resolve to OpenLCA / ecoinvent / Agribalyse or supplier primary data through the same auto-matcher the drinks products use, with sub-process rows rejected. This is far stronger than the typical hospitality tool's flat factor table.
- **Unit discipline.** Ingredient units come from the shared vocabulary and are converted inside the LCA engine; waste is always mass in kg; litres to m³ conversion in room allocation is correct; no premature rounding anywhere in the calculation path (rounding is display-only).
- **Reconciliation.** The standalone hospitality dashboard mirrors the same maths as the corporate rollup, so the two surfaces agree.

### 3.2 Accuracy concerns, in order of severity

1. **Cradle-to-gate scope for meals.** A meal footprint is ingredient production only: no cooking energy, no service packaging, no prep waste per serving. The design assumes kitchen energy is captured through facility Scope 1/2 and waste through the waste log, which is coherent for the org total but means the public per-dish label understates the true impact of serving the dish, and a producer without hospitality facility metering understates overall. The plan's kitchen-process factor library (section 4.2 of the plan doc) was never built. At minimum this boundary should be stated on the public menu methodology line.

2. **Placeholder quantity of 1.** Imported ingredients are seeded at quantity 1 (g for meals, ml for drinks) because `product_materials` enforces quantity > 0. The mitigation is real: footprints are never auto-calculated, and the user is warned in three places. But nothing stops a user pressing Calculate on an unedited imported recipe and publishing a wildly wrong label. There is no "quantities unconfirmed" state on the recipe, so the placeholder is indistinguishable from a deliberate 1 g entry once the dialog is dismissed.

3. **`units_sold` semantics are unvalidated.** The rollup assumes `units_sold` means individual servings. If someone logs batches, covers-of-four or bottle counts, the divide-by-covers multiply-by-units maths silently mis-scales. No copy or validation ties the two fields together.

4. **Scope 3 fallback can over-count.** `scope3Of()` falls back to the entire `climate_change_gwp100` when the PCF has no scope split. Roughly right for a cradle-to-gate meal today, but if a meal PCF ever carries Scope 1/2 the whole figure lands in Scope 3.

5. **Hardcoded values with no cited source.** Carbon band thresholds (low ≤ 1.0 kg, medium ≤ 3.0 kg per serving) are constants with a comment but no methodology reference, and are not org-configurable. The public menu legend independently hardcodes sample values (0.5 / 2 / 5) that must be kept consistent by hand. Room allocation embeds DEFRA gas (0.18293) and water (0.344/m³) factors rather than using the versioned reference factor sets.

6. **Occupancy is captured but never used.** `hospitality_room_allocation.occupancy` (default 2) is stored and echoed by the API but `computeAllocatedImpact` never divides by it, so the intended per-guest intensity is not actually computed.

7. **Waste treatment fallback.** Unknown treatment methods fall back to the landfill factor, which can over- or under-state depending on the actual method.

8. **Water and land never reach the org level.** The org rollup carries carbon only; per-serving water and land are hospitality-dashboard-only. Consistent with a carbon-only inventory, but worth knowing.

### 3.3 Test coverage

Effectively one test file: `lib/hospitality/__tests__/meal-types.test.ts`, covering only the per-cover division and its null handling. There are no tests for `calculateHospitality()`, the include/exclude toggle, any double-counting guard, carbon banding, room allocation, waste summarisation, menu impact maths, the dashboard service or any `app/api/hospitality/*` route. `corporate-emissions.test.ts` contains no hospitality references. Given that "these numbers reach the customer's reported footprint" is the whole point, this is the single biggest engineering risk in the module.

---

## 4. Ease of data capture

### 4.1 What works well

- **The generic recipe pattern.** Meals, drinks and rooms share one editor, so learning one flow covers everything. Creating a recipe is two screens: name + covers + venue, then ingredient rows.
- **Automatic factor matching with visible status.** Each ingredient row shows "Factor matched" / "Approximate factor" / "No factor match" on blur. Users never have to know what an emission factor is.
- **Paste & AI-fill.** Pasting a free-text recipe extracts ingredient rows via Gemini. Genuinely low-friction for the manual path.
- **The menu importer.** PDF, photo, spreadsheet and CSV in, recipes out, with a review step, deduplication and sensible guards (200 items max, names capped). Deliberately extracting names only avoids fabricating quantities.
- **Sales entry conveniences.** CSV import, POS export-file import and copy-last-period make the recurring task (volumes) the least painful one.
- **Honest warnings.** The importer tells the user three times that quantities need adding.

### 4.2 Friction points

1. **No ingredient library or picker.** The name field autocompletes only from names already used in the same org, so a new org types every ingredient blind against an invisible factor catalogue.
2. **No manual factor override.** When matching fails or lands on an approximate factor, the only remedy is renaming the ingredient and hoping. The plan's amber/red "assign manually" flow was never built.
3. **The importer creates work, not finished recipes.** Every imported dish must be opened individually to enter quantities. A 60-dish menu import means 60 separate visits with no bulk-quantity grid and no progress tracking of which dishes still have placeholders.
4. **No duplication or templates.** No clone action on recipes or menus; a near-identical dish is rebuilt from scratch. Covers always defaults to 1 with no per-venue portion presets.
5. **Room allocation asks the user to do the arithmetic.** The panel asks for annual utilities divided by occupied room nights, pre-computed by hand, even though facility utility data is already in the platform.
6. **No Rosa or smart-upload path.** Rosa's roughly 35 tools contain nothing hospitality-related, and the document ingest classifier has no hospitality routing. A user cannot photograph a menu into the Rosa drawer or ask Rosa to log last week's covers. The two AI import endpoints are bespoke and only reachable from inside the module.
7. **Silent AI degradation.** Paste & AI-fill and photo import 503 gracefully when API keys are missing, but the UI gives no advance indication.

---

## 5. Gaps

### 5.1 Correctness gaps (leaks)

Hospitality PCFs are real `product_carbon_footprints` rows, so any unfiltered query shows them. Filtered correctly: the products list, `useCompanyMetrics`, the corporate rollup. **Not filtered (leaks):**

- `app/(authenticated)/reports/lcas/page.tsx` (LCA report list)
- `app/(authenticated)/dashboard/reports/product-lca/page.tsx` (product LCA reports)
- `hooks/data/useProductSpotlight.ts` (dashboard spotlight can feature a meal)
- `lib/pulse/snapshots.ts` (`products_assessed` and `lca_completeness_pct` both inflated)
- `app/(authenticated)/reports/sustainability/page.tsx` (PCF count stat)

The `isHospitalityKind()` / `HOSPITALITY_KINDS` helpers exist; these surfaces just do not use them.

### 5.2 Visibility gaps

- The interactive company-footprint page never itemises hospitality; it is inside the Scope 3 total but only the PDF names it. `useScope3Emissions` has no hospitality line either.
- The include/exclude toggle lives only on `/hospitality`, so a reporting user will not discover why their Scope 3 moved.
- CSRD gap analysis (`lib/pulse/csrd-gaps.ts`) has no hospitality awareness.

### 5.3 Schema and hygiene gaps

- `hospitality_meal_meta.prep_waste_pct` is a dead column: defined, CHECK-constrained, never read or written.
- `hospitality_room_allocation` has no `venue_id` or `facility_id`, so "already counted in facility Scope 1/2" is a convention, not something the data model can verify.
- Archived venues and menus are never filtered out of list services.
- The rollout checklist in `tasks/hospitality-todo.md` lists only five of the nine migrations (missing settings, waste and the water meter split).
- `GRANT ALL ... TO anon` on every hospitality table is broader than needed (RLS blocks it in practice, and the public route uses the service-role client, but it is unnecessary surface).

### 5.4 Plan-versus-reality gap

Neither planning document was followed architecturally (a good call: the in-app `product_kind` module is simpler and shares the real LCA engine). Materially unbuilt from the plans: kitchen-process energy factors, per-cover and per-revenue intensity KPIs against real covers data, live POS/PMS/waste-platform integrations (only export-file import exists), events venue type and guest travel estimator, hotel-specific modules (laundry, HCMI/CHSB exports), compliance packs (SECR, France Decree 2022-982 menu labelling, AGEC, Cool Food Pledge), Greenwash Guardian for menus, the commodity nature-risk matrix, the producer-venue marketplace and the cross-account data bridge. These are roadmap items, not defects, but the plan docs should be updated so they stop describing a platform that does not exist.

---

## 6. Five improvement areas

### Improvement 1: Seal the boundaries and prove the maths (trust)

The highest-value, lowest-effort package. Apply `HOSPITALITY_KINDS` filters to the five leaking surfaces (LCA report lists, product spotlight, Pulse `products_assessed` and `lca_completeness_pct`, sustainability PCF count), then write the missing tests for `calculateHospitality()`: the divide-multiply maths, the include/exclude toggle, the own-wine `internal_consumption` exclusion, the product-rollup exclusion, and the Scope 3 fallback. This is a day or two of work that converts "structurally sound" into "provably sound", which matters because these figures reach customer footprint reports.

### Improvement 2: Make imported menus reach the finish line (data capture)

The importer gets users 40 per cent of the way and abandons them. Three changes close the loop: (a) a "quantities unconfirmed" flag on imported recipes, set on commit and cleared on first real save, shown as a badge in the list and blocking Calculate (or at least interposing a confirm) while set; (b) a bulk quantity grid, one screen listing every imported dish's ingredients with quantity and unit fields inline, so a 60-dish menu is one editing session instead of 60; (c) optionally let the AI propose typical quantities (clearly marked as estimates needing confirmation) since Claude vision already sees the dish names. This directly attacks both the biggest UX friction and the biggest accuracy trap (placeholder 1 g footprints).

### Improvement 3: Ingredient library and factor override (data capture and accuracy)

Replace blind free-text entry with a searchable ingredient picker over the factor catalogue (the search endpoint pattern already exists for products), seeded with the 100 or so most common hospitality ingredients mapped to good Agribalyse/ecoinvent factors. Add a manual factor assignment flow for the "No factor match" and "Approximate factor" states. Add recipe duplication and per-kind portion defaults while in there. This is what makes the module usable for an org that is new to the platform, and it fixes silent factor mis-matches that no amount of downstream maths can recover from.

### Improvement 4: Close the operational-energy gap in the meal footprint (accuracy and credibility)

Two-step. First, transparency: state the cradle-to-gate boundary on the public menu methodology line and in the recipe editor ("ingredient production; kitchen energy is counted in your site footprint"), and give the band thresholds a citable basis (or make them org-configurable with a sensible default). Second, substance: a lightweight cooking-energy step per recipe (cooking method plus minutes, against a small published kWh factor table, exactly the plan's section 4.2 idea in miniature), and make room allocation pull from linked facility utility data divided by occupied nights instead of asking the user to do the division, actually using the occupancy field it already stores. This is the difference between a defensible carbon label and one a journalist can pick apart.

### Improvement 5: Surface hospitality where the numbers land, and feed it ambiently (visibility and adoption)

On the reporting side: itemise "Hospitality service" as a named Category 1 line on the interactive company-footprint page and in `useScope3Emissions`, move (or mirror) the include/exclude toggle into reporting settings, and teach the CSRD gap analysis that hospitality exists. On the capture side: give Rosa two or three hospitality tools (log service volumes, log waste, start a menu import) and add a hospitality route to the smart-upload classifier so a photographed menu or a POS export dropped into the drawer lands in the right place. The module currently only works for users who go looking for it; this makes it part of the ambient platform experience, which is where the rest of alka**tera** has been heading all year.

### Quick wins alongside (under an hour each)

- Delete or wire up `prep_waste_pct`.
- Derive the public menu legend swatches from `BAND_THRESHOLDS` instead of separate hardcoded values.
- Filter archived venues and menus out of list services.
- Update the rollout checklist in `tasks/hospitality-todo.md` to all nine migrations.
- Add helper copy to the sales form clarifying that `units_sold` means individual servings.

---

## 7. Verdict

The hospitality module is a well-architected beta that delivers its core promise: hospitality operations measured with real LCA factors and included in the producer's organisational footprint with the double-counting problems thought through. Its risks are not architectural. They are the untested critical path, five unfiltered queries leaking meals into drinks surfaces, an import flow that strands users at the placeholder stage, and a per-dish figure whose boundary is narrower than the public label implies. All four are addressable within the current design, and Improvements 1 and 2 alone would take the module from "promising beta" to "safe to widen the beta cohort".
