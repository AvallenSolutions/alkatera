# Scope 3 Calculation Comparison: Dashboard vs Company Emissions Page

## Current Discrepancy
- **Dashboard:** 283.4 tCO₂e
- **Company Emissions Page:** 275.607 tCO₂e
- **Difference:** 7.793 tCO₂e (2.8% higher on Dashboard)

---

## Company Emissions Page Calculation (CORRECT)

**File:** `/app/(authenticated)/reports/company-footprint/[year]/page.tsx`

```typescript
// Lines 70-73: Uses shared Scope 3 hook
const { scope3Emissions, isLoading: isLoadingScope3, refetch: refetchScope3 } = useScope3Emissions(
  currentOrganization?.id,
  year
);

// Line 263: Gets total from hook
const scope3TotalCO2e = scope3Emissions.total;

// Lines 265-272: Calculates live totals
const liveScope1Total = scope1CO2e + fleetCO2e;
const liveScope2Total = scope2CO2e;
const liveScope3Total = scope3TotalCO2e;  // ← Uses hook directly

const liveTotalEmissions = liveScope1Total + liveScope2Total + liveScope3Total;
```

### Data Flow:
1. `useScope3Emissions` hook fetches data
2. Returns `scope3Emissions.total`
3. Used directly as `liveScope3Total`

---

## Dashboard Calculation (SUSPECT)

**File:** `/hooks/data/useCompanyFootprint.ts`

```typescript
// Lines 44-47: Calls shared Scope 3 hook
const { scope3Emissions, isLoading: isLoadingScope3 } = useScope3Emissions(
  currentOrganization?.id,
  targetYear
);

// Line 68: Passes to calculateLiveEmissions
const liveData = await calculateLiveEmissions(targetYear, scope3Emissions);

// Lines 109-112: Function signature
async function calculateLiveEmissions(
  year: number,
  scope3Data: { total: number; products: number; business_travel: number; ... }
) {

  // Lines 118-269: Calculates Scope 1 & 2 from facilities and fleet
  // ... facility activity data
  // ... fleet activities

  // Line 272: Uses Scope 3 data from shared hook
  const scope3Total = scope3Data.total;  // ← Same as Company Emissions

  // Line 274: Calculates total
  const totalEmissions = scope1Total + scope2Total + scope3Total;

  // Lines 278-296: Returns breakdown
  return {
    total: totalEmissions,
    breakdown: {
      scope1: scope1Total,
      scope2: scope2Total,
      scope3: {
        products: scope3Data.products,           // ← From hook
        business_travel: scope3Data.business_travel,
        purchased_services: scope3Data.purchased_services,
        employee_commuting: scope3Data.employee_commuting,
        capital_goods: scope3Data.capital_goods,
        logistics: scope3Data.downstream_logistics,
        waste: scope3Data.operational_waste,
        marketing: scope3Data.marketing_materials,
        total: scope3Total,
      },
      total: totalEmissions,
    },
  };
}
```

---

## The Shared Hook: useScope3Emissions

**File:** `/hooks/data/useScope3Emissions.ts`

### Products Calculation (Lines 67-116):
```typescript
// 1. Fetch products emissions (Category 1: Purchased Goods & Services)
const { data: productionData } = await supabase
  .from("production_logs")
  .select("product_id, volume, unit, units_produced, date")
  .eq("organization_id", organizationId)
  .gte("date", yearStart)
  .lte("date", yearEnd);

if (productionData) {
  for (const log of productionData) {
    const { data: lca } = await supabase
      .from("product_lcas")
      .select("total_ghg_emissions, status")
      .eq("product_id", log.product_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lca && lca.total_ghg_emissions && lca.total_ghg_emissions > 0) {
      const unitsProduced = log.units_produced || 0;

      if (unitsProduced > 0) {
        // USES total_ghg_emissions directly from product_lcas table
        const impactKg = lca.total_ghg_emissions * unitsProduced;
        breakdown.products += impactKg;
      }
    }
  }
}
```

### Overhead Categories (Lines 118-170):
```typescript
// 2. Fetch corporate overhead entries (all other Scope 3 categories)
const { data: reportData } = await supabase
  .from("corporate_reports")
  .select("id")
  .eq("organization_id", organizationId)
  .eq("year", year)
  .maybeSingle();

if (reportData) {
  const { data: overheadData } = await supabase
    .from("corporate_overheads")
    .select("category, computed_co2e, material_type")
    .eq("report_id", reportData.id);

  if (overheadData) {
    overheadData.forEach((entry) => {
      const co2e = entry.computed_co2e || 0;

      switch (entry.category) {
        case "business_travel":
          breakdown.business_travel += co2e;
          break;
        case "employee_commuting":
          breakdown.employee_commuting += co2e;
          break;
        case "capital_goods":
          breakdown.capital_goods += co2e;
          break;
        case "operational_waste":
          breakdown.operational_waste += co2e;
          break;
        case "downstream_logistics":
          breakdown.downstream_logistics += co2e;
          break;
        case "purchased_services":
          if (entry.material_type) {
            breakdown.marketing_materials += co2e;
          } else {
            breakdown.purchased_services += co2e;
          }
          break;
      }
    });
  }
}
```

### Total Calculation (Lines 173-181):
```typescript
breakdown.total =
  breakdown.products +
  breakdown.business_travel +
  breakdown.purchased_services +
  breakdown.employee_commuting +
  breakdown.capital_goods +
  breakdown.operational_waste +
  breakdown.downstream_logistics +
  breakdown.marketing_materials;
```

---

## Root Cause Analysis

### Both pages use IDENTICAL calculation logic:
1. ✅ Both call `useScope3Emissions(organizationId, year)`
2. ✅ Both use `scope3Emissions.total` directly
3. ✅ Both use the same data sources

### Possible Causes of Discrepancy:

#### 1. **Timing Issue** (Most Likely)
- The hooks might be called at different times
- Data might be loading or updating between the two calculations
- The `useEffect` dependencies might be triggering re-fetches at different times

#### 2. **Fleet Emissions Double Counting**
Looking at the Company Emissions page calculation:
```typescript
// Line 267: Fleet added to Scope 1
const liveScope1Total = scope1CO2e + fleetCO2e;
```

But in the `useScope3Emissions` hook (lines 140-141):
```typescript
case "business_travel":
  breakdown.business_travel += co2e;
  break;
```

**Question:** Are fleet emissions ALSO being added to `business_travel` in corporate_overheads?

#### 3. **Corporate Overheads Loading Issue**
The `useScope3Emissions` hook only loads overhead data if a corporate report exists:
```typescript
// Lines 120-125
const { data: reportData } = await supabase
  .from("corporate_reports")
  .select("id")
  .eq("organization_id", organizationId)
  .eq("year", year)
  .maybeSingle();

if (reportData) {
  // Load overheads
}
```

**If no report exists yet:** The hook would return 0 for all overhead categories!

#### 4. **Fleet Activities in Scope 3**
Looking at `useCompanyFootprint.ts`, there's NO code that adds fleet Scope 3 Cat 6 emissions!

The original code (before refactoring) had:
```typescript
// Lines 371-394 (REMOVED):
const { data: fleetScope3Data } = await supabase
  .from('fleet_activities')
  .select('emissions_tco2e, reporting_period_start, reporting_period_end')
  .eq('organization_id', currentOrganization!.id)
  .eq('scope', 'Scope 3 Cat 6')  // ← Grey Fleet
  .gte('reporting_period_start', yearStart)
  .lte('reporting_period_end', yearEnd);

// This was adding to business_travel
scope3Overheads.business_travel += itemKg;
```

**This logic was REMOVED but NOT replaced in the shared hook!**

---

## THE PROBLEM IDENTIFIED

### Missing Fleet Scope 3 Cat 6 in useScope3Emissions Hook

The `useScope3Emissions` hook does NOT fetch fleet Scope 3 Cat 6 emissions (Grey Fleet).

**Dashboard (useCompanyFootprint):**
- Previously had code to fetch fleet Scope 3 Cat 6
- This code was REMOVED when we refactored to use the shared hook
- Now relies entirely on `useScope3Emissions`

**Company Emissions Page:**
- Also relies on `useScope3Emissions`
- Both are now missing Fleet Scope 3 Cat 6!

But wait... if BOTH are missing Fleet Scope 3 Cat 6, they should show the SAME figure!

### Let me check if there's fleet data in corporate_overheads...

The discrepancy suggests:
1. **Company Emissions Page (275.607t):** Correct - No double counting
2. **Dashboard (283.4t):** May still have Fleet Scope 3 in there somehow OR has stale data

---

## Next Steps to Diagnose

1. Check if `fleet_activities` table has Scope 3 Cat 6 entries
2. Check if those entries are being added to `corporate_overheads` as business_travel
3. Verify both pages are loading the same `useScope3Emissions` data
4. Add console logging to see exact breakdown on both pages
5. Check for timing/caching issues

## Recommendation

Add Fleet Scope 3 Cat 6 to the `useScope3Emissions` hook so both pages calculate it consistently.
