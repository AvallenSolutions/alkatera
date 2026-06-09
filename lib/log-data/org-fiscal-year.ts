import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolve an organisation's financial-year start month (1-12) for server-side /
 * non-React callers. This is the server counterpart to the client hook
 * `useReportingPeriod`, which reads the same path from React org context.
 *
 * Reads `organizations.report_defaults.reporting_period.fiscal_year_start_month`.
 * Defaults to 1 (calendar year) when unset, invalid, or on any read error, so
 * callers degrade gracefully to the prior calendar-year behaviour.
 */
export async function getOrgFyStartMonth(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<number> {
  try {
    const { data } = await supabase
      .from('organizations')
      .select('report_defaults')
      .eq('id', organizationId)
      .maybeSingle();
    const raw = (data as any)?.report_defaults?.reporting_period?.fiscal_year_start_month;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 1 && n <= 12 ? n : 1;
  } catch {
    return 1;
  }
}
