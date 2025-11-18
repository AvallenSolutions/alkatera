# Create New LCA - Testing Guide

## Overview
This guide provides step-by-step instructions for testing the complete "Create New LCA" flow from the Products page.

---

## Pre-requisites

### 1. User Account & Organisation
- ✅ User must be logged in
- ✅ User must belong to an organisation
- ✅ Organisation must be selected in the organisation context

### 2. Product Requirements
All products must have the following **mandatory** fields:
- ✅ Product Name
- ✅ SKU
- ✅ Unit Size Value (e.g., 250)
- ✅ Unit (e.g., ml, L, g, kg)
- ✅ Product Description

---

## Test Flow: Create New LCA from Product

### Step 1: Create a Test Product

1. Navigate to **Dashboard → Products**
2. Click **"Add New Product"** button
3. Fill in all mandatory fields:
   ```
   Product Name: Test Coffee Blend 250ml
   SKU: TCB-250-001
   Unit Size Value: 250
   Unit: ml
   Product Description: Premium arabica coffee blend for testing LCA creation
   ```
4. Click **"Create Product"**
5. ✅ Verify: Success toast appears
6. ✅ Verify: Redirected to products list
7. ✅ Verify: New product appears in the table

**Expected Console Logs:**
- None (client-side validation only)

---

### Step 2: Initiate LCA Creation

1. Locate your test product in the products table
2. Click the **⋮ (More Options)** button
3. Click **"Create New LCA"** from the dropdown

**Expected Behaviour:**
- Loading state shows on the dropdown item
- Console logs start appearing

**Expected Console Logs:**
```
[Products] Creating LCA for product: Test Coffee Blend 250ml <uuid>
[Products] Calling createDraftLca...
[createDraftLca] Starting draft LCA creation {productId: "...", organizationId: "..."}
[createDraftLca] User authenticated: <user_id>
[createDraftLca] Product fetched successfully: Test Coffee Blend 250ml
[createDraftLca] Functional unit determined: 250 ml
[createDraftLca] Inserting LCA with data: {...}
[createDraftLca] LCA created successfully: <lca_id>
[Products] createDraftLca result: {success: true, lcaId: "..."}
[Products] LCA created successfully: <lca_id>
[Products] Navigating to sourcing page...
```

**Expected Outcome:**
- ✅ Success toast: "LCA created for 'Test Coffee Blend 250ml'"
- ✅ Navigation to: `/dashboard/lcas/[lca_id]/create/sourcing`

---

### Step 3: Select Sourcing Methodology

**Current Page:** `/dashboard/lcas/[lca_id]/create/sourcing`

**Expected Page Content:**
- Header: "Step 1: Sourcing Methodology"
- Description: "Select how your organisation sources the core ingredients for this product"
- Two cards:
  - **We Grow Our Ingredients** (green icon)
  - **We Purchase Our Ingredients** (blue icon)

**Test Actions:**
1. Click either card (e.g., "We Purchase Our Ingredients")

**Expected Behaviour:**
- Loading state shows during update
- Success toast: "Sourcing methodology set to: We Purchase"
- Navigation to: `/dashboard/lcas/[lca_id]/ingredients`

---

### Step 4: Add Ingredients/Materials

**Current Page:** `/dashboard/lcas/[lca_id]/ingredients`

**Expected Page Content:**
- Form to add ingredients/materials
- Life cycle stage selection
- Material search/selection
- Quantity and unit inputs

**Test Actions:**
1. Add at least one material/ingredient
2. Save the materials

**Expected Outcome:**
- Materials saved to `product_lca_materials` table
- LCA status remains as 'draft'

---

### Step 5: Calculate LCA (Future Step)

**Current Page:** `/dashboard/lcas/[lca_id]/calculate`

This step involves triggering the calculation engine. The LCA should:
1. Change status from 'draft' to 'pending'
2. Invoke OpenLCA calculation engine
3. Generate results in `product_lca_results`
4. Change status to 'completed' or 'failed'

---

## Error Scenarios to Test

### Error 1: Missing Required Product Fields

**Setup:**
Try to create a product without filling all mandatory fields.

**Expected:**
- ❌ Form validation error
- ❌ Toast message: "Please complete the following required fields: SKU, Unit Size Value, Unit, Product Description"
- ❌ Product not created

---

### Error 2: Database Constraint Violation

**Setup:**
This should not occur with the new implementation, but if `system_boundary` is still NOT NULL:

**Expected Console Log:**
```
[createDraftLca] LCA insert error: {code: "23502", message: "..."}
[createDraftLca] Unexpected error: Error: Missing required field: system_boundary...
```

**Expected UI:**
- ❌ Error toast with user-friendly message
- ❌ Navigation doesn't occur
- ❌ LCA not created

---

### Error 3: Permission Denied

**Setup:**
User tries to create LCA for product in organisation they're not a member of (edge case).

**Expected:**
- ❌ Error toast: "Permission denied. You may not have access to create LCAs for this organisation."

---

### Error 4: Product Not Found

**Setup:**
Manually call `createDraftLca` with invalid product ID.

**Expected Console Log:**
```
[createDraftLca] Product not found {productId: "invalid", organizationId: "..."}
```

**Expected:**
- ❌ Error toast: "Product not found or you don't have access to it"

---

## Database Verification

After successfully creating an LCA, verify the database:

### Query: Check LCA Record
```sql
SELECT
  id,
  organization_id,
  product_id,
  product_name,
  functional_unit,
  system_boundary,
  sourcing_methodology,
  status,
  created_at
FROM product_lcas
WHERE product_id = '<your_product_id>'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Results:**
```
id: <uuid>
organization_id: <uuid>
product_id: <uuid>
product_name: "Test Coffee Blend 250ml"
functional_unit: "250 ml"
system_boundary: NULL
sourcing_methodology: "PURCHASED" (after step 3)
status: "draft"
created_at: <timestamp>
```

---

## Success Criteria

The "Create New LCA" flow is working correctly if:

1. ✅ All console logs appear in the correct sequence
2. ✅ LCA record is created in database with correct values
3. ✅ Navigation flows smoothly between steps
4. ✅ Toast notifications appear with correct messages
5. ✅ `functional_unit` is correctly derived from product unit size
6. ✅ `system_boundary` is NULL in draft state (no error)
7. ✅ User can proceed to sourcing methodology selection
8. ✅ Error messages are user-friendly and actionable

---

## Known Issues / Limitations

1. **Standalone Wizard Flow:** The `/lca/new` route provides an alternative flow that's not product-linked. This needs clarity on when to use which flow.

2. **System Boundary:** Currently nullable for drafts. May need to be required before calculation.

3. **Calculation Step:** Full end-to-end calculation testing requires OpenLCA integration to be verified.

---

## Debugging Checklist

If the flow fails, check:

1. ✅ Browser console for error messages
2. ✅ Network tab for failed API requests
3. ✅ Supabase logs for RLS policy failures
4. ✅ Database for partially created records
5. ✅ User's organisation membership
6. ✅ Product has all required fields populated

---

## Contact for Issues

If you encounter issues:
- Check console logs for `[createDraftLca]` and `[Products]` prefixed messages
- Verify database schema has `system_boundary` as nullable
- Ensure migration `20251118170527_make_system_boundary_nullable.sql` has been applied
- Check that product has `unit_size_value` and `unit_size_unit` populated
