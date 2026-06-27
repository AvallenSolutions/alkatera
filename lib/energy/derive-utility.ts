/**
 * Programme 2: derive monthly utility_data_entries from half-hourly readings.
 *
 * A smart-meter upload is just a higher-resolution way to provide consumption,
 * so we roll the half-hours up into one monthly utility_data_entries row per
 * calendar month (tagged data_source='smart_meter'). That feeds the headline
 * Scope 1/2 exactly like a bill would — so the user uploads once.
 */

export type Fuel = 'electricity' | 'gas';

export interface HHRow {
  recordedAt: string; // ISO
  kwh: number;
}

export interface DerivedUtilityRow {
  utility_type: string;
  quantity: number;
  unit: string;
  reporting_period_start: string; // YYYY-MM-DD
  reporting_period_end: string; // YYYY-MM-DD
  calculated_scope: string;
  data_source: 'smart_meter';
  meter_type: 'half_hourly';
}

/** Map a fuel to its utility_type + scope. */
export function fuelToUtility(fuel: Fuel): { utilityType: string; scope: string } {
  return fuel === 'gas'
    ? { utilityType: 'natural_gas', scope: 'Scope 1' }
    : { utilityType: 'electricity_grid', scope: 'Scope 2' };
}

/** Inclusive [from,to] date span (YYYY-MM-DD) of the readings, or null. */
export function readingsSpan(readings: HHRow[]): { from: string; to: string } | null {
  if (readings.length === 0) return null;
  let min = readings[0].recordedAt;
  let max = readings[0].recordedAt;
  for (const r of readings) {
    if (r.recordedAt < min) min = r.recordedAt;
    if (r.recordedAt > max) max = r.recordedAt;
  }
  return { from: min.slice(0, 10), to: max.slice(0, 10) };
}

/** Roll half-hours up to one row per calendar month. */
export function deriveMonthlyEntries(readings: HHRow[], fuel: Fuel): DerivedUtilityRow[] {
  const { utilityType, scope } = fuelToUtility(fuel);
  const byMonth = new Map<string, { sum: number; minD: string; maxD: string }>();
  for (const r of readings) {
    const month = r.recordedAt.slice(0, 7); // YYYY-MM
    const date = r.recordedAt.slice(0, 10);
    const b = byMonth.get(month) ?? { sum: 0, minD: date, maxD: date };
    b.sum += r.kwh;
    if (date < b.minD) b.minD = date;
    if (date > b.maxD) b.maxD = date;
    byMonth.set(month, b);
  }
  return Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, b]) => ({
      utility_type: utilityType,
      quantity: Number(b.sum.toFixed(3)),
      unit: 'kWh',
      reporting_period_start: b.minD,
      reporting_period_end: b.maxD,
      calculated_scope: scope,
      data_source: 'smart_meter' as const,
      meter_type: 'half_hourly' as const,
    }));
}
