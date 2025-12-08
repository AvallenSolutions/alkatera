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
