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

/**
 * Period-weighted (simple) average intensity (g/kWh) for a region over
 * [fromISO, toISO). Cache-first; on a gap, fetches history, upserts it, and
 * averages. Returns null when no data is available.
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

  const expected = Math.max(1, Math.round((to.getTime() - from.getTime()) / HALF_HOUR_MS))

  const { data: cached } = await supabase
    .from('grid_carbon_readings')
    .select('intensity_g_per_kwh')
    .eq('region_code', regionCode)
    .eq('source', SOURCE)
    .gte('recorded_at', from.toISOString())
    .lt('recorded_at', to.toISOString())

  if (cached && cached.length >= expected * 0.8) {
    return cached.reduce((s, r) => s + Number(r.intensity_g_per_kwh), 0) / cached.length
  }

  // Gap: fetch + cache, then average the fetched set.
  const fetched = await fetchHistorical(regionCode, from, to)
  if (fetched.length === 0) {
    // Use whatever little we had cached rather than nothing.
    if (cached && cached.length > 0) {
      return cached.reduce((s, r) => s + Number(r.intensity_g_per_kwh), 0) / cached.length
    }
    return null
  }
  await supabase
    .from('grid_carbon_readings')
    .upsert(
      fetched.map((r) => ({ ...r, source: SOURCE })),
      { onConflict: 'region_code,recorded_at,source' },
    )
  return fetched.reduce((s, r) => s + r.intensity_g_per_kwh, 0) / fetched.length
}
