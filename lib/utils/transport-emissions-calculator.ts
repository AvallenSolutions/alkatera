import { getSupabaseBrowserClient } from '../supabase/browser-client';

export type TransportMode = 'truck' | 'train' | 'ship' | 'air';

export interface TransportEmissionsParams {
  weightKg: number;
  distanceKm: number;
  transportMode: TransportMode;
}

export interface TransportEmissionsResult {
  emissions: number;
  emissionFactor: number;
  methodology: string;
  dataSource: string;
  calculationDetails: string;
}

/**
 * DEFRA 2025 freight emission factor names as stored in staging_emission_factors.
 *
 * MEDIUM FIX #17: Document the load factor assumption embedded in these factors.
 * DEFRA freight factors use "average laden" for road and "average" for other modes.
 * "Average laden" means approximately 50% load factor for HGV (based on UK freight
 * statistics). This is appropriate for most supply chains. For dedicated full-truck
 * loads, the actual per-tonne-km emissions would be ~half this value.
 *
 * Source: DEFRA (2025) Government conversion factors for greenhouse gas reporting
 * https://www.gov.uk/government/collections/government-conversion-factors-for-greenhouse-gas-reporting
 *
 * Emission factors (kg CO2e per tonne-km) — from DEFRA 2025:
 *   truck: ~0.104 kg CO2e/tonne-km (HGV, average laden, includes well-to-wheel)
 *   train: ~0.028 kg CO2e/tonne-km (UK average, electrified + diesel mix)
 *   ship:  ~0.016 kg CO2e/tonne-km (container ship, global average)
 *   air:   ~1.130 kg CO2e/tonne-km (dedicated freighter, uplift factor applied)
 *
 * Note: These are pulled from the staging_emission_factors table at runtime,
 * so the values above are for documentation purposes only — the actual calculation
 * uses whatever is in the database. Check staging_emission_factors for current values.
 */
const TRANSPORT_MODE_MAP: Record<TransportMode, string> = {
  truck: 'Freight - Road (HGV, Average laden)',
  train: 'Freight - Rail (Freight train, UK average)',
  ship: 'Freight - Sea (Container ship, Average)',
  air: 'Freight - Air (Dedicated freight service, Average)'
};

export async function calculateTransportEmissions(
  params: TransportEmissionsParams
): Promise<TransportEmissionsResult> {
  const { weightKg, distanceKm, transportMode } = params;

  if (weightKg <= 0) {
    throw new Error('Weight must be greater than 0');
  }

  if (distanceKm <= 0) {
    throw new Error('Distance must be greater than 0');
  }

  if (!transportMode || !TRANSPORT_MODE_MAP[transportMode]) {
    throw new Error(`Invalid transport mode: ${transportMode}`);
  }

  const supabase = getSupabaseBrowserClient();

  const factorName = TRANSPORT_MODE_MAP[transportMode];

  const { data: emissionFactor, error } = await supabase
    .from('staging_emission_factors')
    .select('co2_factor, source, metadata')
    .eq('name', factorName)
    .eq('category', 'Transport')
    .maybeSingle();

  if (error || !emissionFactor) {
    console.error(`[TransportCalculator] Failed to fetch emission factor for ${transportMode}:`, error);
    throw new Error(`Transport emission factor not found for mode: ${transportMode}`);
  }

  const weightTonnes = weightKg / 1000;

  const tonneKm = weightTonnes * distanceKm;

  const emissions = tonneKm * Number(emissionFactor.co2_factor);

  const calculationDetails = `${weightKg.toFixed(3)} kg ÷ 1000 = ${weightTonnes.toFixed(3)} tonnes; ${weightTonnes.toFixed(3)} t × ${distanceKm} km = ${tonneKm.toFixed(2)} tonne-km; ${tonneKm.toFixed(2)} tonne-km × ${emissionFactor.co2_factor} kgCO2e/tonne-km = ${emissions.toFixed(4)} kgCO2e`;

  return {
    emissions: Number(emissions.toFixed(6)),
    emissionFactor: Number(emissionFactor.co2_factor),
    methodology: emissionFactor.metadata?.methodology || 'DEFRA 2025 Freight Factors',
    dataSource: `${emissionFactor.source} - ${factorName}`,
    calculationDetails
  };
}

export function validateTransportData(
  transportMode?: string | null,
  distanceKm?: number | null
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!transportMode && !distanceKm) {
    return { valid: true, errors: [] };
  }

  if (transportMode && !distanceKm) {
    errors.push('Distance is required when transport mode is specified');
  }

  if (distanceKm && !transportMode) {
    errors.push('Transport mode is required when distance is specified');
  }

  if (transportMode && !['truck', 'train', 'ship', 'air'].includes(transportMode)) {
    errors.push(`Invalid transport mode: ${transportMode}`);
  }

  if (distanceKm && distanceKm < 0) {
    errors.push('Distance cannot be negative');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function formatTransportMode(mode: TransportMode): string {
  const labels: Record<TransportMode, string> = {
    truck: 'Road (HGV)',
    train: 'Rail Freight',
    ship: 'Sea Freight',
    air: 'Air Freight'
  };
  return labels[mode] || mode;
}
