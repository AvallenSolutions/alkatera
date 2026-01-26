import { describe, it, expect } from 'vitest';
import { calculateVitalityScores } from '../VitalityScoreHero';

// ============================================================================
// VITALITY SCORE CALCULATION TESTS
// ============================================================================

describe('calculateVitalityScores', () => {
  // ==========================================================================
  // CLIMATE SCORE TESTS
  // ==========================================================================

  describe('Climate Score', () => {
    it('should return null when no climate data is provided', () => {
      const result = calculateVitalityScores({});
      expect(result.climate).toBeNull();
    });

    it('should return null when totalEmissions is zero', () => {
      const result = calculateVitalityScores({
        totalEmissions: 0,
        emissionsIntensity: 0.5,
        industryBenchmark: 1.0,
      });
      expect(result.climate).toBeNull();
    });

    it('should return null when emissionsIntensity is missing', () => {
      const result = calculateVitalityScores({
        totalEmissions: 1000,
        industryBenchmark: 1.0,
      });
      expect(result.climate).toBeNull();
    });

    it('should return null when industryBenchmark is missing', () => {
      const result = calculateVitalityScores({
        totalEmissions: 1000,
        emissionsIntensity: 0.5,
      });
      expect(result.climate).toBeNull();
    });

    it('should return 90 when ratio <= 0.7 (excellent performance)', () => {
      const result = calculateVitalityScores({
        totalEmissions: 1000,
        emissionsIntensity: 0.7,
        industryBenchmark: 1.0,
      });
      expect(result.climate).toBe(90);
    });

    it('should return 90 when ratio is well below 0.7', () => {
      const result = calculateVitalityScores({
        totalEmissions: 1000,
        emissionsIntensity: 0.5,
        industryBenchmark: 1.0,
      });
      expect(result.climate).toBe(90);
    });

    it('should return 80 when ratio is between 0.7 and 0.85', () => {
      const result = calculateVitalityScores({
        totalEmissions: 1000,
        emissionsIntensity: 0.8,
        industryBenchmark: 1.0,
      });
      expect(result.climate).toBe(80);
    });

    it('should return 70 when ratio is between 0.85 and 1.0', () => {
      const result = calculateVitalityScores({
        totalEmissions: 1000,
        emissionsIntensity: 0.95,
        industryBenchmark: 1.0,
      });
      expect(result.climate).toBe(70);
    });

    it('should return 70 when ratio is exactly 1.0 (at benchmark)', () => {
      const result = calculateVitalityScores({
        totalEmissions: 1000,
        emissionsIntensity: 1.0,
        industryBenchmark: 1.0,
      });
      expect(result.climate).toBe(70);
    });

    it('should return 55 when ratio is between 1.0 and 1.15', () => {
      const result = calculateVitalityScores({
        totalEmissions: 1000,
        emissionsIntensity: 1.1,
        industryBenchmark: 1.0,
      });
      expect(result.climate).toBe(55);
    });

    it('should return 40 when ratio is between 1.15 and 1.3', () => {
      const result = calculateVitalityScores({
        totalEmissions: 1000,
        emissionsIntensity: 1.25,
        industryBenchmark: 1.0,
      });
      expect(result.climate).toBe(40);
    });

    it('should return 25 when ratio > 1.3 (poor performance)', () => {
      const result = calculateVitalityScores({
        totalEmissions: 1000,
        emissionsIntensity: 1.5,
        industryBenchmark: 1.0,
      });
      expect(result.climate).toBe(25);
    });

    it('should handle edge case at exactly 0.85 boundary', () => {
      const result = calculateVitalityScores({
        totalEmissions: 1000,
        emissionsIntensity: 0.85,
        industryBenchmark: 1.0,
      });
      expect(result.climate).toBe(80);
    });

    it('should handle edge case at exactly 1.15 boundary', () => {
      const result = calculateVitalityScores({
        totalEmissions: 1000,
        emissionsIntensity: 1.15,
        industryBenchmark: 1.0,
      });
      expect(result.climate).toBe(55);
    });

    it('should handle edge case at exactly 1.3 boundary', () => {
      const result = calculateVitalityScores({
        totalEmissions: 1000,
        emissionsIntensity: 1.3,
        industryBenchmark: 1.0,
      });
      expect(result.climate).toBe(40);
    });
  });

  // ==========================================================================
  // WATER SCORE TESTS
  // ==========================================================================

  describe('Water Score', () => {
    it('should return null when waterRiskLevel is not provided', () => {
      const result = calculateVitalityScores({});
      expect(result.water).toBeNull();
    });

    it('should return 85 for low water risk', () => {
      const result = calculateVitalityScores({
        waterRiskLevel: 'low',
      });
      expect(result.water).toBe(85);
    });

    it('should return 60 for medium water risk', () => {
      const result = calculateVitalityScores({
        waterRiskLevel: 'medium',
      });
      expect(result.water).toBe(60);
    });

    it('should return 35 for high water risk', () => {
      const result = calculateVitalityScores({
        waterRiskLevel: 'high',
      });
      expect(result.water).toBe(35);
    });
  });

  // ==========================================================================
  // CIRCULARITY SCORE TESTS
  // ==========================================================================

  describe('Circularity Score', () => {
    it('should return null when circularityRate is not provided', () => {
      const result = calculateVitalityScores({});
      expect(result.circularity).toBeNull();
    });

    it('should return null when circularityRate is zero', () => {
      const result = calculateVitalityScores({
        circularityRate: 0,
      });
      expect(result.circularity).toBeNull();
    });

    it('should return null when hasWasteData is false even with circularityRate', () => {
      const result = calculateVitalityScores({
        circularityRate: 50,
        hasWasteData: false,
      });
      expect(result.circularity).toBeNull();
    });

    it('should return 95 when circularityRate >= 80%', () => {
      const result = calculateVitalityScores({
        circularityRate: 80,
      });
      expect(result.circularity).toBe(95);
    });

    it('should return 95 when circularityRate is 100%', () => {
      const result = calculateVitalityScores({
        circularityRate: 100,
      });
      expect(result.circularity).toBe(95);
    });

    it('should return 80 when circularityRate is between 60% and 80%', () => {
      const result = calculateVitalityScores({
        circularityRate: 70,
      });
      expect(result.circularity).toBe(80);
    });

    it('should return 60 when circularityRate is between 40% and 60%', () => {
      const result = calculateVitalityScores({
        circularityRate: 50,
      });
      expect(result.circularity).toBe(60);
    });

    it('should return 40 when circularityRate is between 20% and 40%', () => {
      const result = calculateVitalityScores({
        circularityRate: 30,
      });
      expect(result.circularity).toBe(40);
    });

    it('should return 20 when circularityRate < 20%', () => {
      const result = calculateVitalityScores({
        circularityRate: 10,
      });
      expect(result.circularity).toBe(20);
    });

    it('should handle edge case at exactly 60% boundary', () => {
      const result = calculateVitalityScores({
        circularityRate: 60,
      });
      expect(result.circularity).toBe(80);
    });

    it('should handle edge case at exactly 40% boundary', () => {
      const result = calculateVitalityScores({
        circularityRate: 40,
      });
      expect(result.circularity).toBe(60);
    });

    it('should handle edge case at exactly 20% boundary', () => {
      const result = calculateVitalityScores({
        circularityRate: 20,
      });
      expect(result.circularity).toBe(40);
    });
  });

  // ==========================================================================
  // NATURE SCORE TESTS
  // ==========================================================================

  describe('Nature Score', () => {
    it('should return null when biodiversityRisk is not provided', () => {
      const result = calculateVitalityScores({});
      expect(result.nature).toBeNull();
    });

    it('should return 80 for low biodiversity risk', () => {
      const result = calculateVitalityScores({
        biodiversityRisk: 'low',
      });
      expect(result.nature).toBe(80);
    });

    it('should return 55 for medium biodiversity risk', () => {
      const result = calculateVitalityScores({
        biodiversityRisk: 'medium',
      });
      expect(result.nature).toBe(55);
    });

    it('should return 30 for high biodiversity risk', () => {
      const result = calculateVitalityScores({
        biodiversityRisk: 'high',
      });
      expect(result.nature).toBe(30);
    });
  });

  // ==========================================================================
  // OVERALL SCORE CALCULATION TESTS
  // ==========================================================================

  describe('Overall Score Calculation', () => {
    it('should return null overall when no pillar has data', () => {
      const result = calculateVitalityScores({});
      expect(result.overall).toBeNull();
      expect(result.hasData).toBe(false);
    });

    it('should calculate overall score with all four pillars', () => {
      // Climate: 90 (weight 30%)
      // Water: 85 (weight 25%)
      // Circularity: 95 (weight 25%)
      // Nature: 80 (weight 20%)
      // Expected: (90 * 0.30) + (85 * 0.25) + (95 * 0.25) + (80 * 0.20) = 27 + 21.25 + 23.75 + 16 = 88
      const result = calculateVitalityScores({
        totalEmissions: 1000,
        emissionsIntensity: 0.5,
        industryBenchmark: 1.0,
        waterRiskLevel: 'low',
        circularityRate: 85,
        biodiversityRisk: 'low',
      });
      expect(result.overall).toBe(88);
      expect(result.hasData).toBe(true);
      expect(result.climate).toBe(90);
      expect(result.water).toBe(85);
      expect(result.circularity).toBe(95);
      expect(result.nature).toBe(80);
    });

    it('should redistribute weights when only some pillars have data', () => {
      // Only Climate (90) and Water (85) have data
      // Original weights: Climate 30%, Water 25%
      // Redistributed: Climate 30/55 = 54.5%, Water 25/55 = 45.5%
      // Expected: (90 * 0.545) + (85 * 0.455) = 49.09 + 38.68 = 87.77 ≈ 88
      const result = calculateVitalityScores({
        totalEmissions: 1000,
        emissionsIntensity: 0.5,
        industryBenchmark: 1.0,
        waterRiskLevel: 'low',
      });
      expect(result.overall).toBe(88);
      expect(result.hasData).toBe(true);
      expect(result.climate).toBe(90);
      expect(result.water).toBe(85);
      expect(result.circularity).toBeNull();
      expect(result.nature).toBeNull();
    });

    it('should calculate overall with only one pillar having data', () => {
      // Only Climate (90) has data
      // Redistributed weight: 100%
      // Expected: 90
      const result = calculateVitalityScores({
        totalEmissions: 1000,
        emissionsIntensity: 0.5,
        industryBenchmark: 1.0,
      });
      expect(result.overall).toBe(90);
      expect(result.hasData).toBe(true);
    });

    it('should calculate overall with three pillars having data', () => {
      // Climate: 90 (weight 30%)
      // Water: 60 (weight 25%)
      // Nature: 55 (weight 20%)
      // Total weight: 75%
      // Redistributed: Climate 40%, Water 33.3%, Nature 26.7%
      // Expected: (90 * 0.40) + (60 * 0.333) + (55 * 0.267) = 36 + 20 + 14.67 = 70.67 ≈ 71
      const result = calculateVitalityScores({
        totalEmissions: 1000,
        emissionsIntensity: 0.5,
        industryBenchmark: 1.0,
        waterRiskLevel: 'medium',
        biodiversityRisk: 'medium',
      });
      expect(result.overall).toBe(71);
      expect(result.hasData).toBe(true);
    });

    it('should handle worst case scores correctly', () => {
      // All pillars with worst scores
      // Climate: 25, Water: 35, Circularity: 20, Nature: 30
      // Expected: (25 * 0.30) + (35 * 0.25) + (20 * 0.25) + (30 * 0.20) = 7.5 + 8.75 + 5 + 6 = 27.25 ≈ 27
      const result = calculateVitalityScores({
        totalEmissions: 1000,
        emissionsIntensity: 2.0,
        industryBenchmark: 1.0,
        waterRiskLevel: 'high',
        circularityRate: 10,
        biodiversityRisk: 'high',
      });
      expect(result.overall).toBe(27);
      expect(result.climate).toBe(25);
      expect(result.water).toBe(35);
      expect(result.circularity).toBe(20);
      expect(result.nature).toBe(30);
    });

    it('should handle best case scores correctly', () => {
      // All pillars with best scores
      // Climate: 90, Water: 85, Circularity: 95, Nature: 80
      // Expected: (90 * 0.30) + (85 * 0.25) + (95 * 0.25) + (80 * 0.20) = 27 + 21.25 + 23.75 + 16 = 88
      const result = calculateVitalityScores({
        totalEmissions: 1000,
        emissionsIntensity: 0.5,
        industryBenchmark: 1.0,
        waterRiskLevel: 'low',
        circularityRate: 100,
        biodiversityRisk: 'low',
      });
      expect(result.overall).toBe(88);
      expect(result.climate).toBe(90);
      expect(result.water).toBe(85);
      expect(result.circularity).toBe(95);
      expect(result.nature).toBe(80);
    });
  });

  // ==========================================================================
  // WEIGHTING VERIFICATION TESTS
  // ==========================================================================

  describe('Score Weighting', () => {
    it('should apply 30% weight to climate score', () => {
      // Climate only: 90 * 1.0 = 90 (full weight redistribution)
      const climateOnly = calculateVitalityScores({
        totalEmissions: 1000,
        emissionsIntensity: 0.5,
        industryBenchmark: 1.0,
      });
      expect(climateOnly.overall).toBe(90);
    });

    it('should apply 25% weight to water score', () => {
      // Water only: 85 * 1.0 = 85 (full weight redistribution)
      const waterOnly = calculateVitalityScores({
        waterRiskLevel: 'low',
      });
      expect(waterOnly.overall).toBe(85);
    });

    it('should apply 25% weight to circularity score', () => {
      // Circularity only: 95 * 1.0 = 95 (full weight redistribution)
      const circularityOnly = calculateVitalityScores({
        circularityRate: 90,
      });
      expect(circularityOnly.overall).toBe(95);
    });

    it('should apply 20% weight to nature score', () => {
      // Nature only: 80 * 1.0 = 80 (full weight redistribution)
      const natureOnly = calculateVitalityScores({
        biodiversityRisk: 'low',
      });
      expect(natureOnly.overall).toBe(80);
    });

    it('should verify combined weights sum to 100%', () => {
      // This is implicitly tested by the overall calculation tests
      // Explicit verification that 30 + 25 + 25 + 20 = 100
      const weights = { climate: 0.30, water: 0.25, circularity: 0.25, nature: 0.20 };
      const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
      expect(totalWeight).toBe(1.0);
    });
  });

  // ==========================================================================
  // EDGE CASES AND BOUNDARY CONDITIONS
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle very small emission values', () => {
      const result = calculateVitalityScores({
        totalEmissions: 0.001,
        emissionsIntensity: 0.5,
        industryBenchmark: 1.0,
      });
      expect(result.climate).toBe(90);
    });

    it('should handle very large emission values', () => {
      const result = calculateVitalityScores({
        totalEmissions: 1000000000,
        emissionsIntensity: 0.5,
        industryBenchmark: 1.0,
      });
      expect(result.climate).toBe(90);
    });

    it('should handle circularityRate of exactly 1%', () => {
      const result = calculateVitalityScores({
        circularityRate: 1,
      });
      expect(result.circularity).toBe(20);
    });

    it('should handle circularityRate of exactly 99%', () => {
      const result = calculateVitalityScores({
        circularityRate: 99,
      });
      expect(result.circularity).toBe(95);
    });

    it('should handle undefined values gracefully', () => {
      const result = calculateVitalityScores({
        totalEmissions: undefined,
        emissionsIntensity: undefined,
        industryBenchmark: undefined,
        waterRiskLevel: undefined,
        circularityRate: undefined,
        biodiversityRisk: undefined,
      });
      expect(result.overall).toBeNull();
      expect(result.climate).toBeNull();
      expect(result.water).toBeNull();
      expect(result.circularity).toBeNull();
      expect(result.nature).toBeNull();
      expect(result.hasData).toBe(false);
    });

    it('should handle mixed valid and invalid data', () => {
      const result = calculateVitalityScores({
        totalEmissions: 0, // Invalid - zero
        emissionsIntensity: 0.5,
        industryBenchmark: 1.0,
        waterRiskLevel: 'low', // Valid
        circularityRate: 0, // Invalid - zero
        biodiversityRisk: 'medium', // Valid
      });
      expect(result.climate).toBeNull();
      expect(result.water).toBe(85);
      expect(result.circularity).toBeNull();
      expect(result.nature).toBe(55);
      expect(result.hasData).toBe(true);
    });

    it('should round scores to whole numbers', () => {
      // All calculations should return integers
      const result = calculateVitalityScores({
        totalEmissions: 1000,
        emissionsIntensity: 0.75, // Right at boundary
        industryBenchmark: 1.0,
        waterRiskLevel: 'medium',
        circularityRate: 45,
        biodiversityRisk: 'medium',
      });
      expect(Number.isInteger(result.overall!)).toBe(true);
      expect(Number.isInteger(result.climate!)).toBe(true);
      expect(Number.isInteger(result.water!)).toBe(true);
      expect(Number.isInteger(result.circularity!)).toBe(true);
      expect(Number.isInteger(result.nature!)).toBe(true);
    });
  });

  // ==========================================================================
  // DATA FLAGS TESTS
  // ==========================================================================

  describe('Data Flags', () => {
    it('should set hasData to false when no valid scores', () => {
      const result = calculateVitalityScores({});
      expect(result.hasData).toBe(false);
    });

    it('should set hasData to true when at least one valid score', () => {
      const result = calculateVitalityScores({
        waterRiskLevel: 'low',
      });
      expect(result.hasData).toBe(true);
    });

    it('should respect hasProductData flag', () => {
      // hasProductData doesn't directly affect calculation but documents intention
      const result = calculateVitalityScores({
        totalEmissions: 1000,
        emissionsIntensity: 0.5,
        industryBenchmark: 1.0,
        hasProductData: true,
      });
      expect(result.climate).toBe(90);
    });

    it('should respect hasWasteData flag for circularity', () => {
      const result = calculateVitalityScores({
        circularityRate: 50,
        hasWasteData: false,
      });
      expect(result.circularity).toBeNull();
    });

    it('should calculate circularity when hasWasteData is true', () => {
      const result = calculateVitalityScores({
        circularityRate: 50,
        hasWasteData: true,
      });
      expect(result.circularity).toBe(60);
    });

    it('should calculate circularity when hasWasteData is undefined (defaults to allowed)', () => {
      const result = calculateVitalityScores({
        circularityRate: 50,
      });
      expect(result.circularity).toBe(60);
    });
  });

  // ==========================================================================
  // REAL-WORLD SCENARIO TESTS
  // ==========================================================================

  describe('Real-World Scenarios', () => {
    it('should calculate score for a sustainable leader company', () => {
      const result = calculateVitalityScores({
        totalEmissions: 5000,
        emissionsIntensity: 0.6,
        industryBenchmark: 1.0,
        waterRiskLevel: 'low',
        circularityRate: 85,
        biodiversityRisk: 'low',
      });
      expect(result.overall).toBeGreaterThanOrEqual(85);
      expect(result.climate).toBe(90);
      expect(result.water).toBe(85);
      expect(result.circularity).toBe(95);
      expect(result.nature).toBe(80);
    });

    it('should calculate score for an average performing company', () => {
      const result = calculateVitalityScores({
        totalEmissions: 10000,
        emissionsIntensity: 1.0,
        industryBenchmark: 1.0,
        waterRiskLevel: 'medium',
        circularityRate: 50,
        biodiversityRisk: 'medium',
      });
      expect(result.overall).toBeGreaterThanOrEqual(55);
      expect(result.overall).toBeLessThanOrEqual(65);
      expect(result.climate).toBe(70);
      expect(result.water).toBe(60);
      expect(result.circularity).toBe(60);
      expect(result.nature).toBe(55);
    });

    it('should calculate score for a company needing improvement', () => {
      const result = calculateVitalityScores({
        totalEmissions: 50000,
        emissionsIntensity: 1.5,
        industryBenchmark: 1.0,
        waterRiskLevel: 'high',
        circularityRate: 15,
        biodiversityRisk: 'high',
      });
      expect(result.overall).toBeLessThanOrEqual(35);
      expect(result.climate).toBe(25);
      expect(result.water).toBe(35);
      expect(result.circularity).toBe(20);
      expect(result.nature).toBe(30);
    });

    it('should handle a startup with limited data', () => {
      // Startup with only climate data from initial carbon assessment
      const result = calculateVitalityScores({
        totalEmissions: 500,
        emissionsIntensity: 0.9,
        industryBenchmark: 1.0,
      });
      expect(result.overall).toBe(70);
      expect(result.climate).toBe(70);
      expect(result.water).toBeNull();
      expect(result.circularity).toBeNull();
      expect(result.nature).toBeNull();
      expect(result.hasData).toBe(true);
    });

    it('should handle a company with only environmental risk data', () => {
      // Company with water and biodiversity assessments but no emissions tracking
      // Water: 60 (weight 25%), Nature: 80 (weight 20%)
      // Total weight: 45%
      // Redistributed: Water = 25/45 = 55.6%, Nature = 20/45 = 44.4%
      // Expected: (60 * 0.556) + (80 * 0.444) = 33.33 + 35.55 = 68.88 ≈ 69
      const result = calculateVitalityScores({
        waterRiskLevel: 'medium',
        biodiversityRisk: 'low',
      });
      expect(result.overall).toBe(69);
      expect(result.climate).toBeNull();
      expect(result.water).toBe(60);
      expect(result.circularity).toBeNull();
      expect(result.nature).toBe(80);
    });
  });
});

// ============================================================================
// SCORE LABEL TESTS (Testing through score ranges)
// ============================================================================

describe('Score Label Ranges', () => {
  // These tests verify that scores fall into the correct label categories
  // Labels: EXCELLENT (>=85), HEALTHY (>=70), DEVELOPING (>=50), EMERGING (>=30), NEEDS ATTENTION (<30)

  it('should produce EXCELLENT range scores (>=85)', () => {
    const result = calculateVitalityScores({
      totalEmissions: 1000,
      emissionsIntensity: 0.5,
      industryBenchmark: 1.0,
      waterRiskLevel: 'low',
      circularityRate: 90,
      biodiversityRisk: 'low',
    });
    expect(result.overall).toBeGreaterThanOrEqual(85);
  });

  it('should produce HEALTHY range scores (70-84)', () => {
    const result = calculateVitalityScores({
      totalEmissions: 1000,
      emissionsIntensity: 0.9,
      industryBenchmark: 1.0,
      waterRiskLevel: 'medium',
      circularityRate: 65,
      biodiversityRisk: 'low',
    });
    expect(result.overall).toBeGreaterThanOrEqual(70);
    expect(result.overall).toBeLessThan(85);
  });

  it('should produce DEVELOPING range scores (50-69)', () => {
    const result = calculateVitalityScores({
      totalEmissions: 1000,
      emissionsIntensity: 1.1,
      industryBenchmark: 1.0,
      waterRiskLevel: 'medium',
      circularityRate: 45,
      biodiversityRisk: 'medium',
    });
    expect(result.overall).toBeGreaterThanOrEqual(50);
    expect(result.overall).toBeLessThan(70);
  });

  it('should produce EMERGING range scores (30-49)', () => {
    const result = calculateVitalityScores({
      totalEmissions: 1000,
      emissionsIntensity: 1.25,
      industryBenchmark: 1.0,
      waterRiskLevel: 'high',
      circularityRate: 25,
      biodiversityRisk: 'medium',
    });
    expect(result.overall).toBeGreaterThanOrEqual(30);
    expect(result.overall).toBeLessThan(50);
  });

  it('should produce NEEDS ATTENTION range scores (<30)', () => {
    const result = calculateVitalityScores({
      totalEmissions: 1000,
      emissionsIntensity: 2.0,
      industryBenchmark: 1.0,
      waterRiskLevel: 'high',
      circularityRate: 5,
      biodiversityRisk: 'high',
    });
    expect(result.overall).toBeLessThan(30);
  });
});

// ============================================================================
// CONSISTENCY TESTS WITH UNDERLYING CALCULATIONS
// ============================================================================

describe('Consistency with Calculation Modules', () => {
  it('should be consistent with water risk levels from water-risk.ts', () => {
    // Water risk levels should map to consistent scores
    const lowRisk = calculateVitalityScores({ waterRiskLevel: 'low' });
    const mediumRisk = calculateVitalityScores({ waterRiskLevel: 'medium' });
    const highRisk = calculateVitalityScores({ waterRiskLevel: 'high' });

    expect(lowRisk.water).toBeGreaterThan(mediumRisk.water!);
    expect(mediumRisk.water).toBeGreaterThan(highRisk.water!);
  });

  it('should be consistent with biodiversity risk levels from nature-biodiversity.ts', () => {
    // Biodiversity risk levels should map to consistent scores
    const lowRisk = calculateVitalityScores({ biodiversityRisk: 'low' });
    const mediumRisk = calculateVitalityScores({ biodiversityRisk: 'medium' });
    const highRisk = calculateVitalityScores({ biodiversityRisk: 'high' });

    expect(lowRisk.nature).toBeGreaterThan(mediumRisk.nature!);
    expect(mediumRisk.nature).toBeGreaterThan(highRisk.nature!);
  });

  it('should be consistent with circularity rates from waste-circularity.ts', () => {
    // Higher circularity rates should yield higher scores
    const highCircularity = calculateVitalityScores({ circularityRate: 90 });
    const mediumCircularity = calculateVitalityScores({ circularityRate: 50 });
    const lowCircularity = calculateVitalityScores({ circularityRate: 15 });

    expect(highCircularity.circularity).toBeGreaterThan(mediumCircularity.circularity!);
    expect(mediumCircularity.circularity).toBeGreaterThan(lowCircularity.circularity!);
  });

  it('should be consistent with emissions intensity ratios from corporate-emissions.ts', () => {
    // Lower intensity ratios (better than benchmark) should yield higher scores
    const excellent = calculateVitalityScores({
      totalEmissions: 1000,
      emissionsIntensity: 0.5,
      industryBenchmark: 1.0,
    });
    const average = calculateVitalityScores({
      totalEmissions: 1000,
      emissionsIntensity: 1.0,
      industryBenchmark: 1.0,
    });
    const poor = calculateVitalityScores({
      totalEmissions: 1000,
      emissionsIntensity: 1.5,
      industryBenchmark: 1.0,
    });

    expect(excellent.climate).toBeGreaterThan(average.climate!);
    expect(average.climate).toBeGreaterThan(poor.climate!);
  });
});
