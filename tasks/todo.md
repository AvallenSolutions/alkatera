# Make reporting consumers financial-year aware

Audit (post custom-period feature) found calendar-year assumptions across the
reporting stack. The org FY start month lives at
`organizations.report_defaults.reporting_period.fiscal_year_start_month` (1-12).
`getYearRangeForOrg(year, fyStartMonth)` (lib/log-data/period-utils.ts) turns a
label year + FY month into the correct date window. Key discovery: the corporate
emissions SQL RPC was DROPPED; the authoritative calc is now TypeScript
(`lib/calculations/corporate-emissions.ts`), hardcoded to calendar year — so the
core fix is TS, and all 11 callers pass a year integer, so fixing the calculator
internally makes every consumer FY-correct at once.

## Shared helper
- [ ] `lib/log-data/org-fiscal-year.ts`: `getOrgFyStartMonth(supabase, orgId): Promise<number>`
      reading report_defaults.reporting_period.fiscal_year_start_month (default 1).
      Server-usable (mirrors the inline read in lib/xero/sync-service.ts).

## Core (highest impact)
- [ ] `lib/calculations/corporate-emissions.ts` L613-614: replace `${year}-01-01`/
      `${year}-12-31` with `getYearRangeForOrg(year, fyStartMonth)` (resolve FY month
      via the helper). Also switch the period-based utility/fleet filters (scope 1 & 2,
      and scope3 grey fleet) from "reporting_period_start within window" to date-range
      OVERLAP, matching the Xero fix. Leave `corporate_reports.eq('year', year)` (a
      year-integer/report-keyed lookup) as-is — out of scope, note it.

## Admin
- [ ] `app/api/emissions/trace/route.ts` L48-49: FY-aware window via helper +
      getYearRangeForOrg; utility filter → overlap. (fleet/production_logs use a point
      date here — leave.)

## Pulse / dashboards (build date windows from getFullYear → make FY-aware)
- [ ] `app/api/pulse/carbon-budgets/route.ts`
- [ ] `app/api/pulse/board-pack/route.ts`
- [ ] `app/api/vitality/composite/route.ts`
- [ ] `app/api/pulse/whatif-baseline/route.ts`
- [ ] `components/pulse/widgets/carbon-budgets/expanded.tsx` (client — use useReportingPeriod)
- [ ] Assess `pulse/cost-intensity` + `pulse/issb-disclosure` (these filter a
      `reporting_year` INTEGER column; convert the getFullYear() default to the FY label
      year via getLabelYearForDate, or leave if it's the ESG year-integer model).

## Out of scope (different data model — year-integer ESG)
people-culture/*, community-impact/*, impact-valuation. Not period-flexible; separate.

## Verification
- [ ] Unit test for getOrgFyStartMonth default + FY-window wiring where practical
- [ ] tsc clean for all touched files
- [ ] Spot-check: calendar-year orgs unchanged (overlap == start-in-window for monthly/
      calendar-annual entries); only non-calendar/custom periods shift
- [ ] Review section

## Review (in progress)
DONE (committed + pushed):
- New `lib/log-data/org-fiscal-year.ts` `getOrgFyStartMonth` (server-side, default 1).
- `corporate-emissions.ts` (SoT) window now FY-aware via getYearRangeForOrg — makes
  all 11 year-integer callers FY-correct at once. Calendar orgs unchanged.
- `emissions/trace` route: FY-aware window + utility overlap.
- `xero/resolved-emissions.ts`: utility/fleet matched by overlap (earlier commit).
- `pulse/carbon-budgets` route: annual period + snapshot window aligned to FY.
- `pulse/board-pack` route: YTD start aligned to FY.

DEFERRED (deliberate — need a holistic, separately-verified pass):
- `vitality/composite`: blends E/S/G pillars + uses a `reporting_year` integer column;
  converting only the env date-window would make the composite score internally
  inconsistent for FY orgs. Convert all pillars together.
- `pulse/carbon-budgets/expanded.tsx` (client forecast widget): projects "to 31 Dec";
  FY conversion changes the forecast horizon — needs runtime verification.
- `pulse/whatif-baseline`: uses a ROLLING 12-month window (FY-agnostic) — already fine.
- `reporting_year`-INTEGER ESG aggregates (`cost-intensity`, `issb-disclosure`,
  board-pack `facility_emissions_aggregated`, composite `facility_water_data`): different
  data model (year integer, not date ranges) — out of scope for period flexibility.

## Review (final — all complete)
Remaining items now done (FY-aware via getOrgFyStartMonth + period-utils):
- `vitality/composite`: fyStartMonth resolved once in GET, threaded into the
  environmental + social builders so the whole composite score is internally
  consistent for FY orgs (env date windows + social/water `reporting_year` filters
  all use the FY label year). Governance is not time-bucketed.
- `pulse/carbon-budgets/expanded.tsx` (client forecast widget): YTD fetch + the
  forecast-to-year-end projection now run over the org's FY window via
  useReportingPeriod, not the calendar year.
- `cost-intensity` + `issb-disclosure` + board-pack `facility_emissions_aggregated`:
  the `reporting_year`-integer "recent rows" floor now uses the FY label year.
- `whatif-baseline`: confirmed a rolling trailing-12-month baseline anchored to now
  (FY-agnostic by design) — correctly left unchanged.

Verification: tsc clean for every touched file; vitality + pulse lib suites
(3068 tests) and period-utils suites green. Calendar-year orgs (fyStartMonth=1)
are provably unchanged everywhere (getYearRangeForOrg(y,1) === Jan-Dec,
getLabelYearForDate(d,1) === d.getFullYear()).

Minor follow-up (not data-affecting): `getReportingPeriodPresets` in
lib/reporting-period-utils.ts still builds calendar-quarter preset BUTTONS; these
are convenience presets for a date-range picker, not data bucketing — left as-is.
