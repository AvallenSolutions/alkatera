/**
 * Hospitality events: episodic occasions (festivals, weddings, corporate,
 * private) with their own footprint = attendee travel + temporary power +
 * optional catering carbon. Self-contained; travel uses the modal-split
 * estimator (DESNZ factors) and temp power uses DESNZ diesel + the grid factor.
 */

import { estimateTravel, type TravelMode, type TravelEstimate } from './travel-estimator'
import { getGridFactor } from '@/lib/grid-emission-factors'

type Db = any

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }
const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data })
const fail = (status: number, error: string): ServiceResult<never> => ({ ok: false, status, error })

/** DESNZ 2024 diesel (average biofuel blend), kg CO2e per litre. */
export const DIESEL_FACTOR = 2.51

export const EVENT_TYPES = ['festival', 'wedding', 'corporate', 'private', 'other'] as const
const EVENT_TYPE_SET = new Set<string>(EVENT_TYPES)
const EVENT_STATUS_SET = new Set<string>(['planned', 'completed'])

const EVENT_COLS =
  'id, venue_id, name, event_type, event_date_start, event_date_end, attendee_count, avg_distance_km, travel_split, generator_litres, temp_electricity_kwh, catering_co2e, country, status, note'

export interface EventFootprint {
  travel: TravelEstimate
  /** Temporary power (generator diesel + temporary grid electricity), kg CO2e. */
  temp_power_co2e: number
  catering_co2e: number
  total_co2e: number
  per_attendee_co2e: number | null
}

export function computeEventFootprint(row: any): EventFootprint {
  const attendees = Number(row?.attendee_count) || 0
  const travel = estimateTravel({
    attendees,
    avg_distance_km: Number(row?.avg_distance_km) || 0,
    split: (row?.travel_split ?? {}) as Partial<Record<TravelMode, number>>,
  })
  const grid = getGridFactor(row?.country || 'GB', 'uk').factor
  const temp_power_co2e = (Number(row?.generator_litres) || 0) * DIESEL_FACTOR + (Number(row?.temp_electricity_kwh) || 0) * grid
  const catering_co2e = Number(row?.catering_co2e) || 0
  const total_co2e = travel.total_kg + temp_power_co2e + catering_co2e
  return {
    travel,
    temp_power_co2e,
    catering_co2e,
    total_co2e,
    per_attendee_co2e: attendees > 0 ? total_co2e / attendees : null,
  }
}

function shape(row: any) {
  return { ...row, footprint: computeEventFootprint(row) }
}

export async function listEvents(db: Db, organizationId: string): Promise<ServiceResult<unknown[]>> {
  const { data, error } = await db
    .from('hospitality_events')
    .select(EVENT_COLS)
    .eq('organization_id', organizationId)
    .order('event_date_start', { ascending: false, nullsFirst: false })
  if (error) return fail(500, error.message)
  return ok((data ?? []).map(shape))
}

export async function getEvent(db: Db, organizationId: string, id: string): Promise<ServiceResult<unknown>> {
  const { data, error } = await db.from('hospitality_events').select(EVENT_COLS).eq('id', id).eq('organization_id', organizationId).maybeSingle()
  if (error) return fail(500, error.message)
  if (!data) return fail(404, 'Event not found')
  return ok(shape(data))
}

function validateBody(body: any): { updates: Record<string, unknown> } | { error: string } {
  const updates: Record<string, unknown> = {}
  if (body?.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) return { error: 'name cannot be empty' }
    updates.name = name
  }
  if (body?.event_type !== undefined) {
    if (!EVENT_TYPE_SET.has(String(body.event_type))) return { error: 'invalid event_type' }
    updates.event_type = String(body.event_type)
  }
  if (body?.status !== undefined) {
    if (!EVENT_STATUS_SET.has(String(body.status))) return { error: 'invalid status' }
    updates.status = String(body.status)
  }
  for (const [key, min] of [['attendee_count', 0], ['avg_distance_km', 0], ['generator_litres', 0], ['temp_electricity_kwh', 0], ['catering_co2e', 0]] as const) {
    if (body?.[key] !== undefined) {
      const n = Number(body[key])
      if (!Number.isFinite(n) || n < min) return { error: `${key} must be ${min} or more` }
      updates[key] = n
    }
  }
  for (const key of ['event_date_start', 'event_date_end'] as const) {
    if (body?.[key] !== undefined) updates[key] = body[key] ? String(body[key]) : null
  }
  if (body?.venue_id !== undefined) updates.venue_id = body.venue_id ? String(body.venue_id) : null
  if (body?.country !== undefined) updates.country = String(body.country || 'GB').toUpperCase().slice(0, 3) || 'GB'
  if (body?.note !== undefined) updates.note = body.note ? String(body.note) : null
  if (body?.travel_split !== undefined) {
    const raw = body.travel_split && typeof body.travel_split === 'object' ? body.travel_split : {}
    const clean: Record<string, number> = {}
    for (const [k, v] of Object.entries(raw)) {
      const n = Number(v)
      if (Number.isFinite(n) && n > 0) clean[k] = n
    }
    updates.travel_split = clean
  }
  return { updates }
}

export async function createEvent(db: Db, organizationId: string, userId: string | null, body: any): Promise<ServiceResult<{ id: string }>> {
  const name = String(body?.name ?? '').trim()
  if (!name) return fail(400, 'name required')
  const v = validateBody(body)
  if ('error' in v) return fail(400, v.error)
  if (body?.venue_id) {
    const { data: venue } = await db.from('hospitality_venues').select('id').eq('id', body.venue_id).eq('organization_id', organizationId).maybeSingle()
    if (!venue) return fail(400, 'invalid venue_id')
  }
  const { data, error } = await db
    .from('hospitality_events')
    .insert({ organization_id: organizationId, created_by: userId, ...v.updates, name })
    .select('id')
    .single()
  if (error) return fail(500, error.message)
  return ok({ id: data.id })
}

export async function updateEvent(db: Db, organizationId: string, id: string, body: any): Promise<ServiceResult<{ ok: true }>> {
  const v = validateBody(body)
  if ('error' in v) return fail(400, v.error)
  if (Object.keys(v.updates).length === 0) return fail(400, 'no updatable fields provided')
  const { data, error } = await db.from('hospitality_events').update(v.updates).eq('id', id).eq('organization_id', organizationId).select('id').maybeSingle()
  if (error) return fail(500, error.message)
  if (!data) return fail(404, 'Event not found')
  return ok({ ok: true })
}

export async function deleteEvent(db: Db, organizationId: string, id: string): Promise<ServiceResult<{ ok: true }>> {
  const { error } = await db.from('hospitality_events').delete().eq('id', id).eq('organization_id', organizationId)
  if (error) return fail(500, error.message)
  return ok({ ok: true })
}
