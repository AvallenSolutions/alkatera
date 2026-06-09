# Reporting period flexibility

## Part 1 — Financial Year: any month (Settings)
Current: `components/settings/OrganisationSettings.tsx` (~L665-681) offers 4 presets
(Jan/Apr/Jul/Oct). Stored as `report_defaults.reporting_period.fiscal_year_start_month`
(number 1-12). Consumers (`lib/log-data/period-utils.ts`, `hooks/useReportingPeriod.ts`,
`lib/xero/sync-service.ts`) ALREADY accept any month 1-12 — so this is UI-only.

- [ ] Replace the 4 SelectItems with all 12 months, annotating the conventional ones
      (January = Calendar Year, April = UK Financial Year). No storage/consumer change.

## Part 2 — Facility Data: custom 12-month period to the day
Current: `components/facilities/DirectDataEntry.tsx` cadence (monthly/quarterly/annual)
→ `getAvailablePeriods()` dropdown; annual buckets are calendar/FY years only. Schema
(`utility_data_entries`, `facility_activity_entries`) stores `reporting_period_start/end`
as DATE — already supports arbitrary ranges. LCA facility allocation uses period-overlap
queries (`product-lca-calculator.ts`) so custom ranges work downstream.

- [ ] `lib/log-data/period-utils.ts`: add `getCustomAnnualPeriod(startISO)` →
      `{ start, end = start + 1 year − 1 day, label }` + a range label formatter.
- [ ] `DirectDataEntry.tsx`: for the **Annual** cadence add a "Custom 12-month period…"
      entry to the period selector. When chosen, show a day-precision start-date input and
      auto-compute + display the end (e.g. 15/06/2024 → 14/06/2025). The custom period
      flows through as `selectedPeriod`; activity-date min/max already bind to it.
- [ ] Keep monthly/quarterly unchanged; keep existing annual presets for convenience.

## Decisions
- Custom period is locked to exactly 12 months (custom start day, auto end), per the
  requirement ("a full 12 month period") — not a free-form arbitrary-length range.
- Only the Annual cadence gets the custom option.

## Known limitation (flag, not fixing in this change)
- `lib/xero/resolved-emissions.ts` buckets emissions by calendar year on
  `reporting_period_start`. Facility utility/activity → LCA allocation is overlap-based and
  unaffected; only the Xero financial-emissions yearly view assumes calendar years.
  Refactor deferred unless wanted.

## Verification
- [ ] Unit test for `getCustomAnnualPeriod` (incl. 15/06/2024 → 14/06/2025 + a leap-year start)
- [ ] tsc clean for touched files
- [ ] Manual: settings shows 12 months; facility annual "custom" yields a day-precise 12-month window
- [ ] Review section completed

## Review (completed)
- Part 1: `OrganisationSettings.tsx` financial-year selector now lists all 12 start
  months (generated, `en-GB` month names), annotating January (Calendar Year) and
  April (UK Financial Year). Storage (`fiscal_year_start_month`) and all consumers
  already accepted 1-12, so no other changes were needed.
- Part 2: added `getCustomAnnualPeriod()`, `formatPeriodRangeLabel()` and
  `formatISODateDisplay()` to `lib/log-data/period-utils.ts`. `DirectDataEntry.tsx`
  now offers "Custom 12-month period…" under the Annual cadence; picking it shows a
  day-precision start-date input and auto-derives the end (start + 12 months − 1 day,
  shown as e.g. "2024-06-15 to 2025-06-14 (12 months)"). The custom window flows
  through `selectedPeriod`, so saved `reporting_period_start/end` and the activity-date
  min/max all honour it. Monthly/quarterly and the annual presets are unchanged.
- Tests: `lib/__tests__/log-data-period-utils.test.ts` (7) — spec example
  15/06/2024 → 14/06/2025, calendar year, leap-day start, and both leap-year
  boundary directions. tsc clean for all touched files.
- Known limitation (unchanged): `lib/xero/resolved-emissions.ts` still buckets by
  calendar year; facility → LCA allocation is overlap-based and handles custom periods.
