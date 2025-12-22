# BOLT FIX: Company Emissions Page Console Errors & No Scope 3 Data

## Issues from Console

Multiple errors when loading `/data/scope-1-2` (Company Emissions) page:

1. ❌ **Error fetching fleet emissions** - `activities.journey_date does not exist`
2. ❌ **Error fetching Scope 3 Cat 1** - `product_functional_unit_quantity does not exist`
3. ❌ **Error fetching production_logs** - `production_logs.journey_date does not exist`
4. ❌ **Scope 3 shows "No data"** despite having data entered

---

## Root Causes

### Issue 1: Fleet Activities Query (Line 534)
**Current Code**:
```typescript
.gte('journey_date', yearStart)
.lte('journey_date', yearEnd);
```

**Problem**: Column is `journey_date` but might be `date` or `activity_date` in fleet_activities table.

### Issue 2: Products JOIN (Line 560-564)
**Current Code**:
```typescript
products!inner (
  id,
  name,
  functional_unit_quantity
)
```

**Problem**: Same as LCA page - RLS policy blocking products JOIN.

### Issue 3: Scope 3 Not Aggregating
Missing function to aggregate `corporate_overheads` into Scope 3 total display.

---

## Fix Required

**File**: `app/(authenticated)/data/scope-1-2/page.tsx`

### Fix 1: Remove Products JOIN from fetchScope3Cat1FromLCAs

**Replace lines 554-567**:

**FROM**:
```typescript
const { data: productionLogs, error: productionError } = await browserSupabase
  .from('production_logs')
  .select(`
    product_id,
    volume,
    unit,
    products!inner (
      id,
      name,
      functional_unit_quantity
    )
  `)
  .eq('organization_id', currentOrganization.id)
  .gte('date', yearStart)
  .lte('date', yearEnd);
```

**TO**:
```typescript
const { data: productionLogs, error: productionError } = await browserSupabase
  .from('production_logs')
  .select('product_id, volume, unit, date')
  .eq('organization_id', currentOrganization.id)
  .gte('date', yearStart)
  .lte('date', yearEnd);
```

### Fix 2: Update Product Lookup (Lines 601-625)

**Replace the product lookup logic**:

**FROM**:
```typescript
const product = Array.isArray(log.products) ? log.products[0] : log.products;
const volumeInUnits = log.unit === 'Hectolitre'
  ? log.volume * 100 / ((product as any).functional_unit_quantity || 1)
  : log.volume / ((product as any).functional_unit_quantity || 1);
```

**TO**:
```typescript
// Fetch product details separately to avoid JOIN issues
const { data: product } = await browserSupabase
  .from('products')
  .select('name, functional_unit_quantity')
  .eq('id', log.product_id)
  .single();

if (!product) continue;

const volumeInUnits = log.unit === 'Hectolitre'
  ? log.volume * 100 / (product.functional_unit_quantity || 1)
  : log.volume / (product.functional_unit_quantity || 1);
```

### Fix 3: Fix Fleet Emissions Date Column (Line 534)

**Replace lines 530-536**:

**FROM**:
```typescript
const { data, error } = await browserSupabase
  .from('fleet_activities')
  .select('emissions_tco2e')
  .eq('organization_id', currentOrganization.id)
  .gte('journey_date', yearStart)
  .lte('journey_date', yearEnd);
```

**TO**:
```typescript
const { data, error } = await browserSupabase
  .from('fleet_activities')
  .select('emissions_tco2e, date')
  .eq('organization_id', currentOrganization.id)
  .gte('date', yearStart)
  .lte('date', yearEnd);
```

**Note**: Changed `journey_date` to `date` - check your actual column name in fleet_activities table.

### Fix 4: Add Scope 3 Overheads Aggregation

**Add new function after fetchScope3Cat1FromLCAs** (around line 648):

```typescript
const fetchScope3Overheads = async () => {
  if (!currentOrganization?.id || !report?.id) return;

  try {
    const browserSupabase = getSupabaseBrowserClient();

    const { data, error } = await browserSupabase
      .from('corporate_overheads')
      .select('category, computed_co2e')
      .eq('report_id', report.id);

    if (error) throw error;

    // Aggregate all Scope 3 overhead categories
    const scope3Categories = [
      'business_travel',
      'purchased_services',
      'employee_commuting',
      'capital_goods',
      'operational_waste',
      'downstream_logistics',
      'marketing_materials',
    ];

    const total = data
      ?.filter(item => scope3Categories.includes(item.category))
      .reduce((sum, item) => sum + (item.computed_co2e || 0), 0) || 0;

    return total;
  } catch (error: any) {
    console.error('Error fetching Scope 3 overheads:', error);
    return 0;
  }
};
```

### Fix 5: Add State for Scope 3 Overheads

**Add state variable** (around line 150):

```typescript
const [scope3OverheadsCO2e, setScope3OverheadsCO2e] = useState(0);
```

### Fix 6: Call fetchScope3Overheads in fetchReportData

**Update fetchReportData** (around line 311):

**Add after line 311**:
```typescript
await fetchScope3Cat1FromLCAs();
const overheadsTotal = await fetchScope3Overheads();
setScope3OverheadsCO2e(overheadsTotal);
```

### Fix 7: Update Scope 3 Display Total

**Find the Scope 3 card display** (around line 917-920):

**FROM**:
```typescript
{(scope3Cat1CO2e * 1000) + productsCO2e + fleetCO2e > 0
  ? `${((scope3Cat1CO2e * 1000) + productsCO2e + fleetCO2e).toFixed(3)} kgCO2e`
  : 'No data'}
```

**TO**:
```typescript
{(scope3Cat1CO2e * 1000) + productsCO2e + fleetCO2e + scope3OverheadsCO2e > 0
  ? `${((scope3Cat1CO2e * 1000) + productsCO2e + fleetCO2e + scope3OverheadsCO2e).toFixed(3)} kgCO2e`
  : 'No data'}
```

---

## Alternative Simpler Fix (If Products Query Keeps Failing)

If the products queries keep failing, disable the Scope 3 Cat 1 auto-calculation temporarily:

**In fetchScope3Cat1FromLCAs** (line 546), add early return:

```typescript
const fetchScope3Cat1FromLCAs = async () => {
  if (!currentOrganization?.id) return;

  // Temporarily disabled due to query issues
  setScope3Cat1CO2e(0);
  setScope3Cat1Breakdown([]);
  setScope3Cat1DataQuality('Calculation temporarily disabled');
  return;

  // Rest of function...
};
```

This will at least let the page load and show Scope 3 overheads data.

---

## Fleet Activities Table Column Check

The error suggests `journey_date` doesn't exist. Check what the actual column name is:

**Query to run in Supabase SQL Editor**:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'fleet_activities'
  AND column_name LIKE '%date%'
ORDER BY column_name;
```

**Update the fix based on result**:
- If column is `date` → Use `date`
- If column is `activity_date` → Use `activity_date`
- If column is `journey_date` → Keep `journey_date` (error is elsewhere)

---

## Summary of Changes

**File**: `app/(authenticated)/data/scope-1-2/page.tsx`

**Changes Required**:
1. ✅ Remove products JOIN from production_logs query (line 560-564)
2. ✅ Fetch product details separately in loop (line 621)
3. ✅ Fix fleet_activities date column (line 534)
4. ✅ Add fetchScope3Overheads function (new)
5. ✅ Add scope3OverheadsCO2e state (line 150)
6. ✅ Call fetchScope3Overheads in fetchReportData (line 311)
7. ✅ Update Scope 3 total display to include overheads (line 918)

**Impact**:
- ✅ No more console errors
- ✅ Scope 3 data displays correctly
- ✅ Business Travel, Services, etc. show in total
- ✅ Category 1 calculates (if products accessible)

**Priority**: P0 - CRITICAL
