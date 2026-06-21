/**
 * Hospitality waste-log service: list (with per-row CO2e + venue name), create,
 * delete, plus a range aggregate reused by the dashboard and the company-total
 * calculation. CO2e uses the shared DEFRA waste factors.
 */

import { WASTE_EMISSION_FACTORS_FALLBACK, DEFAULT_WASTE_EMISSION_FACTOR } from '@/lib/calculations/waste-circularity'
import {
  DIVERTED_TREATMENTS,
  type HospitalityWasteRow,
  type WasteStream,
  type WasteTreatment,
} from './waste-types'

type Db = any

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }
const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data })
const fail = (status: number, error: string): ServiceResult<never> => ({ ok: false, status, error })

const STREAMS: WasteStream[] = ['food', 'dry']
const TREATMENTS: WasteTreatment[] = [
  'composting',
  'anaerobic_digestion',
  'recycling',
  'reuse',
  'incineration_with_recovery',
  'incineration_without_recovery',
  'landfill',
]

/** kg CO2e for a mass + treatment route (DEFRA factors, landfill as fallback). */
export function wasteCo2e(massKg: number, treatment: string): number {
  const factor = WASTE_EMISSION_FACTORS_FALLBACK[treatment] ?? DEFAULT_WASTE_EMISSION_FACTOR
  return (Number(massKg) || 0) * factor
}

function validPeriod(start: string, end: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && end >= start
}

export interface WasteRangeSummary {
  total_kg: number
  total_co2e: number
  food_kg: number
  dry_kg: number
  food_co2e: number
  dry_co2e: number
  diverted_kg: number
  /** Share of mass diverted from disposal (recycling/reuse/compost/AD), 0..1. */
  diversion_rate: number
}

const EMPTY_RANGE: WasteRangeSummary = {
  total_kg: 0,
  total_co2e: 0,
  food_kg: 0,
  dry_kg: 0,
  food_co2e: 0,
  dry_co2e: 0,
  diverted_kg: 0,
  diversion_rate: 0,
}

/** Aggregate the waste log over a date range (used by dashboard + company total). */
export async function summariseWaste(
  db: Db,
  organizationId: string,
  rangeStart: string,
  rangeEnd: string,
): Promise<WasteRangeSummary> {
  const { data: rows } = await db
    .from('hospitality_waste')
    .select('waste_stream, treatment_method, mass_kg')
    .eq('organization_id', organizationId)
    .lte('period_start', rangeEnd)
    .gte('period_end', rangeStart)
  if (!rows || rows.length === 0) return { ...EMPTY_RANGE }

  const out: WasteRangeSummary = { ...EMPTY_RANGE }
  for (const r of rows) {
    const mass = Number(r.mass_kg) || 0
    const co2e = wasteCo2e(mass, r.treatment_method)
    out.total_kg += mass
    out.total_co2e += co2e
    if (r.waste_stream === 'food') {
      out.food_kg += mass
      out.food_co2e += co2e
    } else {
      out.dry_kg += mass
      out.dry_co2e += co2e
    }
    if (DIVERTED_TREATMENTS.includes(r.treatment_method)) out.diverted_kg += mass
  }
  out.diversion_rate = out.total_kg > 0 ? out.diverted_kg / out.total_kg : 0
  return out
}

export async function listWaste(db: Db, organizationId: string): Promise<ServiceResult<HospitalityWasteRow[]>> {
  const { data: rows, error } = await db
    .from('hospitality_waste')
    .select('id, venue_id, period_start, period_end, waste_stream, treatment_method, mass_kg, note')
    .eq('organization_id', organizationId)
    .order('period_start', { ascending: false })
  if (error) return fail(500, error.message)

  const venueIds = Array.from(new Set((rows ?? []).map((r: any) => r.venue_id).filter(Boolean)))
  const venueNames = new Map<string, string>()
  if (venueIds.length > 0) {
    const { data: venues } = await db.from('hospitality_venues').select('id, name').in('id', venueIds)
    for (const v of venues ?? []) venueNames.set(v.id, v.name)
  }

  const result: HospitalityWasteRow[] = (rows ?? []).map((r: any) => ({
    id: r.id,
    venue_id: r.venue_id ?? null,
    venue_name: r.venue_id ? venueNames.get(r.venue_id) ?? null : null,
    period_start: r.period_start,
    period_end: r.period_end,
    waste_stream: r.waste_stream,
    treatment_method: r.treatment_method,
    mass_kg: Number(r.mass_kg),
    note: r.note ?? null,
    co2e: wasteCo2e(Number(r.mass_kg), r.treatment_method),
  }))
  return ok(result)
}

export async function createWaste(db: Db, organizationId: string, body: any): Promise<ServiceResult<{ id: string }>> {
  const waste_stream = String(body?.waste_stream ?? '')
  if (!STREAMS.includes(waste_stream as WasteStream)) return fail(400, 'waste_stream must be food or dry')
  const treatment_method = String(body?.treatment_method ?? '')
  if (!TREATMENTS.includes(treatment_method as WasteTreatment)) return fail(400, 'invalid treatment_method')
  const mass_kg = Number(body?.mass_kg)
  if (!Number.isFinite(mass_kg) || mass_kg < 0) return fail(400, 'mass_kg must be 0 or more')
  const period_start = String(body?.period_start ?? '')
  const period_end = String(body?.period_end ?? '')
  if (!validPeriod(period_start, period_end)) return fail(400, 'period_start/period_end must be YYYY-MM-DD with end >= start')

  const venue_id = body?.venue_id ? String(body.venue_id) : null
  if (venue_id) {
    const { data: venue } = await db
      .from('hospitality_venues')
      .select('id')
      .eq('id', venue_id)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (!venue) return fail(400, 'invalid venue_id')
  }

  const { data, error } = await db
    .from('hospitality_waste')
    .insert({
      organization_id: organizationId,
      venue_id,
      period_start,
      period_end,
      waste_stream,
      treatment_method,
      mass_kg,
      note: body?.note ? String(body.note) : null,
    })
    .select('id')
    .single()
  if (error) return fail(500, error.message)
  return ok({ id: data.id })
}

export async function deleteWaste(db: Db, organizationId: string, id: string): Promise<ServiceResult<{ ok: true }>> {
  const { error } = await db.from('hospitality_waste').delete().eq('id', id).eq('organization_id', organizationId)
  if (error) return fail(500, error.message)
  return ok({ ok: true })
}
