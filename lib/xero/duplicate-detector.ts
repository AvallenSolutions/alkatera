import { SupabaseClient } from '@supabase/supabase-js'

export interface OverlapResult {
  category: string
  overlapCount: number
  existingSource: string
  existingCount: number
  xeroSpend: number
  message: string
}

/**
 * Map emission categories to the utility_type_enum values used in utility_data_entries.
 */
const CATEGORY_TO_UTILITY_TYPE: Record<string, string> = {
  grid_electricity: 'electricity',
  natural_gas: 'natural_gas',
  water: 'water',
  diesel_stationary: 'diesel',
  lpg: 'lpg',
}

const CATEGORY_LABELS: Record<string, string> = {
  grid_electricity: 'Electricity',
  natural_gas: 'Natural Gas',
  water: 'Water',
  diesel_stationary: 'Diesel (stationary)',
  diesel_mobile: 'Diesel (mobile)',
  petrol_mobile: 'Petrol (mobile)',
  lpg: 'LPG',
  air_travel: 'Air Travel',
  rail_travel: 'Rail Travel',
  accommodation: 'Accommodation',
  road_freight: 'Road Freight',
  sea_freight: 'Sea Freight',
  air_freight: 'Air Freight',
}

/**
 * Detect overlaps between Xero spend-based data and existing manually entered data.
 *
 * Checks two sources:
 * 1. utility_data_entries - for energy/water categories (facility-level kWh, m³, etc.)
 * 2. corporate_overheads - for travel/freight/accommodation (manual entries without xero source)
 *
 * When yearStart/yearEnd are provided, only checks for overlaps within that
 * reporting period. Without them, checks all pending transactions.
 *
 * Returns overlap warnings to show in the Action Centre and scope pages.
 */
export async function detectOverlaps(
  supabase: SupabaseClient,
  organizationId: string,
  yearStart?: string,
  yearEnd?: string
): Promise<OverlapResult[]> {
  const overlaps: OverlapResult[] = []

  // 1. Find which emission categories have pending Xero transactions
  let xeroQuery = supabase
    .from('xero_transactions')
    .select('emission_category, amount')
    .eq('organization_id', organizationId)
    .eq('upgrade_status', 'pending')
    .not('emission_category', 'is', null)

  if (yearStart) xeroQuery = xeroQuery.gte('transaction_date', yearStart)
  if (yearEnd) xeroQuery = xeroQuery.lte('transaction_date', yearEnd)

  const { data: xeroCategories } = await xeroQuery

  if (!xeroCategories || xeroCategories.length === 0) return overlaps

  // Group Xero transactions by category
  const xeroByCat = new Map<string, { count: number; spend: number }>()
  for (const tx of xeroCategories) {
    if (!tx.emission_category) continue
    const existing = xeroByCat.get(tx.emission_category) || { count: 0, spend: 0 }
    existing.count++
    existing.spend += Math.abs(tx.amount || 0)
    xeroByCat.set(tx.emission_category, existing)
  }

  // 2. Check energy categories against utility_data_entries
  // We need to go via facilities belonging to this org
  const energyCategories = Array.from(xeroByCat.keys()).filter(c => CATEGORY_TO_UTILITY_TYPE[c])

  if (energyCategories.length > 0) {
    // Get facility IDs for the org
    const { data: facilities } = await supabase
      .from('facilities')
      .select('id')
      .eq('organization_id', organizationId)

    if (facilities && facilities.length > 0) {
      const facilityIds = facilities.map(f => f.id)

      for (const cat of energyCategories) {
        const utilityType = CATEGORY_TO_UTILITY_TYPE[cat]
        if (!utilityType) continue

        let utilityQuery = supabase
          .from('utility_data_entries')
          .select('id', { count: 'exact', head: true })
          .in('facility_id', facilityIds)
          .eq('utility_type', utilityType)

        // Filter utility entries to the same reporting period when dates are provided
        if (yearStart) utilityQuery = utilityQuery.gte('reporting_period_start', yearStart)
        if (yearEnd) utilityQuery = utilityQuery.lte('reporting_period_end', yearEnd)

        const { count: existingCount } = await utilityQuery

        if (existingCount && existingCount > 0) {
          const xeroData = xeroByCat.get(cat)!
          const label = CATEGORY_LABELS[cat] || cat
          overlaps.push({
            category: cat,
            overlapCount: Math.min(xeroData.count, existingCount),
            existingSource: 'utility_data_entries',
            existingCount,
            xeroSpend: xeroData.spend,
            message: `Your ${label.toLowerCase()} data may be double-counted. You have both Xero spend data and ${existingCount} utility meter ${existingCount === 1 ? 'reading' : 'readings'} for this period.`,
          })
        }
      }
    }
  }

  // 3. Check travel/freight/accommodation against corporate_overheads (manual entries)
  const overheadCategoryMap: Record<string, string> = {
    air_travel: 'business_travel',
    rail_travel: 'business_travel',
    accommodation: 'business_travel',
    road_freight: 'upstream_transportation',
    sea_freight: 'upstream_transportation',
    air_freight: 'upstream_transportation',
  }

  const overheadCategories = Array.from(xeroByCat.keys()).filter(c => overheadCategoryMap[c])

  if (overheadCategories.length > 0) {
    // Get reports for this org to find corporate_overheads
    const { data: reports } = await supabase
      .from('corporate_reports')
      .select('id')
      .eq('organization_id', organizationId)

    if (reports && reports.length > 0) {
      const reportIds = reports.map(r => r.id)

      // Find manual corporate_overheads entries (those NOT from xero_upgrade)
      const { data: manualOverheads } = await supabase
        .from('corporate_overheads')
        .select('category, id')
        .in('report_id', reportIds)
        .or('data_source.is.null,data_source.neq.xero_upgrade')

      if (manualOverheads && manualOverheads.length > 0) {
        // Group by category
        const manualByCat = new Map<string, number>()
        for (const oh of manualOverheads) {
          manualByCat.set(oh.category, (manualByCat.get(oh.category) || 0) + 1)
        }

        for (const cat of overheadCategories) {
          const overheadCat = overheadCategoryMap[cat]
          const manualCount = manualByCat.get(overheadCat) || 0

          if (manualCount > 0) {
            const xeroData = xeroByCat.get(cat)!
            const label = CATEGORY_LABELS[cat] || cat
            overlaps.push({
              category: cat,
              overlapCount: Math.min(xeroData.count, manualCount),
              existingSource: 'corporate_overheads',
              existingCount: manualCount,
              xeroSpend: xeroData.spend,
              message: `Your ${label.toLowerCase()} data may be double-counted. You have both Xero spend data and ${manualCount} manually entered ${overheadCat.replace('_', ' ')} ${manualCount === 1 ? 'entry' : 'entries'} for this period.`,
            })
          }
        }
      }
    }
  }

  return overlaps
}

/**
 * Dismiss (acknowledge) overlapping Xero transactions for a given category.
 */
export async function acknowledgeOverlap(
  supabase: SupabaseClient,
  organizationId: string,
  category: string
): Promise<void> {
  await supabase
    .from('xero_transactions')
    .update({
      duplicate_flag: 'acknowledged',
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', organizationId)
    .eq('emission_category', category)
    .eq('upgrade_status', 'pending')
}

/**
 * Dismiss Xero transactions for a category that overlaps with existing data.
 * Marks them as dismissed so they no longer appear in the Action Centre.
 */
export async function dismissOverlappingTransactions(
  supabase: SupabaseClient,
  organizationId: string,
  category: string
): Promise<void> {
  await supabase
    .from('xero_transactions')
    .update({
      upgrade_status: 'dismissed',
      duplicate_flag: 'probable_overlap',
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', organizationId)
    .eq('emission_category', category)
    .eq('upgrade_status', 'pending')
}
