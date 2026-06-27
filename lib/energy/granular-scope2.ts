/**
 * Programme 2 / Phase 1: carbon-aware *enhanced* Scope 2 (electricity).
 *
 * This is an ADDITIVE figure shown ALONGSIDE the standard annual-factor Scope 2
 * (`calculateScope2` in corporate-emissions.ts) — it never replaces the
 * compliance headline. For each GB electricity entry it weights consumption by
 * the facility's *regional* 30-min grid intensity, period-averaged over the
 * entry's reporting window (true half-hourly matching arrives in Phase 2 with
 * smart-meter data). It also returns the national-average equivalent so the UI
 * can show "your regional grid was X% cleaner/dirtier than the national average".
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { overlapFraction, normaliseEnergyToKwh } from '@/lib/calculations/utility-factors'
import { resolveFacilityRegionCode } from './region'
import { periodAverageIntensity } from './intensity-history'

export interface GranularScope2Result {
  /** Region-weighted electricity emissions (kg CO2e) for the covered consumption. */
  granularKg: number
  /** Same covered consumption × the national average intensity, for the delta. */
  nationalEquivalentKg: number
  /** Electricity kWh that received a granular (regional) figure. */
  coveredKwh: number
  /** All electricity kWh in scope (covered + uncovered, e.g. non-GB). */
  totalElectricityKwh: number
  byRegion: Record<string, { kwh: number; avgIntensityG: number }>
}

function startIso(dateStr: string): string {
  return `${dateStr}T00:00:00Z`
}
function endExclusiveIso(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1) // reporting_period_end is inclusive
  return d.toISOString()
}
const maxStr = (a: string, b: string) => (a > b ? a : b)
const minStr = (a: string, b: string) => (a < b ? a : b)

export async function calculateScope2Granular(
  supabase: SupabaseClient,
  organizationId: string,
  yearStart: string,
  yearEnd: string,
): Promise<GranularScope2Result> {
  const result: GranularScope2Result = {
    granularKg: 0,
    nationalEquivalentKg: 0,
    coveredKwh: 0,
    totalElectricityKwh: 0,
    byRegion: {},
  }

  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, location_country_code, address_country, address_postcode, grid_region_code')
    .eq('organization_id', organizationId)

  const facMap = new Map<string, any>((facilities ?? []).map((f: any) => [f.id, f]))
  const facilityIds = Array.from(facMap.keys())
  if (facilityIds.length === 0) return result

  const { data: entries } = await supabase
    .from('utility_data_entries')
    .select('quantity, unit, utility_type, facility_id, reporting_period_start, reporting_period_end')
    .in('facility_id', facilityIds)
    .eq('utility_type', 'electricity_grid')
    .lte('reporting_period_start', yearEnd)
    .gte('reporting_period_end', yearStart)

  const regionCache = new Map<string, string | null>()

  for (const e of entries ?? []) {
    const facility = facMap.get((e as any).facility_id)
    if (!facility) continue

    const fraction = overlapFraction((e as any).reporting_period_start, (e as any).reporting_period_end, yearStart, yearEnd)
    const kwh = normaliseEnergyToKwh(Number((e as any).quantity) || 0, (e as any).unit) * fraction
    if (kwh <= 0) continue
    result.totalElectricityKwh += kwh

    let region = regionCache.get((e as any).facility_id)
    if (region === undefined) {
      region = await resolveFacilityRegionCode(supabase, facility)
      regionCache.set((e as any).facility_id, region)
    }
    if (!region) continue // non-GB / unresolvable — stays on the headline factor

    const periodFrom = startIso(maxStr((e as any).reporting_period_start, yearStart))
    const periodTo = endExclusiveIso(minStr((e as any).reporting_period_end, yearEnd))

    const [regAvg, natAvg] = await Promise.all([
      periodAverageIntensity(supabase, region, periodFrom, periodTo),
      periodAverageIntensity(supabase, 'GB-NATIONAL', periodFrom, periodTo),
    ])
    if (regAvg == null) continue

    result.granularKg += kwh * (regAvg / 1000)
    result.nationalEquivalentKg += kwh * ((natAvg ?? regAvg) / 1000)
    result.coveredKwh += kwh

    const b = result.byRegion[region] ?? { kwh: 0, avgIntensityG: 0 }
    b.avgIntensityG = (b.avgIntensityG * b.kwh + regAvg * kwh) / (b.kwh + kwh)
    b.kwh += kwh
    result.byRegion[region] = b
  }

  return result
}
