/**
 * Distribution (Outbound Transport) Factor Library
 *
 * Calculates outbound distribution emissions for products transported
 * from factory to point of sale (shelf) or consumer.
 *
 * Supports multi-leg transport chains with different modes per leg.
 * Reuses DEFRA 2025 transport factors from lib/utils/transport-emissions-calculator.ts.
 *
 * Sources:
 * - DEFRA 2025: Freight emission factors (truck, train, ship, air)
 * - GHG Protocol Scope 3 Category 4/9: Upstream/downstream transportation
 * - ISO 14067 §6.4: System boundary for product carbon footprints
 */

import {
  calculateTransportEmissions,
  type TransportMode,
} from './utils/transport-emissions-calculator';

// ============================================================================
// TYPES
// ============================================================================

export interface DistributionLeg {
  /** Unique ID for UI keying */
  id: string;
  /** User-friendly label, e.g. "Factory to warehouse" */
  label: string;
  /** Transport mode: truck, train, ship, or air */
  transportMode: TransportMode;
  /** Distance in kilometres */
  distanceKm: number;
}

export interface DistributionConfig {
  /** Ordered list of transport legs from factory to destination */
  legs: DistributionLeg[];
  /** Total shipped product weight in kg (auto-filled from product materials) */
  productWeightKg: number;
}

export interface DistributionLegResult {
  legId: string;
  label: string;
  emissions: number; // kg CO2e
  mode: TransportMode;
  distanceKm: number;
}

export interface DistributionResult {
  /** Total emissions across all legs (kg CO2e) */
  total: number;
  /** Per-leg emissions breakdown */
  perLeg: DistributionLegResult[];
}

// ============================================================================
// SCENARIO PRESETS
// ============================================================================

/**
 * Common distribution scenarios for the drinks industry.
 * Each scenario defines a typical set of transport legs.
 * Users can select a preset and then customise distances.
 */
export const DISTRIBUTION_SCENARIOS: Record<
  string,
  {
    label: string;
    description: string;
    legs: Omit<DistributionLeg, 'id'>[];
  }
> = {
  local: {
    label: 'Local Distribution',
    description: 'Brewery/distillery to local pubs and shops',
    legs: [
      { label: 'Factory to retail', transportMode: 'truck', distanceKm: 50 },
    ],
  },
  national: {
    label: 'National Distribution',
    description: 'Via regional distribution centre to retail nationwide',
    legs: [
      {
        label: 'Factory to distribution centre',
        transportMode: 'truck',
        distanceKm: 200,
      },
      {
        label: 'Distribution centre to retail',
        transportMode: 'truck',
        distanceKm: 150,
      },
    ],
  },
  export_eu: {
    label: 'European Export',
    description: 'Cross-channel/overland to EU markets',
    legs: [
      { label: 'Factory to port', transportMode: 'truck', distanceKm: 100 },
      {
        label: 'Port to destination port',
        transportMode: 'ship',
        distanceKm: 1500,
      },
      { label: 'Port to retail', transportMode: 'truck', distanceKm: 200 },
    ],
  },
  export_long_haul: {
    label: 'Long-Haul Export',
    description: 'Intercontinental shipping (e.g. NZ wine to UK)',
    legs: [
      { label: 'Factory to port', transportMode: 'truck', distanceKm: 100 },
      {
        label: 'Intercontinental shipping',
        transportMode: 'ship',
        distanceKm: 19000,
      },
      {
        label: 'Port to distribution centre',
        transportMode: 'truck',
        distanceKm: 150,
      },
      {
        label: 'Distribution centre to retail',
        transportMode: 'truck',
        distanceKm: 100,
      },
    ],
  },
  direct_to_consumer: {
    label: 'Direct to Consumer',
    description: 'Online orders shipped directly from factory',
    legs: [
      {
        label: 'Factory to consumer',
        transportMode: 'truck',
        distanceKm: 300,
      },
    ],
  },
};

// ============================================================================
// DEFAULTS
// ============================================================================

/**
 * Generate a default distribution configuration.
 * Starts with a single local distribution leg.
 *
 * @param productWeightKg - Total product weight (auto-calculated from materials)
 */
export function getDefaultDistributionConfig(
  productWeightKg: number
): DistributionConfig {
  return {
    legs: [
      {
        id: generateLegId(),
        label: 'Factory to retail',
        transportMode: 'truck',
        distanceKm: 50,
      },
    ],
    productWeightKg,
  };
}

// ============================================================================
// CALCULATION
// ============================================================================

/**
 * Calculate distribution emissions for all transport legs.
 *
 * Calls the existing `calculateTransportEmissions()` for each leg,
 * reusing DEFRA 2025 freight factors. The total is the sum of all legs.
 *
 * @param config - Distribution configuration with legs and product weight
 * @returns Per-leg and total emissions in kg CO2e
 */
export async function calculateDistributionEmissions(
  config: DistributionConfig
): Promise<DistributionResult> {
  if (!config.legs || config.legs.length === 0) {
    return { total: 0, perLeg: [] };
  }

  if (config.productWeightKg <= 0) {
    return { total: 0, perLeg: [] };
  }

  const perLeg: DistributionLegResult[] = [];
  let total = 0;

  for (const leg of config.legs) {
    if (leg.distanceKm <= 0) {
      perLeg.push({
        legId: leg.id,
        label: leg.label,
        emissions: 0,
        mode: leg.transportMode,
        distanceKm: leg.distanceKm,
      });
      continue;
    }

    try {
      const result = await calculateTransportEmissions({
        weightKg: config.productWeightKg,
        distanceKm: leg.distanceKm,
        transportMode: leg.transportMode,
      });

      perLeg.push({
        legId: leg.id,
        label: leg.label,
        emissions: result.emissions,
        mode: leg.transportMode,
        distanceKm: leg.distanceKm,
      });

      total += result.emissions;
    } catch (err: any) {
      console.warn(
        `[calculateDistributionEmissions] Leg "${leg.label}" failed: ${err.message}`
      );
      perLeg.push({
        legId: leg.id,
        label: leg.label,
        emissions: 0,
        mode: leg.transportMode,
        distanceKm: leg.distanceKm,
      });
    }
  }

  return {
    total: Number(total.toFixed(6)),
    perLeg,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate a unique leg ID for UI keying.
 */
export function generateLegId(): string {
  return `leg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
