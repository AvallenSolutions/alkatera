/**
 * Programme 2 / Phase 1: historical grid carbon intensity, fetched on demand.
 *
 * The 30-min poller only stores intensity from now forwards, so a past reporting
 * period has no rows yet. This module fetches the Carbon Intensity API's history
 * (available back to 2018) for a region + date range, caches it into
 * `grid_carbon_readings`, and returns the period-weighted average intensity. It
 * is cache-first, so a period is only fetched from the API once.
 *
 * Regional series are FORECAST-only (the API publishes no regional actuals); the
 * national series uses the metered actual where present.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const BASE = 'https://api.carbonintensity.org.uk'
const SOURCE = 'uk_carbon_intensity'
const HALF_HOUR_MS = 30 * 60 * 1000
const CHUNK_DAYS = 30 // the API happily returns ~30 days per call

interface IntensityRow {
  region_code: string
  recorded_at: string
  intensity_g_per_kwh: number
  forecast_g_per_kwh: number | null
}

function isoMinute(d: Date): string {
  return `${d.toISOString().slice(0, 16)}Z`
}

/** Split [from,to) into <= CHUNK_DAYS windows. */
function chunkRange(from: Date, to: Date): Array<[Date, Date]> {
  const chunks: Array<[Date, Date]> = []
  let cursor = from
  const step = CHUNK_DAYS * 24 * 3600 * 1000
  while (cursor < to) {
    const next = new Date(Math.min(cursor.getTime() + step, to.getTime()))
    chunks.push([cursor, next])
    cursor = next
  }
  return chunks
}

/** Fetch historical readings for a region over a range (no caching). */
async function fetchHistorical(regionCode: string, from: Date, to: Date): Promise<IntensityRow[]> {
  const rows: IntensityRow[] = []
  for (const [a, b] of chunkRange(from, to)) {
    const fromS = isoMinute(a)
    const toS = isoMinute(b)
    try {
      let periods: any[] = []
      if (regionCode === 'GB-NATIONAL') {
        const res = await fetch(`${BASE}/intensity/${fromS}/${toS}`, { headers: { Accept: 'application/json' } })
        if (!res.ok) continue
        periods = (await res.json())?.data ?? []
        for (const p of periods) {
          const v = p?.intensity?.actual ?? p?.intensity?.forecast
          if (typeof v === 'number' && p?.from) {
            rows.push({ region_code: regionCode, recorded_at: p.from, intensity_g_per_kwh: v, forecast_g_per_kwh: p?.intensity?.forecast ?? null })
          }
        }
      } else {
        const id = regionCode.replace(/^GB-/, '')
        const res = await fetch(`${BASE}/regional/intensity/${fromS}/${toS}/regionid/${id}`, { headers: { Accept: 'application/json' } })
        if (!res.ok) continue
        // Region-scoped responses nest the periods under data.data.
        periods = (await res.json())?.data?.data ?? []
        for (const p of periods) {
          const v = p?.intensity?.forecast
          if (typeof v === 'number' && p?.from) {
            rows.push({ region_code: regionCode, recorded_at: p.from, intensity_g_per_kwh: v, forecast_g_per_kwh: v })
          }
        }
      }
    } catch (err) {
      console.error(`[intensity-history] fetch failed ${regionCode} ${fromS}..${toS}`, err)
    }
  }
  return rows
}

interface IntensityPoint {
  recorded_at: string
  intensity: number
}

/** Normalised half-hour key (YYYY-MM-DDTHH:MM, UTC) for joining to consumption. */
export function halfHourKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16)
}

/**
 * Ensure the region's readings for [from,to) are available (cache-first; fetch +
 * cache on a gap) and return them. Shared by the average and the per-half-hour
 * map below.
 */
async function ensureReadings(
  supabase: SupabaseClient,
  regionCode: string,
  from: Date,
  to: Date,
): Promise<IntensityPoint[]> {
  const expected = Math.max(1, Math.round((to.getTime() - from.getTime()) / HALF_HOUR_MS))

  const { data: cached } = await supabase
    .from('grid_carbon_readings')
    .select('recorded_at, intensity_g_per_kwh')
    .eq('region_code', regionCode)
    .eq('source', SOURCE)
    .gte('recorded_at', from.toISOString())
    .lt('recorded_at', to.toISOString())

  const cachedPoints = (cached ?? []).map((r) => ({ recorded_at: r.recorded_at as string, intensity: Number(r.intensity_g_per_kwh) }))
  if (cachedPoints.length >= expected * 0.8) return cachedPoints

  const fetched = await fetchHistorical(regionCode, from, to)
  if (fetched.length === 0) return cachedPoints

  await supabase
    .from('grid_carbon_readings')
    .upsert(
      fetched.map((r) => ({ ...r, source: SOURCE })),
      { onConflict: 'region_code,recorded_at,source' },
    )
  return fetched.map((r) => ({ recorded_at: r.recorded_at, intensity: r.intensity_g_per_kwh }))
}

/**
 * Period (simple) average intensity (g/kWh) for a region over [fromISO, toISO).
 * Cache-first; fetches + caches history on a gap. Null when no data.
 */
export async function periodAverageIntensity(
  supabase: SupabaseClient,
  regionCode: string,
  fromISO: string,
  toISO: string,
): Promise<number | null> {
  const from = new Date(fromISO)
  const to = new Date(toISO)
  if (!(from < to)) return null
  const points = await ensureReadings(supabase, regionCode, from, to)
  if (points.length === 0) return null
  return points.reduce((s, p) => s + p.intensity, 0) / points.length
}

/**
 * Per-half-hour intensity (g/kWh) for a region over [fromISO, toISO), keyed by
 * `halfHourKey`, so half-hourly consumption can be intensity-weighted.
 */
export async function regionalIntensityMap(
  supabase: SupabaseClient,
  regionCode: string,
  fromISO: string,
  toISO: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  const from = new Date(fromISO)
  const to = new Date(toISO)
  if (!(from < to)) return map
  for (const p of await ensureReadings(supabase, regionCode, from, to)) {
    map.set(halfHourKey(p.recorded_at), p.intensity)
  }
  return map
}
