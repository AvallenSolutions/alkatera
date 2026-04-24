/**
 * Open-Meteo client (free, no API key).
 * https://open-meteo.com/en/docs
 *
 * Returns the next 14 days of daily temperatures + precipitation for a
 * lat/lon. Used by the Pulse climate-risk widget for facility / supplier
 * regions.
 */

const BASE = 'https://api.open-meteo.com/v1/forecast';

export interface DailyForecastPoint {
  date: string;        // YYYY-MM-DD
  temp_max: number;    // °C
  temp_min: number;
  precipitation_mm: number;
}

export async function fetchDailyForecast(
  lat: number,
  lon: number,
): Promise<DailyForecastPoint[]> {
  try {
    const url = new URL(BASE);
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set(
      'daily',
      'temperature_2m_max,temperature_2m_min,precipitation_sum',
    );
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '14');

    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const body = await res.json();
    const dates: string[] = body?.daily?.time ?? [];
    const tMax: number[] = body?.daily?.temperature_2m_max ?? [];
    const tMin: number[] = body?.daily?.temperature_2m_min ?? [];
    const precip: number[] = body?.daily?.precipitation_sum ?? [];
    return dates.map((date, i) => ({
      date,
      temp_max: tMax[i],
      temp_min: tMin[i],
      precipitation_mm: precip[i] ?? 0,
    }));
  } catch (err) {
    console.error('[Open-Meteo] fetch failed', err);
    return [];
  }
}
