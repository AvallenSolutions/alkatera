# Alkatera Hospitality Module — Implementation Plan

> Extension of the existing impact engine to hospitality operations (meals, drinks,
> menus, room nights) for wineries that also run restaurants/bars/accommodation.
> Gated behind a new `hospitality_beta` feature flag. **Reuse, don't rebuild.**

## Decisions (resolved this session)

- **Storage = Hybrid.** Meals and made-drinks (cocktails/coffee) become `products`
  rows with a `product_kind` discriminator so they reuse the calculator, PCF
  storage, Pulse and LCA report generators unchanged, but are filtered out of the
  wine Products list UI. Venues, Menus, RoomTypes, Sales get dedicated
  `hospitality_*` tables that reference `products.id`. Own-wine drinks reference an
  existing wine `products.id` (live link, never a snapshot).
- **Double-counting rule (documented, enforced in code):**
  1. **Venue energy/water** → stays as existing facility data via
     `facility_activity_entries` (Scope 1/2). Room-night/meal energy is an
     *allocation view* of that data for intensity metrics, **never additive** to
     the company total.
  2. **Own-wine served in own venue** → impact shown in hospitality views for
     per-cover/menu intensity, tagged `internal_consumption = true`, **excluded**
     from the company-total add (already counted in production).
  3. **Net-new company emissions from hospitality** = purchased food/beverage
     ingredients + linen/amenity supplies = the `scope3` slice of each
     meal/made-drink/room-night PCF × volume sold. This is the only thing added to
     `calculateCorporateEmissions`.
- **Metrics** = all the engine already returns (carbon, water, water-scarcity AWARE,
  land, ReCiPe set). No new metric plumbing.
- **Food factors** = reuse `staging_emission_factors` (`category='Ingredient'`) +
  `scripts/extract-agribalyse-factors.ts`; no licensed dataset.
- **POS** = CSV import only for the trial; Lightspeed/Toast/Square deferred.

## Key reuse map (verified file paths)

- Calculator: `lib/product-lca-calculator.ts::calculateProductCarbonFootprint`
  → `lib/impact-waterfall-resolver.ts::resolveImpactFactors`
  → `lib/product-lca-aggregator.ts::aggregateProductImpacts` (client-side).
- Live product impact read: `hooks/data/useProductSpotlight.ts` pattern
  (`products` + latest `product_carbon_footprints.aggregated_impacts`).
- Company total: `lib/calculations/corporate-emissions.ts::calculateCorporateEmissions`
  (+ `Scope3Breakdown`); daily `lib/pulse/snapshots.ts::computeOrgSnapshots`.
- Beta flag: `app/api/admin/beta-access/route.ts` (`PRODUCT_BETA_CODES`),
  `hooks/useSubscription.ts` (`FeatureCode`, `hasFeature`),
  `components/subscription/FeatureGate.tsx`, `components/layouts/Sidebar.tsx`.
- Automation: `lib/ai/gemini.ts` (`extractStructured`/`runJsonPrompt`),
  `lib/ingest/classify-document.ts`, `lib/inngest/*`,
  `lib/distributor/parsers/csv-parser.ts::parseCSV`,
  `lib/suppliers/ingredient-matcher.ts::rankIngredientMatches`.

---

## Phase 1 — Foundation (vertical slice: create a venue behind the flag) ✅ SHIPPED

- [x] Migration `supabase/migrations/20260619140000_hospitality_foundation.sql`:
  - `products`: `product_kind text not null default 'product'` (+ check constraint)
    and `serves_per_container numeric`; index on `(organization_id, product_kind)`.
  - `hospitality_venues` (uuid pk, org, facility_id, name, venue_type
    `restaurant|bar|accommodation`, status, timestamps, created_by) + 4 org-scoped
    RLS policies + updated_at trigger + indexes + grants.
- [x] Register flag: `'hospitality_beta'` added to `PRODUCT_BETA_CODES`,
  `FeatureCode`, `hasFeature` productBetas, canopy list, and `FeatureGate`
  featureInfo/names.
- [x] Filter wine Products list to `product_kind = 'product'` in `products/page.tsx`.
- [x] Nav: gated `Hospitality` entry in `navigationStructure` (betaBadge,
  `featureCode: 'hospitality_beta'`) with Dashboard + Venues children (rest added as
  routes land).
- [x] Routes: `hospitality/layout.tsx` (`<FeatureGate>`), `page.tsx` (dashboard stub),
  `venues/page.tsx`.
- [x] Venue CRUD: `app/api/hospitality/venues/route.ts` + `[id]/route.ts`
  (`getSupabaseAPIClient` + `resolveUserOrganization`); `useHospitalityVenues` hook;
  `VenuesManager` component (create/edit/delete) reusing shadcn.
- [x] Verify: created a venue end-to-end behind the flag (POST 201, row persisted with
  correct org_id/created_by); negative test confirms nav hides + locked FeatureGate
  page when flag off.

## Review

**Phase 1 shipped and verified (2026-06-19).**

- Typecheck: `tsc --noEmit` → 0 errors. Lint: clean on all new files.
- Migration applied to local Supabase (`supabase migration up`); schema confirmed
  (both product columns, 4 RLS policies, table live).
- Browser E2E on `dev-main` @ 8888, logged in as `dev@local.test`, org `Local Dev Co`
  (Canopy/active, `hospitality_beta=true`): Hospitality nav renders → Venues page →
  created "The Cellar Door Restaurant" → `POST /api/hospitality/venues` 201 → card
  renders → DB row scoped to org + created_by. Flag-off negative test: nav entry hides
  and direct URL shows the locked "Hospitality (Beta)" page.
- Local-only setup performed for testing (not committed): wired dev-user membership via
  `seed-local-user.sh`, set org to Canopy/active, toggled the beta flag.

**Notes / follow-ups for Phase 2+**
- Other product aggregations (spotlight, setup-progress, data-quality counts) don't yet
  filter `product_kind`; harmless until meals exist, but add the predicate when Phase 2
  introduces meal products so counts stay wine-only.
- Nav lists only Dashboard + Venues; add sub-sections as their routes ship.

## Phase 2 — Meals (per-cover impact via the existing engine) ✅ SHIPPED

- [x] A meal IS a `products` row (`product_kind='hospitality_meal'`) with ingredient
  rows in `product_materials` (`material_type='ingredient'`). Added
  `hospitality_meal_meta` (product_id UNIQUE, venue_id, covers, portion_note,
  prep_waste_pct) + RLS (migration `20260619150000_hospitality_meals.sql`).
- [x] Recipe form + per-cover impact: thin meal-appropriate ingredient form
  (name/qty/unit, reuses `lib/constants/material-units.ts`), writes
  `product_materials` client-side, runs `calculateProductLCA` (the shared engine),
  reads `aggregated_impacts` and divides by covers (`perCoverImpact`). Carbon/water/
  land cards per cover.
- [x] Verify: beef ragù (600 g beef, 200 g onion, 400 g tomato, 30 g oil, 4 covers)
  → recipe 37.12 kg CO₂e (exact hand-calc), per cover 9.28 kg CO₂e / 2.47 m³ / 24.88 m².
  Unit test on `perCoverImpact` (4 tests, pass).
- [x] **Food-factor coverage — Agribalyse backfill WIRED IN (admin button → Inngest).**
  `lib/openlca/agribalyse-backfill.ts` (**131 restaurant commodities** across meat,
  fish, dairy, veg, fruit, herbs/spices, grains, legumes, nuts, oils, condiments)
  reuses the canonical OpenLCA client + a food-specific process selector and
  idempotently upserts `staging_emission_factors`. Selector: **query-priority**
  (first specific query that matches wins) + **word-boundary** matching with a
  plural tolerance; prefers raw, aggregated "processed in FR | … at distribution"
  CIQUAL processes; penalises composites/by-products/cooked/frozen. Calculates via
  `calculateProcess` (this gdt-server has no `create-system`). Inngest fn
  `agribalyseBackfillRun` (chunked) + admin API `/api/admin/agribalyse-backfill`
  (GET coverage, POST dispatch) + admin page + nav.
  Validated: all 131 selections dry-run-checked against the live process list;
  12 spot-checked through the real calc (Beef 32, Chicken 7.5, Salmon 8.8,
  Butter 29, Cheddar 15, Almonds 1.0, Onion 0.27…); beef-ragù meal resolves
  through them to 7.48 kg CO₂e/cover.

### Review — Agribalyse backfill (2026-06-19)

- New: `lib/openlca/agribalyse-backfill.ts`; `lib/inngest/functions/factors.ts`
  (+ event in `client.ts`, registry); `app/api/admin/agribalyse-backfill/route.ts`;
  `app/(authenticated)/admin/agribalyse-backfill/page.tsx`; admin nav link.
- **No DB migration** — writes data rows into the existing `staging_emission_factors`.
- Reuse-first: canonical `OpenLCAClient`, `resolveServerConfig('agribalyse')`,
  `isFoodPackagingSystemName`. Did NOT reuse `filterAgribalyseProcesses` (drinks-only,
  excludes meat) — added a food pre-filter instead.
- Caught + fixed during live verification: gdt-server lacks `create-system` (switched
  to direct `calculateProcess`); the drinks process filter excluded all meat; `data_quality_grade`
  isn't a real column and `pedigree_dqi_score` is generated (removed both); selector
  initially hit by-products ("Blood, beef") and unlinked unit processes ("olive oil at
  plant", 0.3) and frozen variants — fixed with the food-specific scorer + frozen penalty.
- Gates: `tsc` 0 errors, ESLint clean. Live E2E: admin coverage 9/42, meal resolves to
  Agribalyse factors. POST dispatch returns a graceful 503 locally (no `INNGEST_EVENT_KEY`),
  202 in prod.
- Prod run: open **Admin → Agribalyse Factors → Run backfill** (needs the Agribalyse
  server + `INNGEST_EVENT_KEY`, both present in prod; ~131 × ~15s ≈ 30 min, chunked).
  Extend `HOSPITALITY_FOOD_TARGETS` as menus need more; the run summary logs each
  chosen process so odd matches are easy to spot.
- Selector hardening (caught via dry-run over the live process list): word-boundary
  matching (so "pea" ≠ "Pearled barley", "salt" ≠ "Salty snacks") with `+s` plural
  tolerance ("almond" → "Almonds"); query-priority so a specific first query beats a
  generic one (fixed Butter→"Butter bean", Garlic→"Garlic sausage", Lemon→"Lemon sole"
  the fish, Salmon→"Salmon trout"); dropped commodities with no clean raw process
  (Chorizo, Peanuts, Black beans, Couscous, Turnip, Minced pork, plain Coconut,
  Sesame seeds, Crème fraîche, Mascarpone).
- [ ] **Deferred enhancement:** ingredient→factor auto-match with confidence + one-click
  confirm (the waterfall already resolves by name; this is a UX nicety for ambiguous
  names). prep_waste_pct is captured but not yet applied to quantities.

### Review — Phase 2 (2026-06-19)

- New: `hospitality_meal_meta` migration; `lib/hospitality/meal-types.ts` (+ test);
  `app/api/hospitality/meals/route.ts` + `[id]/route.ts`; `useHospitalityMeals`;
  `MealsManager`; `hospitality/meals/page.tsx` + `[id]/page.tsx` (editor); Meals nav +
  dashboard card.
- Design: maximal **engine** reuse (calculator, factor waterfall, PCF storage, multi-
  metric results) with a thin meal recipe form rather than the wine recipe UI. Meal
  creation + metadata via org-scoped API; ingredient editing + calculation client-side
  (the calculator is client-only), mirroring the product LCA flow.
- Gates: `tsc` 0 errors, ESLint clean, 4/4 unit tests, live browser E2E with DB cross-
  check (per-cover values match exactly).
- Caught + fixed in review: `INGREDIENT_UNITS` is `MaterialUnit[]` not `string[]` (Select
  mapping); `water_consumption` is m³ not litres (corrected the card label to match the
  app-wide convention).

## Phase 3 — Drinks (live bottle link #3) + Menus + menu aggregation ✅ SHIPPED

- [x] Made-drinks reuse the meal machinery via a generalised **recipe service**:
  `lib/hospitality/recipe-kinds.ts` (kind config) + `recipe-service.ts` +
  `recipe-route-handlers.ts`. `/api/hospitality/meals` and `/drinks` are thin
  wrappers; `RecipeManager` + `RecipeEditor` components are kind-generic. Made-drink
  = `products` row `product_kind='hospitality_drink'` + `hospitality_meal_meta`.
- [x] Migration `20260619160000_hospitality_menus.sql`: `hospitality_menus` +
  `hospitality_menu_items` (item_kind `meal|made_drink|own_product_drink`,
  serves_per_container, internal_consumption) + RLS.
- [x] **Own-product drink (#3):** menu item references the wine `products.id`;
  per-serve impact computed **live on every read** in
  `menu-service.computeItemImpacts` = wine's latest `aggregated_impacts` ÷
  serves_per_container (item override → `products.serves_per_container` → default 6).
  Never snapshotted. Tagged `internal_consumption=true`. Wine picker at
  `/api/hospitality/wines`.
- [x] Menu aggregate (item count, average-per-cover, full-menu total) + menu editor
  UI with add-item flow (meal / made-drink / own-wine) and live per-serving impacts.
- [x] Nav: Drinks + Menus added; dashboard cards updated.

### Review — Phase 3 (2026-06-19)

- **Live-link test passed:** seeded wine "Estate Pinot Noir" (1.2 kg CO₂e/bottle, 6
  serves → 0.20/glass). Built "Autumn dinner menu" with the beef-ragù meal (7.48/cover),
  the own-wine (0.20/glass, internal), and a made-drink "Garden Bloody Mary"
  (0.045/serve). Changed the wine's PCF 1.2 → 2.4 → the menu item moved 0.20 → **0.40**
  and the menu average updated, **with no menu edit** — impact is read live, never copied.
- Refactor reused: meals + drinks now share one verified code path; meals still load
  (regression checked). Removed superseded `MealsManager` + `useHospitalityMeals`.
- Gates: `tsc` 0 errors, ESLint clean. Live browser E2E across all three item kinds.
- The own-wine `internal_consumption` flag is the hook Phase 5 uses to avoid
  double-counting wine already in production totals.

## Phase 4 — Rooms (room-night impact) ✅ SHIPPED

- [x] Room-night = `products` row (`product_kind='hospitality_room_night'`) whose
  ingredients are the **purchased consumables** per night (laundry/linen, amenities,
  breakfast). Reuses the recipe engine via a third `RECIPE_KINDS.room_night`
  (`/api/hospitality/rooms`, portion word "night") → consumables Scope 3 impact.
- [x] Migration `20260619170000_hospitality_rooms.sql`: `hospitality_room_allocation`
  (product_id unique, occupancy, electricity_kwh, gas_kwh, water_litres, country) + RLS.
- [x] Allocation: `lib/hospitality/room-allocation.ts` converts per-night electricity
  (grid factor by country, reusing `getGridFactor`), gas (DEFRA 0.18293/kWh) and water
  (DEFRA 0.344/m³) to CO₂e. API `/api/hospitality/rooms/[id]/allocation` (GET/PUT).
  `RoomAllocationPanel` (in the `RecipeEditor` `renderExtra` slot) shows inputs +
  Consumables / Allocated / **Total per night**.
- [x] Accounting rule made explicit + structural: allocated energy/water is computed
  separately (NOT in the product PCF), shown for per-night intensity only; the company
  total adds the **consumables Scope 3 only** (Phase 5). The panel states this.
- [x] Nav: Rooms added; dashboard shows all five operational sections.

### Review — Phase 4 (2026-06-19)

- Verified live: room "Standard Double Room" — consumables (Butter 20g) **0.57**
  kg CO₂e/night via the engine; allocation (12 kWh elec + 5 kWh gas + 100 L water, GB) →
  electricity 2.484 + gas 0.915 + water 0.034 = **3.43**; per-night **Total 4.01**. Values
  exact; persisted; accounting note rendered.
- Reuse: rooms add zero new editor code — `RecipeEditor` gained an `ingredientLabel` +
  `renderExtra` slot and rooms compose `RecipeEditor` + `RoomAllocationPanel`.
- Gates: `tsc` 0 errors, ESLint clean.
- Follow-up: allocation is entered directly per night; deriving it automatically from
  `facility_activity_entries` ÷ occupied nights is a later enhancement (the inputs and
  the rule are already in place).

## Phase 5 — Sales/volumes + company-total integration (#2) ✅ SHIPPED

- [x] Migration `20260619180000_hospitality_service_volumes.sql`:
  `hospitality_service_volumes` (product_id, venue_id, period_start/end, units_sold) + RLS.
- [x] CSV import (reuses `parseCSV`) — `/api/hospitality/volumes/import` matches the
  `product` column to hospitality products by name, inserts matched, reports unmatched.
  Plus manual add. UI: `SalesManager` (file upload, no curl), `/hospitality/sales`.
- [x] `lib/calculations/hospitality-emissions.ts::calculateHospitality(supabase, orgId,
  yearStart, yearEnd)` = Σ (product PCF **scope3** ÷ covers × units_sold) over service
  volumes; food (meals+drinks) vs supplies (rooms). Own-wine throughput can't be
  recorded (insert rejects non-hospitality products); venue energy never enters a
  product PCF — so no double count.
- [x] Wired into `calculateCorporateEmissions`: added optional `hospitality` field to
  `Scope3Breakdown` (Cat 1), computed in `calculateScope3`, summed into the Scope-3
  total. Optional field → the other ~8 `Scope3Breakdown` constructors are untouched.
- [x] Hospitality dashboard shows the live company contribution (`/api/hospitality/summary`).
- [ ] Pulse widget — deferred (the company-total integration that #2 requires is done;
  a Pulse `widget-registry` tile is a presentation nicety for later).

### Review — Phase 5 (2026-06-19)

- **Aggregation test passed.** Recorded 100 covers (beef ragù, 29.94 Scope-3 PCF ÷ 4 =
  7.485/cover → 748.48), 200 drinks (8.92), 50 room-nights (28.66) → hospitality
  **786.07 kg CO₂e**. `calculateCorporateEmissions(org, 2026)` returned
  `scope3.hospitality = 786.07`, rolled into `scope3.total` and the company total — the #2
  requirement.
- **No double-count, verified two ways:** adding the own-wine (product_kind='product') as a
  volume was **rejected (400)**; venue/room energy is computed separately and never in the
  product PCF, so the Scope-3 figure excludes it.
- CSV import: matched "Beef ragù" inserted, "Nonexistent Dish" reported unmatched.
- Gates: `tsc` 0 errors, ESLint clean. Temp corporate-emissions verifier removed.

## Phase 6 — Automation + value-adds ✅ SHIPPED (core); rest documented

- [x] **Consumer menu carbon labels + public QR page (the marketing asset).**
  `is_public`/`public_slug` on menus; `publishMenu` generates a slug; menu editor has a
  **Publish + QR** panel (`qrcode.react`). Public, no-auth route `app/menu/[slug]` +
  `/api/public/menu/[slug]` (service-role, `is_public=true` only, consumer-safe fields).
  `lib/hospitality/carbon-band.ts` → low/medium/high bands + g/kg formatting. Branded
  page sorts items by band.
- [x] **AI recipe parsing.** `/api/hospitality/parse-recipe` (Gemini Flash
  `runJsonPrompt`) extracts `{material_name, quantity, unit}[]`; "Paste & AI-fill"
  dialog in `RecipeEditor` pre-fills rows. Returns a graceful **503** when
  `GEMINI_API_KEY` is absent (works in prod).
- [ ] Deferred value-adds (follow-ups): invoice-OCR → auto ingredients
  (`classify-document.ts`); what-if scenario swaps; food-waste impact line; per-cover
  benchmarking vs industry; hotspot analysis; targets/trends into existing reports;
  Pulse widget.

### Review — Phase 6 (2026-06-19)

- Verified live: published "Autumn dinner menu" → slug `autumn-dinner-menu-…`; public
  page `/menu/<slug>` renders **no-auth**, branded, items sorted by band (Pinot Noir
  400 g / Bloody Mary 45 g / Beef ragù 7.48 kg, green→red), alka**tera** footer. Editor
  shows the QR + share link. AI parse → graceful 503 locally.
- Public route is safe: middleware only gates portals; the public API uses the
  service-role client but filters strictly on `is_public=true` and returns only
  name + kind + per-serving carbon (no ids/flags/org data).
- Gates: `tsc` 0 errors, ESLint clean.

---

## Module complete — prod rollout checklist

All six phases shipped behind `hospitality_beta`. To go live:
1. Run the migrations in order (posted in chat):
   - `20260619140000` (foundation: `product_kind`/`serves_per_container` + venues)
   - `20260619150000` (meals meta)
   - `20260619160000` (menus + menu items)
   - `20260619170000` (rooms allocation)
   - `20260619180000` (service volumes)
   - `20260620100000` (hospitality settings)
   - `20260620110000` (waste)
   - `20260621100000` (facility water `meter_purpose` split)
   Improvements programme (2026-07) adds:
   - `20260712100000` (`hospitality_meal_meta.quantities_status` — import finish-line)
   - `20260712110000` (`hospitality_meal_meta.cooking_method` + `cooking_minutes` — cooking energy)
   - `20260712120000` (`hospitality_meal_meta.dietary_tags` + `allergens` — Tier 2)
   - `20260712130000` (`hospitality_operating_periods` — covers + revenue for intensity KPIs)
   - `20260712140000` (`hospitality_events` + venue_type 'events' — Tier 3 events)
   - `20260712150000` (`hospitality_room_allocation.laundry_kwh` — Tier 3 hotel)
2. Run **Admin → Agribalyse Factors → Run backfill** (needs the Agribalyse server +
   `INNGEST_EVENT_KEY`) to populate food factors.
3. Enable `hospitality_beta` per trial org via **Admin → Beta Access**.
4. Sections: Venues · Meals · Drinks · Menus · Rooms · Sales, all gated.

## Verification harness (all phases)

- Unit tests on composition→impact (reuse vitest; scope to `lib/` + new suites — never
  bare `npx vitest run`, it hangs).
- Manual run behind the flag at port 8888: venue → meal → own-wine drink → menu →
  sales → company dashboard + exported report.
- Lint/build before declaring done.

## Review
_(to be filled after each phase)_
