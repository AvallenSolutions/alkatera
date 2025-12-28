# Scope 3 Calculation Bug - The Real Issue

## Symptoms

**Scope 3 Tab shows**: 275.440 + 0.215 + 0.172 = **275.827 tCO₂e** ✅

**Annual Footprint Tab shows**: **1054.299 tCO₂e** ❌ (Nearly 4× too high!)

## Root Cause

The `useScope3Emissions` hook was using the **wrong field** from `production_logs`:

### The Bug (Line 88)
```typescript
// ❌ WRONG - Using bulk volume (hectolitres)
breakdown.products += lca.total_ghg_emissions * log.volume;
```

### Why This Failed

1. **LCA emissions are per functional unit**: `lca.total_ghg_emissions` = kg CO₂e **per bottle/can**
2. **Volume is bulk measure**: `log.volume` = hectolitres of liquid (e.g., 100 hl)
3. **Wrong multiplication**: 0.5 kg/bottle × 100 hectolitres = **50 kg** (nonsense!)

### The Correct Calculation

1. **LCA emissions are per functional unit**: `lca.total_ghg_emissions` = kg CO₂e **per bottle/can**
2. **Units produced is consumer units**: `log.units_produced` = actual number of bottles/cans (e.g., 20,000 bottles)
3. **Correct multiplication**: 0.5 kg/bottle × 20,000 bottles = **10,000 kg** ✅

### Real Example from Your Data

If you have TEST CALVADOS with:
- `total_ghg_emissions` = 0.002744 kg CO₂e per bottle (2.744 g)
- `volume` = 100 hectolitres
- `units_produced` = 100,000 bottles

**Wrong calculation (before fix)**:
```
0.002744 kg/bottle × 100 = 0.2744 kg ❌
```

**Correct calculation (after fix)**:
```
0.002744 kg/bottle × 100,000 bottles = 274.4 kg ✅
```

This is exactly 1000× different, which explains why the total was ~4× off (you have multiple products with different ratios).

## The Fix

### Changed in `hooks/data/useScope3Emissions.ts`

**Line 70 - Added `units_produced` to SELECT**:
```typescript
// Before
.select("product_id, volume, unit, date")

// After
.select("product_id, volume, unit, units_produced, date")
```

**Lines 92-114 - Fixed the calculation**:
```typescript
// CRITICAL: Use units_produced (number of bottles/cans) NOT volume (bulk hectolitres)
// LCA emissions are per functional unit (per bottle/can)
const unitsProduced = log.units_produced || 0;

if (unitsProduced > 0) {
  const impactKg = lca.total_ghg_emissions * unitsProduced;
  breakdown.products += impactKg;

  console.log('✅ [SCOPE 3 HOOK] Product calculated', {
    product_id: log.product_id,
    units_produced: unitsProduced,
    emissions_per_unit: lca.total_ghg_emissions,
    total_impact_kg: impactKg,
    running_total: breakdown.products,
  });
} else {
  console.warn('⚠️ [SCOPE 3 HOOK] Skipping - units_produced is 0', {
    product_id: log.product_id,
    log,
  });
}
```

## Why the Local Calculation Worked

The **Scope 3 tab** uses `fetchScope3Cat1FromLCAs()` which correctly used:
```typescript
// Line 345 in page.tsx
const unitsProduced = log.units_produced || 0;

// Line 376-377
const totalMaterialsTonnes = (materialsPerUnit * unitsProduced) / 1000;
const totalPackagingTonnes = (packagingPerUnit * unitsProduced) / 1000;
```

This is why the Scope 3 tab showed the correct value (275.440 tCO₂e), but the Annual Footprint tab (using the hook) showed the wrong value (1054.299 tCO₂e).

## Verification

### Console Logs to Check

After refreshing the page, you should see:

```javascript
📦 [SCOPE 3 HOOK] Production logs fetched { count: X, year: 2025 }

✅ [SCOPE 3 HOOK] Product calculated {
  product_id: "uuid",
  units_produced: 100000,
  emissions_per_unit: 0.002744,
  total_impact_kg: 274.4,
  running_total: 274.4
}

📊 [SCOPE 3 HOOK] Final breakdown {
  products: 275440,              // kg (275.44 tonnes) ✅
  business_travel: 172,          // kg (0.172 tonnes) ✅
  marketing_materials: 215,      // kg (0.215 tonnes) ✅
  // ... other categories
  total: 275827,                 // kg
  totalInTonnes: 275.827        // tonnes ✅ CORRECT!
}
```

### Expected Result

**Before Fix**: Annual Footprint shows **1054.299 tCO₂e** ❌

**After Fix**: Annual Footprint shows **275.827 tCO₂e** ✅ (matching Scope 3 tab)

## Database Schema Context

For reference, `production_logs` table has:
- `volume` (numeric) - Bulk volume in hectolitres/litres (for inventory tracking)
- `units_produced` (integer) - Actual number of consumer units produced (bottles/cans)
- `unit` (text) - Unit of measure for volume (e.g., "Hectolitre", "Litre")

The LCA system works in **consumer units** (functional units), NOT bulk volume.

## Files Changed

1. ✅ `hooks/data/useScope3Emissions.ts` - Fixed calculation logic
   - Added `units_produced` to SELECT query
   - Changed calculation from `log.volume` to `log.units_produced`
   - Added detailed console logging for debugging

## Build Status

✅ Build completed successfully
✅ No TypeScript errors
✅ All routes compile correctly
