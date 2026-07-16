/**
 * Hospitality operating periods: covers served (footfall) and F&B revenue per
 * period, which power the intensity KPIs (carbon per cover, per £, per room-night).
 */

type Db = any

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }
const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data })
const fail = (status: number, error: string): ServiceResult<never> => ({ ok: false, status, error })

function validPeriod(start: string, end: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && end >= start
}

export interface OperatingPeriodRow {
  id: string
  venue_id: string | null
  period_start: string
  period_end: string
  covers: number
  fnb_revenue: number
  currency: string
  note: string | null
}

export async function listOperatingPeriods(db: Db, organizationId: string): Promise<ServiceResult<OperatingPeriodRow[]>> {
  const { data, error } = await db
    .from('hospitality_operating_periods')
    .select('id, venue_id, period_start, period_end, covers, fnb_revenue, currency, note')
    .eq('organization_id', organizationId)
    .order('period_start', { ascending: false })
  if (error) return fail(500, error.message)
  return ok(
    (data ?? []).map((r: any) => ({
      id: r.id,
      venue_id: r.venue_id ?? null,
      period_start: r.period_start,
      period_end: r.period_end,
      covers: Number(r.covers),
      fnb_revenue: Number(r.fnb_revenue),
      currency: r.currency,
      note: r.note ?? null,
    })),
  )
}

export async function createOperatingPeriod(db: Db, organizationId: string, body: any): Promise<ServiceResult<{ id: string }>> {
  const period_start = String(body?.period_start ?? '')
  const period_end = String(body?.period_end ?? '')
  if (!validPeriod(period_start, period_end)) return fail(400, 'period_start/period_end must be YYYY-MM-DD with end >= start')
  const covers = Number(body?.covers)
  if (!Number.isFinite(covers) || covers < 0) return fail(400, 'covers must be 0 or more')
  const fnb_revenue = Number(body?.fnb_revenue)
  if (!Number.isFinite(fnb_revenue) || fnb_revenue < 0) return fail(400, 'fnb_revenue must be 0 or more')
  const currency = String(body?.currency ?? 'GBP').toUpperCase().slice(0, 3) || 'GBP'

  const venue_id = body?.venue_id ? String(body.venue_id) : null
  if (venue_id) {
    const { data: venue } = await db.from('hospitality_venues').select('id').eq('id', venue_id).eq('organization_id', organizationId).maybeSingle()
    if (!venue) return fail(400, 'invalid venue_id')
  }

  const { data, error } = await db
    .from('hospitality_operating_periods')
    .insert({ organization_id: organizationId, venue_id, period_start, period_end, covers, fnb_revenue, currency, note: body?.note ? String(body.note) : null })
    .select('id')
    .single()
  if (error) return fail(500, error.message)
  return ok({ id: data.id })
}

export async function deleteOperatingPeriod(db: Db, organizationId: string, id: string): Promise<ServiceResult<{ ok: true }>> {
  const { error } = await db.from('hospitality_operating_periods').delete().eq('id', id).eq('organization_id', organizationId)
  if (error) return fail(500, error.message)
  return ok({ ok: true })
}

export interface IntensitySummary {
  covers: number
  fnb_revenue: number
  currency: string
  room_nights: number
  /** kg CO2e per cover served (overall hospitality carbon ÷ covers). */
  per_cover: number | null
  /** kg CO2e per unit of F&B revenue. */
  per_revenue: number | null
  /** kg CO2e per occupied room-night (room consumables ÷ room-nights). */
  per_room_night: number | null
}

/**
 * Intensity KPIs for a period. Covers + revenue come from operating periods
 * (overlap-filtered); room-nights from service volumes for room-night products.
 */
export async function computeIntensity(
  db: Db,
  organizationId: string,
  yearStart: string,
  yearEnd: string,
  totals: { total: number; supplies: number },
): Promise<IntensitySummary> {
  const { data: periods } = await db
    .from('hospitality_operating_periods')
    .select('covers, fnb_revenue, currency')
    .eq('organization_id', organizationId)
    .lte('period_start', yearEnd)
    .gte('period_end', yearStart)
  let covers = 0
  let revenue = 0
  const currencyCounts = new Map<string, number>()
  for (const p of periods ?? []) {
    covers += Number(p.covers) || 0
    revenue += Number(p.fnb_revenue) || 0
    const c = String(p.currency || 'GBP')
    currencyCounts.set(c, (currencyCounts.get(c) ?? 0) + 1)
  }
  const currency = Array.from(currencyCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'GBP'

  // Room-nights sold = units_sold for room-night products over the period.
  const { data: roomProducts } = await db
    .from('products')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('product_kind', 'hospitality_room_night')
  const roomIds = (roomProducts ?? []).map((p: any) => p.id)
  let roomNights = 0
  if (roomIds.length > 0) {
    const { data: vols } = await db
      .from('hospitality_service_volumes')
      .select('units_sold')
      .in('product_id', roomIds)
      .lte('period_start', yearEnd)
      .gte('period_end', yearStart)
    for (const v of vols ?? []) roomNights += Number(v.units_sold) || 0
  }

  return {
    covers,
    fnb_revenue: revenue,
    currency,
    room_nights: roomNights,
    per_cover: covers > 0 ? totals.total / covers : null,
    per_revenue: revenue > 0 ? totals.total / revenue : null,
    per_room_night: roomNights > 0 ? totals.supplies / roomNights : null,
  }
}
