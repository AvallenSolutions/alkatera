# Scope 3 & LCA Display Issues

## Issue #1: LCA Report Cards Showing 0.000 kg CO2eq

### Screenshot Evidence
- Page: `/reports/lcas-epds` (LCA's & EPD's page)
- Shows: "Total Reports: 18", "13 completed"
- Report cards display: "0.000 kg CO2eq"
- Database shows: LCAs have `total_ghg_emissions` values calculated

### Root Cause Investigation Needed

#### Check 1: Product LCAs Table Data
```sql
-- Check if product_lcas have total_ghg_emissions populated
SELECT
  pl.id,
  p.name as product_name,
  pl.status,
  pl.total_ghg_emissions,
  pl.total_ghg_emissions_fossil,
  pl.total_ghg_emissions_biogenic,
  pl.created_at,
  pl.updated_at
FROM product_lcas pl
JOIN products p ON pl.product_id = p.id
WHERE pl.status = 'completed'
ORDER BY pl.created_at DESC
LIMIT 20;
```

**Expected**: Should show `total_ghg_emissions` > 0 for completed LCAs
**If 0**: Migrations didn't recalculate properly, need to re-run calculations

#### Check 2: LCA Page Query
The LCA list page likely queries `product_lcas` table and displays `total_ghg_emissions`.

**Possible Issues**:
1. Frontend querying wrong column
2. Frontend not fetching `total_ghg_emissions` column
3. Display logic dividing/multiplying incorrectly
4. Column exists but NULL (not 0)

**Files to Check**:
- Page rendering LCA cards (likely `app/(authenticated)/reports/lcas-epds/page.tsx` or similar)
- LCA card component

---

## Issue #2: Corporate Reports vs Product LCA Reports Confusion

### Clarification

You ran TEST 1 query for `corporate_reports` (Company Emissions):
```
report_id: 34c7282f... | year: 2025 | status: Draft | total_emissions: 0
report_id: 03453dee... | year: 2025 | status: Draft | total_emissions: 0
```

But the screenshot shows **Product LCA Reports** page, not Company Emissions.

### Two Separate Systems

#### A. Product LCA Reports (what you're looking at)
- **Table**: `product_lcas`
- **Purpose**: Individual product carbon footprints
- **Columns**: `total_ghg_emissions`, `status`, `aggregated_impacts`
- **Page**: `/reports/lcas-epds`
- **Count**: You have 18 total, 13 completed

#### B. Company Emissions Reports (what TEST 1 checks)
- **Table**: `corporate_reports`
- **Purpose**: Annual organizational carbon footprint (Scope 1+2+3)
- **Columns**: `total_emissions`, `year`, `status`, `breakdown_json`
- **Page**: `/data/scope-1-2` → Annual Footprint tab
- **Count**: 2 reports for 2025 (both Draft, total_emissions = 0)

### The `corporate_reports` with 0 emissions is EXPECTED
The Corporate Reports showing `total_emissions: 0` is correct because:
1. They're still in "Draft" status
2. You haven't clicked "Calculate Footprint" button yet
3. Scope 3 data entry issues prevent aggregation

This is separate from the Product LCA issue.

---

## Issue #3: Scope 3 Category 1 Not Showing

From your earlier report: "From the UI, it's not showing any purchase good & services, despite us having run product LCA's."

### Architecture
Category 1 (Purchased Goods) should:
1. Query `production_logs` for 2025
2. For each log, get latest completed `product_lca`
3. Extract materials + packaging emissions from `aggregated_impacts`
4. Scale by production volume
5. Display total

### Test Query for Category 1
```sql
-- Check if production logs exist for 2025
SELECT
  pl.id,
  pl.date,
  pl.volume,
  pl.unit,
  p.name as product_name,
  p.functional_unit_quantity,
  (
    SELECT plca.total_ghg_emissions
    FROM product_lcas plca
    WHERE plca.product_id = pl.product_id
      AND plca.status = 'completed'
    ORDER BY plca.created_at DESC
    LIMIT 1
  ) as lca_total_emissions,
  (
    SELECT plca.aggregated_impacts
    FROM product_lcas plca
    WHERE plca.product_id = pl.product_id
      AND plca.status = 'completed'
    ORDER BY plca.created_at DESC
    LIMIT 1
  ) as lca_aggregated_impacts
FROM production_logs pl
JOIN products p ON pl.product_id = p.id
WHERE pl.date >= '2025-01-01'
  AND pl.date <= '2025-12-31'
ORDER BY pl.date DESC
LIMIT 10;
```

**Expected**:
- Rows with 2025 production data
- `lca_total_emissions` > 0
- `lca_aggregated_impacts` with JSON structure

**If NO ROWS**: No production logged for 2025 → Category 1 correctly shows "No data"

**If HAS ROWS but lca_total_emissions = 0**: LCA calculations failed

**If HAS ROWS but lca_aggregated_impacts = NULL**: LCA not completed or missing breakdown

---

## Diagnostic Steps

### Step 1: Check Product LCA Data
Run this to see if LCAs actually have emissions calculated:

```sql
SELECT
  p.name as product_name,
  pl.status,
  pl.total_ghg_emissions,
  pl.total_ghg_emissions_fossil,
  pl.total_ghg_emissions_biogenic,
  pl.lifecycle_stage_raw_materials,
  pl.lifecycle_stage_processing,
  pl.lifecycle_stage_packaging,
  pl.created_at
FROM product_lcas pl
JOIN products p ON pl.product_id = p.id
WHERE pl.status = 'completed'
ORDER BY pl.created_at DESC
LIMIT 10;
```

### Step 2: Check Production Logs for 2025
```sql
SELECT COUNT(*) as production_logs_2025
FROM production_logs
WHERE date >= '2025-01-01' AND date <= '2025-12-31';
```

### Step 3: Check LCA Page Frontend Query
Need to find the file that renders the LCA list page and check:
1. What columns it's selecting from `product_lcas`
2. How it's displaying `total_ghg_emissions`
3. If there's any formatting/conversion logic

### Step 4: Check Scope 3 Overheads Data
```sql
-- Check if any Scope 3 data actually saved
SELECT
  category,
  COUNT(*) as count,
  SUM(computed_co2e) as total_co2e
FROM corporate_overheads
WHERE report_id IN (
  SELECT id FROM corporate_reports WHERE year = 2025
)
GROUP BY category;
```

**Expected**: If Business Travel, Services, etc. not saving, this returns 0 rows

---

## Summary of Issues

### Issue A: LCA Report Cards Show "0.000 kg CO2eq" ❌
- **Location**: `/reports/lcas-epds` page
- **Table**: `product_lcas`
- **Symptom**: Cards display 0.000 despite having completed LCAs
- **Priority**: P1 - Display issue, data exists but not showing

### Issue B: Scope 3 Category 1 Not Displaying ❌
- **Location**: `/data/scope-1-2` → Scope 3 tab → Category 1 card
- **Tables**: `production_logs` + `product_lcas`
- **Symptom**: Shows "No Category 1 data available"
- **Priority**: P0 - Blocking Scope 3 footprint

### Issue C: Corporate Reports total_emissions = 0 ✅
- **Location**: `corporate_reports` table
- **Status**: EXPECTED (Draft status, not calculated yet)
- **Action**: Click "Calculate Footprint" after entering Scope 1-3 data

### Issue D: Scope 3 Cards Not Saving (Business Travel, etc.) ❌
- **Location**: `/data/scope-1-2` → Scope 3 tab → All category cards
- **Table**: `corporate_overheads`
- **Priority**: P0 - CRITICAL (still needs diagnosis)

---

## Next Actions

1. **Run Step 1 query** to check if product LCAs have `total_ghg_emissions` populated
2. **Run Step 2 query** to check if production logs exist for 2025
3. **Run Step 4 query** to check if any Scope 3 overhead data saved
4. **Try saving Business Travel** with browser console open (F12) and report any errors

Once you provide these results, I can pinpoint the exact issue and create the fix.
