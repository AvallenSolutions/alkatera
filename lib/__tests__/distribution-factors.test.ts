/**
 * Distribution Factors Unit Tests
 *
 * Tests the distribution configuration, scenario presets,
 * and emissions calculation functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the transport emissions calculator
vi.mock('@/lib/utils/transport-emissions-calculator', () => ({
  calculateTransportEmissions: vi.fn(async (params: any) => {
    // Simple mock: use approximate DEFRA 2025 factors
    const factors: Record<string, number> = {
      truck: 0.104,
      train: 0.028,
      ship: 0.016,
      air: 1.13,
    };
    const factor = factors[params.transportMode] || 0.1;
    const tonneKm = (params.weightKg / 1000) * params.distanceKm;
    const emissions = tonneKm * factor;
    return {
      emissions: Number(emissions.toFixed(6)),
      emissionFactor: factor,
      methodology: 'DEFRA 2025 (mock)',
      dataSource: 'Mock',
      calculationDetails: 'Mock calculation',
    };
  }),
  formatTransportMode: vi.fn((mode: string) => mode),
  getTransportModeWarning: vi.fn(() => null),
}));

import {
  getDefaultDistributionConfig,
  calculateDistributionEmissions,
  generateLegId,
  DISTRIBUTION_SCENARIOS,
  type DistributionConfig,
} from '../distribution-factors';

// ============================================================================
// TYPES & DEFAULTS
// ============================================================================

describe('getDefaultDistributionConfig', () => {
  it('returns a valid config with provided weight', () => {
    const config = getDefaultDistributionConfig(0.75);
    expect(config.productWeightKg).toBe(0.75);
    expect(config.legs).toHaveLength(1);
  });

  it('default leg is a local truck route', () => {
    const config = getDefaultDistributionConfig(1.0);
    const leg = config.legs[0];
    expect(leg.transportMode).toBe('truck');
    expect(leg.distanceKm).toBe(50);
    expect(leg.label).toBeTruthy();
    expect(leg.id).toBeTruthy();
  });

  it('each call generates unique leg IDs', () => {
    const config1 = getDefaultDistributionConfig(1.0);
    const config2 = getDefaultDistributionConfig(1.0);
    expect(config1.legs[0].id).not.toBe(config2.legs[0].id);
  });
});

// ============================================================================
// SCENARIO PRESETS
// ============================================================================

describe('DISTRIBUTION_SCENARIOS', () => {
  it('has at least 4 presets', () => {
    expect(Object.keys(DISTRIBUTION_SCENARIOS).length).toBeGreaterThanOrEqual(4);
  });

  it('all presets have valid legs with transport modes', () => {
    const validModes = ['truck', 'train', 'ship', 'air'];
    for (const [key, scenario] of Object.entries(DISTRIBUTION_SCENARIOS)) {
      expect(scenario.label).toBeTruthy();
      expect(scenario.description).toBeTruthy();
      expect(scenario.legs.length).toBeGreaterThan(0);

      for (const leg of scenario.legs) {
        expect(validModes).toContain(leg.transportMode);
        expect(leg.distanceKm).toBeGreaterThan(0);
        expect(leg.label).toBeTruthy();
      }
    }
  });

  it('includes local, national, export, and long-haul scenarios', () => {
    expect(DISTRIBUTION_SCENARIOS).toHaveProperty('local');
    expect(DISTRIBUTION_SCENARIOS).toHaveProperty('national');
    expect(DISTRIBUTION_SCENARIOS).toHaveProperty('export_eu');
    expect(DISTRIBUTION_SCENARIOS).toHaveProperty('export_long_haul');
  });

  it('long-haul export includes a ship leg', () => {
    const longHaul = DISTRIBUTION_SCENARIOS.export_long_haul;
    const hasShip = longHaul.legs.some((leg) => leg.transportMode === 'ship');
    expect(hasShip).toBe(true);
  });
});

// ============================================================================
// CALCULATION
// ============================================================================

describe('calculateDistributionEmissions', () => {
  it('returns 0 for empty legs', async () => {
    const result = await calculateDistributionEmissions({
      legs: [],
      productWeightKg: 1.0,
    });
    expect(result.total).toBe(0);
    expect(result.perLeg).toHaveLength(0);
  });

  it('returns 0 for zero product weight', async () => {
    const result = await calculateDistributionEmissions({
      legs: [
        { id: 'test', label: 'Test', transportMode: 'truck', distanceKm: 100 },
      ],
      productWeightKg: 0,
    });
    expect(result.total).toBe(0);
  });

  it('calculates emissions for a single truck leg', async () => {
    const result = await calculateDistributionEmissions({
      legs: [
        { id: 'leg1', label: 'Factory to retail', transportMode: 'truck', distanceKm: 100 },
      ],
      productWeightKg: 1.0, // 1 kg
    });

    expect(result.total).toBeGreaterThan(0);
    expect(result.perLeg).toHaveLength(1);
    expect(result.perLeg[0].legId).toBe('leg1');
    expect(result.perLeg[0].emissions).toBeGreaterThan(0);
    expect(result.perLeg[0].mode).toBe('truck');
    expect(result.perLeg[0].distanceKm).toBe(100);

    // Expected: (1 kg / 1000) * 100 km * 0.104 = 0.0104 kg CO2e
    expect(result.total).toBeCloseTo(0.0104, 3);
  });

  it('sums emissions across multiple legs', async () => {
    const config: DistributionConfig = {
      legs: [
        { id: 'leg1', label: 'Factory to port', transportMode: 'truck', distanceKm: 100 },
        { id: 'leg2', label: 'Shipping', transportMode: 'ship', distanceKm: 19000 },
        { id: 'leg3', label: 'Port to retail', transportMode: 'truck', distanceKm: 150 },
      ],
      productWeightKg: 0.75, // 750g
    };

    const result = await calculateDistributionEmissions(config);

    expect(result.perLeg).toHaveLength(3);
    expect(result.total).toBeGreaterThan(0);

    // Check that total equals sum of per-leg
    const legSum = result.perLeg.reduce((sum, leg) => sum + leg.emissions, 0);
    expect(result.total).toBeCloseTo(legSum, 4);
  });

  it('handles legs with 0 distance gracefully', async () => {
    const result = await calculateDistributionEmissions({
      legs: [
        { id: 'leg1', label: 'Valid', transportMode: 'truck', distanceKm: 100 },
        { id: 'leg2', label: 'Zero dist', transportMode: 'truck', distanceKm: 0 },
      ],
      productWeightKg: 1.0,
    });

    expect(result.perLeg).toHaveLength(2);
    expect(result.perLeg[1].emissions).toBe(0);
    // Total should only reflect leg1
    expect(result.total).toBeGreaterThan(0);
  });

  it('ship mode produces lower emissions than truck for same distance', async () => {
    const truckResult = await calculateDistributionEmissions({
      legs: [
        { id: 'truck', label: 'Truck', transportMode: 'truck', distanceKm: 1000 },
      ],
      productWeightKg: 1.0,
    });

    const shipResult = await calculateDistributionEmissions({
      legs: [
        { id: 'ship', label: 'Ship', transportMode: 'ship', distanceKm: 1000 },
      ],
      productWeightKg: 1.0,
    });

    expect(shipResult.total).toBeLessThan(truckResult.total);
  });
});

// ============================================================================
// HELPERS
// ============================================================================

describe('generateLegId', () => {
  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateLegId());
    }
    expect(ids.size).toBe(100);
  });

  it('generates strings starting with "leg_"', () => {
    const id = generateLegId();
    expect(id).toMatch(/^leg_/);
  });
});
