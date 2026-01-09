# GHG Validation Logic Fix & Database Schema Update

## Date: 2026-01-09

## Issues Fixed

### 1. **GHG Breakdown Validation Too Lenient**

**Problem:**
The validation logic in `useCompanyMetrics.ts` was passing when only total `methane` values existed, even though there was no breakdown between biogenic and fossil methane. This meant the system would accept incomplete data that couldn't properly display in the GHG Emissions Breakdown table.

**Root Cause:**
```typescript
// OLD CODE - Too lenient
const hasData = (ghg.gas_inventory?.methane || 0) > 0 ||  // ❌ Accepts total only
               (ghg.gas_inventory?.methane_fossil || 0) > 0 ||
               (ghg.gas_inventory?.methane_biogenic || 0) > 0
```

The check would pass if `methane > 0` even when `methane_fossil` and `methane_biogenic` were both 0.

**Solution:**
Updated the validation to **require breakdown data**, not just totals:

```typescript
// NEW CODE - Strict validation
const hasCH4Breakdown =
  (ghg.gas_inventory?.methane_fossil || 0) > 0 ||
  (ghg.gas_inventory?.methane_biogenic || 0) > 0 ||
  (ghg.physical_mass?.ch4_fossil_kg || 0) > 0 ||
  (ghg.physical_mass?.ch4_biogenic_kg || 0) > 0;

const hasN2OData =
  (ghg.gas_inventory?.nitrous_oxide || 0) > 0 ||
  (ghg.physical_mass?.n2o_kg || 0) > 0;

const hasData = hasCH4Breakdown || hasN2OData;  // ✅ Requires breakdown
```

**Impact:**
- The system will now correctly trigger `fetchMaterialAndGHGBreakdown()` when breakdown data is missing
- Prevents displaying incomplete/zero data in the GHG breakdown table
- Ensures ISO 14067 compliance by requiring proper gas inventory segregation

---

### 2. **Missing Location Columns in Facilities Table**

**Problem:**
The `facilities` table only had a generic `location` text column, but the frontend code was querying for specific columns:
- `location_city`
- `location_country_code`

This caused repeated 400 errors:
```
{"code":"42703","message":"column facilities_1.location_city does not exist"}
```

**Solution:**
Created migration `add_location_columns_to_facilities.sql` that adds:
- `location_city` (text)
- `location_country_code` (text)
- `location_address` (text)
- `latitude` (double precision)
- `longitude` (double precision)

Plus indexes for efficient querying:
- Index on `location_country_code` for filtering
- Spatial index on coordinates for mapping

**Impact:**
- Fixes 400 errors when loading production sites data
- Enables proper facility mapping and location-based analysis
- Maintains backward compatibility with existing `location` column

---

### 3. **TypeScript Safety Improvements**

**Problem:**
`CarbonDeepDive.tsx` was accessing `methane_fossil` and `methane_biogenic` without null checks, causing TypeScript errors.

**Solution:**
Added nullish coalescing operators throughout:
```typescript
// Before
{ghgBreakdown.gas_inventory.methane_fossil.toLocaleString(...)}

// After
{(ghgBreakdown.gas_inventory.methane_fossil ?? 0).toLocaleString(...)}
```

---

## Files Modified

1. `hooks/data/useCompanyMetrics.ts` - Stricter GHG validation logic
2. `components/vitality/CarbonDeepDive.tsx` - Added null safety
3. `supabase/migrations/[timestamp]_add_location_columns_to_facilities.sql` - New migration
4. `lib/bulk-import/material-matcher.ts` - Created placeholder (build fix)
5. `lib/bulk-import/template-generator.ts` - Created placeholder (build fix)

---

## Testing Recommendations

1. **Verify GHG Validation:**
   - Check browser console logs for: `"🔬 GHG breakdown validation:"`
   - Confirm `hasValidBreakdownData: false` when breakdown is missing
   - Verify fallback query is triggered

2. **Test Facility Location Queries:**
   - Navigate to dashboard and check for 400 errors (should be gone)
   - Verify production sites display correctly with city/country data

3. **Test GHG Breakdown Display:**
   - Navigate to Company Vitality page
   - Click "GHG Detail" button
   - Verify no TypeScript/runtime errors
   - Check that methane values display as "0.000000" when undefined (not errors)

---

## Next Steps

The validation is now stricter, which means:
- Products without proper GHG breakdown will trigger database queries
- You may need to populate `methane_fossil`, `methane_biogenic`, and `n2o_kg` in `product_lca_materials` table
- Consider running a data migration to split existing total methane into biogenic/fossil components

---

## Technical Notes

### Why This Matters for ISO Compliance

ISO 14067 requires GHG inventories to distinguish between:
- **Biogenic methane** (from agricultural/biological sources, GWP = 27.2)
- **Fossil methane** (from industrial/petrochemical sources, GWP = 29.8)

Accepting totals without breakdown violates this standard and produces inaccurate climate impact assessments.
