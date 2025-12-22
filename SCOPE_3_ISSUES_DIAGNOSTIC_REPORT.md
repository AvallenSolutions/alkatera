# Scope 3 Data Entry Issues - Diagnostic Report

**Date**: 2025-12-22
**Page**: `/data/scope-1-2` → Scope 3 Tab
**Severity**: HIGH - Multiple data entry failures

---

## Issues Summary

| # | Issue | Status | Priority |
|---|-------|--------|----------|
| 1 | Category 1 (Purchased Goods) not showing despite Product LCAs | ❌ | P0 |
| 2 | Business Travel data not saving | ❌ | P0 |
| 3 | Services & Overhead data not saving | ❌ | P0 |
| 4 | Team Commuting data not saving | ❌ | P0 |
| 5 | Capital Goods data not saving | ❌ | P0 |
| 6 | Operational Waste not auto-calculating | ⚠️ | P1 |
| 7 | Logistics & Distribution necessity | ❓ | P2 |
| 8 | No Scope 3 total showing on Annual Footprint | ❌ | P0 |

---

## Architecture Overview

### Data Flow
```
Scope 3 Components → corporate_overheads table → corporate_reports aggregation
                                                        ↓
                                            Annual Footprint Display
```

### Tables Involved
1. **corporate_reports** - Stores annual footprint summary (by org + year)
2. **corporate_overheads** - Stores Scope 3 activity data (linked to report_id)
3. **product_lcas** - Product LCA data (for Cat 1 auto-calculation)
4. **production_logs** - Production volumes (for Cat 1 scaling)
5. **facility_waste_logs** - Waste data (for operational waste auto-calc)

### Components
- `BusinessTravelCard.tsx` - Cat 6: Business Travel
- `ServicesOverheadCard.tsx` - Cat 1: Purchased Services
- `TeamCommutingCard.tsx` - Cat 7: Employee Commuting
- `CapitalGoodsCard.tsx` - Cat 2: Capital Goods
- `OperationalWasteCard.tsx` - Cat 5: Waste Generated
- `LogisticsDistributionCard.tsx` - Cat 9: Downstream Transport
- `MarketingMaterialsCard.tsx` - Cat 1: Marketing Materials

---

## Issue #1: Category 1 (Purchased Goods) Not Showing

### Expected Behavior
The UI should show:
```
Category 1: Purchased Goods & Services
[Badge] Auto-calculated from Product LCAs

Total Category 1 Emissions: X.XXX tCO2e
Tier 1: Primary LCA data from ecoinvent 3.10

Breakdown by Product:
- Product A: Materials + Packaging = X.XXX tCO2e
- Product B: Materials + Packaging = X.XXX tCO2e
```

### Actual Behavior
Shows:
```
No Category 1 data available
Complete product LCAs and record production volumes...
[Go to Product LCAs button]
```

### Root Cause Analysis

**Function**: `fetchScope3Cat1FromLCAs()` (lines 561-648 in page.tsx)

**Query Logic**:
1. Fetches `production_logs` for selected year
2. For each log, fetches latest completed `product_lca`
3. Extracts `raw_materials` and `packaging` stages from `aggregated_impacts.breakdown.by_lifecycle_stage`
4. Calculates total emissions scaled by production volume

**Possible Issues**:
1. ✅ No production logs for 2025 (but you said you have LCAs)
2. ❌ `aggregated_impacts` JSON structure mismatch
3. ❌ LCA `status` not set to 'completed'
4. ❌ Lifecycle stage names don't match ('raw_materials' vs 'materials')
5. ❌ `climate_change` field missing in stage breakdown

**Diagnostic Query**:
```sql
-- Check if production logs exist for 2025
SELECT COUNT(*) as log_count
FROM production_logs
WHERE organization_id = '<your-org-id>'
  AND date >= '2025-01-01'
  AND date <= '2025-12-31';

-- Check if product LCAs have aggregated_impacts
SELECT
  p.name as product_name,
  pl.status,
  pl.aggregated_impacts::text
FROM product_lcas pl
JOIN products p ON pl.product_id = p.id
WHERE pl.status = 'completed'
  AND pl.organization_id = '<your-org-id>'
ORDER BY pl.created_at DESC
LIMIT 5;

-- Check lifecycle stage structure
SELECT
  p.name,
  jsonb_pretty(pl.aggregated_impacts->'breakdown'->'by_lifecycle_stage') as stages
FROM product_lcas pl
JOIN products p ON pl.product_id = p.id
WHERE pl.status = 'completed'
  AND pl.aggregated_impacts IS NOT NULL
LIMIT 1;
```

**Expected JSON Structure**:
```json
{
  "aggregated_impacts": {
    "breakdown": {
      "by_lifecycle_stage": [
        {
          "stage": "raw_materials",
          "climate_change": 1234.56,
          ...
        },
        {
          "stage": "packaging",
          "climate_change": 567.89,
          ...
        }
      ]
    }
  }
}
```

---

## Issue #2-5: Scope 3 Cards Not Saving Data

### Components Affected
- BusinessTravelCard
- ServicesOverheadCard
- TeamCommutingCard
- CapitalGoodsCard

### Save Pattern (Example from BusinessTravelCard line 270)
```typescript
await supabase.from("corporate_overheads").insert({
  report_id: reportId,
  category: "business_travel",
  description,
  transport_mode,
  distance_km,
  passenger_count,
  computed_co2e,
  // ...other fields
});
```

### Possible Root Causes

#### A. RLS Policies Blocking INSERT
**Table**: `corporate_overheads`

**Check Current Policies**:
```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual::text as using_expression,
  with_check::text as with_check_expression
FROM pg_policies
WHERE tablename = 'corporate_overheads'
ORDER BY policyname;
```

**Expected Policy**:
```sql
-- Should allow INSERT for authenticated users with matching organization_id
CREATE POLICY "Users can insert corporate overheads for their org"
ON corporate_overheads
FOR INSERT
TO authenticated
WITH CHECK (
  report_id IN (
    SELECT id FROM corporate_reports
    WHERE organization_id = auth.uid()::text
  )
);
```

**Issue**: Policy might be checking `organization_id` on `corporate_overheads` but column doesn't exist - it's only on `corporate_reports`.

#### B. Foreign Key Constraint Failing
**Check**: Does `report_id` exist in `corporate_reports`?

```sql
-- Verify report exists for org + year
SELECT id, year, status, organization_id
FROM corporate_reports
WHERE organization_id = '<your-org-id>'
  AND year = 2025;
```

**If no report exists**: Page should auto-create it via `fetchReportData()` (line 279-289), but this might be failing silently.

#### C. Missing Required Columns
**Check schema**:
```sql
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'corporate_overheads'
ORDER BY ordinal_position;
```

**Required fields** from BusinessTravelCard insert:
- report_id (UUID, NOT NULL, FK to corporate_reports.id)
- category (TEXT, NOT NULL)
- description (TEXT)
- computed_co2e (NUMERIC)
- spend_amount (NUMERIC)
- currency (TEXT)
- entry_date (DATE)
- ... and category-specific fields

#### D. Browser Console Errors
**Action**: Open browser console (F12) → Network tab

**When saving Business Travel**:
1. Click "Log Business Travel"
2. Fill form and submit
3. Check Network tab for:
   - POST request to Supabase
   - Response status (200 = success, 4xx/5xx = error)
   - Response body (error message if failed)

**Check Console tab for**:
- JavaScript errors
- Supabase client errors
- `console.error('Error saving travel entry:', error)` messages

---

## Issue #6: Operational Waste Not Auto-Calculating

### Expected Behavior
Operational waste should be auto-calculated from `facility_waste_logs` table where users log waste at facility level.

### Current Implementation
**Component**: `OperationalWasteCard.tsx`

**Needs Investigation**:
1. Does component query `facility_waste_logs`?
2. Or does it also use `corporate_overheads` for manual entry?
3. Is there auto-aggregation logic?

**Diagnostic**:
```sql
-- Check if facility waste logs exist
SELECT COUNT(*) as waste_log_count
FROM facility_waste_logs
WHERE organization_id = '<your-org-id>'
  AND date >= '2025-01-01'
  AND date <= '2025-12-31';

-- Check waste categories available
SELECT DISTINCT waste_type, disposal_method
FROM facility_waste_logs
WHERE organization_id = '<your-org-id>'
ORDER BY waste_type;
```

---

## Issue #7: Logistics & Distribution

### Question
You're doing cradle-to-gate LCAs. Is downstream logistics (Cat 9) necessary?

### GHG Protocol Guidance
**Category 9: Downstream Transportation & Distribution**
- Applies to: Transport of sold products from company to end customer
- **Boundary**: Gate → Customer
- **Required if**: You don't own the transport (e.g., third-party delivery)
- **Not required if**:
  - Customer picks up product (no transport)
  - Already included in Scope 1 (owned vehicles)

### Recommendation
If you're a distillery and:
- ✅ Distributors transport products → **Cat 9 required** (use distance-based or spend-based)
- ❌ Customers pick up at distillery → **Cat 9 not required**
- ❌ You deliver in owned vehicles → **Already in Scope 1**, don't double-count

**Decision**: Ask user about distribution model

---

## Issue #8: Scope 3 Not Showing on Annual Footprint

### Current Display Logic (lines 917-920)
```typescript
<div className="text-2xl font-bold">
  {(scope3Cat1CO2e * 1000) + productsCO2e + fleetCO2e > 0
    ? `${((scope3Cat1CO2e * 1000) + productsCO2e + fleetCO2e).toFixed(3)} kgCO2e`
    : 'No data'}
</div>
```

### Variables Calculated
1. `scope3Cat1CO2e` - From `fetchScope3Cat1FromLCAs()` (tCO2e)
2. `productsCO2e` - From `fetchProductsEmissions()` (kgCO2e)
3. `fleetCO2e` - From `fetchFleetEmissions()` (kgCO2e)

### Missing Variables
**Not included in Scope 3 total**:
- Business Travel (`corporate_overheads` where category = 'business_travel')
- Purchased Services (`corporate_overheads` where category = 'purchased_services')
- Employee Commuting (`corporate_overheads` where category = 'employee_commuting')
- Capital Goods (`corporate_overheads` where category = 'capital_goods')
- Operational Waste (`corporate_overheads` where category = 'operational_waste')
- Logistics & Distribution (`corporate_overheads` where category = 'downstream_logistics')

### Root Cause
**Missing fetch function** to aggregate `corporate_overheads` by category.

### Required Fix
Add function to fetch and aggregate all Scope 3 categories from `corporate_overheads`:

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

    // Aggregate by Scope 3 category
    const scope3Categories = [
      'business_travel',        // Cat 6
      'purchased_services',     // Cat 1
      'employee_commuting',     // Cat 7
      'capital_goods',          // Cat 2
      'operational_waste',      // Cat 5
      'downstream_logistics',   // Cat 9
      'marketing_materials',    // Cat 1
    ];

    const total = data
      ?.filter(item => scope3Categories.includes(item.category))
      .reduce((sum, item) => sum + (item.computed_co2e || 0), 0) || 0;

    setScope3OverheadsCO2e(total); // New state variable
  } catch (error: any) {
    console.error('Error fetching Scope 3 overheads:', error);
    setScope3OverheadsCO2e(0);
  }
};
```

Then update display:
```typescript
{(scope3Cat1CO2e * 1000) + productsCO2e + fleetCO2e + scope3OverheadsCO2e > 0
  ? `${((scope3Cat1CO2e * 1000) + productsCO2e + fleetCO2e + scope3OverheadsCO2e).toFixed(3)} kgCO2e`
  : 'No data'}
```

---

## Recommended Testing Sequence

### Test 1: Check Report Creation
```sql
SELECT id, year, status, organization_id, created_at
FROM corporate_reports
WHERE organization_id = '<your-org-id>'
  AND year = 2025;
```
**Expected**: 1 row with status 'Draft'

### Test 2: Test Business Travel Save (Browser Console)
1. Open `/data/scope-1-2` → Scope 3 tab
2. Open Browser Console (F12) → Console tab
3. Click "+ Log Business Travel"
4. Fill form:
   - Description: "Test trip"
   - Transport: "Domestic Flight"
   - Distance: 500 km
   - Passengers: 1
5. Submit
6. **Check Console** for errors
7. **Check Network tab** for POST request status

### Test 3: Check If Data Saved
```sql
SELECT
  id,
  category,
  description,
  transport_mode,
  distance_km,
  computed_co2e,
  created_at
FROM corporate_overheads
WHERE report_id = (
  SELECT id FROM corporate_reports
  WHERE organization_id = '<your-org-id>'
  AND year = 2025
)
ORDER BY created_at DESC
LIMIT 10;
```
**Expected**: Row with category = 'business_travel', your test data

### Test 4: Check RLS Policies
```sql
-- Test INSERT permission (run as authenticated user)
INSERT INTO corporate_overheads (
  report_id,
  category,
  description,
  spend_amount,
  currency,
  entry_date,
  computed_co2e
) VALUES (
  (SELECT id FROM corporate_reports WHERE organization_id = '<your-org-id>' AND year = 2025),
  'test_category',
  'Test entry',
  100,
  'GBP',
  '2025-01-01',
  50
);

-- If this fails with RLS error, policies need fixing
```

### Test 5: Check Scope 3 Cat 1 Data
```sql
-- Check production logs
SELECT
  pl.date,
  pl.volume,
  pl.unit,
  p.name as product_name
FROM production_logs pl
JOIN products p ON pl.product_id = p.id
WHERE pl.organization_id = '<your-org-id>'
  AND pl.date >= '2025-01-01'
ORDER BY pl.date DESC
LIMIT 10;

-- Check product LCA structure
SELECT
  p.name,
  plca.status,
  plca.total_ghg_emissions,
  jsonb_pretty(plca.aggregated_impacts->'breakdown'->'by_lifecycle_stage') as stages
FROM product_lcas plca
JOIN products p ON plca.product_id = p.id
WHERE plca.organization_id = '<your-org-id>'
  AND plca.status = 'completed'
LIMIT 3;
```

---

## Priority Actions

### P0 - Critical (Blocking Scope 3 data entry)
1. ✅ Check browser console for errors when saving Business Travel
2. ✅ Verify RLS policies on `corporate_overheads` allow INSERT
3. ✅ Confirm `corporate_reports` row exists for 2025
4. ✅ Fix Scope 3 total calculation to include `corporate_overheads`

### P1 - High (Data quality)
5. ✅ Investigate why Cat 1 (Purchased Goods) not displaying
6. ✅ Check `aggregated_impacts` JSON structure in `product_lcas`
7. ✅ Verify production logs exist for 2025

### P2 - Medium (Feature clarification)
8. ❓ Clarify if Logistics & Distribution (Cat 9) needed for cradle-to-gate

---

## Next Steps

1. **Run diagnostic queries** above to identify which specific issue is causing saves to fail
2. **Check browser console** when attempting to save each Scope 3 category
3. **Report findings** back with:
   - SQL query results
   - Browser console error messages
   - Network request/response details
4. **Create Bolt fix prompt** once root cause identified

---

## Summary

**Root Cause Hypothesis**:
- RLS policies on `corporate_overheads` too restrictive (most likely)
- Missing `corporate_reports` row for 2025 (less likely, should auto-create)
- JSON structure mismatch for Cat 1 LCA data (for Cat 1 issue specifically)
- Missing aggregation function for Scope 3 total display (confirmed)

**Impact**:
- Users cannot enter any Scope 3 data
- Annual footprint incomplete (Scope 3 = 0)
- GHG inventory non-compliant with GHG Protocol

**Priority**: **P0 - CRITICAL**
