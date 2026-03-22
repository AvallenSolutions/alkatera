# Viticulture Improvements + Multi-Vintage Tracking

## Context

Research against global best practices (OIV GHGAP, EU PEFCR, IPCC 2019,
SBTi FLAG, AWRI, SWNZ, SWGB) identified gaps in the viticulture calculator
and an opportunity to add year-on-year vintage tracking.

The codebase already has: AWARE water scarcity factors (`lib/calculations/water-risk.ts`),
all 18 ReCiPe 2016 impact categories in `WaterfallResult`, a mature reporting-year
system with fiscal year support (`hooks/useReportingPeriod.ts`, `hooks/usePersistedYear.ts`),
and Recharts for charting.

---

## Phase 1: Calculator Scientific Improvements

### 1.1 Add crop residue N2O emissions
**Why:** IPCC Chapter 11 requires N2O from crop residues returned to soil.
Vine prunings are a significant nitrogen source that we currently ignore.
**What:**
- Add `pruning_residue_returned: boolean` field to `VineyardGrowingProfile` type
  and questionnaire (Step 1: Soil & Land)
- Add IPCC crop residue N2O calculation to `viticulture-calculator.ts`:
  - Default pruning biomass: ~2.5 t DM/ha/yr for established vines
  - N content of vine prunings: ~0.8% (IPCC Table 11.2)
  - Apply EF1 by climate zone (same as fertiliser N)
- Classify as FLAG emissions (field-level N2O)
- Add migration to extend `vineyard_growing_profiles` column
- Update unit tests

### 1.2 Integrate AWARE water scarcity weighting
**Why:** We track irrigation volume (m3) but don't apply scarcity weighting.
A vineyard in Kent using 500 m3 has a very different real-world impact to one
in Mendoza using 500 m3. The AWARE methodology is already in our codebase.
**What:**
- Import `getAwareFactor()` from `lib/calculations/water-risk.ts` in the
  viticulture calculator
- Use the vineyard's `location_country_code` to look up the AWARE factor
- Populate `impact_water_scarcity` on the synthetic irrigation row
  (currently only `impact_water` is set)
- The aggregator and reports already handle `impact_water_scarcity`, so
  no downstream changes needed
- Update unit tests with scarcity-weighted assertions

### 1.3 Expand pesticide impact beyond production emissions
**Why:** Vineyards are among the most treated crops globally. We only capture
the embodied carbon of manufacturing pesticides, missing ecotoxicity, human
toxicity, and freshwater eutrophication from application. The WaterfallResult
already has fields for all these categories.
**What:**
- Add characterisation factors for common vineyard pesticides:
  - Copper fungicide (organic/conventional): freshwater ecotoxicity,
    terrestrial ecotoxicity
  - Sulfur: lower toxicity profile
  - Synthetic fungicides (mancozeb, folpet): human toxicity, ecotoxicity
  - Herbicides (glyphosate): freshwater eutrophication, ecotoxicity
- Add `pesticide_type` enum: `copper_fungicide`, `sulfur`, `synthetic_fungicide`,
  `generic` (current default)
- Populate `impact_terrestrial_ecotoxicity`, `impact_freshwater_ecotoxicity`,
  `impact_human_toxicity_non_carcinogenic`, `impact_freshwater_eutrophication`
  on the synthetic pesticide row
- Source factors from USEtox 2.0 / PestLCI consensus values
- Add to questionnaire Step 2 (Inputs) as optional detail level
- Update unit tests

### 1.4 Add soil management options
**Why:** Missing biochar and integrated practices. The research shows biochar-compost
can increase sequestration from 0.156 to 0.356 Mg C/ha/yr.
**What:**
- Add to `SoilManagement` enum: `biochar_compost`, `regenerative_integrated`
- Add corresponding defaults to `SOIL_CARBON_REMOVAL_DEFAULTS` in ghg-constants.ts:
  - `biochar_compost`: 700 kg CO2e/ha/yr
  - `regenerative_integrated`: 600 kg CO2e/ha/yr
- Update questionnaire radio buttons
- Update unit tests

---

## Phase 2: Multi-Vintage Data Model + Year-on-Year Tracking

### 2.1 Add vintage year to growing profiles
**Why:** Growing practices change year to year (different fertiliser amounts,
weather-driven irrigation differences, yield variation). Best practice (AWRI)
is to collect 3+ years and use median values. Users also want to track their
improvement over time.
**What:**
- Add `vintage_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())`
  column to `vineyard_growing_profiles`
- Change UNIQUE constraint from `(vineyard_id)` to `(vineyard_id, vintage_year)`
- Update API routes to accept `vintage_year` parameter
- Update questionnaire to show year selector at the top
- Pre-populate new vintage from previous year's data (copy-forward)
- Migration to backfill existing profiles with current year

### 2.2 Multi-vintage averaging in calculator
**Why:** Single-year data is noisy (drought year vs wet year). The OIV and
AWRI both recommend multi-year averaging.
**What:**
- Add `calculateMultiVintageImpacts()` function that:
  - Accepts an array of `ViticultureCalculatorInput` (one per vintage)
  - Calculates impacts for each vintage independently
  - Returns median values across vintages (more robust than mean for outliers)
  - Includes per-vintage breakdown for transparency
  - Flags data quality as HIGH only when 3+ vintages available
- Update `product-lca-calculator.ts` section 5c to query all vintage
  profiles for a vineyard and use multi-vintage averaging
- Add `vintages_used: number` and `vintage_years: number[]` to the
  methodology notes

### 2.3 Vineyard dashboard page
**Why:** Users need a dedicated place to see their vineyard's environmental
performance over time, not just buried in product LCA results.
**What:**
- Create `/app/(authenticated)/vineyards/page.tsx` - vineyard list page
  (replaces Settings-only access)
- Create `/app/(authenticated)/vineyards/[id]/page.tsx` - single vineyard
  detail page with:
  - **Header:** Vineyard name, location, hectares, certification badge
  - **Vintage selector:** Year dropdown (matching existing usePersistedYear pattern)
  - **Growing profile summary card:** Key inputs for selected vintage
  - **Impact breakdown card:** Climate, water, land, ecotoxicity for selected vintage
  - **Year-on-year trend charts** (Recharts):
    - Total emissions per hectare (line chart, all vintages)
    - Emissions by source (stacked area: fertiliser, fuel, irrigation, pesticides)
    - Water consumption + scarcity-weighted impact (dual axis)
    - Soil carbon removals trend (bar chart)
  - **Benchmark comparison:** How this vineyard compares to sector averages
    (research found 0.9-1.9 kg CO2e/bottle 90% CI)
  - **Improvement indicators:** Green/red arrows showing YoY change per category
- Gate behind `viticulture_beta` FeatureGate
- Add to sidebar under "Capture Data" (replace current Settings-only link)

### 2.4 Vintage history table
**Why:** Users need to see all their vintages at a glance and manage them.
**What:**
- Add vintage history table component to vineyard detail page
- Columns: Year, Yield (t/ha), Total Emissions (kg CO2e/ha), Water (m3/ha),
  Soil Carbon (kg CO2e/ha), Data Quality grade, Actions (edit/copy/delete)
- "Add New Vintage" button that copies forward from most recent year
- Inline status badges: Complete (all fields filled) vs Incomplete

---

## Phase 3: Integration Polish

### 3.1 Product LCA vintage context
**Why:** When a product LCA runs, the user should see which vintage data
was used and how multi-vintage averaging affected the result.
**What:**
- Add viticulture methodology note to LCA results showing:
  "Based on N vintages (2023, 2024, 2025) using median averaging"
- Show per-vintage contribution in the LCA detail view
- Flag if only 1 vintage available with recommendation to add more

### 3.2 Questionnaire improvements
**Why:** Make data entry faster and more intuitive.
**What:**
- Auto-populate vineyard's country code and climate zone from vineyard record
- Add "Copy from previous vintage" button
- Add inline help tooltips explaining each field's purpose
- Add validation warnings (e.g. yield >25 t/ha is unusually high)
- Show sector benchmarks inline (e.g. "UK average: 5-8 t/ha")

### 3.3 Export and reporting
**Why:** Wineries need to report their vineyard impacts externally.
**What:**
- Add vineyard impact data to the sustainability report generator
- Include vintage trend charts in PDF/PPTX exports
- Add OIV GHGAP-aligned summary format option

---

## Implementation Order

1. **Phase 1.1** - Crop residue N2O (quick win, ~1 hour)
2. **Phase 1.4** - Soil management options (quick win, ~30 mins)
3. **Phase 1.2** - AWARE water scarcity (moderate, ~1 hour, already have the code)
4. **Phase 2.1** - Vintage year data model (foundation for everything else)
5. **Phase 2.2** - Multi-vintage averaging (builds on 2.1)
6. **Phase 2.3** - Vineyard dashboard page (biggest UX impact)
7. **Phase 2.4** - Vintage history table (part of dashboard)
8. **Phase 1.3** - Pesticide ecotoxicity (highest effort, can run in parallel)
9. **Phase 3.1-3.3** - Integration polish (after core is solid)

---

## Files Affected

### New Files
- `app/(authenticated)/vineyards/page.tsx`
- `app/(authenticated)/vineyards/[id]/page.tsx`
- `components/vineyards/VineyardDashboard.tsx`
- `components/vineyards/VintageHistoryTable.tsx`
- `components/vineyards/VineyardTrendCharts.tsx`
- `components/vineyards/VineyardBenchmark.tsx`
- `supabase/migrations/YYYYMMDD_viticulture_vintage_support.sql`
- `supabase/migrations/YYYYMMDD_viticulture_crop_residue.sql`

### Modified Files
- `lib/viticulture-calculator.ts` - crop residue, AWARE, pesticide ecotox, multi-vintage
- `lib/types/viticulture.ts` - new fields, enums, multi-vintage types
- `lib/ghg-constants.ts` - crop residue constants, new soil management defaults
- `lib/product-lca-calculator.ts` - multi-vintage query + averaging
- `lib/__tests__/viticulture-calculator.test.ts` - new test cases
- `components/vineyards/VineyardGrowingQuestionnaire.tsx` - new fields, vintage selector
- `components/layouts/Sidebar.tsx` - update vineyards link to /vineyards/
- `app/api/vineyards/[id]/growing-profile/route.ts` - vintage year support
