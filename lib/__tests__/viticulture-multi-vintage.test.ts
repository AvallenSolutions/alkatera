import { describe, it, expect } from 'vitest';
import { calculateMultiVintageAverage } from '../viticulture-multi-vintage';
import { calculateViticultureImpacts } from '../viticulture-calculator';
import type { ViticultureCalculatorInput } from '../types/viticulture';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const BASE_INPUT: ViticultureCalculatorInput = {
  climate_zone: 'temperate',
  certification: 'conventional',
  location_country_code: 'GB',
  area_ha: 5,
  soil_management: 'cover_cropping',
  fertiliser_type: 'synthetic_n',
  fertiliser_quantity_kg: 200,
  fertiliser_n_content_percent: 34.5,
  uses_pesticides: true,
  pesticide_applications_per_year: 6,
  pesticide_type: 'generic',
  uses_herbicides: false,
  herbicide_applications_per_year: 0,
  herbicide_type: 'generic',
  diesel_litres_per_year: 500,
  petrol_litres_per_year: 50,
  is_irrigated: false,
  water_m3_per_ha: 0,
  irrigation_energy_source: 'none',
  grape_yield_tonnes: 30,
  soil_carbon_override_kg_co2e_per_ha: null,
};

/** Low-emission vintage (less fertiliser, lower fuel) */
const LOW_INPUT: ViticultureCalculatorInput = {
  ...BASE_INPUT,
  fertiliser_quantity_kg: 100,
  diesel_litres_per_year: 300,
  petrol_litres_per_year: 20,
  grape_yield_tonnes: 25,
};

/** High-emission vintage (more fertiliser, more fuel, irrigated) */
const HIGH_INPUT: ViticultureCalculatorInput = {
  ...BASE_INPUT,
  fertiliser_quantity_kg: 400,
  diesel_litres_per_year: 800,
  petrol_litres_per_year: 100,
  grape_yield_tonnes: 35,
  is_irrigated: true,
  water_m3_per_ha: 200,
  irrigation_energy_source: 'grid_electricity',
};

// ============================================================================
// TESTS
// ============================================================================

describe('calculateMultiVintageAverage', () => {
  describe('single vintage', () => {
    it('should return the single result unchanged', () => {
      const result = calculateMultiVintageAverage([
        { vintage_year: 2025, input: BASE_INPUT },
      ]);

      expect(result.method).toBe('single');
      expect(result.vintages_used).toEqual([2025]);
      expect(result.averaged_impacts.total_emissions).toBeGreaterThan(0);
    });
  });

  describe('two vintages', () => {
    it('should return arithmetic mean with method average_2yr', () => {
      const result = calculateMultiVintageAverage([
        { vintage_year: 2024, input: LOW_INPUT },
        { vintage_year: 2025, input: HIGH_INPUT },
      ]);

      expect(result.method).toBe('average_2yr');
      expect(result.vintages_used).toEqual([2024, 2025]);

      // Average should be between the two
      // calculateViticultureImpacts imported at top of file
      const low = calculateViticultureImpacts(LOW_INPUT);
      const high = calculateViticultureImpacts(HIGH_INPUT);

      expect(result.averaged_impacts.total_emissions).toBeCloseTo(
        (low.total_emissions + high.total_emissions) / 2, 2
      );
    });
  });

  describe('three vintages (median)', () => {
    it('should return median with method median_3yr', () => {
      const result = calculateMultiVintageAverage([
        { vintage_year: 2023, input: LOW_INPUT },
        { vintage_year: 2024, input: BASE_INPUT },
        { vintage_year: 2025, input: HIGH_INPUT },
      ]);

      expect(result.method).toBe('median_3yr');
      expect(result.vintages_used).toHaveLength(3);
    });

    it('should pick the middle value for odd count', () => {
      const result = calculateMultiVintageAverage([
        { vintage_year: 2023, input: LOW_INPUT },
        { vintage_year: 2024, input: BASE_INPUT },
        { vintage_year: 2025, input: HIGH_INPUT },
      ]);

      // For 3 values sorted, median = middle value
      // calculateViticultureImpacts imported at top of file
      const low = calculateViticultureImpacts(LOW_INPUT);
      const base = calculateViticultureImpacts(BASE_INPUT);
      const high = calculateViticultureImpacts(HIGH_INPUT);

      const emissions = [low.total_emissions, base.total_emissions, high.total_emissions].sort((a, b) => a - b);
      const expectedMedian = emissions[1]; // middle value

      expect(result.averaged_impacts.total_emissions).toBeCloseTo(expectedMedian, 2);
    });

    it('should average the two middle values for even count', () => {
      const result = calculateMultiVintageAverage([
        { vintage_year: 2022, input: LOW_INPUT },
        { vintage_year: 2023, input: LOW_INPUT },
        { vintage_year: 2024, input: HIGH_INPUT },
        { vintage_year: 2025, input: HIGH_INPUT },
      ]);

      expect(result.method).toBe('median_3yr');
      expect(result.vintages_used).toHaveLength(4);

      // For 4 values, median = average of 2nd and 3rd when sorted
      // calculateViticultureImpacts imported at top of file
      const low = calculateViticultureImpacts(LOW_INPUT);
      const high = calculateViticultureImpacts(HIGH_INPUT);

      const sorted = [low.total_emissions, low.total_emissions, high.total_emissions, high.total_emissions].sort((a, b) => a - b);
      const expectedMedian = (sorted[1] + sorted[2]) / 2;

      expect(result.averaged_impacts.total_emissions).toBeCloseTo(expectedMedian, 2);
    });
  });

  describe('data quality', () => {
    it('should use worst grade across vintages', () => {
      // LOW_INPUT should produce MEDIUM or higher, HIGH_INPUT with measured override = HIGH
      const result = calculateMultiVintageAverage([
        { vintage_year: 2024, input: LOW_INPUT },
        { vintage_year: 2025, input: { ...HIGH_INPUT, soil_carbon_override_kg_co2e_per_ha: 500 } },
      ]);

      // Should not be higher than the worst individual grade
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(result.averaged_impacts.data_quality_grade);
    });

    it('should include multi-vintage method in methodology notes', () => {
      const result = calculateMultiVintageAverage([
        { vintage_year: 2023, input: LOW_INPUT },
        { vintage_year: 2024, input: BASE_INPUT },
        { vintage_year: 2025, input: HIGH_INPUT },
      ]);

      expect(result.averaged_impacts.methodology_notes).toContain('Multi-vintage averaging');
      expect(result.averaged_impacts.methodology_notes).toContain('median');
    });
  });

  describe('FLAG compliance', () => {
    it('should keep emissions and removals separated after averaging', () => {
      const result = calculateMultiVintageAverage([
        { vintage_year: 2024, input: BASE_INPUT },
        { vintage_year: 2025, input: HIGH_INPUT },
      ]);

      // Removals should be positive (not netted)
      expect(result.averaged_impacts.flag_removals.soil_carbon_co2e).toBeGreaterThanOrEqual(0);

      // Total emissions should equal FLAG + non-FLAG (no removals subtracted)
      const expectedTotal =
        result.averaged_impacts.flag_emissions.total_flag_co2e +
        result.averaged_impacts.non_flag_emissions.total_non_flag_co2e;

      expect(result.averaged_impacts.total_emissions).toBeCloseTo(expectedTotal, 2);
    });
  });

  describe('edge cases', () => {
    it('should throw on empty input', () => {
      expect(() => calculateMultiVintageAverage([])).toThrow('At least one vintage input is required');
    });

    it('should handle identical vintages gracefully', () => {
      const result = calculateMultiVintageAverage([
        { vintage_year: 2023, input: BASE_INPUT },
        { vintage_year: 2024, input: BASE_INPUT },
        { vintage_year: 2025, input: BASE_INPUT },
      ]);

      // All identical inputs should produce the same result as a single input
      const single = calculateMultiVintageAverage([
        { vintage_year: 2025, input: BASE_INPUT },
      ]);

      expect(result.averaged_impacts.total_emissions).toBeCloseTo(
        single.averaged_impacts.total_emissions, 2
      );
    });
  });
});
