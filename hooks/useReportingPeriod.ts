import { useMemo } from 'react';
import { useOrganization } from '@/lib/organizationContext';
import {
  type Cadence,
  type Period,
  getAvailablePeriodsForOrg,
  getYearRangeForOrg,
  getYearLabelForOrg,
  getLabelYearForDate,
  getSelectableYears,
} from '@/lib/log-data/period-utils';

interface ReportingPeriodConfig {
  /** 1-indexed month the financial year starts (1=Jan=calendar year, 4=Apr=UK FY) */
  fyStartMonth: number;
  /** Default reporting cadence */
  defaultCadence: Cadence;
  /** Whether the org uses calendar year (fyStartMonth === 1) */
  isCalendarYear: boolean;
  /** Get date range for a label year */
  getYearRange: (year: number) => { yearStart: string; yearEnd: string };
  /** Get available periods for a cadence */
  getAvailablePeriods: (cadence: Cadence) => Period[];
  /** Get display label for a year */
  getYearLabel: (year: number) => string;
  /** Get the label year for the current date */
  currentLabelYear: number;
  /** Get selectable years for dropdowns */
  selectableYears: Array<{ year: number; label: string; yearStart: string; yearEnd: string }>;
}

/**
 * Hook that reads the org's reporting period configuration and provides
 * FY-aware period generation utilities.
 *
 * Reads from `organizations.report_defaults.reporting_period`:
 * - `fiscal_year_start_month` (number, 1-12, default 1)
 * - `default_cadence` ('monthly' | 'quarterly' | 'annual', default 'monthly')
 */
export function useReportingPeriod(): ReportingPeriodConfig {
  const { currentOrganization } = useOrganization();

  const config = useMemo(() => {
    const reportDefaults = currentOrganization?.report_defaults;
    const periodConfig = reportDefaults?.reporting_period;

    const fyStartMonth: number = periodConfig?.fiscal_year_start_month ?? 1;
    const defaultCadence: Cadence = periodConfig?.default_cadence ?? 'monthly';
    const isCalendarYear = fyStartMonth === 1;
    const currentLabelYear = getLabelYearForDate(new Date(), fyStartMonth);

    return {
      fyStartMonth,
      defaultCadence,
      isCalendarYear,
      currentLabelYear,
      getYearRange: (year: number) => getYearRangeForOrg(year, fyStartMonth),
      getAvailablePeriods: (cadence: Cadence) => getAvailablePeriodsForOrg(cadence, fyStartMonth),
      getYearLabel: (year: number) => getYearLabelForOrg(year, fyStartMonth),
      selectableYears: getSelectableYears(fyStartMonth),
    };
  }, [currentOrganization?.report_defaults]);

  return config;
}
