/**
 * Programme 2: the symmetric guard for the "enter consumption once" rule.
 *
 * The smart-meter CSV upload already warns when a BILL overlaps. This is the
 * other direction: when a bill / manual entry is saved, detect smart-meter data
 * already covering the same facility + months, so the user is warned instead of
 * silently double-counting. Only electricity/gas have a smart-meter equivalent.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const SMART_METER_FUELS: Record<string, 'electricity' | 'gas'> = {
  electricity_grid: 'electricity',
  natural_gas: 'gas',
}

export interface SmartMeterOverlap {
  utilityType: string
  from: string
  to: string
  quantity: number
}

function checkableTypes(utilityTypes: string[]): string[] {
  return Array.from(new Set(utilityTypes.filter((t) => t in SMART_METER_FUELS)))
}

/** Smart-meter-derived utility rows overlapping [from,to] for the given utility types. */
export async function findSmartMeterOverlap(
  supabase: SupabaseClient,
  facilityId: string,
  utilityTypes: string[],
  from: string,
  to: string,
): Promise<SmartMeterOverlap[]> {
  const types = checkableTypes(utilityTypes)
  if (types.length === 0) return []
  const { data } = await supabase
    .from('utility_data_entries')
    .select('utility_type, reporting_period_start, reporting_period_end, quantity')
    .eq('facility_id', facilityId)
    .in('utility_type', types)
    .eq('data_source', 'smart_meter')
    .lte('reporting_period_start', to)
    .gte('reporting_period_end', from)
  return (data ?? []).map((r) => ({
    utilityType: (r as any).utility_type as string,
    from: (r as any).reporting_period_start as string,
    to: (r as any).reporting_period_end as string,
    quantity: Number((r as any).quantity),
  }))
}

/**
 * Remove smart-meter data (derived monthly rows + the half-hourly detail) for a
 * span + utility types, when the user chooses to use a bill instead.
 */
export async function removeSmartMeterData(
  supabase: SupabaseClient,
  facilityId: string,
  utilityTypes: string[],
  from: string,
  to: string,
): Promise<void> {
  const types = checkableTypes(utilityTypes)
  if (types.length === 0) return

  await supabase
    .from('utility_data_entries')
    .delete()
    .eq('facility_id', facilityId)
    .in('utility_type', types)
    .eq('data_source', 'smart_meter')
    .lte('reporting_period_start', to)
    .gte('reporting_period_end', from)

  const fuels = Array.from(new Set(types.map((t) => SMART_METER_FUELS[t])))
  const toExclusive = new Date(new Date(`${to}T00:00:00Z`).getTime() + 86_400_000).toISOString()
  await supabase
    .from('smart_meter_readings')
    .delete()
    .eq('facility_id', facilityId)
    .in('fuel', fuels)
    .gte('recorded_at', `${from}T00:00:00Z`)
    .lt('recorded_at', toExclusive)
}
