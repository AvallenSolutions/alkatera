/**
 * Unit Tests for Nature & Biodiversity Calculation Service
 *
 * Tests cover:
 * - ReCiPe 2016 category definitions
 * - Performance threshold evaluation
 * - EF 3.1 normalisation and weighting
 * - UI helper functions
 * - Compliance documentation
 */

import { describe, it, expect } from 'vitest';

import {
  // Constants
  RECIPE_2016_CATEGORIES,
  NATURE_PERFORMANCE_THRESHOLDS,
  LAND_INTENSITY_THRESHOLDS,
  EF31_NORMALISATION_FACTORS,
  EF31_WEIGHTING_FACTORS,
  // Types
  type NatureImpactCategory,
  type PerformanceLevel,
  type LandIntensityLevel,
  // Core functions
  getPerformanceLevel,
  getThresholdsForCategory,
  getLandIntensityLevel,
  normaliseImpact,
  weightImpact,
  // UI helpers
  getPerformanceColorClass,
  getPerformanceBgColorClass,
  getPerformanceBarColorClass,
  getPerformanceLabel,
  getLandIntensityColorClass,
  getLandIntensityLabel,
  formatImpactValue,
  getTargetGuidanceText,
  getCategoryInfo,
  // Compliance
  getMethodologyDocumentation,
  getTNFDLEAPStatus,
} from '../nature-biodiversity';

// ============================================================================
// RECIPE 2016 CATEGORY DEFINITIONS
// ============================================================================

describe('ReCiPe 2016 Category Definitions', () => {
  describe('RECIPE_2016_CATEGORIES', () => {
    it('should have all four nature impact categories', () => {
      expect(RECIPE_2016_CATEGORIES).toHaveProperty('LAND_USE');
      expect(RECIPE_2016_CATEGORIES).toHaveProperty('TERRESTRIAL_ECOTOXICITY');
      expect(RECIPE_2016_CATEGORIES).toHaveProperty('FRESHWATER_EUTROPHICATION');
      expect(RECIPE_2016_CATEGORIES).toHaveProperty('TERRESTRIAL_ACIDIFICATION');
    });

    it('should have correct unit for Land Use', () => {
      expect(RECIPE_2016_CATEGORIES.LAND_USE.unit).toBe('m²a crop eq');
      expect(RECIPE_2016_CATEGORIES.LAND_USE.unitShort).toBe('m²a');
      expect(RECIPE_2016_CATEGORIES.LAND_USE.code).toBe('LU');
    });

    it('should have correct unit for Terrestrial Ecotoxicity', () => {
      expect(RECIPE_2016_CATEGORIES.TERRESTRIAL_ECOTOXICITY.unit).toBe('kg 1,4-DCB eq');
      expect(RECIPE_2016_CATEGORIES.TERRESTRIAL_ECOTOXICITY.unitShort).toBe('kg DCB');
      expect(RECIPE_2016_CATEGORIES.TERRESTRIAL_ECOTOXICITY.code).toBe('TETPinf');
    });

    it('should have correct unit for Freshwater Eutrophication', () => {
      expect(RECIPE_2016_CATEGORIES.FRESHWATER_EUTROPHICATION.unit).toBe('kg P eq');
      expect(RECIPE_2016_CATEGORIES.FRESHWATER_EUTROPHICATION.code).toBe('FEP');
    });

    it('should have correct unit for Terrestrial Acidification', () => {
      expect(RECIPE_2016_CATEGORIES.TERRESTRIAL_ACIDIFICATION.unit).toBe('kg SO₂ eq');
      expect(RECIPE_2016_CATEGORIES.TERRESTRIAL_ACIDIFICATION.unitShort).toBe('kg SO₂');
      expect(RECIPE_2016_CATEGORIES.TERRESTRIAL_ACIDIFICATION.code).toBe('TAP100');
    });

    it('should reference ReCiPe 2016 methodology', () => {
      expect(RECIPE_2016_CATEGORIES.LAND_USE.methodology).toContain('ReCiPe 2016');
      expect(RECIPE_2016_CATEGORIES.FRESHWATER_EUTROPHICATION.methodology).toContain('ReCiPe 2016');
    });
  });
});

// ============================================================================
// PERFORMANCE THRESHOLDS
// ============================================================================

describe('Performance Thresholds', () => {
  describe('NATURE_PERFORMANCE_THRESHOLDS', () => {
    it('should have EXCELLENT threshold lower than GOOD for all categories', () => {
      expect(NATURE_PERFORMANCE_THRESHOLDS.LAND_USE.EXCELLENT)
        .toBeLessThan(NATURE_PERFORMANCE_THRESHOLDS.LAND_USE.GOOD);
      expect(NATURE_PERFORMANCE_THRESHOLDS.TERRESTRIAL_ECOTOXICITY.EXCELLENT)
        .toBeLessThan(NATURE_PERFORMANCE_THRESHOLDS.TERRESTRIAL_ECOTOXICITY.GOOD);
      expect(NATURE_PERFORMANCE_THRESHOLDS.FRESHWATER_EUTROPHICATION.EXCELLENT)
        .toBeLessThan(NATURE_PERFORMANCE_THRESHOLDS.FRESHWATER_EUTROPHICATION.GOOD);
      expect(NATURE_PERFORMANCE_THRESHOLDS.TERRESTRIAL_ACIDIFICATION.EXCELLENT)
        .toBeLessThan(NATURE_PERFORMANCE_THRESHOLDS.TERRESTRIAL_ACIDIFICATION.GOOD);
    });

    it('should have documented source for each threshold', () => {
      expect(NATURE_PERFORMANCE_THRESHOLDS.LAND_USE.source).toBeDefined();
      expect(NATURE_PERFORMANCE_THRESHOLDS.LAND_USE.source).toContain('benchmark');
      expect(NATURE_PERFORMANCE_THRESHOLDS.TERRESTRIAL_ECOTOXICITY.source).toBeDefined();
      expect(NATURE_PERFORMANCE_THRESHOLDS.FRESHWATER_EUTROPHICATION.source).toBeDefined();
      expect(NATURE_PERFORMANCE_THRESHOLDS.TERRESTRIAL_ACIDIFICATION.source).toBeDefined();
    });

    it('should have reasonable threshold values', () => {
      // Land Use: 500/2000 m²a/unit
      expect(NATURE_PERFORMANCE_THRESHOLDS.LAND_USE.EXCELLENT).toBe(500);
      expect(NATURE_PERFORMANCE_THRESHOLDS.LAND_USE.GOOD).toBe(2000);

      // Ecotoxicity: 5/15 kg DCB/unit
      expect(NATURE_PERFORMANCE_THRESHOLDS.TERRESTRIAL_ECOTOXICITY.EXCELLENT).toBe(5);
      expect(NATURE_PERFORMANCE_THRESHOLDS.TERRESTRIAL_ECOTOXICITY.GOOD).toBe(15);

      // Eutrophication: 0.3/0.7 kg P eq/unit
      expect(NATURE_PERFORMANCE_THRESHOLDS.FRESHWATER_EUTROPHICATION.EXCELLENT).toBe(0.3);
      expect(NATURE_PERFORMANCE_THRESHOLDS.FRESHWATER_EUTROPHICATION.GOOD).toBe(0.7);

      // Acidification: 1.5/3.0 kg SO2/unit
      expect(NATURE_PERFORMANCE_THRESHOLDS.TERRESTRIAL_ACIDIFICATION.EXCELLENT).toBe(1.5);
      expect(NATURE_PERFORMANCE_THRESHOLDS.TERRESTRIAL_ACIDIFICATION.GOOD).toBe(3.0);
    });
  });

  describe('LAND_INTENSITY_THRESHOLDS', () => {
    it('should have correct thresholds', () => {
      expect(LAND_INTENSITY_THRESHOLDS.LOW).toBe(5);
      expect(LAND_INTENSITY_THRESHOLDS.MEDIUM).toBe(15);
    });
  });
});

// ============================================================================
// EF 3.1 NORMALISATION AND WEIGHTING
// ============================================================================

describe('EF 3.1 Factors', () => {
  describe('Normalisation Factors', () => {
    it('should have correct normalisation factors (EU-27+UK 2010 baseline)', () => {
      expect(EF31_NORMALISATION_FACTORS.LAND_USE).toBe(819000);
      expect(EF31_NORMALISATION_FACTORS.TERRESTRIAL_ECOTOXICITY).toBe(28700);
      expect(EF31_NORMALISATION_FACTORS.FRESHWATER_EUTROPHICATION).toBe(1.61);
      expect(EF31_NORMALISATION_FACTORS.TERRESTRIAL_ACIDIFICATION).toBe(55.6);
    });
  });

  describe('Weighting Factors', () => {
    it('should have correct weighting factors', () => {
      expect(EF31_WEIGHTING_FACTORS.LAND_USE).toBe(0.0794);
      expect(EF31_WEIGHTING_FACTORS.TERRESTRIAL_ECOTOXICITY).toBe(0.0187);
      expect(EF31_WEIGHTING_FACTORS.FRESHWATER_EUTROPHICATION).toBe(0.028);
      expect(EF31_WEIGHTING_FACTORS.TERRESTRIAL_ACIDIFICATION).toBe(0.0621);
    });

    it('should have weighting factors between 0 and 1', () => {
      Object.values(EF31_WEIGHTING_FACTORS).forEach((weight) => {
        expect(weight).toBeGreaterThan(0);
        expect(weight).toBeLessThan(1);
      });
    });
  });
});

// ============================================================================
// CORE CALCULATION FUNCTIONS
// ============================================================================

describe('Core Calculation Functions', () => {
  describe('getPerformanceLevel', () => {
    it('should return excellent for values below EXCELLENT threshold', () => {
      expect(getPerformanceLevel('land_use', 400)).toBe('excellent');
      expect(getPerformanceLevel('terrestrial_ecotoxicity', 3)).toBe('excellent');
      expect(getPerformanceLevel('freshwater_eutrophication', 0.2)).toBe('excellent');
      expect(getPerformanceLevel('terrestrial_acidification', 1.0)).toBe('excellent');
    });

    it('should return good for values between EXCELLENT and GOOD thresholds', () => {
      expect(getPerformanceLevel('land_use', 1000)).toBe('good');
      expect(getPerformanceLevel('terrestrial_ecotoxicity', 10)).toBe('good');
      expect(getPerformanceLevel('freshwater_eutrophication', 0.5)).toBe('good');
      expect(getPerformanceLevel('terrestrial_acidification', 2.0)).toBe('good');
    });

    it('should return needs_improvement for values above GOOD threshold', () => {
      expect(getPerformanceLevel('land_use', 3000)).toBe('needs_improvement');
      expect(getPerformanceLevel('terrestrial_ecotoxicity', 20)).toBe('needs_improvement');
      expect(getPerformanceLevel('freshwater_eutrophication', 1.0)).toBe('needs_improvement');
      expect(getPerformanceLevel('terrestrial_acidification', 5.0)).toBe('needs_improvement');
    });

    it('should handle boundary values correctly', () => {
      // At EXCELLENT threshold = good (not excellent)
      expect(getPerformanceLevel('land_use', 500)).toBe('good');
      // Just below EXCELLENT threshold = excellent
      expect(getPerformanceLevel('land_use', 499.99)).toBe('excellent');
      // At GOOD threshold = needs_improvement
      expect(getPerformanceLevel('land_use', 2000)).toBe('needs_improvement');
    });
  });

  describe('getThresholdsForCategory', () => {
    it('should return correct thresholds for land_use', () => {
      const thresholds = getThresholdsForCategory('land_use');
      expect(thresholds.excellent).toBe(500);
      expect(thresholds.good).toBe(2000);
      expect(thresholds.source).toBeDefined();
    });

    it('should return correct thresholds for terrestrial_ecotoxicity', () => {
      const thresholds = getThresholdsForCategory('terrestrial_ecotoxicity');
      expect(thresholds.excellent).toBe(5);
      expect(thresholds.good).toBe(15);
    });

    it('should return correct thresholds for freshwater_eutrophication', () => {
      const thresholds = getThresholdsForCategory('freshwater_eutrophication');
      expect(thresholds.excellent).toBe(0.3);
      expect(thresholds.good).toBe(0.7);
    });

    it('should return correct thresholds for terrestrial_acidification', () => {
      const thresholds = getThresholdsForCategory('terrestrial_acidification');
      expect(thresholds.excellent).toBe(1.5);
      expect(thresholds.good).toBe(3.0);
    });
  });

  describe('getLandIntensityLevel', () => {
    it('should return low for values below LOW threshold', () => {
      expect(getLandIntensityLevel(3)).toBe('low');
      expect(getLandIntensityLevel(4.99)).toBe('low');
    });

    it('should return medium for values between LOW and MEDIUM thresholds', () => {
      expect(getLandIntensityLevel(5)).toBe('medium');
      expect(getLandIntensityLevel(10)).toBe('medium');
      expect(getLandIntensityLevel(14.99)).toBe('medium');
    });

    it('should return high for values at or above MEDIUM threshold', () => {
      expect(getLandIntensityLevel(15)).toBe('high');
      expect(getLandIntensityLevel(50)).toBe('high');
    });
  });

  describe('normaliseImpact', () => {
    it('should calculate person-equivalents for land use', () => {
      // 819 m²a / 819000 person-eq = 0.001 person-eq
      const normalised = normaliseImpact('land_use', 819);
      expect(normalised).toBeCloseTo(0.001, 5);
    });

    it('should calculate person-equivalents for eutrophication', () => {
      // 1.61 kg P eq / 1.61 person-eq = 1 person-eq
      const normalised = normaliseImpact('freshwater_eutrophication', 1.61);
      expect(normalised).toBeCloseTo(1, 5);
    });

    it('should handle zero values', () => {
      expect(normaliseImpact('land_use', 0)).toBe(0);
    });
  });

  describe('weightImpact', () => {
    it('should apply correct weighting factor', () => {
      // 1 person-eq * 0.0794 = 0.0794
      const weighted = weightImpact('land_use', 1);
      expect(weighted).toBe(0.0794);
    });

    it('should handle zero values', () => {
      expect(weightImpact('land_use', 0)).toBe(0);
    });
  });
});

// ============================================================================
// UI HELPER FUNCTIONS
// ============================================================================

describe('UI Helper Functions', () => {
  describe('getPerformanceColorClass', () => {
    it('should return green for excellent', () => {
      expect(getPerformanceColorClass('excellent')).toBe('text-green-600');
    });

    it('should return emerald for good', () => {
      expect(getPerformanceColorClass('good')).toBe('text-emerald-600');
    });

    it('should return amber for needs_improvement', () => {
      expect(getPerformanceColorClass('needs_improvement')).toBe('text-amber-600');
    });
  });

  describe('getPerformanceBgColorClass', () => {
    it('should return correct background colors', () => {
      expect(getPerformanceBgColorClass('excellent')).toBe('bg-green-100');
      expect(getPerformanceBgColorClass('good')).toBe('bg-emerald-100');
      expect(getPerformanceBgColorClass('needs_improvement')).toBe('bg-amber-100');
    });
  });

  describe('getPerformanceBarColorClass', () => {
    it('should return correct bar colors', () => {
      expect(getPerformanceBarColorClass('excellent')).toBe('bg-green-500');
      expect(getPerformanceBarColorClass('good')).toBe('bg-emerald-500');
      expect(getPerformanceBarColorClass('needs_improvement')).toBe('bg-amber-500');
    });
  });

  describe('getPerformanceLabel', () => {
    it('should return human-readable labels', () => {
      expect(getPerformanceLabel('excellent')).toBe('Excellent');
      expect(getPerformanceLabel('good')).toBe('Good');
      expect(getPerformanceLabel('needs_improvement')).toBe('Needs Improvement');
    });
  });

  describe('getLandIntensityColorClass', () => {
    it('should return correct colors', () => {
      expect(getLandIntensityColorClass('low')).toBe('text-green-600');
      expect(getLandIntensityColorClass('medium')).toBe('text-amber-600');
      expect(getLandIntensityColorClass('high')).toBe('text-red-600');
    });
  });

  describe('getLandIntensityLabel', () => {
    it('should return human-readable labels', () => {
      expect(getLandIntensityLabel('low')).toBe('Low Impact');
      expect(getLandIntensityLabel('medium')).toBe('Medium Impact');
      expect(getLandIntensityLabel('high')).toBe('High Impact');
    });
  });

  describe('formatImpactValue', () => {
    it('should format large values with 2 decimal places', () => {
      expect(formatImpactValue(123.456)).toBe('123.46');
      expect(formatImpactValue(1.234)).toBe('1.23');
    });

    it('should format medium values with 3 decimal places', () => {
      expect(formatImpactValue(0.1234)).toBe('0.123');
      expect(formatImpactValue(0.0123)).toBe('0.012');
    });

    it('should format small values with 4 decimal places', () => {
      expect(formatImpactValue(0.001234)).toBe('0.0012');
      expect(formatImpactValue(0.000123)).toBe('0.0001');
    });
  });

  describe('getTargetGuidanceText', () => {
    it('should return formatted guidance text for land_use', () => {
      const text = getTargetGuidanceText('land_use');
      expect(text).toContain('Excellent: <500');
      expect(text).toContain('Good: 500-2000');
      expect(text).toContain('m²a/unit');
    });

    it('should return formatted guidance text for freshwater_eutrophication', () => {
      const text = getTargetGuidanceText('freshwater_eutrophication');
      expect(text).toContain('Excellent: <0.3');
      expect(text).toContain('Good: 0.3-0.7');
      expect(text).toContain('kg P eq/unit');
    });
  });

  describe('getCategoryInfo', () => {
    it('should return correct category info for each type', () => {
      expect(getCategoryInfo('land_use').name).toBe('Land Use');
      expect(getCategoryInfo('terrestrial_ecotoxicity').code).toBe('TETPinf');
      expect(getCategoryInfo('freshwater_eutrophication').unit).toBe('kg P eq');
      expect(getCategoryInfo('terrestrial_acidification').referenceSubstance).toBe('Sulfur dioxide');
    });
  });
});

// ============================================================================
// COMPLIANCE DOCUMENTATION
// ============================================================================

describe('Compliance Documentation', () => {
  describe('getMethodologyDocumentation', () => {
    const docs = getMethodologyDocumentation();

    it('should reference CSRD ESRS E4', () => {
      expect(docs.disclosureStandard).toContain('ESRS E4');
    });

    it('should list all E4 disclosure requirements', () => {
      expect(docs.disclosureRequirements).toHaveProperty('E4-1');
      expect(docs.disclosureRequirements).toHaveProperty('E4-4');
      expect(docs.disclosureRequirements).toHaveProperty('E4-5');
    });

    it('should reference ReCiPe 2016 methodology', () => {
      expect(docs.impactAssessment.methodology).toContain('ReCiPe 2016');
      expect(docs.impactAssessment.source).toContain('rivm.nl');
    });

    it('should include all four impact categories', () => {
      expect(docs.impactAssessment.categories).toHaveLength(4);
      expect(docs.impactAssessment.categories).toContain('Land Use (m²a crop eq)');
      expect(docs.impactAssessment.categories).toContain('Terrestrial Ecotoxicity (kg 1,4-DCB eq)');
    });

    it('should include TNFD alignment information', () => {
      expect(docs.tnfdAlignment.framework).toContain('LEAP');
      expect(docs.tnfdAlignment.currentCoverage).toHaveProperty('Locate');
      expect(docs.tnfdAlignment.currentCoverage).toHaveProperty('Evaluate');
    });

    it('should include disclaimers about benchmark limitations', () => {
      expect(docs.disclaimers.length).toBeGreaterThan(0);
      expect(docs.disclaimers.some(d => d.includes('internal benchmark'))).toBe(true);
      expect(docs.disclaimers.some(d => d.includes('TNFD'))).toBe(true);
    });

    it('should include data source priority information', () => {
      expect(docs.dataSources.primary).toContain('EPD');
      expect(docs.dataSources.secondary).toContain('Ecoinvent');
      expect(docs.dataSources.fallback).toContain('staging_emission_factors');
    });

    it('should include reference URLs', () => {
      expect(docs.references.recipe2016).toContain('springer.com');
      expect(docs.references.tnfd).toContain('tnfd.global');
      expect(docs.references.sbtn).toContain('sciencebasedtargets');
    });
  });

  describe('getTNFDLEAPStatus', () => {
    const status = getTNFDLEAPStatus();

    it('should reference TNFD LEAP framework', () => {
      expect(status.framework).toBe('TNFD LEAP');
      expect(status.version).toContain('v1.0');
    });

    it('should have status for all four phases', () => {
      expect(status.phases).toHaveProperty('Locate');
      expect(status.phases).toHaveProperty('Evaluate');
      expect(status.phases).toHaveProperty('Assess');
      expect(status.phases).toHaveProperty('Prepare');
    });

    it('should indicate Evaluate phase is implemented', () => {
      expect(status.phases.Evaluate.status).toBe('Implemented');
      expect(status.phases.Evaluate.implemented.length).toBeGreaterThan(0);
    });

    it('should indicate Assess phase is not implemented', () => {
      expect(status.phases.Assess.status).toBe('Not Implemented');
      expect(status.phases.Assess.gaps.length).toBeGreaterThan(0);
    });

    it('should list implementation gaps', () => {
      expect(status.phases.Locate.gaps).toContain('Geospatial biodiversity analysis');
      expect(status.phases.Assess.gaps).toContain('Physical risk assessment');
    });
  });
});

// ============================================================================
// INTEGRATION SCENARIOS
// ============================================================================

describe('Integration Scenarios', () => {
  describe('Full impact assessment workflow', () => {
    it('should correctly assess a low-impact product', () => {
      const metrics = {
        land_use: 300, // Below excellent threshold
        terrestrial_ecotoxicity: 3,
        freshwater_eutrophication: 0.2,
        terrestrial_acidification: 1.0,
      };

      expect(getPerformanceLevel('land_use', metrics.land_use)).toBe('excellent');
      expect(getPerformanceLevel('terrestrial_ecotoxicity', metrics.terrestrial_ecotoxicity)).toBe('excellent');
      expect(getPerformanceLevel('freshwater_eutrophication', metrics.freshwater_eutrophication)).toBe('excellent');
      expect(getPerformanceLevel('terrestrial_acidification', metrics.terrestrial_acidification)).toBe('excellent');
    });

    it('should correctly assess a high-impact product', () => {
      const metrics = {
        land_use: 3000, // Above good threshold
        terrestrial_ecotoxicity: 25,
        freshwater_eutrophication: 1.5,
        terrestrial_acidification: 5.0,
      };

      expect(getPerformanceLevel('land_use', metrics.land_use)).toBe('needs_improvement');
      expect(getPerformanceLevel('terrestrial_ecotoxicity', metrics.terrestrial_ecotoxicity)).toBe('needs_improvement');
      expect(getPerformanceLevel('freshwater_eutrophication', metrics.freshwater_eutrophication)).toBe('needs_improvement');
      expect(getPerformanceLevel('terrestrial_acidification', metrics.terrestrial_acidification)).toBe('needs_improvement');
    });

    it('should correctly assess a mixed-performance product', () => {
      const metrics = {
        land_use: 300, // Excellent
        terrestrial_ecotoxicity: 10, // Good
        freshwater_eutrophication: 1.0, // Needs improvement
        terrestrial_acidification: 2.0, // Good
      };

      expect(getPerformanceLevel('land_use', metrics.land_use)).toBe('excellent');
      expect(getPerformanceLevel('terrestrial_ecotoxicity', metrics.terrestrial_ecotoxicity)).toBe('good');
      expect(getPerformanceLevel('freshwater_eutrophication', metrics.freshwater_eutrophication)).toBe('needs_improvement');
      expect(getPerformanceLevel('terrestrial_acidification', metrics.terrestrial_acidification)).toBe('good');
    });
  });

  describe('EF 3.1 single score calculation', () => {
    it('should calculate weighted single score correctly', () => {
      // Example: 1000 m²a land use
      const landUse = 1000;
      const normalised = normaliseImpact('land_use', landUse);
      const weighted = weightImpact('land_use', normalised);

      // 1000 / 819000 * 0.0794 = ~0.000097
      expect(weighted).toBeCloseTo(0.0000969, 6);
    });

    it('should sum weighted scores for total environmental footprint', () => {
      const metrics = {
        land_use: 1000,
        terrestrial_ecotoxicity: 10,
        freshwater_eutrophication: 0.5,
        terrestrial_acidification: 2.0,
      };

      const categories: NatureImpactCategory[] = [
        'land_use',
        'terrestrial_ecotoxicity',
        'freshwater_eutrophication',
        'terrestrial_acidification',
      ];

      let totalScore = 0;
      categories.forEach((cat) => {
        const value = metrics[cat];
        const normalised = normaliseImpact(cat, value);
        const weighted = weightImpact(cat, normalised);
        totalScore += weighted;
      });

      // Should be a small positive number
      expect(totalScore).toBeGreaterThan(0);
      expect(totalScore).toBeLessThan(1);
    });
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle zero values', () => {
    expect(getPerformanceLevel('land_use', 0)).toBe('excellent');
    expect(normaliseImpact('land_use', 0)).toBe(0);
    expect(weightImpact('land_use', 0)).toBe(0);
  });

  it('should handle very large values', () => {
    expect(getPerformanceLevel('land_use', 1000000)).toBe('needs_improvement');
    const normalised = normaliseImpact('land_use', 1000000);
    expect(normalised).toBeGreaterThan(1);
  });

  it('should handle very small values', () => {
    expect(getPerformanceLevel('freshwater_eutrophication', 0.0001)).toBe('excellent');
    expect(formatImpactValue(0.00001)).toBe('0.0000');
  });

  it('should handle negative values gracefully', () => {
    // Negative values shouldn't occur in practice, but should not crash
    expect(getPerformanceLevel('land_use', -100)).toBe('excellent');
  });
});
