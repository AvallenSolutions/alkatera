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

/**
 * Distance thresholds for transport mode plausibility checks.
 * Based on GHG Protocol Scope 3 Category 4 guidance and real-world logistics constraints.
 */
export const TRANSPORT_DISTANCE_THRESHOLDS = {
  /** Max credible single truck leg — beyond this, sea or rail should be used */
  TRUCK_MAX_KM: 1500,
  /** Max credible rail freight distance — beyond this, sea is more realistic */
  TRAIN_MAX_KM: 5000,
  /** Min credible air freight distance — below this, truck is more appropriate */
  AIR_MIN_KM: 300,
  /** Min credible sea freight distance — below this, truck is more appropriate */
  SHIP_MIN_KM: 50,
} as const;

/**
 * Returns a warning message if the transport mode is implausible for the given distance.
 *
 * These are soft warnings — the calculation still runs, but the user is alerted that
 * their mode selection may be incorrect and could significantly over- or under-estimate
 * transport emissions (truck vs ship factors differ by ~6×).
 *
 * Based on:
 * - GHG Protocol Scope 3 Category 4 Technical Guidance (upstream transport)
 * - ISO 14067:2018 §6.4 (system boundary for transport)
 * - DEFRA 2025 freight factors (truck: 0.062, ship: 0.011 kg CO₂e/tonne-km)
 *
 * @returns Warning string if implausible, null if OK
 */
export function getTransportModeWarning(
  transportMode: string | null | undefined,
  distanceKm: number | null | undefined
): string | null {
  if (!transportMode || !distanceKm || distanceKm <= 0) return null;

  const dist = Number(distanceKm);
  if (isNaN(dist)) return null;

  if (transportMode === 'truck' && dist > TRANSPORT_DISTANCE_THRESHOLDS.TRUCK_MAX_KM) {
    return `${dist.toLocaleString()} km is too far for a single truck leg. For transoceanic or intercontinental routes, select Ship instead (or Rail for long overland routes). Using Truck at this distance overestimates transport emissions by ~6×.`;
  }
  if (transportMode === 'train' && dist > TRANSPORT_DISTANCE_THRESHOLDS.TRAIN_MAX_KM) {
    return `${dist.toLocaleString()} km is unusually long for rail freight. Intercontinental distances are typically served by sea. Consider switching to Ship.`;
  }
  if (transportMode === 'air' && dist < TRANSPORT_DISTANCE_THRESHOLDS.AIR_MIN_KM) {
    return `${dist.toLocaleString()} km is a very short distance for air freight. Road (Truck) is typically used for distances under 300 km.`;
  }
  if (transportMode === 'ship' && dist < TRANSPORT_DISTANCE_THRESHOLDS.SHIP_MIN_KM) {
    return `${dist.toLocaleString()} km is very short for sea freight. Road (Truck) is typically more appropriate for distances under 50 km.`;
  }
  return null;
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
