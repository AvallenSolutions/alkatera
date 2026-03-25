# LCA Wizard — Comprehensive Test Plan

> **Goal:** Triple-check every function, data entry point, calculation, and output of the entire LCA wizard to ensure flawless operation.

---

## 1. UNIT TESTS

### 1.1 System Boundaries (`lib/system-boundaries.ts`)

- [ ] `getBoundaryDefinition` — valid boundaries return correct definition; unknown defaults to cradle-to-gate
- [ ] `getBoundaryLabel` — correct human-readable label for all 4 boundaries
- [ ] `getBoundaryIncludedStages` — gate=3, shelf=4, consumer=5, grave=6 stages
- [ ] `getBoundaryExcludedStages` — inverse of included; gate excludes distribution, use_phase, end_of_life
- [ ] `isStageIncluded` — true/false for all boundary+stage combinations
- [ ] `boundaryNeedsUsePhase` — only true for consumer and grave
- [ ] `boundaryNeedsEndOfLife` — only true for grave
- [ ] `boundaryNeedsDistribution` — true for shelf, consumer, grave; false for gate
- [ ] `boundaryToDbEnum` / `boundaryFromDbEnum` — hyphen/underscore conversion round-trips
- [ ] `getDefaultLossConfig` — category-specific loss percentages; null category returns generic defaults
- [ ] `getDefaultConsumerWaste` — correct waste % per category (spirits=1%, beer=3%, wine=10%)
- [ ] `getConsumerWasteEntry` — returns entry with rate, source, confidence; null for unknown category
- [ ] `calculateLossMultiplier` — 1.0 for gate; compound loss for wider boundaries; handles 0% and 50% edge

### 1.2 Wizard Step Logic (`WizardContext.tsx`)

- [ ] `getTotalSteps` — 10/11/12/13 for gate/shelf/consumer/grave; +1 when showGuide=true
- [ ] `getStepIdsForBoundary` — correct ordering for all 4 boundaries; dynamic steps inserted between boundary and calculate; guide prepended correctly
- [ ] Edge: empty string boundary

### 1.3 Material Validation (`types.ts`)

- [ ] `materialHasAssignedFactor` — true when data_source='supplier' + supplier_product_id
- [ ] `materialHasAssignedFactor` — true when data_source='openlca' + data_source_id
- [ ] `materialHasAssignedFactor` — false when data_source is null
- [ ] `materialHasAssignedFactor` — false when data_source='supplier' but no supplier_product_id
- [ ] `materialHasAssignedFactor` — false when data_source='openlca' but no data_source_id

### 1.4 Use Phase Factors (`lib/use-phase-factors.ts`)

- [ ] `getDefaultUsePhaseConfig` — beer=refrigerated+carbonated; wine=refrigerated; spirits=neither
- [ ] `calculateUsePhaseEmissions` — zero volume returns zero
- [ ] `calculateUsePhaseEmissions` — non-refrigerated, non-carbonated returns zero
- [ ] `calculateUsePhaseEmissions` — refrigeration-only calculates correctly (7 days, 50/50 split)
- [ ] `calculateUsePhaseEmissions` — carbonation-only calculates correctly (beer vs sparkling_wine)
- [ ] `calculateUsePhaseEmissions` — both enabled adds correctly
- [ ] `calculateUsePhaseEmissions` — country-specific grid factor changes result
- [ ] Edge: volume=0, refrigerationDays=0, retailRefrigerationSplit at boundaries (0 and 1)

### 1.5 End of Life Factors (`lib/end-of-life-factors.ts`)

- [ ] `getRegionalDefaults` — correct % splits for EU/UK/US; pathways sum to 100
- [ ] `getMaterialFactorKey` — maps packaging categories to correct factor keys; PET vs HDPE distinction
- [ ] `calculateMaterialEoL` — gross, avoided (negative), and net for each material type
- [ ] `calculateMaterialEoL` — aluminium has large recycling credit
- [ ] `calculateMaterialEoL` — override pathways work correctly
- [ ] Edge: quantity=0, pathways sum != 100, all recycling, all landfill

### 1.6 Distribution Factors (`lib/distribution-factors.ts`)

- [ ] `calculateDistributionEmissions` — single leg (truck 100km, 1kg product)
- [ ] `calculateDistributionEmissions` — multi-leg chain (truck + ship + truck)
- [ ] `calculateDistributionEmissions` — zero distance returns zero
- [ ] `calculateDistributionEmissions` — air freight > truck for same distance
- [ ] `getDefaultDistributionConfig` — returns config with correct weight and default legs
- [ ] Edge: empty legs array, weight=0, very large distances

### 1.7 Data Quality Assessment (`lib/data-quality-assessment.ts`)

- [ ] `assessMaterialDataQuality` — Primary_Verified scores higher than Secondary_Estimated
- [ ] `assessMaterialDataQuality` — pedigree matrix scores 1-5 correctly
- [ ] `assessMaterialDataQuality` — temporal: recent year scores better; uses referenceYear not current year
- [ ] `assessMaterialDataQuality` — geographic match scoring
- [ ] `assessAggregateDataQuality` — impact-weighted average DQI; data source breakdown sums to 100
- [ ] `propagateUncertainty` — positive %; handles single material and many materials
- [ ] Edge: zero-impact materials, referenceYear far in past

### 1.8 Impact Waterfall Resolver (`lib/impact-waterfall-resolver.ts`)

- [ ] `normalizeToKg` — g/1000, kg*1, ml/1000, l*1, tonne*1000, unknown defaults to kg
- [ ] `validateMaterialsBeforeCalculation` — assigned factors in validMaterials; unassigned in missingData; empty array returns empty results
- [ ] `resolveImpactFactors` — supplier data source path
- [ ] `resolveImpactFactors` — openlca data source path
- [ ] `resolveImpactFactors` — ecoinvent proxy fallback path (name-based)
- [ ] `resolveImpactFactors` — ecoinvent process name fallback path
- [ ] `resolveImpactFactors` — DEFRA fallback path
- [ ] `resolveImpactFactors` — cached CO2 factor last-resort path
- [ ] `resolveImpactFactors` — complete miss returns null/error
- [ ] Edge: quantity as string vs number, null unit, zero quantity

### 1.9 Assumptions Generator (`lib/lca-assumptions-generator.ts`)

- [ ] `generateAssumptions` — correct for all boundary types
- [ ] `generateAssumptions` — includes facility assumption when hasFacilities=true
- [ ] `generateAssumptions` — includes use-phase/EoL for consumer/grave
- [ ] `generateAssumptions` — reference year appears in output
- [ ] Edge: zero materials, no facilities, all optional fields undefined

### 1.10 Interpretation Engine (`lib/lca-interpretation-engine.ts`)

- [ ] `runContributionAnalysis` — identifies dominant contributor; sorts descending; % sums to ~100%
- [ ] `runContributionAnalysis` — tags significant contributors (>10%)
- [ ] `generateLcaInterpretation` — complete LcaInterpretationResult structure
- [ ] `generateLcaInterpretation` — sensitivity analysis tests top 3 contributors
- [ ] `generateLcaInterpretation` — completeness check identifies missing data
- [ ] `generateLcaInterpretation` — consistency check flags methodology mismatches
- [ ] Edge: zero total impact, single material, all equal contributions

### 1.11 Report Transformer (`lib/utils/lca-report-transformer.ts`)

- [ ] Transforms DB PCF record to LCAReportData format
- [ ] Handles missing aggregated_impacts gracefully
- [ ] Maps lifecycle stage breakdown correctly
- [ ] Handles GHG breakdown with all gas types
- [ ] Data quality section populated from aggregated_impacts
- [ ] Reference year read from `lca.reference_year`, not hardcoded

### 1.12 Calculator (`lib/product-lca-calculator.ts`)

- [ ] `generateCalculationFingerprint` — same inputs produce same hash; different inputs differ; inputs sorted for determinism
- [ ] `buildResultFromPinnedMaterial` — scales all impact fields proportionally; tags source as "Pinned"
- [ ] `calculateProductLCA` — success=true with valid pcfId on success
- [ ] `calculateProductLCA` — success=false with error on failure
- [ ] `calculateProductLCA` — calls resolveImpactFactors for each material
- [ ] `calculateProductLCA` — calls aggregateProductImpacts with referenceYear
- [ ] `calculateProductLCA` — generates interpretation
- [ ] `calculateProductLCA` — progress callback fires at expected percentages
- [ ] `calculateProductLCA` — referenceYear stored in DB record, not current year

### 1.13 Aggregator (`lib/product-lca-aggregator.ts`)

- [ ] Sums material impacts correctly
- [ ] Applies facility allocation (attribution ratio)
- [ ] Includes use-phase emissions when config provided
- [ ] Includes EoL emissions when config provided
- [ ] Includes distribution emissions when config provided
- [ ] Applies product loss multipliers
- [ ] Calculates DQI score using referenceYear parameter (not hardcoded)
- [ ] Returns warnings array
- [ ] Stores calculation fingerprint

### 1.14 DataQualityStep Scoring Functions

- [ ] `scoreGeographicCoverage` — empty=0; named countries=60+; vague terms penalised
- [ ] `scoreTechnologicalCoverage` — empty=0; process keywords boost; vague terms penalised
- [ ] `computeTemporalCoverage` — single allocation year; multi-year range; no allocations
- [ ] `computeGeographicCoverage` — aggregates unique countries from materials and facilities
- [ ] `computeTechnologicalCoverage` — returns template for known product types; appends facility names
- [ ] `classifyMaterials` — counts high/medium/low correctly
- [ ] `computePrecision` — >60% high='high'; >50% low='low'; else 'medium'
- [ ] `computeCompleteness` — rounds to nearest 5%; 100% when all have data; 0% when empty

### 1.15 ReviewStep Logic

- [ ] `getRecommendedReviewType` — comparative assertion always returns 'external_panel'
- [ ] `getRecommendedReviewType` — public audience returns 'external_expert'
- [ ] `getRecommendedReviewType` — B2B only returns 'internal'
- [ ] `getRecommendedReviewType` — internal only returns 'none'

### 1.16 BoundaryStep Logic

- [ ] `composeFunctionalUnit` — builds "500 ml of Pale Ale at factory gate"
- [ ] `composeFunctionalUnit` — missing product data defaults to "1 unit of product"
- [ ] `composeFunctionalUnit` — different boundaries change delivery point text
- [ ] `getFunctionalUnitHint` — returns null when value contains quantity pattern
- [ ] `getFunctionalUnitHint` — returns hint when value lacks quantity

### 1.17 DistributionStep Logic

- [ ] `getProductWeightKg` — 500ml volume = 0.5kg liquid + packaging
- [ ] `getProductWeightKg` — no product volume falls back to summing all materials
- [ ] `getProductWeightKg` — packaging in grams converted correctly
- [ ] `getProductWeightKg` — returns minimum 0.001

---

## 2. INTEGRATION TESTS

### 2.1 WizardContext Data Flow

- [ ] `loadMaterialAndFacilityData` — fetches product, materials, validates, sets preCalcState with correct statuses
- [ ] Material with assigned but unresolved factor — DB has factor, resolver fails: status = 'assigned', not 'missing'
- [ ] Facility allocation pre-population — annual_production_volume splits correctly by allocation_percentage
- [ ] **Reference year cascade** — changing referenceYear auto-selects matching reporting session; no match falls back to latest
- [ ] **Boundary change cascade** — changing boundary resets post-calculate completed steps; preserves pre-calculate steps
- [ ] Load PCF data with wizard progress — restores completed steps with correct offset based on boundary
- [ ] Auto-save debounce — field updates trigger save after 2000ms; rapid updates reset timer

### 2.2 Calculation Pipeline (Calculator -> Aggregator -> Interpretation)

- [ ] **Cradle-to-gate flow** — materials resolved -> aggregated (no dist/use/EoL) -> interpretation generated
- [ ] **Cradle-to-grave flow** — materials -> distribution -> use-phase -> EoL -> loss multipliers -> aggregation -> interpretation
- [ ] **Pinned factors mode** — pinnedPcfId set: uses buildResultFromPinnedMaterial; fingerprints match
- [ ] **Facility allocation integration** — facility emissions attributed by production volume ratio; owned vs third_party
- [ ] **DQI score propagation** — material confidence -> impact-weighted DQI -> stored in PCF -> displayed in DataQualityStep
- [ ] **Fallback event tracking** — resolver fallthrough records FallbackEvent; appears in SummaryStep

### 2.3 Step Validation Chain

- [ ] Materials -> Facilities -> Calculate — cannot proceed if materials missing factors or facility volumes empty
- [ ] Boundary -> Distribution -> UsePhase -> EoL -> Calculate — for grave, all 4 conditional steps appear
- [ ] Goal validation — intendedApplication, reasonsForStudy, intendedAudience all required
- [ ] Cutoff validation — cutoffCriteria and at least one assumption required
- [ ] DataQuality validation — all three coverage fields required
- [ ] Review validation — criticalReviewType must be selected

### 2.4 Form Data Persistence

- [ ] Save progress round-trip — save to DB -> reload -> all fields match
- [ ] Assumptions serialisation — saved as [{type, text}]; loaded back as flat strings
- [ ] System boundary sync — saves to both PCF and product records
- [ ] Lifecycle config persistence — distribution/usePhase/eol/productLoss configs saved when present; not included when null

---

## 3. END-TO-END WIZARD FLOW TESTS

### 3.1 Happy Path: Cradle-to-Gate

- [ ] Wizard loads with materials pre-validated
- [ ] All materials have emission factors (canCalculate=true)
- [ ] Skip through Materials step (all green)
- [ ] Facility step shows linked facilities with pre-populated volumes
- [ ] Boundary step defaults to cradle-to-gate; functional unit auto-generated
- [ ] Calculate step: "Start Calculation" -> progress overlay -> success
- [ ] Goal step: fill intendedApplication, reasonsForStudy, select audiences
- [ ] Cutoff step: assumptions auto-seeded; add cutoff text
- [ ] Data Quality step: fields auto-filled from materials/facilities
- [ ] Interpretation step: "Generate Analysis" -> results displayed
- [ ] Review step: recommendation suggests review type based on audience
- [ ] Summary step: compliance checklist all green; generate PDF -> download

### 3.2 Happy Path: Cradle-to-Grave

- [ ] Same as above but boundary = cradle-to-grave
- [ ] Distribution step appears: configure transport legs with scenario presets
- [ ] Use Phase step appears: configure refrigeration and carbonation
- [ ] End of Life step appears: select region, configure pathways per material
- [ ] Product loss rates configured in Boundary step
- [ ] Calculate receives all configs; aggregation includes all lifecycle stages

### 3.3 Resume Flow

- [ ] Complete steps 1-6, save progress, close wizard
- [ ] Re-open wizard: resume banner appears
- [ ] Click "Resume": jumps to last completed step + 1
- [ ] Click "Start from beginning": starts at step 1

### 3.4 Guide Step Flow

- [ ] First-time user: guide step appears at step 1
- [ ] User checks "Don't show again" -> preference saved
- [ ] Next wizard open: guide step skipped

### 3.5 Material Fix Flow

- [ ] One material missing emission factor
- [ ] Click "Fix" -> InlineIngredientSearch appears
- [ ] Select emission factor -> DB updated -> validation re-runs
- [ ] Material status changes from 'missing' to 'resolved'
- [ ] canCalculate becomes true

### 3.6 Boundary Change Mid-Wizard

- [ ] Complete calculation with cradle-to-gate
- [ ] Go back to Boundary step, select cradle-to-grave
- [ ] Confirmation dialog appears
- [ ] Confirm: use-phase, distribution, end-of-life steps inserted
- [ ] Post-calculate completed steps reset; pre-calculate preserved

---

## 4. EDGE CASES AND REGRESSION TESTS

### 4.1 Reference Year

- [ ] Year 2020 selected: temporal score drops; no matching facility session -> falls back to latest
- [ ] Current year: matches most recent session
- [ ] Year change cascades: session re-selection + temporal coverage update

### 4.2 Material Validation

- [ ] All materials missing factors: canCalculate=false
- [ ] Mix of resolved, assigned, missing: only 'missing' blocks calculation
- [ ] Resolver timeout for assigned material: status = 'assigned' not 'missing'
- [ ] Material with zero quantity: validates but contributes zero impact
- [ ] Proxy factor detection: isProxy=true when matched_source_name differs from material_name

### 4.3 Facility Allocation

- [ ] No facilities linked: manufacturing emissions skipped
- [ ] Facility with no reporting sessions: uses default date range
- [ ] Multiple facilities with different allocation percentages: volumes split correctly
- [ ] Division by zero: facilityTotalProduction=0 handled gracefully
- [ ] Mismatched production volume units

### 4.4 EoL Pathways

- [ ] Pathways sum < 100: validation error
- [ ] Pathways sum > 100: validation error
- [ ] Pathways sum = 99.5: passes (tolerance 1%)
- [ ] All recycling: net may be negative (credits exceed emissions)
- [ ] Region change resets pathways to regional defaults

### 4.5 Distribution

- [ ] Single leg with zero distance: total=0, Next disabled
- [ ] Leg with no transport mode: invalid, Next disabled
- [ ] Air freight plausibility warning for short distance (<500km)
- [ ] Scenario preset populates legs; modification switches to "Custom"

### 4.6 Use Phase

- [ ] Non-beverage product (no volume): preview returns null
- [ ] Volume unit edge cases: 'litre' vs 'l' vs 'liter' all normalise
- [ ] Consumer country code = null: falls back to global average
- [ ] Refrigeration days = 0: zero refrigeration emissions

### 4.7 Calculation

- [ ] Calculation with no facilities: succeeds with materials-only
- [ ] Network failure during resolveImpactFactors: error toast, calculating=false
- [ ] Duplicate rapid clicks: does not create two PCF records
- [ ] Pinned mode with changed quantities: scales correctly

### 4.8 Summary and PDF

- [ ] Compliance < 60%: warning shown, PDF generation blocked
- [ ] All fields complete: PDF button enabled
- [ ] PDF generation failure: error state with "Try Again"
- [ ] Download filename contains product name (sanitised) and date

### 4.9 Auto-Save

- [ ] No save before PCF exists (pcfId is null)
- [ ] Skips if JSON matches lastSavedDataRef
- [ ] Save failure: error toast, saving state reset
- [ ] Debounce prevents overlapping saves

### 4.10 Subscription Tier Locking

- [ ] Seed tier: only cradle-to-gate available
- [ ] Blossom tier: gate and shelf available
- [ ] Canopy tier: all boundaries available

### 4.11 Comparative Assertion

- [ ] isComparativeAssertion=true: warning in GoalStep; ReviewStep locks to external_panel
- [ ] External audience without comparative: suggestion for external review shown

---

## 5. TEST FILE ORGANISATION

```
components/lca/EnhancedComplianceWizard/__tests__/
  wizard-logic.test.ts                  (EXISTS - extend)
  wizard-context-actions.test.ts        (NEW - updateField cascades, boundary change, ref year)
  wizard-validation.test.ts             (NEW - step validation rules, Next button disabling)
  wizard-resume.test.ts                 (NEW - resume flow, progress restoration)
  goal-step.test.ts                     (NEW - audience handling, comparative assertion)
  boundary-step.test.ts                 (NEW - composeFunctionalUnit, getFunctionalUnitHint, loss)
  material-validation.test.ts           (NEW - materialHasAssignedFactor, tri-state validation)
  data-quality-step.test.ts             (NEW - scoring functions, auto-fill, DQI computation)
  review-step.test.ts                   (NEW - getRecommendedReviewType)
  summary-step.test.ts                  (NEW - useComplianceChecklist, PDF state machine)
  distribution-step.test.ts             (NEW - getProductWeightKg, scenario handling)

lib/__tests__/
  product-lca-calculator.test.ts        (EXISTS - extend with pinned mode, fingerprint)
  product-lca-aggregator-full.test.ts   (EXISTS - extend with loss multipliers, DQI, referenceYear)
  system-boundaries.test.ts             (EXISTS - extend with loss config, consumer waste)
  use-phase-factors.test.ts             (EXISTS)
  end-of-life-factors.test.ts           (EXISTS)
  distribution-factors.test.ts          (EXISTS)
  lca-assumptions-generator.test.ts     (NEW)
  data-quality-assessment.test.ts       (NEW)
  lca-interpretation-engine.test.ts     (NEW)
  lca-report-transformer.test.ts        (NEW)
  impact-waterfall-resolver.test.ts     (NEW - normalizeToKg, validateMaterialsBeforeCalculation)
```

---

## 6. PRIORITY ORDER

1. **Impact Waterfall Resolver** — most frequent source of user-visible bugs (missing emission factors)
2. **Calculator + Aggregator** — core calculation pipeline, referenceYear propagation
3. **WizardContext cascades** — reference year, boundary change, facility session selection
4. **Data Quality Assessment** — referenceYear was hardcoded; needs verification
5. **System Boundaries + Loss Config** — calculation correctness for wider boundaries
6. **Use Phase / EoL / Distribution** — lifecycle stage accuracy
7. **Step validation + form persistence** — UX correctness
8. **E2E happy paths** — full flow confidence
9. **Edge cases** — robustness
