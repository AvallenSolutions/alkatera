# Scope 3 Double Counting Fix

## Problem Identified ✓

**Dashboard Scope 3:** 283.4 tCO₂e
**Company Emissions Scope 3:** 275.607 tCO₂e
**Difference:** 7.793 tCO₂e (Production facility Scope 1 & 2 being double counted)

## Root Cause

The `useScope3Emissions` hook uses `product_lcas.total_ghg_emissions` which includes:

1. **Materials emissions** (Scope 3 Cat 1: Purchased Goods & Services) = 2.7544 kg/unit
2. **Production facility Scope 1 & 2** (already counted separately!) = 0.0779 kg/unit
3. **Total LCA** = 2.8323 kg/unit

For 100,000 units of TEST CALVADOS:
- Using `total_ghg_emissions`: 283,232 kg = **283.2 tonnes** (includes facility) ❌
- Using materials only: 275,440 kg = **275.4 tonnes** (Scope 3 only) ✓
- Facility Scope 1 & 2 double counted: **7.79 tonnes**

## Why This Is Double Counting

According to **ISO 14064-1** and **GHG Protocol**:

**Scope 3 Category 1 (Purchased Goods & Services)** should include:
- Cradle-to-gate emissions of purchased goods
- Raw materials extraction and processing
- Packaging production
- Transport to your facility

**Scope 3 Category 1 should NOT include:**
- Your own facility's Scope 1 emissions (direct combustion, process emissions)
- Your own facility's Scope 2 emissions (purchased electricity, heat, steam)
- These are reported in Scope 1 & 2 directly

## The Fix Required

**File:** `/hooks/data/useScope3Emissions.ts` (lines 84-116)

### Current Code (WRONG):
```typescript
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
    const impactKg = lca.total_ghg_emissions * unitsProduced;  // ← INCLUDES FACILITY SCOPE 1 & 2
    breakdown.products += impactKg;
  }
}
```

### Required Change:
```typescript
const { data: lca } = await supabase
  .from("product_lcas")
  .select("id, status")
  .eq("product_id", log.product_id)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (lca && lca.status === 'completed') {
  // Fetch materials-only emissions (Scope 3 Cat 1 ONLY)
  const { data: materials } = await supabase
    .from("product_lca_materials")
    .select("impact_climate")
    .eq("product_lca_id", lca.id);

  if (materials && materials.length > 0) {
    const materialsPerUnit = materials.reduce((sum, m) => sum + (m.impact_climate || 0), 0);
    const unitsProduced = log.units_produced || 0;

    if (unitsProduced > 0) {
      const impactKg = materialsPerUnit * unitsProduced;  // ← MATERIALS ONLY (No facility Scope 1 & 2)
      breakdown.products += impactKg;
    }
  }
}
```

## Expected Result After Fix

**Scope 3 Cat 1 (Purchased Goods & Services):**
- Materials only: 275.44 tonnes

**Plus other Scope 3 categories:**
- Business travel: 0.167 tonnes

**Total Scope 3:** 275.607 tonnes ✓

Both Dashboard and Company Emissions page will show the same figure: **275.607 tonnes**

## Additional Verification Needed

Check if the Company Emissions page is somehow already doing this filtering. The 275.607t figure suggests it might be, but we need to confirm how.

Look for any code that:
1. Sums `product_lca_materials.impact_climate` instead of using `total_ghg_emissions`
2. Has logic to exclude facility Scope 1 & 2 from Scope 3 calculations
3. Uses a different field or calculation method
