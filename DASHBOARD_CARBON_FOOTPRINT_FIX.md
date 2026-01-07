# Dashboard Carbon Footprint Calculation Fix

## Problem
The dashboard's Carbon Footprint widget was showing different figures than the Company Emissions page because it used different calculation logic.

## Root Cause
The `useCompanyFootprint` hook had duplicate Scope 3 calculation code that:
1. Manually fetched and summed `product_lca_materials` table (incorrect approach)
2. Had complex logic that could miss or incorrectly aggregate data
3. Prioritized showing finalized corporate reports over live data

The Company Emissions page correctly used:
- `useScope3Emissions` hook which uses `total_ghg_emissions` directly from `product_lcas` table
- Live calculation from current data sources

## Solution Implemented

### 1. Refactored useCompanyFootprint Hook
**File:** `/hooks/data/useCompanyFootprint.ts`

**Changes:**
- Added import for `useScope3Emissions` hook
- Now uses the shared Scope 3 emissions hook internally
- Removed 140+ lines of duplicate Scope 3 calculation code
- Updated `calculateLiveEmissions` to accept `scope3Data` parameter instead of calculating it

### 2. Removed Finalized Report Priority
- Dashboard now **always** shows live calculated data for the current year
- Removed logic that checked for finalized corporate reports first (lines 68-90)
- Company Emissions page can still show finalized report data when "Generate Report" is clicked

### 3. Unified Data Sources
Both dashboard and Company Emissions page now use:
- **Scope 1 & 2:** `facility_activity_data` + `fleet_activities` tables
- **Scope 3:** `useScope3Emissions` hook (products from `product_lcas.total_ghg_emissions` + overheads from `corporate_overheads`)

## Benefits
1. **Single source of truth:** All Scope 3 calculations use `useScope3Emissions` hook
2. **Accurate figures:** Dashboard now matches Company Emissions page exactly
3. **Reduced complexity:** Eliminated 140+ lines of duplicate code
4. **Easier maintenance:** Changes to calculation logic only need to happen in one place
5. **Real-time data:** Dashboard always reflects current state

## Data Flow

### Before (Incorrect)
```
Dashboard Widget
└── useCompanyFootprint
    ├── Check finalized report first (priority)
    └── calculateLiveEmissions (duplicate Scope 3 logic)
        └── Manual material aggregation ❌

Company Emissions Page
└── useScope3Emissions
    └── Uses total_ghg_emissions ✓
```

### After (Correct)
```
Dashboard Widget
└── useCompanyFootprint
    └── calculateLiveEmissions
        ├── Scope 1 & 2: facility_activity_data + fleet
        └── Scope 3: useScope3Emissions (shared) ✓

Company Emissions Page
└── useScope3Emissions (shared) ✓
```

## Testing
- TypeScript compilation: ✓ No errors
- Dashboard always shows live data for current year
- Company Emissions page continues to work correctly
- Both pages now use identical calculation logic

## Key Changes Summary
1. `useCompanyFootprint` now internally uses `useScope3Emissions` hook
2. Removed duplicate Scope 3 calculation logic (lines 271-411)
3. Dashboard always shows live calculated data
4. `calculateLiveEmissions` accepts `scope3Data` parameter
5. Scope 3 breakdown uses data from shared hook instead of local calculation

## Notes
- Dashboard behavior: Always live data for current year
- Full Report behavior: Can show finalized report data when generated
- Both use same underlying calculation when showing live data
