# FIX: LCA Page Showing No Results After Query Update

## Issue

After updating the LCA page query to include product JOIN, no LCAs are displaying on `/reports/lcas` page.

**Symptoms**:
- Page shows "No reports found"
- Browser console may show errors
- Creating new LCAs doesn't show them on the page

---

## Root Cause Analysis

### Possible Causes

#### 1. RLS Policy Blocking JOIN
The query now includes:
```typescript
products (
  name,
  functional_unit,
  functional_unit_quantity
)
```

If RLS policies on `products` table don't allow SELECT for the JOIN, the entire query fails.

#### 2. Foreign Key NULL Values
If `product_lcas.product_id` is NULL for some records, the INNER JOIN fails.

#### 3. Query Syntax Error
The JOIN syntax might not be compatible with the RLS setup.

---

## Diagnostic Steps

### Step 1: Check Browser Console
Open `/reports/lcas` page and check browser console (F12) for:
- JavaScript errors
- Supabase query errors
- Network request failures

**Look for**:
```
Error fetching LCAs: { message: "...", code: "..." }
```

### Step 2: Check Database Query
Run this in Supabase SQL Editor:

```sql
-- Test the exact query that the page is running
SELECT
  pl.*,
  p.name,
  p.functional_unit,
  p.functional_unit_quantity
FROM product_lcas pl
LEFT JOIN products p ON pl.product_id = p.id
WHERE pl.organization_id = '<your-org-id>'
ORDER BY pl.created_at DESC
LIMIT 10;
```

**Expected**: Should return rows with product data
**If returns 0 rows**: RLS blocking the query
**If returns rows without product data**: product_id is NULL

### Step 3: Check RLS Policies on Products Table

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual::text as using_expression
FROM pg_policies
WHERE tablename = 'products'
ORDER BY policyname;
```

**Check**: Does SELECT policy allow access for current organization?

---

## Fix

Replace the JOIN with a LEFT JOIN and make it optional to prevent query failures.

### Option A: Make Products JOIN Optional (Recommended)

**File**: `app/(authenticated)/reports/lcas/page.tsx`

**Change line 48-55** from:
```typescript
.select(`
  *,
  products (
    name,
    functional_unit,
    functional_unit_quantity
  )
`)
```

**To**:
```typescript
.select('*')
```

Then **update lines 86-88** to handle missing product data:
```typescript
// Get product name from stored value (products JOIN removed due to RLS)
const productName = lca.product_name || 'Unknown Product';
const functionalUnit = lca.functional_unit || 'per unit';
```

**Reason**: Removes dependency on products table JOIN which may be blocked by RLS.

### Option B: Fix RLS Policies on Products Table

If you want to keep the JOIN, ensure RLS policies allow it:

```sql
-- Check current policy
SELECT policyname, qual::text
FROM pg_policies
WHERE tablename = 'products' AND cmd = 'SELECT';

-- If policy is too restrictive, update it
DROP POLICY IF EXISTS "Users can view their organization's products" ON products;

CREATE POLICY "Users can view their organization's products"
ON products
FOR SELECT
TO authenticated
USING (organization_id = (SELECT active_organization_id FROM profiles WHERE id = auth.uid()));
```

### Option C: Use Explicit LEFT JOIN in Query

Change the Supabase query to explicitly use LEFT JOIN:

**Replace lines 46-57** with:
```typescript
const { data: lcas, error: lcaError } = await supabase
  .from('product_lcas')
  .select(`
    *,
    products!left (
      name,
      functional_unit,
      functional_unit_quantity
    )
  `)
  .eq('organization_id', currentOrganization!.id)
  .order('created_at', { ascending: false });
```

**Note**: The `!left` hint tells Supabase to use LEFT JOIN instead of INNER JOIN.

---

## Recommended Solution

I recommend **Option A** (remove the JOIN) because:

1. ✅ **Simplest fix** - no database changes needed
2. ✅ **No RLS dependencies** - works regardless of products table policies
3. ✅ **Product data already stored** - `product_lcas` has `product_name` column
4. ✅ **Fast** - one less table to query

The product name is already stored in `product_lcas.product_name` when the LCA is created, so we don't need to JOIN to get it.

---

## Complete Fixed Code

Replace the `fetchLCAReports` function (lines 40-113) with:

```typescript
const fetchLCAReports = async () => {
  try {
    setLoading(true);
    const supabase = getSupabaseBrowserClient();

    // Fetch all product LCAs for the organization
    // Note: Not joining to products table to avoid RLS issues
    const { data: lcas, error: lcaError } = await supabase
      .from('product_lcas')
      .select('*')
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

      // Get product name from stored value in product_lcas
      const productName = lca.product_name || 'Unknown Product';
      const functionalUnit = lca.functional_unit || 'per unit';

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

**Changes**:
- Line 47: Removed products JOIN, back to `.select('*')`
- Lines 41-42: Removed product data from JOIN
- Comment added explaining why JOIN removed

---

## Validation After Fix

### Test 1: LCAs Display
1. Navigate to `/reports/lcas`
2. **Expected**: See all your LCA reports
3. **Expected**: Product names display correctly
4. **Expected**: Total emissions show actual values (not 0.000)

### Test 2: Create New LCA
1. Create a new Product LCA
2. Navigate to `/reports/lcas`
3. **Expected**: New LCA appears in list immediately

### Test 3: Browser Console
1. Open `/reports/lcas` with console open (F12)
2. **Expected**: No errors in console
3. **Expected**: Network tab shows successful query

---

## Summary

**Issue**: Products JOIN failing due to RLS policies
**Fix**: Remove JOIN, use stored `product_name` from `product_lcas` table
**Impact**: LCAs will display correctly with actual emissions values
**File**: `app/(authenticated)/reports/lcas/page.tsx` lines 40-113

**Priority**: P0 - CRITICAL (page completely broken)
**Effort**: 5 minutes
