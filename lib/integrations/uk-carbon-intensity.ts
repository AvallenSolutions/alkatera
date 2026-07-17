/**
 * UK Carbon Intensity API client.
 * Free, no API key required: https://carbonintensity.org.uk/
 *
 * We poll:
 *   - /intensity                       : current GB-NATIONAL intensity (actual + forecast)
 *   - /intensity/date                  : 24h half-hourly forecast for GB-NATIONAL
 *   - /regional/intensity/{from}/{to}  : 24h half-hourly forecast for all 14 DNO regions
 *                                        (+ England/Scotland/Wales) in a single call
 *
 * National readings carry a metered "actual"; regional readings are FORECAST only
 * (the API does not publish regional actuals), so the regional granular figure is
 * forecast-based — fine for an accuracy insight and for energy-timing.
 */

const BASE = 'https://api.carbonintensity.org.uk';

export interface CarbonIntensityReading {
  region_code: string;
  recorded_at: string;
  intensity_g_per_kwh: number;
  forecast_g_per_kwh: number | null;
}

/**
 * Carbon Intensity API regionids → human names. 1-14 are the GB DNO regions;
 * 15-17 are the England/Scotland/Wales aggregates. (18 = "GB", which we skip in
 * favour of the national endpoint that carries actuals.)
 */
export const CARBON_INTENSITY_REGIONS: Record<number, string> = {
  1: 'North Scotland',
  2: 'South Scotland',
  3: 'North West England',
  4: 'North East England',
  5: 'Yorkshire',
  6: 'North Wales & Merseyside',
  7: 'South Wales',
  8: 'West Midlands',
  9: 'East Midlands',
  10: 'East England',
  11: 'South West England',
  12: 'South England',
  13: 'London',
  14: 'South East England',
  15: 'England',
  16: 'Scotland',
  17: 'Wales',
};

export async function fetchCurrentNationalIntensity(): Promise<CarbonIntensityReading | null> {
  try {
    const res = await fetch(`${BASE}/intensity`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const body = await res.json();
    const entry = body?.data?.[0];
    if (!entry) return null;
    return {
      region_code: 'GB-NATIONAL',
      recorded_at: entry.from,
      intensity_g_per_kwh: entry.intensity?.actual ?? entry.intensity?.forecast ?? 0,
      forecast_g_per_kwh: entry.intensity?.forecast ?? null,
    };
  } catch (err) {
    console.error('[UK carbon-intensity] fetch failed', err);
    return null;
  }
}

/** Returns today's half-hourly forecast (~48 entries). */
export async function fetchTodayForecast(): Promise<CarbonIntensityReading[]> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`${BASE}/intensity/date/${today}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const body = await res.json();
    const entries: any[] = body?.data ?? [];
    return entries.map(e => ({
      region_code: 'GB-NATIONAL',
      recorded_at: e.from,
      intensity_g_per_kwh: e.intensity?.actual ?? e.intensity?.forecast ?? 0,
      forecast_g_per_kwh: e.intensity?.forecast ?? null,
    }));
  } catch (err) {
    console.error('[UK carbon-intensity] forecast fetch failed', err);
    return [];
  }
}

/**
 * Today's half-hourly forecast for every region, in one call. Emits readings
 * with region_code `GB-1`..`GB-17` (forecast-only). Region 18 ("GB") is skipped
 * — the national endpoint already gives us GB-NATIONAL with actuals.
 */
export async function fetchRegionalToday(): Promise<CarbonIntensityReading[]> {
  try {
    const now = new Date();
    const from = `${now.toISOString().slice(0, 10)}T00:00Z`;
    const to = `${new Date(now.getTime() + 24 * 3600 * 1000).toISOString().slice(0, 10)}T00:00Z`;
    const res = await fetch(`${BASE}/regional/intensity/${from}/${to}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const body = await res.json();
    const periods: any[] = body?.data ?? [];
    const readings: CarbonIntensityReading[] = [];
    for (const p of periods) {
      const recordedAt = p?.from;
      if (!recordedAt || !Array.isArray(p?.regions)) continue;
      for (const r of p.regions) {
        const id = Number(r?.regionid);
        // 1-17 only (skip 18 = GB national, covered by the national endpoint).
        if (!Number.isInteger(id) || id < 1 || id > 17) continue;
        const forecast = r?.intensity?.forecast;
        if (typeof forecast !== 'number') continue;
        readings.push({
          region_code: `GB-${id}`,
          recorded_at: recordedAt,
          intensity_g_per_kwh: forecast,
          forecast_g_per_kwh: forecast,
        });
      }
    }
    return readings;
  } catch (err) {
    console.error('[UK carbon-intensity] regional fetch failed', err);
    return [];
  }
}

export interface GridCarbonRefreshResult {
  written: number;
  message?: string;
}

/**
 * Fetches current + forecast + regional readings and upserts them into
 * grid_carbon_readings. Shared by the `/api/cron/refresh-grid-carbon` route
 * (manual/admin trigger) and the `pulseRefreshGridCarbon` Inngest cron
 * function so the merge/dedupe logic lives in exactly one place.
 */
export async function refreshGridCarbonReadings(
  supabase: import('@supabase/supabase-js').SupabaseClient,
): Promise<GridCarbonRefreshResult> {
  const [current, forecast, regional] = await Promise.all([
    fetchCurrentNationalIntensity(),
    fetchTodayForecast(),
    fetchRegionalToday(),
  ]);

  // The "current" reading is the same half-hour slot as one of the forecast
  // entries, so naively concatenating the two lists would send duplicate
  // (region_code, recorded_at, source) keys to Postgres and the upsert would
  // fail with "ON CONFLICT DO UPDATE command cannot affect row a second time".
  // Dedupe with a Map keyed on the conflict columns; later writes (ordered so
  // the live "current" reading wins over the forecast entry for the same
  // slot) overwrite earlier ones.
  const merged = new Map<string, {
    region_code: string;
    recorded_at: string;
    intensity_g_per_kwh: number;
    forecast_g_per_kwh: number | null;
    source: string;
  }>();

  for (const r of [...forecast, ...regional]) {
    const key = `${r.region_code}|${r.recorded_at}|uk_carbon_intensity`;
    merged.set(key, {
      region_code: r.region_code,
      recorded_at: r.recorded_at,
      intensity_g_per_kwh: r.intensity_g_per_kwh,
      forecast_g_per_kwh: r.forecast_g_per_kwh,
      source: 'uk_carbon_intensity',
    });
  }
  if (current) {
    const key = `${current.region_code}|${current.recorded_at}|uk_carbon_intensity`;
    merged.set(key, {
      region_code: current.region_code,
      recorded_at: current.recorded_at,
      intensity_g_per_kwh: current.intensity_g_per_kwh,
      forecast_g_per_kwh: current.forecast_g_per_kwh,
      source: 'uk_carbon_intensity',
    });
  }

  const rows = Array.from(merged.values());
  if (rows.length === 0) {
    return { written: 0, message: 'No data from upstream' };
  }

  const { error } = await supabase
    .from('grid_carbon_readings')
    .upsert(rows, { onConflict: 'region_code,recorded_at,source' });

  if (error) throw new Error(error.message);

  return { written: rows.length };
}
