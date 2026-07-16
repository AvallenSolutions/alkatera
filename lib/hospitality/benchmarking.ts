/**
 * Hotel benchmarking export (HCMI / CHSB style): carbon, energy and water per
 * occupied room-night, computed from the accommodation venues' facility utilities
 * ÷ room-nights sold. HCMI = Hotel Carbon Measurement Initiative; CHSB = Cornell
 * Hotel Sustainability Benchmarking. Self-contained; no external submission.
 */

import { normaliseEnergyToKwh, normaliseToCubicMetres, overlapFraction } from '@/lib/calculations/utility-factors'
import { getGridFactor } from '@/lib/grid-emission-factors'
import { NATURAL_GAS_FACTOR } from './room-allocation'

type Db = any

export interface BenchmarkingResult {
  year: number
  room_nights: number
  electricity_kwh: number
  gas_kwh: number
  energy_kwh: number
  water_litres: number
  /** Energy carbon (electricity grid + gas), kg CO2e. */
  energy_co2e: number
  // Per occupied room-night intensities (null when no room-nights recorded):
  energy_kwh_per_night: number | null
  water_litres_per_night: number | null
  co2e_per_night: number | null
  facilities: number
}

export async function computeBenchmarking(db: Db, organizationId: string, year: number): Promise<BenchmarkingResult> {
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const { data: venues } = await db
    .from('hospitality_venues')
    .select('facility_id, country')
    .eq('organization_id', organizationId)
    .eq('venue_type', 'accommodation')
    .eq('status', 'active')
  const facilityIds = Array.from(new Set((venues ?? []).map((v: any) => v.facility_id).filter(Boolean))) as string[]
  const country = (venues ?? []).find((v: any) => v.country)?.country || 'GB'
  const grid = getGridFactor(country, 'uk').factor

  let electricity_kwh = 0
  let gas_kwh = 0
  let water_litres = 0
  if (facilityIds.length > 0) {
    const { data: utils } = await db
      .from('utility_data_entries')
      .select('quantity, unit, utility_type, reporting_period_start, reporting_period_end')
      .in('facility_id', facilityIds)
      .lte('reporting_period_start', yearEnd)
      .gte('reporting_period_end', yearStart)
    for (const e of utils ?? []) {
      const frac = overlapFraction(e.reporting_period_start, e.reporting_period_end, yearStart, yearEnd)
      const qty = (Number(e.quantity) || 0) * frac
      if (e.utility_type === 'electricity_grid') electricity_kwh += normaliseEnergyToKwh(qty, e.unit)
      else if (e.utility_type === 'natural_gas') gas_kwh += normaliseEnergyToKwh(qty, e.unit)
    }
    const { data: waterRows } = await db
      .from('facility_activity_entries')
      .select('quantity, unit, reporting_period_start, reporting_period_end')
      .in('facility_id', facilityIds)
      .eq('activity_category', 'water_intake')
      .lte('reporting_period_start', yearEnd)
      .gte('reporting_period_end', yearStart)
    for (const r of waterRows ?? []) {
      const frac = overlapFraction(r.reporting_period_start, r.reporting_period_end, yearStart, yearEnd)
      water_litres += normaliseToCubicMetres((Number(r.quantity) || 0) * frac, r.unit) * 1000
    }
  }

  // Room-nights sold across the org's room-night products in the period.
  const { data: roomProducts } = await db
    .from('products')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('product_kind', 'hospitality_room_night')
  const roomIds = (roomProducts ?? []).map((p: any) => p.id)
  let room_nights = 0
  if (roomIds.length > 0) {
    const { data: vols } = await db
      .from('hospitality_service_volumes')
      .select('units_sold, period_start, period_end')
      .in('product_id', roomIds)
      .lte('period_start', yearEnd)
      .gte('period_end', yearStart)
    for (const v of vols ?? []) {
      const frac = overlapFraction(v.period_start, v.period_end, yearStart, yearEnd)
      room_nights += (Number(v.units_sold) || 0) * frac
    }
  }

  const energy_kwh = electricity_kwh + gas_kwh
  const energy_co2e = electricity_kwh * grid + gas_kwh * NATURAL_GAS_FACTOR
  const per = (n: number) => (room_nights > 0 ? n / room_nights : null)

  return {
    year,
    room_nights,
    electricity_kwh,
    gas_kwh,
    energy_kwh,
    water_litres,
    energy_co2e,
    energy_kwh_per_night: per(energy_kwh),
    water_litres_per_night: per(water_litres),
    co2e_per_night: per(energy_co2e),
    facilities: facilityIds.length,
  }
}

function n(v: number | null): string {
  return v == null ? '' : String(Math.round(v * 1000) / 1000)
}

/** HCMI/CHSB-aligned CSV: one metric per row with its per-room-night intensity. */
export function benchmarkingCsv(b: BenchmarkingResult): string {
  const rows: string[][] = [
    ['metric', 'total', 'unit', 'per_occupied_room_night', 'per_night_unit'],
    ['occupied_room_nights', n(b.room_nights), 'nights', '', ''],
    ['energy', n(b.energy_kwh), 'kWh', n(b.energy_kwh_per_night), 'kWh/night'],
    ['electricity', n(b.electricity_kwh), 'kWh', '', ''],
    ['gas', n(b.gas_kwh), 'kWh', '', ''],
    ['water', n(b.water_litres), 'litres', n(b.water_litres_per_night), 'litres/night'],
    ['energy_carbon', n(b.energy_co2e), 'kg CO2e', n(b.co2e_per_night), 'kg CO2e/night'],
  ]
  return rows.map((r) => r.map((c) => (c.includes(',') ? `"${c}"` : c)).join(',')).join('\n')
}
