/**
 * Shared utility emission factors + unit normalisers used across the Pulse
 * layer so the nightly snapshot KPI and the Facility Impact widget can't
 * drift out of sync.
 *
 * DEFRA 2024 GHG conversion factors, kg CO₂e per native unit. Electricity
 * is deliberately excluded — grid emissions are computed via the
 * country-average / live-grid-intensity pathway in
 * lib/calculations/grid-carbon-fallback.ts.
 */

export type UtilityFactorBucket = 'gas' | 'fuel' | 'other';

export interface UtilityFactor {
  factor: number;
  native_unit: string;
  bucket: UtilityFactorBucket;
}

export const UTILITY_EMISSION_FACTORS: Record<string, UtilityFactor> = {
  natural_gas:          { factor: 0.18,  native_unit: 'kWh',    bucket: 'gas' },    // kg CO2e/kWh gross CV
  heat_steam_purchased: { factor: 0.17,  native_unit: 'kWh',    bucket: 'other' },
  lpg:                  { factor: 1.557, native_unit: 'litres', bucket: 'fuel' },
  diesel_stationary:    { factor: 2.66,  native_unit: 'litres', bucket: 'fuel' },
  diesel_mobile:        { factor: 2.51,  native_unit: 'litres', bucket: 'fuel' },
  petrol_mobile:        { factor: 2.08,  native_unit: 'litres', bucket: 'fuel' },
  heavy_fuel_oil:       { factor: 3.13,  native_unit: 'litres', bucket: 'fuel' },
  biomass_solid:        { factor: 0.015, native_unit: 'kWh',    bucket: 'other' }, // biogenic CO2 not counted
  refrigerant_leakage:  { factor: 1430,  native_unit: 'kg',     bucket: 'other' }, // R-134a equivalent default
};

/** Convert energy units to kWh. Unknown units pass through as-is. */
export function normaliseEnergyToKwh(value: number, unit: string): number {
  const u = unit?.toLowerCase()?.trim();
  if (!u || u === 'kwh') return value;
  if (u === 'mwh') return value * 1000;
  if (u === 'gwh') return value * 1_000_000;
  if (u === 'wh') return value / 1000;
  if (u === 'mj') return value / 3.6;
  if (u === 'gj') return value * 277.778;
  if (u === 'therms') return value * 29.3071;
  if (u === 'btu') return value / 3412.14;
  if (u === 'm3' || u === 'm³' || u === 'cubic metres') {
    // Natural gas m3 → kWh, UK gross CV ~10.83 kWh/m3
    return value * 10.83;
  }
  return value;
}

export function normaliseToCubicMetres(value: number, unit: string): number {
  const u = unit?.toLowerCase()?.trim();
  if (!u || u === 'm3' || u === 'm³' || u === 'cubic metres') return value;
  if (u === 'litres' || u === 'l') return value / 1000;
  if (u === 'megalitres' || u === 'ml') return value * 1000;
  if (u === 'gallons' || u === 'us gallons') return value * 0.003785;
  if (u === 'imperial gallons' || u === 'uk gallons') return value * 0.004546;
  return value;
}

export function normaliseToKg(value: number, unit: string): number {
  const u = unit?.toLowerCase()?.trim();
  if (!u || u === 'kg') return value;
  if (u === 't' || u === 'tonnes' || u === 'metric tonnes') return value * 1000;
  if (u === 'g' || u === 'grams') return value / 1000;
  if (u === 'lb' || u === 'lbs' || u === 'pounds') return value * 0.453592;
  return value;
}
