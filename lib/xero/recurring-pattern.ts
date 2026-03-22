import { SupabaseClient } from '@supabase/supabase-js'

export interface RecurringGroup {
  /** Month key, e.g. "2026-01" */
  monthKey: string
  /** Display label, e.g. "January 2026" */
  monthLabel: string
  /** Total spend for this month */
  spend: number
  /** Transaction count */
  transactionCount: number
  /** Transaction IDs in this group */
  transactionIds: string[]
  /** Pro-rated quantity based on spend ratio */
  proRatedQuantity: number
}

/**
 * Find recurring transaction patterns for a given category and contact.
 *
 * Groups pending Xero transactions by month for the same supplier+category,
 * enabling "apply to similar months" after a user enters detail for one month.
 */
export async function findRecurringTransactions(
  supabase: SupabaseClient,
  organizationId: string,
  category: string,
  contactId?: string | null
): Promise<RecurringGroup[]> {
  let query = supabase
    .from('xero_transactions')
    .select('id, transaction_date, amount, xero_contact_id')
    .eq('organization_id', organizationId)
    .eq('emission_category', category)
    .eq('upgrade_status', 'pending')
    .order('transaction_date', { ascending: true })

  if (contactId) {
    query = query.eq('xero_contact_id', contactId)
  }

  const { data: transactions } = await query

  if (!transactions || transactions.length < 2) return []

  // Group by month
  const monthMap = new Map<string, {
    spend: number
    count: number
    ids: string[]
  }>()

  for (const tx of transactions) {
    const date = new Date(tx.transaction_date)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const existing = monthMap.get(key) || { spend: 0, count: 0, ids: [] }
    existing.spend += Math.abs(tx.amount || 0)
    existing.count++
    existing.ids.push(tx.id)
    monthMap.set(key, existing)
  }

  // Only return if there are 2+ months
  if (monthMap.size < 2) return []

  // Convert to sorted array
  const months = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))

  return months.map(([key, data]) => ({
    monthKey: key,
    monthLabel: formatMonthLabel(key),
    spend: data.spend,
    transactionCount: data.count,
    transactionIds: data.ids,
    proRatedQuantity: 0, // Will be calculated when base values are provided
  }))
}

/**
 * Calculate pro-rated values for recurring months based on a known base month.
 *
 * Uses the spend ratio between the base month and each target month
 * to estimate quantities proportionally.
 */
export function calculateProRatedValues(
  baseQuantity: number,
  baseSpend: number,
  groups: RecurringGroup[]
): RecurringGroup[] {
  if (baseSpend <= 0) return groups

  return groups.map(g => ({
    ...g,
    proRatedQuantity: Math.round((g.spend / baseSpend) * baseQuantity * 100) / 100,
  }))
}

/**
 * Format a month key like "2026-01" to "January 2026".
 */
function formatMonthLabel(key: string): string {
  const [year, month] = key.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, 1)
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}
