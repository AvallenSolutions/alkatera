/**
 * UK Carbon Intensity API client.
 * Free, no API key required: https://carbonintensity.org.uk/
 *
 * We poll two endpoints:
 *   - /intensity         : current GB-NATIONAL intensity
 *   - /intensity/date    : 24h half-hourly forecast for the day
 */

const BASE = 'https://api.carbonintensity.org.uk';

export interface CarbonIntensityReading {
  region_code: string;
  recorded_at: string;
  intensity_g_per_kwh: number;
  forecast_g_per_kwh: number | null;
}

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
