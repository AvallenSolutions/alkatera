# LCA Creation Flows Analysis

## Two Distinct Flows Identified

### Flow 1: Product-Linked LCA Flow (Recommended)
**Entry Point:** Products page → "Create New LCA" dropdown action
**Route:** `/dashboard/lcas/[lca_id]/create/sourcing`
**Purpose:** Create LCA for an existing product with predefined metadata

**Steps:**
1. User creates/selects a product with full metadata (name, SKU, unit size, description)
2. Clicks "Create New LCA" from product dropdown
3. `createDraftLca()` creates draft with product metadata
4. Navigate to sourcing methodology selection page
5. User selects "We Grow" or "We Purchase"
6. Navigate to ingredients page to add materials
7. Calculate LCA

**Advantages:**
- Product metadata already validated and complete
- Functional unit automatically derived from product unit size
- Linked to product record for traceability
- Streamlined workflow focused on LCA-specific data
- Better data integrity (product → LCA relationship)

**Current Status:** ✅ Working after fixes

---

### Flow 2: Standalone LCA Wizard Flow
**Entry Point:** Reports page → "Create New LCA" button
**Route:** `/lca/new`
**Purpose:** Create standalone LCA without product linkage

**Steps:**
1. Step 1: Define product details (name, functional unit, system boundary)
2. Step 2: Enter activity data by life cycle stage (raw materials, manufacturing, transport, use, end-of-life)
3. Step 3: Review & Save draft, then calculate

**Advantages:**
- Comprehensive data capture for non-product LCAs
- Includes detailed activity data with DQI scores
- Suitable for assessments not tied to specific products
- Data Quality Indicators (DQI) for reliability tracking

**Current Status:** ⚠️ This flow creates LCAs via different API endpoint (`/functions/v1/request-product-lca`)

---

## Key Differences

| Aspect | Product-Linked Flow | Standalone Wizard Flow |
|--------|-------------------|----------------------|
| Product Linkage | Yes (product_id FK) | No |
| Entry Point | Products page | Reports page |
| Metadata Source | Existing product | User input |
| Functional Unit | Auto-derived | User input |
| System Boundary | Not required initially | Required upfront |
| Activity Data | Materials-focused | Comprehensive stages |
| Use Case | Product LCAs | General assessments |

---

## Recommendations

### 1. Consolidate or Clarify Purpose
- **Option A:** Keep both flows but document their distinct purposes clearly
- **Option B:** Merge into single flow with "Create from Product" vs "Create from Scratch" options

### 2. Product-Linked Flow (Priority)
This is the primary flow for most users. Current implementation is sound after fixes:
- ✅ Creates draft with product metadata
- ✅ Functional unit derived automatically
- ✅ System boundary nullable for drafts
- ✅ Sourcing methodology selection
- ✅ Materials/ingredients input
- ⏳ Calculation step needs validation

### 3. Standalone Wizard Flow (Secondary)
This flow needs review:
- ⚠️ Uses different API endpoint (`request-product-lca` vs product creation)
- ⚠️ Stores data in `product_lca_inputs` table as JSONB
- ⚠️ No product linkage - standalone assessments
- ❓ Unclear if this integrates with same calculation engine

### 4. Route Consistency
Current routes are inconsistent:
- Product-linked: `/dashboard/lcas/[lca_id]/create/sourcing`
- Standalone: `/lca/new`
- Reports listing: `/dashboard/reports/product-lca`
- Products listing: `/dashboard/products`

**Suggested Standardisation:**
- Product-linked: `/dashboard/products/[product_id]/lcas/new`
- Standalone: `/dashboard/lcas/new`
- All LCA pages under `/dashboard/lcas/` for consistency

---

## Technical Debt Items

1. **Different Data Models:**
   - Product-linked uses `product_lcas` + `product_lca_materials`
   - Standalone uses `product_lcas` + `product_lca_inputs` (JSONB)

2. **Different API Endpoints:**
   - Product-linked: Uses direct Supabase client
   - Standalone: Uses Edge Function `/functions/v1/request-product-lca`

3. **Calculation Engine:**
   - Both should use same engine (`/functions/v1/invoke-openlca`)
   - Need to verify data mapping for both flows

4. **User Experience:**
   - No clear guidance on which flow to use when
   - "Create New LCA" button appears in two places with different behaviours

---

## Immediate Actions Required

1. ✅ Product-linked flow is now functional (completed)
2. ⏳ Add error handling and logging (in progress)
3. ⏳ Test end-to-end flow including calculation
4. ❓ Decide on standalone wizard flow: keep, remove, or merge?
5. ❓ Standardise routes and navigation
6. ❓ Document user-facing difference between flows
