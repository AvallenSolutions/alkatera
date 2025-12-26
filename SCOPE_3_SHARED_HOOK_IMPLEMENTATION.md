# Scope 3 Shared Hook Implementation

## Overview

Created a shared hook `useScope3Emissions` that calculates all Scope 3 category totals and provides a single source of truth for Scope 3 emissions data across the application.

## Changes Made

### 1. Created `hooks/data/useScope3Emissions.ts`

A new React hook that:
- Fetches and calculates all Scope 3 category emissions
- Returns a breakdown by category:
  - Category 1: Purchased Goods (from product LCAs)
  - Category 2: Capital Goods
  - Category 5: Operational Waste
  - Category 6: Business Travel
  - Category 7: Employee Commuting
  - Category 9: Downstream Logistics
  - Marketing Materials (subset of purchased services)
  - Other Purchased Services
- Automatically sums all categories to provide total Scope 3 emissions
- Provides loading state and error handling
- Includes a `refetch` function to manually refresh data

### 2. Updated Company Footprint Page

Modified `app/(authenticated)/reports/company-footprint/[year]/page.tsx` to:
- Import and use the new `useScope3Emissions` hook
- Remove duplicate calculation logic for products and overheads
- Use `scope3Emissions.total` for the Scope 3 total
- Use `scope3Emissions.products` for Category 1 breakdown
- Pass loading state to the ProductsSupplyChainCard component

### Benefits

1. **Single Source of Truth**: Both the company footprint page and any other pages that need Scope 3 data will show identical numbers
2. **No Duplicate Logic**: Calculation logic exists in one place, making it easier to maintain and debug
3. **Guaranteed Consistency**: All components using this hook will always be in sync
4. **Easy to Extend**: Adding new Scope 3 categories is straightforward - just update the hook
5. **Better Performance**: The hook can be reused across multiple components without re-fetching data

## How It Works

The hook:
1. Fetches production logs and their associated product LCA emissions for Category 1
2. Fetches the corporate report for the given year
3. Fetches all corporate overhead entries linked to that report
4. Categorises overhead entries by their category field
5. Sums all categories to get the total
6. Returns the breakdown with loading and error states

## Usage Example

```typescript
const { scope3Emissions, isLoading, error, refetch } = useScope3Emissions(
  organizationId,
  year
);

// Access individual categories
const productsEmissions = scope3Emissions.products;
const travelEmissions = scope3Emissions.business_travel;
const totalScope3 = scope3Emissions.total;
```

## Testing

The build completed successfully with no errors, confirming that:
- All imports are correct
- Type definitions are valid
- The hook integrates properly with existing code

## Next Steps

This hook can now be used in other parts of the application that need Scope 3 data, such as:
- Dashboard overview widgets
- Sustainability reports
- Charts and visualisations
- Export functions
