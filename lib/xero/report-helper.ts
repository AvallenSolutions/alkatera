import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Find or create a Draft corporate report for the given organisation and year.
 *
 * `corporate_overheads` rows require a `report_id` FK. This helper ensures
 * a report exists before inserting overhead entries from Xero upgrades.
 *
 * @returns The report UUID
 */
export async function getOrCreateCorporateReport(
  supabase: SupabaseClient,
  organizationId: string,
  year: number
): Promise<string> {
  // Try to find existing report for this org + year
  const { data: existing, error: selectError } = await supabase
    .from('corporate_reports')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('year', year)
    .single()

  if (existing?.id) return existing.id

  // Not found (PGRST116) - create a new Draft report
  if (selectError && selectError.code !== 'PGRST116') {
    throw new Error(`Failed to look up corporate report: ${selectError.message}`)
  }

  const { data: newReport, error: insertError } = await supabase
    .from('corporate_reports')
    .insert({
      organization_id: organizationId,
      year,
      status: 'Draft',
    })
    .select('id')
    .single()

  if (insertError) {
    // Race condition: another request created it between our SELECT and INSERT
    if (insertError.code === '23505') {
      const { data: retry } = await supabase
        .from('corporate_reports')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('year', year)
        .single()

      if (retry?.id) return retry.id
    }
    throw new Error(`Failed to create corporate report: ${insertError.message}`)
  }

  return newReport.id
}

/**
 * Derive the reporting year from a date string or transaction dates.
 * Falls back to the current year.
 */
export function deriveReportingYear(
  dateStr?: string | null,
  transactionDates?: string[]
): number {
  if (dateStr) {
    const parsed = new Date(dateStr)
    if (!isNaN(parsed.getTime())) return parsed.getFullYear()
  }

  if (transactionDates?.length) {
    // Use the most recent transaction date
    const sorted = transactionDates
      .map(d => new Date(d))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())

    if (sorted.length > 0) return sorted[0].getFullYear()
  }

  return new Date().getFullYear()
}
