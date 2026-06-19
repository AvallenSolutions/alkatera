# Soil Carbon: Measure the Place, Track the Trajectory

Implementation plan driven by Ian Gould's article thesis: the market has moved from
"trust the model" to "measure the place"; the unit of value is the **direction and scale
of change measured consistently over time**, not an absolute figure on a single day.

alka**tera** already separates removals from emissions (FLAG / GHG Protocol LSR v1.0) and
prefers measured data over practice-based defaults. The gap is that we capture a single
annual **flux** (`soil_carbon_override_kg_co2e_per_ha`) instead of measured soil-organic-carbon
**stocks over time**, we have no sampling depth, no trajectory view, and no uncertainty
treatment. This plan closes those gaps.

## Core design decision

Soil carbon is a property of the **land**, measured at points in time, independent of the
annual growing profile. So we add a new field-level time-series table `soil_carbon_samples`
keyed to the land unit (arable field / vineyard / orchard). The annual stock change between
two samples, divided by years elapsed, becomes the measured removal flux. This replaces
"ask the grower for the answer" with "capture the measurements and compute the change".

Removal value priority (highest wins):
1. **Measured stock-change** — ≥2 samples at consistent depth → computed annual flux
2. **Manual override** — existing `soil_carbon_override_kg_co2e_per_ha` (back-compat)
3. **Practice-based default** — existing `SOIL_CARBON_REMOVAL_DEFAULTS` lookup

A single baseline sample (only 1 measurement) does NOT yet yield a measured claim — it is
recorded as a baseline and the UI nudges "re-measure to claim the change".

## SOC stock formula
`SOC stock (tC/ha) = SOC concentration (%) × bulk density (g/cm³) × depth (cm)`
Capture either measured stock (tC/ha) directly, OR concentration + bulk density + depth
and auto-compute. Annual flux = ΔStock / years × (44/12) × 1000 → kg CO2e/ha/yr.

---

## Phase 0 — Shared soil-carbon module (pure functions, no UI)
- [ ] `lib/soil-carbon.ts`: `socStockFromConcentration()`, `computeAnnualStockChange(samples[])`
      returning `{ annual_kg_co2e_per_ha, baseline, latest, years_elapsed, methodology, confidence }`,
      and `assessSampleConfidence()` (depth consistency, sampling-point density, verification).
- [ ] Constants in `lib/ghg-constants.ts`: depth-consistency tolerance, min sampling points for
      HIGH confidence, conservative discount factors for sparse/shallow sampling. Reuse `C_TO_CO2E`.
- [ ] Unit tests `lib/__tests__/soil-carbon.test.ts` (stock formula, two-sample flux, sign of
      change, depth-mismatch rejection, single-sample = baseline-only).

## Phase 1 — Schema migration (Tim runs SQL in Supabase editor)
- [ ] New table `public.soil_carbon_samples`: `id`, `organization_id`, `land_unit_type`
      (`arable_field|vineyard|orchard`), `land_unit_id`, `sample_date`, `depth_cm`,
      `soc_input_method` (`stock|concentration`), `soc_stock_tc_ha`, `soc_concentration_pct`,
      `bulk_density_g_cm3`, `sampling_points`, `lab_name`, `methodology`,
      `verification_status` + verifier fields (mirror existing removal-verification columns),
      `evidence_object_path`, `notes`, `created_by`, `created_at`, `updated_at`, `is_active`.
- [ ] Add `sampling_depth_cm integer` to `arable_growing_profiles`, `vineyard_growing_profiles`,
      `orchard_growing_profiles` (improvement 1; keeps single-profile capture aligned too).
- [ ] RLS: org-scoped select/insert/update + restrictive read-only-advisor policies (follow
      `20260618130000_advisor_access_levels.sql` template). Index on `(land_unit_type, land_unit_id, sample_date)`.
- [ ] Post full migration SQL in chat for Tim to copy.

## Phase 2 — Calculator integration
- [ ] Add optional inputs to the three calculator input interfaces (`lib/types/{arable,viticulture,orchard}.ts`):
      `soil_carbon_annual_change_kg_co2e_per_ha`, `soil_carbon_change_methodology`,
      `soil_carbon_change_confidence`, `soil_carbon_depth_cm`.
- [ ] Update the soil-carbon block in `lib/arable-calculator.ts` (≈346-365),
      `lib/viticulture-calculator.ts` (≈385-393), `lib/orchard-calculator.ts` (≈331-338) to apply
      the priority logic above and set `methodology` to `measured_stock_change` when used.
- [ ] Extend `flag_removals` output with `methodology` (add `measured_stock_change`), `confidence`,
      `change_vs_previous`, and a `removals_warning` when only a baseline exists.
- [ ] Unit tests for each calculator's new branch.

## Phase 3 — Data capture UI + estimate→measured nudge
- [ ] `/api/soil-carbon/samples` route: list/create/update/soft-delete samples for a land unit
      (`getSupabaseServerClient()`, org-membership + role checks per existing API pattern).
- [ ] Field-level "Soil carbon measurements" sub-panel reused across the soil-carbon section of
      `ArableGrowingQuestionnaire.tsx` (≈1040-1192), `VineyardGrowingQuestionnaire.tsx` (≈1057-1369),
      `OrchardGrowingQuestionnaire.tsx` (≈993-1340): list samples, add measurement (date, depth,
      stock OR %+BD, sampling points, lab, methodology, verification + evidence upload), and show
      the **computed change** once ≥2 exist.
- [ ] Nudge: when on practice-based default OR only a baseline sample exists, show the MRV prompt
      ("same lab, same depth, re-test cadence") so growers move from estimate → measured.
- [ ] Add `sampling_depth_cm` to the existing single-profile soil-carbon form (improvement 1).

## Phase 4 — Trajectory surfacing
- [ ] `/api/pulse/soil-carbon-trajectory` route: per-org, per-land-unit time series + headline delta.
- [ ] New Pulse widget `soil-carbon-trajectory` (registry entry in `lib/pulse/widget-registry.ts`,
      `2x2`, with `explainer`; component `components/pulse/widgets/SoilCarbonTrajectoryWidget.tsx`
      mirroring `CarbonBudgetWidget` + line chart; wire into `widgetRenderers`).
- [ ] Report: extend `buildFlagRemovalsSlides()` in `supabase/functions/_shared/report-content-builder.ts`
      (≈547-607) with a trajectory table + measured-change headline; pass `trajectory`/`changeOverTime`
      through the `flag-removals` extractor in `generate-sustainability-report/index.ts`.

## Phase 5 — Uncertainty / data-quality confidence
- [ ] Map soil-carbon samples onto the pedigree matrix in `lib/data-quality-assessment.ts`
      (reliability from verification, completeness/technological from sampling density + depth,
      temporal from sample recency) → DQI + HIGH/MEDIUM/LOW grade + ±uncertainty.
- [ ] Apply a conservative discount to the measured flux when confidence is LOW (sparse points /
      shallow depth / unverified), surfaced as a badge in the widget and a note in the report.

## Phase 6 — Verification
- [ ] `pnpm install` if any dep added; scoped vitest run (lib/ + soil-carbon + calculator suites;
      never bare `npx vitest run` per known-hang note).
- [ ] Local Supabase: `supabase db reset`, apply migration, smoke-test sample CRUD + recompute on
      port 8888; screenshot the trajectory widget.
- [ ] Note: calculator is client-side, so existing products need a **Recalculate LCA** pass
      (`/admin-tools/recalculate-lca`) to pick up measured stock-change values.

## Review (completed 2026-06-19)

All six phases implemented, type-clean (tsc 0 errors) and tested (248 unit tests pass).

**Files added**
- `lib/soil-carbon.ts` — stock-change engine (formula, two-sample flux, confidence, discount, trajectory)
- `lib/soil-carbon-server.ts` — land-unit mapping + `recomputeSoilCarbonCache`
- `lib/__tests__/soil-carbon.test.ts` — 14 tests
- `supabase/migrations/20260619100000_soil_carbon_samples.sql` — table + cache cols + depth + RLS (applied & verified on local)
- `app/api/soil-carbon/samples/route.ts` + `[id]/route.ts` — CRUD + recompute
- `app/api/pulse/soil-carbon-trajectory/route.ts` — per-org trajectory
- `components/soil-carbon/SoilCarbonSamplesPanel.tsx` — capture UI + nudge + computed-change headline
- `components/pulse/widgets/SoilCarbonTrajectoryCard.tsx` — Pulse widget

**Files changed**
- `lib/ghg-constants.ts` — stock-change constants (depth tolerance, point thresholds, discount)
- `lib/{arable,viticulture,orchard}-calculator.ts` — priority: measured stock-change > override > default
- `lib/types/{arable,viticulture,orchard}.ts` — input/output/profile fields
- `lib/product-lca-calculator.ts`, `hooks/data/use{Vineyard,Orchard}Dashboard.ts`, `app/(authenticated)/arable-fields/[id]/page.tsx` — pass cache fields into calculators
- `components/{arable-fields,vineyards,orchards}/*GrowingQuestionnaire.tsx` — embed capture panel
- `lib/pulse/widget-registry.ts` + `components/pulse/widgetRenderers.tsx` — register widget
- `supabase/functions/generate-sustainability-report/index.ts` + `_shared/report-content-builder.ts` — methodology mix in FLAG removals slide
- `lib/data-quality-assessment.ts` — `soilCarbonConfidenceToPedigree()`

**Verified**: tsc 0 errors; 248 tests; migration applies idempotently on local; DB CHECK constraints accept valid / reject invalid; both API routes compile and auth-gate (401); dev server clean compile.

**Outstanding for Tim**
- Run the migration SQL in the Supabase SQL editor (production) — posted in chat.
- After deploy, existing land-based products need a **Recalculate LCA** pass to pick up measured values (calculator is client-side).
- Optional follow-up: full per-field trajectory chart inside the report PDF (widget already shows it in-app); deep DQ-aggregate wiring of `soilCarbonConfidenceToPedigree()` into the report.
