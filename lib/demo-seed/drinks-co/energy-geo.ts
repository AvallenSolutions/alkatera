/**
 * Demo data for the two newest features, scoped to alkatera Drinks Co:
 *
 *  1. Programme 2 — live grid intensity + half-hourly smart-meter energy.
 *     The head office gets a real GB postcode + coordinates (so it resolves to a
 *     Carbon Intensity region) and a full previous calendar month of 30-minute
 *     electricity + gas readings. Those readings DERIVE that month's utility
 *     totals (data_source='smart_meter'), replacing the bill seedOperations wrote
 *     for the same month — so it doubles as a live demo of the "enter consumption
 *     once" single-source rule.
 *
 *  2. Programme 1 — geospatial. The vineyard and orchard get real coordinates and
 *     a SoilGrids soil-carbon baseline request, so the land-unit map + the
 *     unverified soil baseline can be tested.
 *
 * Idempotent: re-running deletes the facility's own half-hourly + that month's
 * energy rows before reinserting, and the geo updates are plain field writes.
 *
 * MUST run after seedOperations (which clears + rewrites utility_data_entries for
 * every owned facility), so this replaces the head office's latest bill cleanly.
 */

import {
  FACILITIES,
  VINEYARD_ID,
  ORCHARD_ID,
  type SeedCtx,
} from './shared';
import {
  deriveMonthlyEntries,
  readingsSpan,
  type HHRow,
  type Fuel,
} from '@/lib/energy/derive-utility';
import { resolveFacilityRegionCode } from '@/lib/energy/region';
import { dispatchSoilBaseline } from '@/lib/geo/dispatch';

// Bristol head office — a real central-Bristol postcode + coordinates so the
// facility resolves to a South West England grid region.
const HEAD_OFFICE_POSTCODE = 'BS1 5TR';
const HEAD_OFFICE_LAT = 51.4536;
const HEAD_OFFICE_LNG = -2.5975;

// Real English land-unit coordinates (Kent vineyard, Somerset cider orchard).
const VINEYARD_LAT = 51.0705;
const VINEYARD_LNG = 0.673;
const ORCHARD_LAT = 51.149;
const ORCHARD_LNG = -2.718;

/** kWh in a single weekday/weekend half hour, by hour-of-day (0–23.5). */
function elecKwh(hour: number, weekend: boolean): number {
  const base = weekend ? 0.6 : 1.4;
  const peak = weekend ? 2.5 : 8;
  const spread = weekend ? 5 : 4.5;
  return base + peak * Math.exp(-Math.pow((hour - 13) / spread, 2));
}

/** Gas kWh in a half hour — morning + evening heating/hot-water bumps. */
function gasKwh(hour: number, weekend: boolean): number {
  const morning = 2.2 * Math.exp(-Math.pow((hour - 7) / 1.6, 2));
  const evening = 1.6 * Math.exp(-Math.pow((hour - 19) / 2, 2));
  const g = 0.25 + morning + evening;
  return weekend ? g * 0.7 : g;
}

/** Build a previous-full-calendar-month of half-hourly readings for one fuel. */
function buildMonthReadings(fuel: Fuel, now = new Date()): HHRow[] {
  const firstOfThisMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const prevEnd = new Date(firstOfThisMonth - 86_400_000); // last day of prev month
  const py = prevEnd.getUTCFullYear();
  const pm = prevEnd.getUTCMonth();
  const days = prevEnd.getUTCDate();

  const rows: HHRow[] = [];
  for (let day = 1; day <= days; day++) {
    const dow = new Date(Date.UTC(py, pm, day)).getUTCDay();
    const weekend = dow === 0 || dow === 6;
    const wiggle = 1 + 0.04 * Math.sin(day);
    for (let hh = 0; hh < 48; hh++) {
      const hour = hh / 2;
      const minute = (hh % 2) * 30;
      const recordedAt = new Date(Date.UTC(py, pm, day, Math.floor(hour), minute)).toISOString();
      const raw = fuel === 'gas' ? gasKwh(hour, weekend) : elecKwh(hour, weekend);
      rows.push({ recordedAt, kwh: Number((raw * wiggle).toFixed(3)) });
    }
  }
  return rows;
}

async function chunkInsert(ctx: SeedCtx, table: string, rows: Record<string, unknown>[]): Promise<void> {
  const CHUNK = 1000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await ctx.svc.from(table).insert(rows.slice(i, i + CHUNK));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

export async function seedEnergyGeo(ctx: SeedCtx): Promise<void> {
  const { svc, orgId } = ctx;
  const facilityId = FACILITIES.headOffice;

  // ── 1. Head office location → resolves to a grid region ──────────────────
  await svc
    .from('facilities')
    .update({
      address_postcode: HEAD_OFFICE_POSTCODE,
      address_lat: HEAD_OFFICE_LAT,
      address_lng: HEAD_OFFICE_LNG,
      location_country_code: 'GB',
      address_country: 'United Kingdom',
    })
    .eq('id', facilityId);

  // Resolve + cache the Carbon Intensity region (non-fatal if the API is down).
  try {
    const { data: facility } = await svc
      .from('facilities')
      .select('id, grid_region_code, location_country_code, address_country, address_postcode')
      .eq('id', facilityId)
      .maybeSingle();
    if (facility) await resolveFacilityRegionCode(svc, facility as never);
  } catch (e) {
    ctx.warnings.push(`grid region resolve: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── 2. Half-hourly smart-meter readings (electricity + gas) ──────────────
  const elec = buildMonthReadings('electricity');
  const gas = buildMonthReadings('gas');
  const span = readingsSpan(elec);

  // Idempotent: drop this facility's prior half-hourly detail first.
  await svc.from('smart_meter_readings').delete().eq('facility_id', facilityId);

  const detail = [
    ...elec.map((r) => ({ facility_id: facilityId, fuel: 'electricity', recorded_at: r.recordedAt, consumption_kwh: r.kwh, source: 'demo_seed' })),
    ...gas.map((r) => ({ facility_id: facilityId, fuel: 'gas', recorded_at: r.recordedAt, consumption_kwh: r.kwh, source: 'demo_seed' })),
  ];
  await chunkInsert(ctx, 'smart_meter_readings', detail);

  // ── 3. Derive that month's totals, replacing the seeded bill (single source) ──
  const derived = [
    ...deriveMonthlyEntries(elec, 'electricity'),
    ...deriveMonthlyEntries(gas, 'gas'),
  ].map((d) => ({ ...d, facility_id: facilityId, name: 'Smart meter (half-hourly)' }));

  if (span) {
    // Remove the overlapping electricity/gas rows for this facility (the bill from
    // seedOperations + any prior derived rows) so energy is counted once.
    await svc
      .from('utility_data_entries')
      .delete()
      .eq('facility_id', facilityId)
      .in('utility_type', ['electricity_grid', 'natural_gas'])
      .lte('reporting_period_start', span.to)
      .gte('reporting_period_end', span.from);
    await chunkInsert(ctx, 'utility_data_entries', derived);
  }

  // ── 4. Geo: land-unit coordinates + SoilGrids baseline request ───────────
  await svc.from('vineyards').update({ address_lat: VINEYARD_LAT, address_lng: VINEYARD_LNG }).eq('id', VINEYARD_ID);
  await svc.from('orchards').update({ address_lat: ORCHARD_LAT, address_lng: ORCHARD_LNG }).eq('id', ORCHARD_ID);

  await dispatchSoilBaseline({ organizationId: orgId, landUnitType: 'vineyard', landUnitId: VINEYARD_ID, lat: VINEYARD_LAT, lng: VINEYARD_LNG });
  await dispatchSoilBaseline({ organizationId: orgId, landUnitType: 'orchard', landUnitId: ORCHARD_ID, lat: ORCHARD_LAT, lng: ORCHARD_LNG });

  const totalElec = Math.round(elec.reduce((s, r) => s + r.kwh, 0));
  const totalGas = Math.round(gas.reduce((s, r) => s + r.kwh, 0));
  ctx.report.energyGeo =
    `head office: ${detail.length} half-hourly readings (${span?.from}…${span?.to}, ${totalElec} kWh elec + ${totalGas} kWh gas) → ${derived.length} derived monthly totals; ` +
    `vineyard + orchard geo-located, SoilGrids baseline requested`;
}
