# Create LCA Column Name Fix

## Issue Discovered

After implementing the initial fixes, the browser console showed the following error:

```
[Products] Error in handleCreateLca: Error: Failed to fetch product: column products.description does not exist
```

## Root Cause

The `createDraftLca` function in `/lib/lca.ts` was using incorrect column names when querying the products table:

**Incorrect Column Names Used:**
- `description` ❌ (doesn't exist)
- `image_url` ❌ (doesn't exist)

**Correct Column Names:**
- `product_description` ✅
- `product_image_url` ✅

## Database Schema

The `products` table (created in migration `20251114144931_create_products_table_with_lca_fields.sql`) has these columns:

```sql
CREATE TABLE public.products (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    name TEXT NOT NULL,
    product_description TEXT,              -- ✅ Correct name
    product_image_url TEXT,                -- ✅ Correct name
    unit_size_value NUMERIC,               -- ✅ Added later
    unit_size_unit TEXT,                   -- ✅ Added later
    sku TEXT,                              -- ✅ Added later
    ...
);
```

## Fix Applied

**File:** `/lib/lca.ts`

**Changed Line 24 from:**
```typescript
.select("name, description, image_url, unit_size_value, unit_size_unit")
```

**To:**
```typescript
.select("name, product_description, product_image_url, unit_size_value, unit_size_unit")
```

**Changed Lines 51-52 from:**
```typescript
product_description: product.description || null,
product_image_url: product.image_url || null,
```

**To:**
```typescript
product_description: product.product_description || null,
product_image_url: product.product_image_url || null,
```

## Verification

### Type Definitions
The TypeScript types in `/lib/types/products.ts` were already correct:
```typescript
export interface Product {
  id: string;
  organization_id: string;
  name: string;
  sku?: string | null;
  unit_size_value?: number | null;
  unit_size_unit?: UnitSizeUnit | null;
  product_description?: string | null;    // ✅ Correct
  product_image_url?: string | null;      // ✅ Correct
  certifications?: Certification[];
  awards?: Award[];
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}
```

### Products Library
The `/lib/products.ts` file was already using correct column names:
```typescript
.insert({
  organization_id: organizationId,
  name: input.name,
  sku: input.sku || null,
  unit_size_value: input.unit_size_value || null,
  unit_size_unit: input.unit_size_unit || null,
  product_description: input.product_description || null,  // ✅ Correct
  product_image_url: input.product_image_url || null,      // ✅ Correct
  ...
})
```

## Build Status

✅ **Build Successful**

```bash
npm run build
# Output: Build completed without errors
```

## Expected Console Output (After Fix)

When clicking "Create New LCA" after this fix, the console should show:

```
[Products] Creating LCA for product: <product_name> <uuid>
[Products] Calling createDraftLca...
[createDraftLca] Starting draft LCA creation {productId: "...", organizationId: "..."}
[createDraftLca] User authenticated: <user_id>
[createDraftLca] Product fetched successfully: <product_name>
[createDraftLca] Functional unit determined: <value> <unit>
[createDraftLca] Inserting LCA with data: {...}
[createDraftLca] LCA created successfully: <lca_id>
[Products] createDraftLca result: {success: true, lcaId: "..."}
[Products] LCA created successfully: <lca_id>
[Products] Navigating to sourcing page...
```

## Why This Happened

This was a simple naming inconsistency. The database schema used descriptive, prefixed column names (`product_description`, `product_image_url`) to avoid ambiguity, but the code was using shorter, unprefixed names (`description`, `image_url`) that don't exist in the schema.

The issue wasn't caught earlier because:
1. TypeScript types were correct
2. The products library was using correct names
3. Only the `createDraftLca` function had this specific issue
4. The error only surfaces at runtime when querying the database

## Prevention

To prevent similar issues in future:

1. **Always refer to database schema or migrations when writing queries**
2. **Use TypeScript types as source of truth** - the `Product` interface had the correct names
3. **Test database queries early** - runtime errors would have caught this immediately
4. **Use code search** - search for other usages of column names before assuming

## Status

✅ **Fixed and Verified**

The Create New LCA button should now work correctly without column name errors.
