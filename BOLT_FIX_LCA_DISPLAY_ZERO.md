# BOLT FIX: LCA Reports Showing 0.000 kg CO2eq

## Issue

LCA report cards on `/reports/lcas` page display "0.000 kg CO₂eq" despite having completed LCAs with calculated emissions.

**File**: `app/(authenticated)/reports/lcas/page.tsx`

---

## Root Cause

The page queries `product_lca_results` table (lines 65-72) looking for "Climate Change" impact category, but the December 2025 schema migration moved total emissions to `product_lcas.total_ghg_emissions` column.

### Current Code (Lines 84-109)
```typescript
const transformedReports: LCAReport[] = lcas.map((lca: any) => {
  const lcaResults = resultsByLcaId[lca.id] || [];
  const climateResult = lcaResults.find(
    (r: any) => r.impact_category === 'Climate Change'
  );
  const totalCO2e = climateResult ? parseFloat(climateResult.value) : 0; // ← Returns 0

  return {
    id: lca.id,
    product_id: lca.product_id,
    product_name: lca.product_name || 'Unknown Product',
    // ...
    total_co2e: totalCO2e, // ← Shows 0.000
  };
});
```

### Problem
- `product_lca_results` table may be empty or not populated
- Schema now stores total emissions in `product_lcas.total_ghg_emissions`
- Query returns 0 because "Climate Change" result not found

---

## Fix

Replace the query and transformation logic to use `total_ghg_emissions` directly from `product_lcas` table.

### Step 1: Update Query (Lines 45-56)

**FROM**:
```typescript
const { data: lcas, error: lcaError } = await supabase
  .from('product_lcas')
  .select('*')
  .eq('organization_id', currentOrganization!.id)
  .order('created_at', { ascending: false });
```

**TO**:
```typescript
const { data: lcas, error: lcaError } = await supabase
  .from('product_lcas')
  .select(`
    *,
    products (
      name,
      functional_unit,
      functional_unit_quantity
    )
  `)
  .eq('organization_id', currentOrganization!.id)
  .order('created_at', { ascending: false });
```

This also fetches product details via JOIN for better display.

### Step 2: Remove product_lca_results Query (Lines 63-81)

**DELETE THESE LINES**:
```typescript
// Fetch results for all LCAs
const lcaIds = lcas.map(lca => lca.id);
const { data: results, error: resultsError } = await supabase
  .from('product_lca_results')
  .select('product_lca_id, impact_category, value, unit')
  .in('product_lca_id', lcaIds);

if (resultsError) {
  console.error('Error fetching LCA results:', resultsError);
}

// Group results by LCA ID
const resultsByLcaId: Record<string, any[]> = {};
(results || []).forEach(result => {
  if (!resultsByLcaId[result.product_lca_id]) {
    resultsByLcaId[result.product_lca_id] = [];
  }
  resultsByLcaId[result.product_lca_id].push(result);
});
```

**REASON**: No longer needed, total emissions stored in `product_lcas` table.

### Step 3: Simplify Transformation Logic (Lines 84-110)

**FROM**:
```typescript
const transformedReports: LCAReport[] = lcas.map((lca: any) => {
  const lcaResults = resultsByLcaId[lca.id] || [];
  const climateResult = lcaResults.find(
    (r: any) => r.impact_category === 'Climate Change'
  );
  const totalCO2e = climateResult ? parseFloat(climateResult.value) : 0;

  // Calculate a simple DQI score based on status and data completeness
  let dqiScore = 50;
  if (lca.status === 'completed') dqiScore = 85;
  if (lcaResults.length >= 4) dqiScore += 10;

  return {
    id: lca.id,
    product_id: lca.product_id,
    product_name: lca.product_name || 'Unknown Product',
    title: `${new Date(lca.created_at).getFullYear()} LCA Study`,
    version: '1.0',
    status: lca.status === 'completed' ? 'completed' : 'draft',
    dqi_score: dqiScore,
    system_boundary: lca.system_boundary || 'Cradle-to-Gate',
    functional_unit: lca.functional_unit || 'per unit',
    assessment_period: new Date(lca.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    published_at: lca.status === 'completed' ? lca.updated_at : null,
    total_co2e: totalCO2e,
  };
});
```

**TO**:
```typescript
const transformedReports: LCAReport[] = lcas.map((lca: any) => {
  // Get total GHG emissions from product_lcas table
  const totalCO2e = lca.total_ghg_emissions || 0;

  // Calculate DQI score based on status and data completeness
  let dqiScore = 50;
  if (lca.status === 'completed') dqiScore = 85;

  // Check if all lifecycle stages calculated
  const hasLifecycleData =
    lca.lifecycle_stage_raw_materials > 0 ||
    lca.lifecycle_stage_processing > 0 ||
    lca.lifecycle_stage_packaging > 0;
  if (hasLifecycleData) dqiScore += 10;

  // Get product name from JOIN or fallback to stored value
  const productName = lca.products?.name || lca.product_name || 'Unknown Product';
  const functionalUnit = lca.products?.functional_unit || lca.functional_unit || 'per unit';

  return {
    id: lca.id,
    product_id: lca.product_id,
    product_name: productName,
    title: `${new Date(lca.created_at).getFullYear()} LCA Study`,
    version: '1.0',
    status: lca.status === 'completed' ? 'completed' : 'draft',
    dqi_score: dqiScore,
    system_boundary: lca.system_boundary || 'cradle-to-gate',
    functional_unit: functionalUnit,
    assessment_period: new Date(lca.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    published_at: lca.status === 'completed' ? lca.updated_at : null,
    total_co2e: totalCO2e,
  };
});
```

**Changes**:
- Line 2: Get `total_ghg_emissions` directly from `lca` object
- Lines 8-12: Check lifecycle stage data instead of results count
- Lines 15-16: Use product name from JOIN

---

## Complete Fixed Function

Replace `fetchLCAReports()` function (lines 40-119) with:

```typescript
const fetchLCAReports = async () => {
  try {
    setLoading(true);
    const supabase = getSupabaseBrowserClient();

    // Fetch all product LCAs for the organization with product details
    const { data: lcas, error: lcaError } = await supabase
      .from('product_lcas')
      .select(`
        *,
        products (
          name,
          functional_unit,
          functional_unit_quantity
        )
      `)
      .eq('organization_id', currentOrganization!.id)
      .order('created_at', { ascending: false });

    if (lcaError) {
      console.error('Error fetching LCAs:', lcaError);
      setReports([]);
      return;
    }

    if (!lcas || lcas.length === 0) {
      setReports([]);
      return;
    }

    // Transform the data using total_ghg_emissions from product_lcas
    const transformedReports: LCAReport[] = lcas.map((lca: any) => {
      // Get total GHG emissions from product_lcas table
      const totalCO2e = lca.total_ghg_emissions || 0;

      // Calculate DQI score based on status and data completeness
      let dqiScore = 50;
      if (lca.status === 'completed') dqiScore = 85;

      // Check if all lifecycle stages calculated
      const hasLifecycleData =
        lca.lifecycle_stage_raw_materials > 0 ||
        lca.lifecycle_stage_processing > 0 ||
        lca.lifecycle_stage_packaging > 0;
      if (hasLifecycleData) dqiScore += 10;

      // Get product name from JOIN or fallback to stored value
      const productName = lca.products?.name || lca.product_name || 'Unknown Product';
      const functionalUnit = lca.products?.functional_unit || lca.functional_unit || 'per unit';

      return {
        id: lca.id,
        product_id: lca.product_id,
        product_name: productName,
        title: `${new Date(lca.created_at).getFullYear()} LCA Study`,
        version: '1.0',
        status: lca.status === 'completed' ? 'completed' : 'draft',
        dqi_score: dqiScore,
        system_boundary: lca.system_boundary || 'cradle-to-gate',
        functional_unit: functionalUnit,
        assessment_period: new Date(lca.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
        published_at: lca.status === 'completed' ? lca.updated_at : null,
        total_co2e: totalCO2e,
      };
    });

    setReports(transformedReports);
  } catch (error) {
    console.error('Failed to fetch LCA reports:', error);
    setReports([]);
  } finally {
    setLoading(false);
  }
};
```

---

## Validation After Fix

### Test 1: LCA Cards Display Emissions
1. Navigate to `/reports/lcas`
2. Check LCA report cards
3. **Expected**: See actual emissions values (e.g., "1234.567 kg CO₂eq")
4. **Not**: "0.000 kg CO₂eq"

### Test 2: DQI Score Calculation
1. Check DQI scores on cards
2. **Expected**: Completed LCAs with lifecycle data = 95/100
3. **Expected**: Completed LCAs without lifecycle data = 85/100
4. **Expected**: Draft LCAs = 50/100

### Test 3: Product Names Display
1. Check product names on cards
2. **Expected**: Shows actual product names from products table
3. **Not**: "Unknown Product"

---

## Additional Improvements

### Optional: Add Fossil/Biogenic Breakdown
If you want to show fossil vs biogenic emissions breakdown on cards:

**Update CardContent (around line 298)**:
```typescript
<div>
  <p className="text-xs text-muted-foreground">Total GHG Emissions</p>
  <p className="text-lg font-semibold">{report.total_co2e.toFixed(3)} kg CO₂eq</p>
  {(lca.total_ghg_emissions_fossil > 0 || lca.total_ghg_emissions_biogenic > 0) && (
    <p className="text-xs text-muted-foreground mt-1">
      Fossil: {lca.total_ghg_emissions_fossil?.toFixed(1) || 0} kg |
      Biogenic: {lca.total_ghg_emissions_biogenic?.toFixed(1) || 0} kg
    </p>
  )}
</div>
```

### Optional: Show Lifecycle Stage Breakdown
Add a visual breakdown of lifecycle stages:

```typescript
<div className="flex gap-2 mt-2">
  <div className="text-xs">
    <span className="text-muted-foreground">Materials:</span> {lca.lifecycle_stage_raw_materials?.toFixed(0) || 0}
  </div>
  <div className="text-xs">
    <span className="text-muted-foreground">Processing:</span> {lca.lifecycle_stage_processing?.toFixed(0) || 0}
  </div>
  <div className="text-xs">
    <span className="text-muted-foreground">Packaging:</span> {lca.lifecycle_stage_packaging?.toFixed(0) || 0}
  </div>
</div>
```

---

## Summary

**File Changed**: `app/(authenticated)/reports/lcas/page.tsx`

**Changes**:
1. ✅ Query `total_ghg_emissions` from `product_lcas` table
2. ✅ Remove unnecessary `product_lca_results` query
3. ✅ Simplify transformation logic
4. ✅ Use JOIN to get product details
5. ✅ Calculate DQI based on lifecycle stage data

**Lines Modified**: 40-119 (fetchLCAReports function)

**Impact**: LCA report cards will display actual calculated emissions instead of 0.000

**Priority**: P1 - Display issue (data exists but not showing correctly)

**Effort**: 15 minutes
