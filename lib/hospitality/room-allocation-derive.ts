/**
 * Derive a suggested per-room-night energy/water allocation from the venue's
 * facility utility data, so the user doesn't hand-compute "annual utilities ÷
 * occupied room-nights". Server-only (kept out of the pure client calculator).
 *
 * Occupied nights come from recorded service volumes for the venue's room-night
 * products over the period — NOT the stored `occupancy` (which is guests per
 * room). The result is a suggestion the user reviews before saving.
 */

import {
  normaliseEnergyToKwh,
  normaliseToCubicMetres,
  overlapFraction,
} from '@/lib/calculations/utility-factors'

type Db = any

export type DeriveResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }
const ok = <T>(data: T): DeriveResult<T> => ({ ok: true, data })
const fail = (status: number, error: string): DeriveResult<never> => ({ ok: false, status, error })

export interface DerivedRoomAllocation {
  /** Suggested per-night figures (total ÷ occupied nights). */
  electricity_kwh: number
  gas_kwh: number
  water_litres: number
  /** Period totals, for the provenance line. */
  totals: { electricity_kwh: number; gas_kwh: number; water_litres: number }
  occupied_nights: number
  water_metered: boolean
  period_start: string
  period_end: string
}

export async function deriveRoomAllocation(
  db: Db,
  organizationId: string,
  productId: number,
  periodStart: string,
  periodEnd: string,
): Promise<DeriveResult<DerivedRoomAllocation>> {
  // product → venue → facility
  const { data: meta } = await db
    .from('hospitality_meal_meta')
    .select('venue_id')
    .eq('product_id', productId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  const venueId = meta?.venue_id ?? null
  if (!venueId) return fail(400, 'Link this room to a venue first, then derive from its facility data.')

  const { data: venue } = await db
    .from('hospitality_venues')
    .select('facility_id')
    .eq('id', venueId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  const facilityId = venue?.facility_id ?? null
  if (!facilityId) return fail(400, 'Link the venue to a facility to derive its utilities.')

  // Energy: electricity + gas over the period, pro-rated by overlap.
  const { data: utils } = await db
    .from('utility_data_entries')
    .select('quantity, unit, utility_type, reporting_period_start, reporting_period_end')
    .eq('facility_id', facilityId)
    .lte('reporting_period_start', periodEnd)
    .gte('reporting_period_end', periodStart)
  let elecKwh = 0
  let gasKwh = 0
  for (const e of utils ?? []) {
    const frac = overlapFraction(e.reporting_period_start, e.reporting_period_end, periodStart, periodEnd)
    const qty = (Number(e.quantity) || 0) * frac
    if (e.utility_type === 'electricity_grid') elecKwh += normaliseEnergyToKwh(qty, e.unit)
    else if (e.utility_type === 'natural_gas') gasKwh += normaliseEnergyToKwh(qty, e.unit)
  }

  // Water: prefer hospitality-purpose meter rows when any exist.
  const { data: waterRows } = await db
    .from('facility_activity_entries')
    .select('quantity, unit, meter_purpose, reporting_period_start, reporting_period_end')
    .eq('facility_id', facilityId)
    .eq('activity_category', 'water_intake')
    .lte('reporting_period_start', periodEnd)
    .gte('reporting_period_end', periodStart)
  const allWater = waterRows ?? []
  const hospWater = allWater.filter((r: any) => r.meter_purpose === 'hospitality')
  const waterSource = hospWater.length > 0 ? hospWater : allWater
  let waterLitres = 0
  for (const r of waterSource) {
    const frac = overlapFraction(r.reporting_period_start, r.reporting_period_end, periodStart, periodEnd)
    const m3 = normaliseToCubicMetres((Number(r.quantity) || 0) * frac, r.unit)
    waterLitres += m3 * 1000
  }

  // Occupied nights: room-nights sold at this venue over the period.
  const { data: roomProducts } = await db
    .from('products')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('product_kind', 'hospitality_room_night')
  const roomIds = (roomProducts ?? []).map((p: any) => p.id)
  let venueRoomIds: number[] = []
  if (roomIds.length > 0) {
    const { data: roomMetas } = await db
      .from('hospitality_meal_meta')
      .select('product_id, venue_id')
      .in('product_id', roomIds)
      .eq('venue_id', venueId)
    venueRoomIds = (roomMetas ?? []).map((m: any) => m.product_id)
  }
  let occupiedNights = 0
  if (venueRoomIds.length > 0) {
    const { data: vols } = await db
      .from('hospitality_service_volumes')
      .select('units_sold, product_id, period_start, period_end')
      .in('product_id', venueRoomIds)
      .lte('period_start', periodEnd)
      .gte('period_end', periodStart)
    for (const v of vols ?? []) {
      const frac = overlapFraction(v.period_start, v.period_end, periodStart, periodEnd)
      occupiedNights += (Number(v.units_sold) || 0) * frac
    }
  }

  const perNight = (total: number) => (occupiedNights > 0 ? total / occupiedNights : 0)

  return ok({
    electricity_kwh: perNight(elecKwh),
    gas_kwh: perNight(gasKwh),
    water_litres: perNight(waterLitres),
    totals: { electricity_kwh: elecKwh, gas_kwh: gasKwh, water_litres: waterLitres },
    occupied_nights: occupiedNights,
    water_metered: hospWater.length > 0,
    period_start: periodStart,
    period_end: periodEnd,
  })
}
