/**
 * Programme 2 / Phase 1-2: carbon-aware *enhanced* Scope 2 (electricity).
 *
 * ADDITIVE figure shown ALONGSIDE the standard annual-factor Scope 2
 * (`calculateScope2` in corporate-emissions.ts) — it never replaces the
 * compliance headline. Per GB facility it weights electricity by the region's
 * actual grid intensity:
 *   - if half-hourly smart-meter data exists, each half hour is weighted by the
 *     region's intensity at that half hour (the real value of HH data — you
 *     consume more when the grid is dirtier/cleaner);
 *   - otherwise the monthly bill is weighted by the period-average intensity.
 * It also returns the national-average equivalent for the "your regional grid
 * was X% cleaner/dirtier than the national average" insight.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { overlapFraction, normaliseEnergyToKwh } from '@/lib/calculations/utility-factors'
import { resolveFacilityRegionCode } from './region'
import { periodAverageIntensity, regionalIntensityMap, halfHourKey } from './intensity-history'

export interface GranularScope2Result {
  /** Region-weighted electricity emissions (kg CO2e) for the covered consumption. */
  granularKg: number
  /** Same covered consumption × the national average intensity, for the delta. */
  nationalEquivalentKg: number
  /** Electricity kWh that received a granular (regional) figure. */
  coveredKwh: number
  /** All electricity kWh in scope (covered + uncovered, e.g. non-GB). */
  totalElectricityKwh: number
  /** True for facilities matched at half-hourly resolution. */
  halfHourlyKwh: number
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
  // Internally accumulate kgSum per region, convert to an average at the end.
  const regionAcc: Record<string, { kwh: number; kgSum: number }> = {}
  const add = (region: string, kwh: number, kg: number) => {
    const a = regionAcc[region] ?? { kwh: 0, kgSum: 0 }
    a.kwh += kwh
    a.kgSum += kg
    regionAcc[region] = a
  }

  const result: GranularScope2Result = {
    granularKg: 0,
    nationalEquivalentKg: 0,
    coveredKwh: 0,
    totalElectricityKwh: 0,
    halfHourlyKwh: 0,
    byRegion: {},
  }

  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, location_country_code, address_country, address_postcode, grid_region_code')
    .eq('organization_id', organizationId)
  const facList = (facilities ?? []) as any[]
  if (facList.length === 0) return result
  const facilityIds = facList.map((f) => f.id)

  const { data: entries } = await supabase
    .from('utility_data_entries')
    .select('quantity, unit, utility_type, facility_id, reporting_period_start, reporting_period_end')
    .in('facility_id', facilityIds)
    .eq('utility_type', 'electricity_grid')
    .lte('reporting_period_start', yearEnd)
    .gte('reporting_period_end', yearStart)
  const entriesByFac = new Map<string, any[]>()
  for (const e of entries ?? []) {
    const arr = entriesByFac.get((e as any).facility_id) ?? []
    arr.push(e)
    entriesByFac.set((e as any).facility_id, arr)
  }

  const windowFrom = startIso(yearStart)
  const windowTo = endExclusiveIso(yearEnd)

  for (const facility of facList) {
    const region = await resolveFacilityRegionCode(supabase, facility)

    // 1. Half-hourly smart-meter data takes precedence.
    const { data: hh } = await supabase
      .from('smart_meter_readings')
      .select('recorded_at, consumption_kwh')
      .eq('facility_id', facility.id)
      .eq('fuel', 'electricity')
      .gte('recorded_at', windowFrom)
      .lt('recorded_at', windowTo)
    if (hh && hh.length > 0) {
      const hhKwh = hh.reduce((s, r) => s + Number((r as any).consumption_kwh), 0)
      result.totalElectricityKwh += hhKwh
      if (!region) continue // non-GB: in totals but not granular
      // Fetch intensity only for the actual span of the readings, not the whole year.
      const times = hh.map((r) => new Date((r as any).recorded_at).getTime())
      const hhFrom = new Date(Math.min(...times)).toISOString()
      const hhTo = new Date(Math.max(...times) + 30 * 60 * 1000).toISOString()
      const [regMap, natMap] = await Promise.all([
        regionalIntensityMap(supabase, region, hhFrom, hhTo),
        regionalIntensityMap(supabase, 'GB-NATIONAL', hhFrom, hhTo),
      ])
      for (const r of hh) {
        const key = halfHourKey((r as any).recorded_at)
        const ri = regMap.get(key)
        if (ri == null) continue
        const kwh = Number((r as any).consumption_kwh)
        const kg = kwh * (ri / 1000)
        result.granularKg += kg
        result.nationalEquivalentKg += kwh * ((natMap.get(key) ?? ri) / 1000)
        result.coveredKwh += kwh
        result.halfHourlyKwh += kwh
        add(region, kwh, kg)
      }
      continue // facility handled via HH — don't double-count its monthly bills
    }

    // 2. Fall back to monthly bills, period-averaged.
    for (const e of entriesByFac.get(facility.id) ?? []) {
      const fraction = overlapFraction((e as any).reporting_period_start, (e as any).reporting_period_end, yearStart, yearEnd)
      const kwh = normaliseEnergyToKwh(Number((e as any).quantity) || 0, (e as any).unit) * fraction
      if (kwh <= 0) continue
      result.totalElectricityKwh += kwh
      if (!region) continue

      const periodFrom = startIso(maxStr((e as any).reporting_period_start, yearStart))
      const periodTo = endExclusiveIso(minStr((e as any).reporting_period_end, yearEnd))
      const [regAvg, natAvg] = await Promise.all([
        periodAverageIntensity(supabase, region, periodFrom, periodTo),
        periodAverageIntensity(supabase, 'GB-NATIONAL', periodFrom, periodTo),
      ])
      if (regAvg == null) continue
      const kg = kwh * (regAvg / 1000)
      result.granularKg += kg
      result.nationalEquivalentKg += kwh * ((natAvg ?? regAvg) / 1000)
      result.coveredKwh += kwh
      add(region, kwh, kg)
    }
  }

  for (const [region, a] of Object.entries(regionAcc)) {
    result.byRegion[region] = { kwh: a.kwh, avgIntensityG: a.kwh > 0 ? (a.kgSum * 1000) / a.kwh : 0 }
  }
  return result
}
