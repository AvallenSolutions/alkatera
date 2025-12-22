# BOLT EMERGENCY FIX: LCA Page Showing No Results

## Issue
The LCA page (`/reports/lcas`) is showing "No reports found" after the recent update. The products table JOIN is being blocked by RLS policies.

## Fix Required

**File**: `app/(authenticated)/reports/lcas/page.tsx`

**Replace lines 45-57** (the query section):

### Current Code (BROKEN):
```typescript
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
```

### New Code (WORKING):
```typescript
// Fetch all product LCAs for the organization
const { data: lcas, error: lcaError } = await supabase
  .from('product_lcas')
  .select('*')
  .eq('organization_id', currentOrganization!.id)
  .order('created_at', { ascending: false });
```

**And update lines 86-88** (remove JOIN references):

### Current Code:
```typescript
// Get product name from JOIN or fallback to stored value
const productName = lca.products?.name || lca.product_name || 'Unknown Product';
const functionalUnit = lca.products?.functional_unit || lca.functional_unit || 'per unit';
```

### New Code:
```typescript
// Get product name from stored value in product_lcas
const productName = lca.product_name || 'Unknown Product';
const functionalUnit = lca.functional_unit || 'per unit';
```

## What This Fixes
- ✅ LCAs will display on the page again
- ✅ Product names will show correctly (from product_lcas.product_name)
- ✅ Total emissions will display actual values (using total_ghg_emissions)
- ✅ No RLS policy conflicts

## Why This Works
The `product_lcas` table already stores `product_name` when the LCA is created, so we don't need to JOIN to the products table. Removing the JOIN avoids RLS policy issues.

---

**Priority**: P0 - CRITICAL (page completely broken)
**Testing**: After applying, navigate to `/reports/lcas` and verify LCAs display with correct emissions values.
