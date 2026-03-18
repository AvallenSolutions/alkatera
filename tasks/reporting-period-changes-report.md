# Reporting Period Date Ranges: Change Report

**Date:** 18 March 2026
**Scope:** Social and governance features across the alka**tera** platform

## Summary

Converted all social and governance features from single-date/integer-year reporting periods to date range reporting periods (`reporting_period_start` / `reporting_period_end`), aligning with the existing pattern in `governance_lobbying`. Built a reusable DateRangePicker component, added period-over-period comparison functionality, and ensured all data carries timestamps for audit purposes.

## Changes Made

### 1. Database Migration
**File:** `supabase/migrations/20260318100000_reporting_period_date_ranges.sql`

Added `reporting_period_start` and `reporting_period_end` columns to 6 tables:
- `people_workforce_demographics`
- `people_employee_compensation`
- `people_training_records`
- `people_benefits`
- `governance_board_members`
- `governance_ethics_records`

**Backfill logic:**
- Records with existing `reporting_period` date: converted to month range (1st to last day of month)
- Records with only `reporting_year`: converted to full year range (1 Jan to 31 Dec)
- CHECK constraints added to all tables ensuring `start <= end`
- Old columns (`reporting_period`, `reporting_year`) retained for backward compatibility

### 2. Reusable DateRangePicker Component
**File:** `components/ui/date-range-picker.tsx`

- Built using existing `Calendar` (react-day-picker `mode="range"`) + `Popover`
- Displays formatted date range in a trigger button (e.g. "1 Jan 2026 - 31 Mar 2026")
- Supports optional period presets (Q1-Q4, Full Year) via props
- No new dependencies required

### 3. Reporting Period Utilities
**File:** `lib/reporting-period-utils.ts`

New utility functions:
- `formatPeriodRange(start, end)` - human-readable period labels with smart formatting (full year shows just "2026", same month shows "Mar 2026")
- `getPreviousPeriod(start, end)` - calculates the equivalent previous period of the same duration
- `calculatePeriodChanges(current, previous)` - computes deltas and percentage changes between two sets of metrics
- `periodsOverlap(a, b)` - detects overlapping reporting periods
- `periodDurationMonths(start, end)` - calculates period length in months
- `getReportingPeriodPresets(year)` - generates Q1-Q4 + Full Year presets for any given year

### 4. API Route Updates

**Demographics API** (`app/api/people-culture/demographics/route.ts`):
- POST: Accepts `reporting_period_start`/`reporting_period_end`, validates `start <= end`, derives `reporting_year` and `reporting_period` for backward compatibility
- GET: Supports `period_start`/`period_end` query params for date range filtering, orders by `reporting_period_start`

**Compensation API** (`app/api/people-culture/compensation/route.ts`):
- GET: Supports `period_start`/`period_end` query params alongside existing `year` param
- POST: Writes `reporting_period_start`/`reporting_period_end`
- PUT: Added to allowed update fields

**Training API** (`app/api/people-culture/training/route.ts`):
- GET: Supports date range query params
- POST: Writes date range fields

**Benefits API** (`app/api/people-culture/benefits/route.ts`):
- POST: Writes date range fields

### 5. Frontend Changes

**AddDemographicsDialog** (`app/(authenticated)/people-culture/diversity-inclusion/page.tsx`):
- Replaced single `<input type="date">` with `<DateRangePicker>` component
- Includes Q1-Q4 and Full Year preset buttons
- Validates that both start and end dates are selected before submission

**useDiversityMetrics hook** (`hooks/data/useDiversityMetrics.ts`):
- Added `reporting_period_start`/`reporting_period_end` to `WorkforceDemographics` interface
- Added `PeriodChanges` interface for period-over-period comparison
- Queries now order by `reporting_period_start` with fallback to `reporting_period`
- Calculates period-over-period changes for: total employees, female representation, turnover rate, new hires, departures
- Trend data includes formatted period labels from date ranges

**DiversityDashboard** (`components/people-culture/DiversityDashboard.tsx`):
- Shows reporting period badge with formatted date range
- Shows "Data entered" timestamp on all records
- Summary stat cards show change indicators (up/down arrows with percentages)
- New `PeriodComparisonCard` component showing side-by-side metrics vs previous period
- `TurnoverCard` shows change indicators for new hires, departures, and turnover rate
- Colour-coded change indicators (green for improvement, red for decline)
- Inverted colour logic for negative metrics (e.g. rising turnover shows red)

### 6. New Exported Components
- `ChangeIndicator` - reusable up/down/unchanged arrow with percentage
- `ReportingPeriodBadge` - calendar icon with formatted period label
- `PeriodComparisonCard` - full comparison table between two periods

## Tests

**33 tests, all passing.**

**Utility tests** (`lib/__tests__/reporting-period-utils.test.ts`) - 22 tests:
- Period formatting (full year, same month, multi-month, cross-year)
- Previous period calculation (quarterly, monthly, annual)
- Period change calculations (positive, negative, zero, no change)
- Overlap detection (overlapping, non-overlapping, adjacent, contained, same-day)
- Duration calculation
- Preset generation

**Component tests** (`components/ui/__tests__/date-range-picker.test.tsx`) - 7 tests:
- Renders with placeholder
- Displays formatted range
- Displays partial range (start only)
- Preset button rendering and interaction
- Disabled state
- Default placeholder

**Hook tests** (`hooks/data/__tests__/useDiversityMetrics.test.ts`) - 4 tests:
- Interface includes new date range fields
- Period change calculation logic
- Period label formatting integration
- Backward compatibility with null date ranges

## Backward Compatibility

- Old `reporting_period` and `reporting_year` columns are retained in all tables
- API routes continue to accept `reporting_period` (single date) as a fallback
- API routes continue to support `year` query parameter for filtering
- When only `reporting_period` is provided in a POST, it is used for both start and end
- Dashboard gracefully falls back to `reporting_period` when date range fields are null

## Performance Considerations

- No additional database queries introduced; same query count as before
- Period comparison calculations are done in-memory on already-fetched data
- DateRangePicker lazy-loads calendar only when popover opens
- Migration includes targeted `WHERE` clauses for backfill (no full table scans on null values)

## Future Considerations

- Once all code paths are verified in production, the deprecated `reporting_period` column can be removed in a follow-up migration
- The DateRangePicker component could be extended with FY-aware presets using the `useReportingPeriod` hook for organisations with non-calendar fiscal years
- The `PeriodComparisonCard` could be enhanced with sparkline charts showing multi-period trends
