import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { safeCompare } from '@/lib/utils/safe-compare';
import {
  fetchCurrentNationalIntensity,
  fetchTodayForecast,
} from '@/lib/integrations/uk-carbon-intensity';

/**
 * Cron: refresh UK grid-carbon readings.
 *
 * POST /api/cron/refresh-grid-carbon
 *
 * Polls the free UK Carbon Intensity API and upserts the current reading +
 * today's half-hourly forecast into grid_carbon_readings. Run every 30 min.
 */
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authHeader || !safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const [current, forecast] = await Promise.all([
    fetchCurrentNationalIntensity(),
    fetchTodayForecast(),
  ]);

  // The "current" reading is the same half-hour slot as one of the forecast
  // entries, so naively concatenating the two lists would send duplicate
  // (region_code, recorded_at, source) keys to Postgres and the upsert would
  // fail with "ON CONFLICT DO UPDATE command cannot affect row a second time".
  // We dedupe with a Map keyed on the conflict columns; later writes (which
  // we order so the live "current" reading wins over the forecast entry for
  // the same slot) overwrite earlier ones.
  const merged = new Map<string, {
    region_code: string;
    recorded_at: string;
    intensity_g_per_kwh: number;
    forecast_g_per_kwh: number | null;
    source: string;
  }>();

  // Forecast first, then overwrite with the actual reading for the current
  // slot if we have one.
  for (const r of forecast) {
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
    return NextResponse.json({ written: 0, message: 'No data from upstream' });
  }

  const { error } = await supabase
    .from('grid_carbon_readings')
    .upsert(rows, { onConflict: 'region_code,recorded_at,source' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ written: rows.length });
}
