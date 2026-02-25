import { describe, it, expect } from 'vitest';
import { calculateMaturationImpacts } from '../maturation-calculator';
import type { MaturationProfile } from '../types/maturation';
import {
  BARREL_CO2E_DEFAULTS,
  ANGEL_SHARE_DEFAULTS,
} from '../types/maturation';

// ============================================================================
// TEST DATA FACTORY
// ============================================================================

function createMockMaturationProfile(overrides: Partial<MaturationProfile> = {}): MaturationProfile {
  return {
    id: 'mat-profile-001',
    product_id: 123,
    organization_id: 'org-456',
    barrel_type: 'american_oak_200',
    barrel_volume_litres: 200,
    barrel_use_number: 1,
    barrel_co2e_new: null,
    aging_duration_months: 144, // 12 years
    angel_share_percent_per_year: 2.0,
    climate_zone: 'temperate',
    fill_volume_litres: 200,
    number_of_barrels: 5,
    warehouse_energy_kwh_per_barrel_year: 15,
    warehouse_energy_source: 'grid_electricity',
    allocation_method: 'cut_off',
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ============================================================================
// BARREL ALLOCATION TESTS
// ============================================================================

describe('calculateMaturationImpacts', () => {
  describe('Barrel Allocation (Cut-off Method)', () => {
    it('should calculate full manufacturing burden for new American oak 200L barrel', () => {
      const profile = createMockMaturationProfile({
        barrel_type: 'american_oak_200',
        barrel_use_number: 1,
        number_of_barrels: 5,
        fill_volume_litres: 200,
      });

      const result = calculateMaturationImpacts(profile);

      // 40 kg CO2e per new American oak barrel × 5 barrels = 200 kg
      expect(result.barrel_total_co2e).toBe(BARREL_CO2E_DEFAULTS['american_oak_200'] * 5);
      expect(result.barrel_total_co2e).toBe(200);

      // Per litre: 200 / (200 × 5) = 0.2
      expect(result.barrel_co2e_per_litre).toBe(0.2);
    });

    it('should calculate full manufacturing burden for new French oak 225L barrique', () => {
      const profile = createMockMaturationProfile({
        barrel_type: 'french_oak_225',
        barrel_volume_litres: 225,
        fill_volume_litres: 225,
        barrel_use_number: 1,
        number_of_barrels: 5,
      });

      const result = calculateMaturationImpacts(profile);

      // 55 kg CO2e per new French oak barrel × 5 = 275 kg
      expect(result.barrel_total_co2e).toBe(BARREL_CO2E_DEFAULTS['french_oak_225'] * 5);
      expect(result.barrel_total_co2e).toBe(275);
    });

    it('should calculate full manufacturing burden for new American oak 500L puncheon', () => {
      const profile = createMockMaturationProfile({
        barrel_type: 'american_oak_500',
        barrel_volume_litres: 500,
        fill_volume_litres: 500,
        barrel_use_number: 1,
        number_of_barrels: 5,
      });

      const result = calculateMaturationImpacts(profile);

      // 65 kg CO2e per puncheon × 5 = 325 kg
      expect(result.barrel_total_co2e).toBe(BARREL_CO2E_DEFAULTS['american_oak_500'] * 5);
      expect(result.barrel_total_co2e).toBe(325);
    });

    it('should apply near-zero reconditioning burden for reused barrel (2nd fill)', () => {
      const profile = createMockMaturationProfile({
        barrel_use_number: 2,
        number_of_barrels: 5,
      });

      const result = calculateMaturationImpacts(profile);

      // 0.5 kg CO2e reconditioning per barrel × 5 = 2.5 kg
      expect(result.barrel_total_co2e).toBe(2.5);
    });

    it('should apply near-zero reconditioning burden for reused barrel (3rd+ fill)', () => {
      const profile = createMockMaturationProfile({
        barrel_use_number: 3,
        number_of_barrels: 5,
      });

      const result = calculateMaturationImpacts(profile);

      // Same as 2nd fill: 0.5 × 5 = 2.5 kg
      expect(result.barrel_total_co2e).toBe(2.5);
    });

    it('should use custom barrel_co2e_new override when provided', () => {
      const profile = createMockMaturationProfile({
        barrel_type: 'custom',
        barrel_co2e_new: 50,
        barrel_use_number: 1,
        number_of_barrels: 5,
      });

      const result = calculateMaturationImpacts(profile);

      // 50 kg override × 5 barrels = 250 kg
      expect(result.barrel_total_co2e).toBe(250);
    });

    it('should fall back to 40 kg default when custom barrel has no override', () => {
      const profile = createMockMaturationProfile({
        barrel_type: 'custom',
        barrel_co2e_new: null,
        barrel_use_number: 1,
        number_of_barrels: 1,
      });

      const result = calculateMaturationImpacts(profile);

      // No matching default for 'custom', falls back to 40 kg
      expect(result.barrel_total_co2e).toBe(40);
    });
  });

  // ==========================================================================
  // ANGEL'S SHARE TESTS
  // ==========================================================================

  describe("Angel's Share (Compound Volume Loss)", () => {
    it('should calculate compound loss for temperate 12yr (2%/yr)', () => {
      const profile = createMockMaturationProfile({
        angel_share_percent_per_year: 2.0,
        aging_duration_months: 144, // 12 years
        fill_volume_litres: 200,
        number_of_barrels: 5,
      });

      const result = calculateMaturationImpacts(profile);
      const totalFill = 200 * 5; // 1000L

      // V_out = 1000 × (1 - 0.02)^12 = 1000 × 0.98^12 ≈ 784.72L
      const expectedRetention = Math.pow(0.98, 12);
      expect(result.volume_loss_factor).toBeCloseTo(expectedRetention, 4);
      expect(result.output_volume_litres).toBeCloseTo(totalFill * expectedRetention, 1);
      expect(result.angel_share_loss_percent_total).toBeCloseTo((1 - expectedRetention) * 100, 1);
    });

    it('should calculate compound loss for continental 12yr (5%/yr)', () => {
      const profile = createMockMaturationProfile({
        angel_share_percent_per_year: 5.0,
        climate_zone: 'continental',
        aging_duration_months: 144,
      });

      const result = calculateMaturationImpacts(profile);

      const expectedRetention = Math.pow(0.95, 12);
      expect(result.volume_loss_factor).toBeCloseTo(expectedRetention, 4);
      expect(result.angel_share_loss_percent_total).toBeCloseTo((1 - expectedRetention) * 100, 1);
    });

    it('should calculate compound loss for tropical 3yr (12%/yr)', () => {
      const profile = createMockMaturationProfile({
        angel_share_percent_per_year: 12.0,
        climate_zone: 'tropical',
        aging_duration_months: 36, // 3 years
      });

      const result = calculateMaturationImpacts(profile);

      const expectedRetention = Math.pow(0.88, 3);
      expect(result.volume_loss_factor).toBeCloseTo(expectedRetention, 4);
      expect(result.angel_share_loss_percent_total).toBeCloseTo((1 - expectedRetention) * 100, 1);
    });

    it('should have zero volume loss when angel share is 0%', () => {
      const profile = createMockMaturationProfile({
        angel_share_percent_per_year: 0,
      });

      const result = calculateMaturationImpacts(profile);

      expect(result.volume_loss_factor).toBe(1.0);
      expect(result.angel_share_loss_percent_total).toBe(0);
      expect(result.angel_share_volume_loss_litres).toBe(0);
      expect(result.angel_share_voc_kg).toBe(0);
      expect(result.angel_share_photochemical_ozone).toBe(0);
    });

    it('should handle fractional year aging (6 months)', () => {
      const profile = createMockMaturationProfile({
        aging_duration_months: 6, // 0.5 years
        angel_share_percent_per_year: 2.0,
        fill_volume_litres: 200,
        number_of_barrels: 1,
      });

      const result = calculateMaturationImpacts(profile);

      const expectedRetention = Math.pow(0.98, 0.5);
      expect(result.volume_loss_factor).toBeCloseTo(expectedRetention, 4);
      expect(result.output_volume_litres).toBeCloseTo(200 * expectedRetention, 1);
    });

    it('should correctly calculate VOC and photochemical ozone from ethanol evaporation', () => {
      const profile = createMockMaturationProfile({
        angel_share_percent_per_year: 2.0,
        aging_duration_months: 144, // 12 years
        fill_volume_litres: 200,
        number_of_barrels: 5,
      });

      const result = calculateMaturationImpacts(profile);
      const totalFill = 200 * 5;
      const volumeLoss = totalFill - result.output_volume_litres;

      // Ethanol lost: volumeLoss × 0.63 ABV × 0.789 density
      const expectedEthanolKg = volumeLoss * 0.63 * 0.789;
      expect(result.angel_share_voc_kg).toBeCloseTo(expectedEthanolKg, 1);

      // Photochemical ozone: ethanol_kg × 0.40 POCP
      expect(result.angel_share_photochemical_ozone).toBeCloseTo(expectedEthanolKg * 0.40, 1);
    });
  });

  // ==========================================================================
  // WAREHOUSE ENERGY TESTS
  // ==========================================================================

  describe('Warehouse Energy', () => {
    it('should calculate warehouse CO2e with grid electricity factor (0.207)', () => {
      const profile = createMockMaturationProfile({
        warehouse_energy_source: 'grid_electricity',
        warehouse_energy_kwh_per_barrel_year: 15,
        number_of_barrels: 5,
        aging_duration_months: 144, // 12 years
      });

      const result = calculateMaturationImpacts(profile);

      // 15 kWh × 5 barrels × 12 years × 0.490 (global avg, no country code) = 441.0 kg CO2e
      expect(result.warehouse_co2e_total).toBeCloseTo(15 * 5 * 12 * 0.490, 1);
    });

    it('should calculate warehouse CO2e with natural gas factor (0.183)', () => {
      const profile = createMockMaturationProfile({
        warehouse_energy_source: 'natural_gas',
        warehouse_energy_kwh_per_barrel_year: 15,
        number_of_barrels: 5,
        aging_duration_months: 144,
      });

      const result = calculateMaturationImpacts(profile);

      expect(result.warehouse_co2e_total).toBeCloseTo(15 * 5 * 12 * 0.183, 1);
    });

    it('should have zero warehouse CO2e with renewable energy', () => {
      const profile = createMockMaturationProfile({
        warehouse_energy_source: 'renewable',
      });

      const result = calculateMaturationImpacts(profile);

      expect(result.warehouse_co2e_total).toBe(0);
      expect(result.warehouse_co2e_per_litre).toBe(0);
    });

    it('should calculate warehouse CO2e with mixed energy factor (0.120)', () => {
      const profile = createMockMaturationProfile({
        warehouse_energy_source: 'mixed',
        warehouse_energy_kwh_per_barrel_year: 15,
        number_of_barrels: 5,
        aging_duration_months: 144,
      });

      const result = calculateMaturationImpacts(profile);

      expect(result.warehouse_co2e_total).toBeCloseTo(15 * 5 * 12 * 0.120, 1);
    });

    it('should have zero warehouse CO2e when energy is zero', () => {
      const profile = createMockMaturationProfile({
        warehouse_energy_kwh_per_barrel_year: 0,
      });

      const result = calculateMaturationImpacts(profile);

      expect(result.warehouse_co2e_total).toBe(0);
    });
  });

  // ==========================================================================
  // TOTALS & PER-LITRE OUTPUT TESTS
  // ==========================================================================

  describe('Totals & Per-Litre Output', () => {
    it('should sum barrel + warehouse for total maturation CO2e', () => {
      const profile = createMockMaturationProfile();

      const result = calculateMaturationImpacts(profile);

      expect(result.total_maturation_co2e).toBeCloseTo(
        result.barrel_total_co2e + result.warehouse_co2e_total,
        4
      );
    });

    it('should NOT include angel share VOC/NMVOC in total climate CO2e', () => {
      const profile = createMockMaturationProfile({
        angel_share_percent_per_year: 12.0, // High tropical loss
        climate_zone: 'tropical',
        aging_duration_months: 36,
      });

      const result = calculateMaturationImpacts(profile);

      // Angel's share should contribute to VOC/photochemical ozone but NOT to total_maturation_co2e
      expect(result.angel_share_voc_kg).toBeGreaterThan(0);
      expect(result.angel_share_photochemical_ozone).toBeGreaterThan(0);
      expect(result.total_maturation_co2e).toBe(
        result.barrel_total_co2e + result.warehouse_co2e_total
      );
    });

    it('should calculate per-litre output based on output volume (after angel share)', () => {
      const profile = createMockMaturationProfile();

      const result = calculateMaturationImpacts(profile);

      expect(result.total_maturation_co2e_per_litre_output).toBeCloseTo(
        result.total_maturation_co2e / result.output_volume_litres,
        4
      );
    });

    it('should include methodology notes with barrel type, duration, and climate zone', () => {
      const profile = createMockMaturationProfile({
        barrel_type: 'french_oak_225',
        aging_duration_months: 36,
        climate_zone: 'continental',
      });

      const result = calculateMaturationImpacts(profile);

      expect(result.methodology_notes).toContain('french_oak_225');
      expect(result.methodology_notes).toContain('36 months');
      expect(result.methodology_notes).toContain('continental');
      expect(result.methodology_notes).toContain('Cut-off allocation');
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle single barrel with 1 month aging', () => {
      const profile = createMockMaturationProfile({
        number_of_barrels: 1,
        fill_volume_litres: 200,
        aging_duration_months: 1,
        angel_share_percent_per_year: 2.0,
      });

      const result = calculateMaturationImpacts(profile);

      // 1 month = 1/12 year
      const expectedRetention = Math.pow(0.98, 1 / 12);
      expect(result.volume_loss_factor).toBeCloseTo(expectedRetention, 4);
      expect(result.output_volume_litres).toBeCloseTo(200 * expectedRetention, 2);

      // Barrel CO2e for 1 barrel
      expect(result.barrel_total_co2e).toBe(40);
    });

    it('should scale linearly for many barrels', () => {
      const singleBarrel = createMockMaturationProfile({ number_of_barrels: 1 });
      const manyBarrels = createMockMaturationProfile({ number_of_barrels: 1000 });

      const resultSingle = calculateMaturationImpacts(singleBarrel);
      const resultMany = calculateMaturationImpacts(manyBarrels);

      // Barrel CO2e scales linearly
      expect(resultMany.barrel_total_co2e).toBeCloseTo(resultSingle.barrel_total_co2e * 1000, 1);

      // Warehouse CO2e scales linearly
      expect(resultMany.warehouse_co2e_total).toBeCloseTo(resultSingle.warehouse_co2e_total * 1000, 1);

      // Volume loss factor (percentage) stays the same
      expect(resultMany.volume_loss_factor).toBeCloseTo(resultSingle.volume_loss_factor, 6);
    });

    it('should handle maximum angel share (25%/yr for 12 years)', () => {
      const profile = createMockMaturationProfile({
        angel_share_percent_per_year: 25.0,
        aging_duration_months: 144,
      });

      const result = calculateMaturationImpacts(profile);

      // (1 - 0.25)^12 = 0.75^12 ≈ 0.0317 — very high loss
      const expectedRetention = Math.pow(0.75, 12);
      expect(result.volume_loss_factor).toBeCloseTo(expectedRetention, 4);
      expect(result.angel_share_loss_percent_total).toBeGreaterThan(95);
      expect(result.output_volume_litres).toBeGreaterThan(0);
    });

    it('should return correct per-litre values for different fill volumes', () => {
      const halfFill = createMockMaturationProfile({
        barrel_volume_litres: 200,
        fill_volume_litres: 100, // Half-filled barrels
        number_of_barrels: 5,
      });

      const fullFill = createMockMaturationProfile({
        barrel_volume_litres: 200,
        fill_volume_litres: 200,
        number_of_barrels: 5,
      });

      const resultHalf = calculateMaturationImpacts(halfFill);
      const resultFull = calculateMaturationImpacts(fullFill);

      // Same barrel count → same barrel total CO2e
      expect(resultHalf.barrel_total_co2e).toBe(resultFull.barrel_total_co2e);

      // But per-litre is higher for half-fill (less volume to amortize over)
      expect(resultHalf.barrel_co2e_per_litre).toBeGreaterThan(resultFull.barrel_co2e_per_litre);
    });
  });

  // ==========================================================================
  // CONSTANT VALIDATION TESTS
  // ==========================================================================

  describe('Constant Validation', () => {
    it('should have correct angel share defaults per climate zone', () => {
      expect(ANGEL_SHARE_DEFAULTS.temperate).toBe(2.0);
      expect(ANGEL_SHARE_DEFAULTS.continental).toBe(5.0);
      expect(ANGEL_SHARE_DEFAULTS.tropical).toBe(12.0);
    });

    it('should have correct barrel CO2e defaults', () => {
      expect(BARREL_CO2E_DEFAULTS['american_oak_200']).toBe(40);
      expect(BARREL_CO2E_DEFAULTS['french_oak_225']).toBe(55);
      expect(BARREL_CO2E_DEFAULTS['american_oak_500']).toBe(65);
    });
  });
});
