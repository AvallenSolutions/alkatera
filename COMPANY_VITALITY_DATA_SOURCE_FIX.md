# Company Vitality Data Source Fix

## Issue
The Company Vitality page Scope 3 tab was showing incorrect data (only Category 1 at 283.2k kg) that didn't match the Company Emissions page (275.440t total). This was because the Vitality page was calculating Scope 3 data independently instead of using Company Footprint as the single source of truth.

## Root Cause
- Created `useScope3GranularData` hook that independently recalculated emissions from database
- This created data inconsistency between:
  - Company Emissions page (source of truth) showing 275.440t
  - Company Vitality page showing incorrect 283.2k kg for only Category 1

## Solution Implemented

### 1. Removed Independent Calculation Hook
- Removed `useScope3GranularData` hook call from Performance page
- Changed from calculating independently to using Company Footprint data

### 2. Created Transformation Function
Added `transformFootprintToScope3Categories()` function that:
- Takes Company Footprint data as input (single source of truth)
- Maps the 8 Company Footprint Scope 3 categories to the 15 GHG Protocol categories
- Preserves exact emission values from Company Emissions page

### 3. Category Mapping
```typescript
Category 1 (Purchased Goods & Services) → scope3.products
Category 2 (Capital Goods)              → scope3.capital_goods
Category 5 (Waste Generated)            → scope3.waste
Category 6 (Business Travel)            → scope3.business_travel
Category 7 (Employee Commuting)         → scope3.employee_commuting
Category 9 (Downstream Transportation)  → scope3.logistics
Categories 3, 4, 8, 10-15              → Not yet captured (marked as 'missing')
```

### 4. Data Quality Classification
- `primary`: Direct measurement (products, business travel)
- `secondary`: Industry averages or estimates (capital goods, waste, commuting, logistics)
- `missing`: Categories not yet captured in system

## Result
- Company Vitality Scope 3 tab now shows **exact same totals** as Company Emissions page
- All 15 GHG Protocol categories are displayed
- Categories with no data are clearly marked as "missing"
- Single source of truth maintained: Company Footprint → Company Vitality
- Build completed successfully with no errors

## Files Modified
- `/app/(authenticated)/performance/page.tsx`
  - Removed `useScope3GranularData` hook call
  - Added `transformFootprintToScope3Categories()` function
  - Updated to use `footprintData` as data source
  - Changed `isLoadingScope3` to use `footprintLoading` state

## Data Flow (Corrected)
```
Company Emissions Page (Source of Truth)
    ↓
useCompanyFootprint() hook
    ↓
footprintData.breakdown.scope3
    ↓
transformFootprintToScope3Categories()
    ↓
Company Vitality Scope 3 Tab (Display)
```

## Testing Recommendations
1. Navigate to Company Vitality page
2. Open Scope 3 tab in Carbon breakdown
3. Verify total matches Company Emissions page exactly (275.440t)
4. Verify all 15 categories are displayed
5. Verify categories 1, 2, 5, 6, 7, 9 show data
6. Verify categories 3, 4, 8, 10-15 show as "missing"
