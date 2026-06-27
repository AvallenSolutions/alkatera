/**
 * Shared half-hourly ingest core, used by both the facility-tab upload
 * (/api/energy/smart-meter/upload) and the smart-upload pipeline
 * (/api/energy/smart-meter/ingest-stashed). Parses, detects bill conflicts
 * (warn-and-choose), writes the half-hourly detail, and derives the monthly
 * utility totals — the single source so "enter consumption once" holds.
 *
 * Callers handle auth + facility access; this just needs a service client.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { parseHalfHourlyCsv } from './hh-csv-parser'
import { fuelToUtility, readingsSpan, deriveMonthlyEntries, type Fuel } from './derive-utility'

export type IngestResult =
  | { status: 'empty'; format: string; errors: string[] }
  | {
      status: 'conflict'
      fuel: Fuel
      span: { from: string; to: string }
      summary: { readings: number; totalKwh: number; months: number }
      existing: { from: string; to: string; quantity: number; unit: string }[]
    }
  | { status: 'ok'; format: string; readingsWritten: number; derivedEntries: number; replacedBills: number; mode: string }

export async function ingestHalfHourly(
  admin: SupabaseClient,
  opts: {
    facilityId: string
    fuel: Fuel
    bytes: ArrayBuffer | Uint8Array
    meterId?: string | null
    resolution?: 'replace' | 'detail_only' | null
  },
): Promise<IngestResult> {
  const { facilityId, fuel, bytes, meterId = null, resolution } = opts

  const parsed = parseHalfHourlyCsv(bytes)
  if (parsed.readings.length === 0) return { status: 'empty', format: parsed.format, errors: parsed.errors }

  const byTime = new Map<string, number>()
  for (const r of parsed.readings) byTime.set(r.recordedAt, r.kwh)
  const dedup = Array.from(byTime.entries()).map(([recordedAt, kwh]) => ({ recordedAt, kwh }))

  const { utilityType } = fuelToUtility(fuel)
  const span = readingsSpan(dedup)
  if (!span) return { status: 'empty', format: parsed.format, errors: ['No dated readings found.'] }

  // Overlapping bill / manual entries (not our own derived rows).
  const { data: conflicts } = await admin
    .from('utility_data_entries')
    .select('id, reporting_period_start, reporting_period_end, quantity, unit')
    .eq('facility_id', facilityId)
    .eq('utility_type', utilityType)
    .lte('reporting_period_start', span.to)
    .gte('reporting_period_end', span.from)
    .or('data_source.is.null,data_source.neq.smart_meter')

  if (conflicts && conflicts.length > 0 && resolution !== 'replace' && resolution !== 'detail_only') {
    return {
      status: 'conflict',
      fuel,
      span,
      summary: {
        readings: dedup.length,
        totalKwh: Math.round(dedup.reduce((s, r) => s + r.kwh, 0)),
        months: deriveMonthlyEntries(dedup, fuel).length,
      },
      existing: conflicts.map((c) => ({
        from: c.reporting_period_start as string,
        to: c.reporting_period_end as string,
        quantity: Number(c.quantity),
        unit: c.unit as string,
      })),
    }
  }

  // 1. Half-hourly detail.
  const detail = dedup.map((r) => ({
    facility_id: facilityId,
    fuel,
    recorded_at: r.recordedAt,
    consumption_kwh: r.kwh,
    meter_id: meterId,
    source: 'csv_upload',
  }))
  const CHUNK = 2000
  let written = 0
  for (let i = 0; i < detail.length; i += CHUNK) {
    const { error } = await admin
      .from('smart_meter_readings')
      .upsert(detail.slice(i, i + CHUNK), { onConflict: 'facility_id,fuel,recorded_at' })
    if (error) throw new Error(error.message)
    written += Math.min(CHUNK, detail.length - i)
  }

  // 2. Replace our own prior derived rows for the span.
  await admin
    .from('utility_data_entries')
    .delete()
    .eq('facility_id', facilityId)
    .eq('utility_type', utilityType)
    .eq('data_source', 'smart_meter')
    .lte('reporting_period_start', span.to)
    .gte('reporting_period_end', span.from)

  // 3. On replace, delete the conflicting bills.
  let replacedBills = 0
  if (resolution === 'replace' && conflicts && conflicts.length > 0) {
    await admin.from('utility_data_entries').delete().in('id', conflicts.map((c) => c.id))
    replacedBills = conflicts.length
  }

  // 4. Derive monthly totals (unless keeping the bill: detail_only).
  let derivedEntries = 0
  if (resolution !== 'detail_only') {
    const derived = deriveMonthlyEntries(dedup, fuel).map((d) => ({
      ...d,
      facility_id: facilityId,
      mpan: fuel === 'electricity' ? meterId : null,
      mprn: fuel === 'gas' ? meterId : null,
    }))
    if (derived.length > 0) {
      const { error } = await admin.from('utility_data_entries').insert(derived)
      if (error) throw new Error(error.message)
      derivedEntries = derived.length
    }
  }

  return { status: 'ok', format: parsed.format, readingsWritten: written, derivedEntries, replacedBills, mode: resolution ?? 'fresh' }
}
