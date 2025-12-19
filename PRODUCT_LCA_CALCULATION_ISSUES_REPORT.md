# Product LCA Calculation Issues - Critical Bug Report

**Product:** Test Calvados (and all products)
**Date:** 2025-12-19
**Severity:** CRITICAL - Core functionality broken
**Status:** Requires immediate fix

---

## Executive Summary

The product LCA calculation system has **7 critical defects** that prevent accurate carbon footprint reporting. The system is currently not compliant with ISO 14067 or GHG Protocol Product Standard requirements, despite having the database schema designed for compliance.

**Impact:** All LCA calculations are producing incorrect results for:
- ✗ Scope 1, 2 & 3 emissions breakdown
- ✗ Lifecycle stage emissions breakdown
- ✗ Methane (CH4) emissions tracking
- ✗ Nitrous Oxide (N2O) emissions tracking
- ✗ Fossil fuel usage tracking
- ✗ GHG breakdown by gas type
- ✗ Biogenic vs fossil CO2 separation

---

## Critical Issues Identified

### 1. **HARDCODED SCOPE BREAKDOWN (Lines 141-144 in calculate-product-lca-impacts/index.ts)**

**Current Code:**
```typescript
breakdown: {
  by_scope: {
    scope1: 0,      // ❌ HARDCODED TO ZERO
    scope2: 0,      // ❌ HARDCODED TO ZERO
    scope3: totalCarbonFootprint,  // ❌ ALL EMISSIONS ASSIGNED TO SCOPE 3
  },
```

**Problem:**
- ALL emissions are incorrectly assigned to Scope 3
- Scope 1 and Scope 2 are hardcoded to zero
- No logic exists to categorize emissions by scope

**Expected Behavior:**
- **Scope 1:** Direct emissions from owned/controlled sources (e.g., on-site combustion, refrigerant leaks, fermentation)
- **Scope 2:** Indirect emissions from purchased electricity, steam, heating, cooling
- **Scope 3:** All other indirect emissions (raw materials, transport, packaging, distribution, waste)

**For Calvados Specifically:**
- Scope 1: Fermentation emissions, barrel aging emissions, on-site boiler
- Scope 2: Electricity for distillery operations
- Scope 3: Apple growing, transport, bottles, labels, distribution

---

### 2. **INCOMPLETE LIFECYCLE STAGE BREAKDOWN (Lines 146-152)**

**Current Code:**
```typescript
by_lifecycle_stage: {
  raw_materials: ingredientClimate,
  processing: 0,              // ❌ HARDCODED TO ZERO
  packaging_stage: packagingClimate,
  distribution: totalTransport,
  use_phase: 0,               // ❌ HARDCODED TO ZERO
  end_of_life: 0,             // ❌ HARDCODED TO ZERO
},
```

**Problem:**
- Processing emissions are completely ignored (distillation, fermentation, aging)
- Use phase emissions not tracked (even though system boundary might be cradle-to-grave)
- End-of-life not tracked (bottle recycling, waste)
- Only raw materials, packaging, and transport are calculated

**Missing Data Sources:**
- No connection to production sites' energy consumption
- No calculation of process-specific emissions (distillation energy, refrigeration)
- No waste treatment emissions
- No product use emissions

---

### 3. **MISSING METHANE (CH4) TRACKING (Line 157)**

**Current Code:**
```typescript
by_ghg: {
  co2_fossil: totalClimateFossil,
  co2_biogenic: totalClimateBiogenic,
  ch4: 0,  // ❌ HARDCODED TO ZERO
  n2o: 0,  // ❌ HARDCODED TO ZERO
},
```

**Problem:**
- Methane emissions are completely ignored
- Critical for alcoholic beverage production (fermentation produces CH4)
- Required by ISO 14067:4.5.3 and GHG Protocol Product Standard Chapter 8

**Missing CH4 Sources for Calvados:**
- Fermentation process
- Wastewater treatment
- Organic waste decomposition
- Manure from apple orchards (if tracked)
- Transport refrigeration leaks

**Database Support:**
The schema supports this (migration `20251128183507_add_ghg_breakdown_to_impact_metrics.sql` lines 30, 161), but the calculation function doesn't populate it.

---

### 4. **MISSING NITROUS OXIDE (N2O) TRACKING (Line 158)**

**Current Code:**
```typescript
by_ghg: {
  co2_fossil: totalClimateFossil,
  co2_biogenic: totalClimateBiogenic,
  ch4: 0,
  n2o: 0,  // ❌ HARDCODED TO ZERO
},
```

**Problem:**
- Nitrous oxide emissions completely ignored
- N2O has 273x GWP of CO2 (IPCC AR6), so even small amounts matter
- Required for ISO 14067 compliance

**Missing N2O Sources for Calvados:**
- Fertilizer application in apple orchards
- Soil management practices
- Wastewater treatment
- Combustion emissions from heating/distillation

**Database Support:**
Schema supports this (same migration, lines 31, 162), but calculation doesn't populate it.

---

### 5. **NO FOSSIL FUEL USE TRACKING**

**Problem:**
- No tracking of fossil fuel consumption across supply chain
- Missing field in aggregated_impacts for fossil resource scarcity
- `totalFossilResourceScarcity` is calculated (line 101) but not exposed in breakdown

**Impact:**
- Cannot report on fossil resource depletion
- Cannot calculate fossil fuel dependency ratios
- Missing key metric for sustainability reporting (CSRD, CDP)

**Expected Tracking:**
- Diesel for tractors (apple farming)
- Natural gas for distillation/heating
- Diesel for transport
- Petroleum-based inputs (plastics, chemicals)

---

### 6. **INCORRECT AGGREGATION LOGIC**

**Current Implementation (lines 82-108):**
```typescript
let totalClimate = 0;
let ingredientClimate = 0;
let packagingClimate = 0;

for (const material of materials) {
  const climateImpact = Number(material.impact_climate || 0);
  const transportImpact = Number(material.impact_transport || 0);

  totalClimate += climateImpact;  // Only material production
  totalTransport += transportImpact;

  if (material.material_type === 'PACKAGING_MATERIAL') {
    packagingClimate += climateImpact + transportImpact;
  } else {
    ingredientClimate += climateImpact + transportImpact;
  }
}
```

**Problems:**
- Only aggregates material-level impacts
- No facility-level energy consumption
- No process-specific emissions
- No Scope 1 or Scope 2 sources
- Lifecycle stages incomplete

---

### 7. **MISSING GAS INVENTORY DATA**

**Database Schema Expectation (from migration 20251128183507):**
```json
"gas_inventory": {
  "co2_fossil": number,
  "co2_biogenic": number,
  "methane": number,
  "nitrous_oxide": number,
  "hfc_pfc": number
}
```

**Current Implementation:**
- None of these fields are calculated
- GHG breakdown structure not created in aggregated_impacts
- Missing IPCC GWP factors documentation

---

## Root Cause Analysis

### Why This Happened

1. **Incomplete Implementation:** The database schema was designed for ISO 14067 compliance (see migrations), but the Edge Function `calculate-product-lca-impacts` was never fully implemented.

2. **Missing Data Sources:** The function only processes `product_lca_materials` table but doesn't access:
   - Production site energy data
   - Process-specific emission factors
   - Facility-level scope 1 & 2 emissions
   - Waste treatment data

3. **No Integration with Emission Factors:** The function doesn't query the `emissions_factors` table for:
   - CH4 emission factors by process
   - N2O emission factors by fertilizer type
   - Scope-specific categorization

4. **Placeholder Values:** Lines 142-143, 147-152, 157-158 all use hardcoded zeros as placeholders.

---

## Data Flow Gap

**Current Data Flow:**
```
product_materials → calculate-product-lca-impacts → aggregated_impacts
     ↓
Only includes:
- Material production impacts (impact_climate)
- Transport impacts (impact_transport)
```

**Required Data Flow:**
```
product_materials ──┐
production_sites ───┼──→ calculate-product-lca-impacts → aggregated_impacts
emissions_factors ──┤           (with scope categorization,
activity_data ──────┘            lifecycle stage mapping,
                                 GHG gas inventory)
```

**Missing Tables in Calculation:**
- `production_sites` → for Scope 1 & 2 emissions
- `emissions_factors` → for CH4, N2O factors
- `facilities` → for process energy consumption
- `ghg_emissions` → for direct emission activities

---

## Impact on Test Calvados

For a typical Calvados product, the current calculation is missing:

### Scope 1 Emissions (~15-25% of total):
- Fermentation CO2 and CH4
- Oak barrel toasting emissions
- Distillation fuel combustion
- On-site heating/boiler emissions
- Refrigerant leaks (HFCs)

### Scope 2 Emissions (~5-10% of total):
- Electricity for:
  - Distillation columns
  - Pumps and conveyors
  - Cooling systems
  - Lighting and HVAC
  - Bottling line

### Proper Lifecycle Stage Breakdown:
- **Raw Materials:** Apple growing, water extraction
- **Processing:** Fermentation, distillation, aging (barrel production), blending
- **Packaging:** Bottle production, label printing, cork/cap, carton
- **Distribution:** Transport to distributors/retailers
- **Use Phase:** Minimal for spirits
- **End of Life:** Bottle recycling, wastewater treatment

### GHG Gas Inventory:
- **CO2 (fossil):** Transport, electricity generation, heating
- **CO2 (biogenic):** Fermentation (carbon neutral from apples)
- **CH4:** Fermentation, wastewater treatment, manure
- **N2O:** Fertilizers in orchards, wastewater treatment
- **HFCs:** Refrigeration systems

---

## Regulatory Compliance Issues

### ISO 14067:2018 Non-Compliance

**Section 4.5.3:** "Biogenic carbon removals and emissions shall be documented separately"
- ❌ Not separated in breakdown (only in totals)

**Section 5.2.4:** "Uncertainty shall be assessed"
- ❌ No uncertainty tracking (though schema supports it)

**Section 6.4:** "GHG emissions shall be reported by gas type"
- ❌ CH4 and N2O not reported

### GHG Protocol Product Standard Non-Compliance

**Chapter 8:** "Report GHG emissions by gas type (CO2, CH4, N2O, F-gases)"
- ❌ Only CO2 reported, CH4 and N2O missing

**Chapter 9:** "Allocate emissions by lifecycle stage"
- ❌ Incomplete lifecycle stages (missing processing, use, end-of-life)

---

## Recommended Fix Priority

### Priority 1 (Critical - Required for Accuracy):
1. Implement Scope 1, 2, 3 categorization logic
2. Add CH4 and N2O calculation from emission factors
3. Complete lifecycle stage breakdown (especially processing)

### Priority 2 (Important - Required for Compliance):
4. Implement GHG gas inventory structure
5. Add fossil fuel usage tracking
6. Integrate production site emissions data

### Priority 3 (Enhancement):
7. Add uncertainty tracking (schema already supports)
8. Implement IPCC GWP factor documentation
9. Add validation functions for data quality

---

## Files Requiring Changes

### 1. **supabase/functions/calculate-product-lca-impacts/index.ts** (PRIMARY)
- Lines 82-164: Complete rewrite of aggregation logic
- Add scope categorization
- Add GHG inventory calculations
- Add lifecycle stage logic
- Integrate emissions_factors queries

### 2. **lib/product-lca-calculator.ts** (SECONDARY)
- May need updates to pass additional context
- Ensure production site data is available

### 3. **lib/impact-waterfall-resolver.ts** (REVIEW)
- Verify it returns CH4, N2O factors
- Ensure scope information available

---

## Testing Requirements

After fixes are implemented, must verify:

1. ✓ Scope 1 + Scope 2 + Scope 3 = Total Carbon Footprint
2. ✓ All lifecycle stages sum to total
3. ✓ CH4 emissions converted to CO2e using IPCC GWP
4. ✓ N2O emissions converted to CO2e using IPCC GWP
5. ✓ Fossil vs biogenic CO2 separation accurate
6. ✓ GHG breakdown validates (see validate_ghg_breakdown function)
7. ✓ Data quality tiers assigned correctly
8. ✓ Test with multiple products (Calvados, Beer, Wine)

---

## References

- ISO 14067:2018 - Carbon footprint of products
- GHG Protocol Product Life Cycle Accounting and Reporting Standard
- IPCC AR6 GWP values (CH4: 27.9, N2O: 273)
- Database migrations:
  - `20251128183507_add_ghg_breakdown_to_impact_metrics.sql`
  - `20251219130230_20251219_add_iso_14064_uncertainty_tracking.sql`

---

**End of Report**
