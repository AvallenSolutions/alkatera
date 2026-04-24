import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import {
  countryToLiveRegion,
  getCountryAverageGridCarbon,
  GLOBAL_GRID_AVERAGE_G_PER_KWH,
  type GridCarbonConfidence,
} from '@/lib/calculations/grid-carbon-fallback';

/**
 * GET /api/pulse/facility-impact?organization_id=...&months=12
 *
 * Aggregates the org's facility utility / water / waste data over a
 * rolling time window and computes two parallel CO₂e figures for the
 * electricity portion:
 *
 *   - "tariff" — kWh × static country average (what their bill estimate
 *     would suggest)
 *   - "live"   — kWh × the actual monthly mean grid intensity (UK only,
 *     other regions fall back to the same country-average factor and
 *     therefore show no seasonality)
 *
 * The delta between the two is the headline "true grid impact" insight:
 * January's electricity emits ~2× more CO₂e per kWh than July's because
 * solar generation collapses in winter.
 *
 * Aggregation strategy:
 *   - Pull entries whose reporting_period_end >= now - N months
 *   - Bucket each entry into a single calendar month using
 *     reporting_period_start (good enough for monthly utility bills which
 *     usually align to billing cycles)
 *   - Sum quantities by month / category, normalising units where needed
 *   - For each month with electricity, compute the live grid mean from
 *     grid_carbon_readings for the facility region
 */
export const runtime = 'nodejs';

// Standard Scope 1/2 combustion factors. DEFRA 2024 GHG conversion
// factors, kg CO₂e per native unit. We don't include electricity here —
// electricity uses the live/country-average grid factor instead.
const UTILITY_EMISSION_FACTORS: Record<string, { factor: number; native_unit: string; bucket: 'gas' | 'fuel' | 'other' }> = {
  natural_gas:          { factor: 0.18,  native_unit: 'kWh',    bucket: 'gas' },   // kg CO2e/kWh (gross CV)
  heat_steam_purchased: { factor: 0.17,  native_unit: 'kWh',    bucket: 'other' },
  lpg:                  { factor: 1.557, native_unit: 'litres', bucket: 'fuel' },
  diesel_stationary:    { factor: 2.66,  native_unit: 'litres', bucket: 'fuel' },
  diesel_mobile:        { factor: 2.51,  native_unit: 'litres', bucket: 'fuel' },
  petrol_mobile:        { factor: 2.08,  native_unit: 'litres', bucket: 'fuel' },
  heavy_fuel_oil:       { factor: 3.13,  native_unit: 'litres', bucket: 'fuel' },
  biomass_solid:        { factor: 0.015, native_unit: 'kWh',    bucket: 'other' }, // biogenic CO2 not counted, only N2O/CH4
  refrigerant_leakage:  { factor: 1430,  native_unit: 'kg',     bucket: 'other' }, // assume R-134a-equivalent default
};

interface MonthBucket {
  month: string;          // 'YYYY-MM'
  month_label: string;    // 'Apr'
  // Energy / fuel quantities
  electricity_kwh: number;
  gas_kwh: number;
  fuel_litres: number;
  // Water (intake)
  water_m3: number;
  // Waste — broken into the three CSRD-aligned streams so the chart can
  // show recovery rate at a glance. waste_kg is the rolled-up total
  // retained for backwards compatibility.
  waste_kg: number;
  waste_general_kg: number;
  waste_hazardous_kg: number;
  waste_recycling_kg: number;
  // Emissions
  electricity_tco2e_tariff: number;
  electricity_tco2e_live: number;
  gas_tco2e: number;
  other_scope12_tco2e: number;
  total_tco2e: number;
  // Grid context
  grid_intensity_avg_g_per_kwh: number;
  grid_confidence: GridCarbonConfidence;
}

interface FacilitySummary {
  id: string;
  name: string;
  country_code: string | null;
  has_live_grid: boolean;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const orgId = url.searchParams.get('organization_id');
  const months = Math.max(1, Math.min(36, parseInt(url.searchParams.get('months') ?? '12', 10)));
  if (!orgId) {
    return NextResponse.json({ error: 'organization_id required' }, { status: 400 });
  }

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }); } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }); } catch {}
        },
      },
    },
  );

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Window: last N full months including current. windowStart is the first
  // day of the earliest month we care about.
  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const windowStartIso = windowStart.toISOString().slice(0, 10);

  // 1. Facilities — we need country code to pick a grid factor per facility.
  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, name, location_country_code, address_country')
    .eq('organization_id', orgId);

  const facilityList: FacilitySummary[] = (facilities ?? []).map(f => {
    const country = (f.location_country_code ?? f.address_country ?? null) as string | null;
    return {
      id: f.id as string,
      name: f.name as string,
      country_code: country,
      has_live_grid: countryToLiveRegion(country) !== null,
    };
  });
  const facilityById = new Map(facilityList.map(f => [f.id, f]));

  // 2. Utility entries — Scope 1 & 2 combustibles + grid electricity.
  const { data: utilityRows } = await supabase
    .from('utility_data_entries')
    .select('facility_id, utility_type, quantity, unit, reporting_period_start')
    .in('facility_id', facilityList.map(f => f.id))
    .gte('reporting_period_start', windowStartIso);

  // 3. Facility activity entries — water + waste.
  const { data: activityRows } = await supabase
    .from('facility_activity_entries')
    .select('facility_id, activity_category, quantity, unit, reporting_period_start')
    .eq('organization_id', orgId)
    .gte('reporting_period_start', windowStartIso);

  // 4. Grid readings within the window — UK regions today, more later.
  // Pull all observations and bucket them by month per region.
  const windowStartFullIso = windowStart.toISOString();
  const { data: gridRows } = await supabase
    .from('grid_carbon_readings')
    .select('region_code, recorded_at, intensity_g_per_kwh')
    .gte('recorded_at', windowStartFullIso);

  // monthGridMean[regionCode][YYYY-MM] = average g/kWh that month
  const monthGridMean: Record<string, Record<string, { sum: number; n: number }>> = {};
  for (const r of (gridRows ?? []) as { region_code: string; recorded_at: string; intensity_g_per_kwh: number }[]) {
    const key = r.recorded_at.slice(0, 7); // YYYY-MM
    monthGridMean[r.region_code] ??= {};
    monthGridMean[r.region_code][key] ??= { sum: 0, n: 0 };
    monthGridMean[r.region_code][key].sum += Number(r.intensity_g_per_kwh);
    monthGridMean[r.region_code][key].n += 1;
  }

  function liveMonthlyMean(regionCode: string | null, monthKey: string): number | null {
    if (!regionCode) return null;
    const bucket = monthGridMean[regionCode]?.[monthKey];
    if (!bucket || bucket.n === 0) return null;
    return bucket.sum / bucket.n;
  }

  // 5. Build month buckets. Initialise empty buckets for every month in
  // the window so the chart x-axis is continuous even when a month has no
  // data.
  const buckets = new Map<string, MonthBucket>();
  const monthKeys: string[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(windowStart.getFullYear(), windowStart.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthKeys.push(key);
    buckets.set(key, {
      month: key,
      month_label: d.toLocaleString('en-GB', { month: 'short' }),
      electricity_kwh: 0,
      gas_kwh: 0,
      fuel_litres: 0,
      water_m3: 0,
      waste_kg: 0,
      waste_general_kg: 0,
      waste_hazardous_kg: 0,
      waste_recycling_kg: 0,
      electricity_tco2e_tariff: 0,
      electricity_tco2e_live: 0,
      gas_tco2e: 0,
      other_scope12_tco2e: 0,
      total_tco2e: 0,
      grid_intensity_avg_g_per_kwh: 0,
      grid_confidence: 'global_average',
    });
  }

  // We need to track the country-average + live coverage per month across
  // facilities, weighted by electricity consumption, so the published
  // grid_intensity_avg per month reflects "what mix actually produced
  // your electricity".
  const monthGridWeights = new Map<string, { liveSum: number; liveKwh: number; tariffSum: number; tariffKwh: number; bestConfidence: GridCarbonConfidence }>();
  for (const k of monthKeys) {
    monthGridWeights.set(k, { liveSum: 0, liveKwh: 0, tariffSum: 0, tariffKwh: 0, bestConfidence: 'global_average' });
  }

  function upgradeConfidence(current: GridCarbonConfidence, candidate: GridCarbonConfidence): GridCarbonConfidence {
    const rank: Record<GridCarbonConfidence, number> = { live: 2, country_average: 1, global_average: 0 };
    return rank[candidate] > rank[current] ? candidate : current;
  }

  // 6. Process utility entries.
  for (const u of (utilityRows ?? []) as {
    facility_id: string;
    utility_type: string;
    quantity: number;
    unit: string;
    reporting_period_start: string;
  }[]) {
    const monthKey = u.reporting_period_start.slice(0, 7);
    const bucket = buckets.get(monthKey);
    if (!bucket) continue;
    const facility = facilityById.get(u.facility_id);
    const quantity = Number(u.quantity) || 0;

    if (u.utility_type === 'electricity_grid') {
      const kwh = normaliseEnergyToKwh(quantity, u.unit);
      bucket.electricity_kwh += kwh;

      const country = facility?.country_code ?? null;
      const region = countryToLiveRegion(country);
      const fallback = getCountryAverageGridCarbon(country);
      const live = liveMonthlyMean(region, monthKey);

      // Tariff = static country average (or global fallback)
      const tariffFactor = fallback.intensity / 1000; // g→kg CO2e/kWh
      bucket.electricity_tco2e_tariff += (kwh * tariffFactor) / 1000; // kg→t

      // Live = monthly mean of grid_carbon_readings if available, else
      // fall back to the same country average (so the bars are equal and
      // no seasonality is implied).
      const liveFactor = live != null ? live / 1000 : tariffFactor;
      bucket.electricity_tco2e_live += (kwh * liveFactor) / 1000;

      // Track for the published per-month grid average
      const w = monthGridWeights.get(monthKey)!;
      if (live != null) {
        w.liveSum += live * kwh;
        w.liveKwh += kwh;
        w.bestConfidence = upgradeConfidence(w.bestConfidence, 'live');
      } else {
        w.tariffSum += fallback.intensity * kwh;
        w.tariffKwh += kwh;
        w.bestConfidence = upgradeConfidence(w.bestConfidence, fallback.confidence);
      }
    } else {
      // Combustion: kg CO2e via DEFRA factor.
      const meta = UTILITY_EMISSION_FACTORS[u.utility_type];
      if (!meta) continue;
      const tco2e = (quantity * meta.factor) / 1000;
      if (meta.bucket === 'gas') {
        bucket.gas_kwh += normaliseEnergyToKwh(quantity, u.unit);
        bucket.gas_tco2e += tco2e;
      } else if (meta.bucket === 'fuel') {
        bucket.fuel_litres += quantity;
        bucket.other_scope12_tco2e += tco2e;
      } else {
        bucket.other_scope12_tco2e += tco2e;
      }
    }
  }

  // 7. Process water / waste.
  for (const a of (activityRows ?? []) as {
    facility_id: string;
    activity_category: string;
    quantity: number;
    unit: string;
    reporting_period_start: string;
  }[]) {
    const monthKey = a.reporting_period_start.slice(0, 7);
    const bucket = buckets.get(monthKey);
    if (!bucket) continue;
    const quantity = Number(a.quantity) || 0;

    switch (a.activity_category) {
      case 'water_intake':
        bucket.water_m3 += normaliseToCubicMetres(quantity, a.unit);
        break;
      case 'waste_general': {
        const kg = normaliseToKg(quantity, a.unit);
        bucket.waste_general_kg += kg;
        bucket.waste_kg += kg;
        break;
      }
      case 'waste_hazardous': {
        const kg = normaliseToKg(quantity, a.unit);
        bucket.waste_hazardous_kg += kg;
        bucket.waste_kg += kg;
        break;
      }
      case 'waste_recycling': {
        const kg = normaliseToKg(quantity, a.unit);
        bucket.waste_recycling_kg += kg;
        bucket.waste_kg += kg;
        break;
      }
      // Other activity categories ignored here — they're double-counts
      // with utility_data_entries (utility_electricity / utility_gas).
    }
  }

  // 8. Finalise: total tCO2e, published per-month grid intensity, and
  // the headline summary.
  for (const b of Array.from(buckets.values())) {
    b.total_tco2e = b.electricity_tco2e_live + b.gas_tco2e + b.other_scope12_tco2e;
    const w = monthGridWeights.get(b.month)!;
    if (w.liveKwh > 0 && w.tariffKwh === 0) {
      b.grid_intensity_avg_g_per_kwh = w.liveSum / w.liveKwh;
      b.grid_confidence = 'live';
    } else if (w.liveKwh > 0 && w.tariffKwh > 0) {
      // Mixed: weighted average of both
      b.grid_intensity_avg_g_per_kwh = (w.liveSum + w.tariffSum) / (w.liveKwh + w.tariffKwh);
      b.grid_confidence = w.bestConfidence;
    } else if (w.tariffKwh > 0) {
      b.grid_intensity_avg_g_per_kwh = w.tariffSum / w.tariffKwh;
      b.grid_confidence = w.bestConfidence;
    } else {
      // No electricity that month — still surface a reasonable number
      // for the chart label.
      b.grid_intensity_avg_g_per_kwh = GLOBAL_GRID_AVERAGE_G_PER_KWH;
    }
  }

  const sortedMonths = monthKeys.map(k => buckets.get(k)!).filter(b => b);

  // Headline seasonality stats (only meaningful where we have ≥2 months
  // of LIVE intensity data — country-average gives a flat line).
  const liveMonths = sortedMonths.filter(m => m.grid_confidence === 'live' && m.electricity_kwh > 0);
  let seasonality_delta_pct = 0;
  let cleanest_month: string | null = null;
  let dirtiest_month: string | null = null;
  if (liveMonths.length >= 2) {
    const sorted = [...liveMonths].sort((a, b) => a.grid_intensity_avg_g_per_kwh - b.grid_intensity_avg_g_per_kwh);
    const cleanest = sorted[0];
    const dirtiest = sorted[sorted.length - 1];
    cleanest_month = cleanest.month;
    dirtiest_month = dirtiest.month;
    if (cleanest.grid_intensity_avg_g_per_kwh > 0) {
      seasonality_delta_pct =
        ((dirtiest.grid_intensity_avg_g_per_kwh - cleanest.grid_intensity_avg_g_per_kwh) /
          cleanest.grid_intensity_avg_g_per_kwh) *
        100;
    }
  }

  // Annual rollups
  const annual_kwh = sortedMonths.reduce((s, m) => s + m.electricity_kwh, 0);
  const annual_tco2e_tariff = sortedMonths.reduce((s, m) => s + m.electricity_tco2e_tariff, 0);
  const annual_tco2e_live = sortedMonths.reduce((s, m) => s + m.electricity_tco2e_live, 0);
  const annual_grid_avg =
    annual_kwh > 0
      ? sortedMonths.reduce((s, m) => s + m.electricity_kwh * m.grid_intensity_avg_g_per_kwh, 0) / annual_kwh
      : 0;

  const confidenceMix = new Set(sortedMonths.map(m => m.grid_confidence));
  const overallConfidence: 'live' | 'mixed' | 'fallback' =
    confidenceMix.has('live') && confidenceMix.size === 1
      ? 'live'
      : confidenceMix.has('live')
        ? 'mixed'
        : 'fallback';

  return NextResponse.json({
    months: sortedMonths,
    facilities: facilityList,
    summary: {
      facilities_count: facilityList.length,
      annual_kwh,
      annual_tco2e_tariff,
      annual_tco2e_live,
      annual_grid_avg_g_per_kwh: annual_grid_avg,
      seasonality_delta_pct,
      cleanest_month,
      dirtiest_month,
      confidence: overallConfidence,
    },
  });
}

/** Convert energy units to kWh. Unknown units pass through as-is. */
function normaliseEnergyToKwh(value: number, unit: string): number {
  const u = unit?.toLowerCase()?.trim();
  if (!u || u === 'kwh') return value;
  if (u === 'mwh') return value * 1000;
  if (u === 'gwh') return value * 1_000_000;
  if (u === 'wh') return value / 1000;
  if (u === 'mj') return value / 3.6;          // 1 kWh = 3.6 MJ
  if (u === 'gj') return value * 277.778;
  if (u === 'therms') return value * 29.3071;  // 1 therm = 29.3071 kWh
  if (u === 'btu') return value / 3412.14;
  if (u === 'm3' || u === 'm³' || u === 'cubic metres') {
    // Natural gas m3 → kWh (UK gross CV ~10.83 kWh/m3)
    return value * 10.83;
  }
  return value; // best-effort
}

function normaliseToCubicMetres(value: number, unit: string): number {
  const u = unit?.toLowerCase()?.trim();
  if (!u || u === 'm3' || u === 'm³' || u === 'cubic metres') return value;
  if (u === 'litres' || u === 'l') return value / 1000;
  if (u === 'megalitres' || u === 'ml') return value * 1000;
  if (u === 'gallons' || u === 'us gallons') return value * 0.003785;
  if (u === 'imperial gallons' || u === 'uk gallons') return value * 0.004546;
  return value;
}

function normaliseToKg(value: number, unit: string): number {
  const u = unit?.toLowerCase()?.trim();
  if (!u || u === 'kg') return value;
  if (u === 't' || u === 'tonnes' || u === 'metric tonnes') return value * 1000;
  if (u === 'g' || u === 'grams') return value / 1000;
  if (u === 'lb' || u === 'lbs' || u === 'pounds') return value * 0.453592;
  return value;
}
